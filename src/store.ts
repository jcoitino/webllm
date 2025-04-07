// src/store.ts
import { makeAutoObservable, runInAction } from 'mobx';
import * as webllm from '@mlc-ai/web-llm';
import type { ChatMessage } from './components/chat-log';

export class Store {
    #worker: Worker | null = null;
    #engine: webllm.MLCEngineInterface | null = null;
    models = [...webllm.prebuiltAppConfig.model_list]
        .sort((a, b) => (a?.vram_required_MB ?? 0) - (b?.vram_required_MB ?? 0))
        .filter(m => m.vram_required_MB && m.vram_required_MB < 5000 && m.model_type !== 1 && m.model_id.includes("q4f16"))
        .map(({ model_id, vram_required_MB }) => ({ id: model_id, displayName: `${model_id} - ${vram_required_MB}MB` }));
    selectedModelId = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
    engineStatus = 'Not loaded';
    engineProgress = 0;
    isGenerating = false;
    messages = new Array<ChatMessage>();
    modelLoadTimeMs: number | null = null;
    systemPrompt = `Your primary function is to classify the user's input into one of three categories: 'QUESTION', 'ACTION', or 'NOSENSE'.

Definitions:
- QUESTION: The user is primarily asking for information, guidance, seeking clarification, definitions, facts, or asking about how to do something or something works.
- ACTION: The user is requesting to perform a task, like create a page or screen, add, remove or modify some components from existing screen, replace some UI fragment by some different one, etc.
- NOSENSE: The user's input is gibberish, incoherent, lacks clear meaning, or doesn't represent a question or an actionable request.

Analyze the user's prompt and determine its primary intent based on these definitions.

You MUST respond ONLY with a valid JSON object containing the classification. Adhere strictly to the following JSON schema:
\`\`\`json
{
  "type": "object",
  "properties": {
    "classification": { "type": "string", "description": "The classification of the user's prompt.", "enum": ["QUESTION", "ACTION", "NOSENSE"] },
    "translation":    { "type": "string", "description": "English translation of the user's prompt." }
  },
  "required": ["classification", "translation"],
  "additionalProperties": false
}
\`\`\`
`;

    constructor() {
        makeAutoObservable(this);
        this.#worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        if (this.selectedModelId) {
            this.loadModel(this.selectedModelId);
        } else {
            runInAction(() => {
                this.engineStatus = 'No model selected';
            });
        }
    }

    loadModel(modelId: string) {
        runInAction(() => {
            this.selectedModelId = modelId;
            this.engineStatus = `Loading ${modelId}...`;
            this.engineProgress = 0;
            this.messages = [];
            this.modelLoadTimeMs = null;
            this.isGenerating = false;
        });

        const startTime = performance.now();
        this.initializeEngine(modelId)
            .then(() => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                runInAction(() => {
                    if (this.selectedModelId === modelId) {
                        this.modelLoadTimeMs = duration;
                        this.engineStatus = `${modelId} loaded.`;
                        this.engineProgress = 1;
                    }
                });
            })
            .catch(err => {
                console.error(`Error loading model ${modelId}:`, err);
                runInAction(() => {
                     if (this.selectedModelId === modelId) {
                        this.engineProgress = 0;
                        this.engineStatus = `Failed to load ${modelId}. Check console.`;
                        this.modelLoadTimeMs = null;
                        this.#engine = null;
                    }
                });
            });
    }

    setSystemPrompt(prompt: string) {
        const newPrompt = prompt.trim();
        if (newPrompt !== this.systemPrompt) {
            runInAction(() => {
                this.systemPrompt = newPrompt;
                this.messages = [];
            });
            if (this.#engine) {
                this.#engine.resetChat()
                    .then(() => console.log('WebLLM chat context reset after prompt update.'))
                    .catch(err => console.error('Error resetting WebLLM chat context:', err));
            }
        }
    }

    resetChat() {
        runInAction(() => {
            this.messages = [];
            this.isGenerating = false;
        });
        if (this.#engine) {
            this.#engine.resetChat().catch(err => console.error('Error resetting WebLLM chat context:', err));
        }
    }

    async sendMessage(usrPrompt: string) {
        const currentSysPrompt = this.systemPrompt;
        const currentUsrPrompt = usrPrompt.trim();
        if (!this.#engine) {
             console.warn('Engine not ready. Cannot send message.');
             alert('Error: Model is not loaded or ready.');
             return;
        }
        if (!currentUsrPrompt) {
            console.warn('User prompt is empty. Cannot send message.');
            return;
        }
        if (this.isGenerating) {
             console.warn('Already generating a response. Please wait.');
             return;
        }
        runInAction(() => {
            this.isGenerating = true;
            this.messages = [...this.messages, { role: 'user', content: currentUsrPrompt }];
        });

        let response = '';
        let duration = 0;
        try {
            const request: webllm.ChatCompletionRequest = {
                messages: [
                    { role: 'system', content: currentSysPrompt },
                    { role: 'user', content: currentUsrPrompt },
                ],
                n: 1,
                temperature: 0.7,
                max_tokens: 500, 
                response_format: { type: "json_object" },
            };

            const startTime = performance.now();
            const completion = await this.#engine.chat.completions.create(request);
            const endTime = performance.now();
            duration = endTime - startTime;
            response = completion.choices[0]?.message?.content ?? '';
            const formattedResponse = this.formatResponse(response);
            runInAction(() => {
                 this.messages = [
                     ...this.messages,
                     {
                         role: 'assistant',
                         content: formattedResponse,
                         executionTimeMs: duration
                     },
                 ];
                this.isGenerating = false;
            });

        } catch (error: any) {
            console.error("Error during chat completion:", error);
            runInAction(() => {
                 this.messages = [...this.messages, {
                     role: 'system',
                     content: `Error generating response: ${error.message || 'Unknown error'}`
                 }];
                 this.isGenerating = false;
            });
        }
    }

    private async initializeEngine(selectedModel: string) {
        if (this.#engine) {
            await this.#engine.unload();
            this.#engine = null;
        }
        const initProgressCallback = (report: webllm.InitProgressReport) => {
            runInAction(() => {
                if (this.selectedModelId === selectedModel && this.modelLoadTimeMs === null) {
                    this.engineStatus = report.text;
                    const match = report.text.match(/\[(\d+)\/(\d+)\]/);
                    if (match) {
                        const current = parseInt(match[1], 10);
                        const total = parseInt(match[2], 10);
                        this.engineProgress = total > 0 ? current / total : 0;
                    } else if (report.text.includes("Fetching")) {
                        this.engineProgress = Math.max(this.engineProgress, 0.1);
                    } else if (report.text.includes("Initializing")) {
                         this.engineProgress = Math.max(this.engineProgress, 0.9);
                    }
                }
            });
        }

        if (!this.#worker) {
            throw new Error("Web Worker is not initialized.");
        }

        this.#engine = await webllm.CreateWebWorkerMLCEngine(
            this.#worker,
            selectedModel,
            { initProgressCallback: initProgressCallback }
        );
    }

     private formatResponse(response: string): string {
        try {
            const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
            const jsonMatch = response.match(jsonRegex);
            let potentialJson = response.trim();

            if (jsonMatch && jsonMatch[1]) {
                 potentialJson = jsonMatch[1].trim();
            }

            if (!jsonMatch) {
                const firstBrace = potentialJson.indexOf('{');
                const lastBrace = potentialJson.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    potentialJson = potentialJson.substring(firstBrace, lastBrace + 1);
                } else {
                     console.warn('Could not find JSON structure in response:', response);
                     return response;
                }
            }

            const jsonResponse = JSON.parse(potentialJson);
            if (typeof jsonResponse === 'object' && jsonResponse !== null &&
                typeof jsonResponse.classification === 'string' &&
                typeof jsonResponse.translation === 'string' &&
                ["QUESTION", "ACTION", "NOSENSE"].includes(jsonResponse.classification))
            {
                return JSON.stringify(jsonResponse, null, 2);
            } else {
                console.warn('Parsed JSON does not match expected schema:', jsonResponse);
                return `Warning: Response structure mismatch.\nRaw JSON:\n${JSON.stringify(jsonResponse, null, 2)}`;
            }
        } catch (error) {
            console.error('Error parsing LLM response:', error, "\nRaw response:", response);
            return `Error: Could not parse AI response as JSON.\nRaw response:\n${response}`;
        }
    }
}

export const chatStore = new Store();