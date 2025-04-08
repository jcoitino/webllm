// src/store.ts
import * as webllm from '@mlc-ai/web-llm';
import { makeAutoObservable, runInAction } from 'mobx';
import type { ChatMessage, AppModel, LLMClassificationResponse, GpuAdapterInfo } from './types';

// --- Configuration Constants ---
const DEFAULT_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
const MAX_VRAM_MB_FILTER = 20000;
const ALLOWED_QUANTIZATION_FILTER = "q4f16_1";
const MODEL_TYPE_FILTER = 1;
const DEFAULT_SYSTEM_PROMPT = `Your primary function is to classify the user's input into one of three categories: 'QUESTION', 'ACTION', or 'NOSENSE'.

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
const CHAT_TEMPERATURE = 0.7;
const MAX_COMPLETION_TOKENS = 500;
const MIN_WARN_DEVICE_MEMORY_GB = 4;
// --- End Configuration Constants ---

export class Store {
    #worker: Worker | null = null;
    #engine: webllm.MLCEngineInterface | null = null;

    // --- Observable State ---
    models: AppModel[] = [];
    selectedModelId = '';
    engineStatus = 'Initializing...';
    engineProgress = 0;
    isGenerating = false;
    messages: ChatMessage[] = [];
    modelLoadTimeMs: number | null = null;
    systemPrompt = DEFAULT_SYSTEM_PROMPT;

    // Compatibility & Info State
    isWebGPUSupported: boolean | null = null;
    gpuAdapterInfo: GpuAdapterInfo | null = null;
    estimatedDeviceMemoryGB: number | null = null;
    selectedModelVramRequirementMB: number | null = null;
    compatibilityError: string | null = null;

    // Specific Error States
    modelLoadError: string | null = null;
    chatError: string | null = null;
    workerError: string | null = null;
    // --- End Observable State ---

    constructor() {
        // Automatically make properties observable, inferring actions.
        makeAutoObservable(this, {});
        this.#initializeWorker();
        // Asynchronously check compatibility and load the initial configuration.
        this.checkCompatibilityAndLoadInitialModel();
    }

    async checkCompatibilityAndLoadInitialModel() {
        runInAction(() => {
            this.engineStatus = 'Checking browser compatibility...';
        });

        // 1. Check WebGPU Support
        if (!navigator.gpu) {
            runInAction(() => {
                this.isWebGPUSupported = false;
                this.compatibilityError = "WebGPU is not supported in this browser. This application requires WebGPU.";
                this.engineStatus = "Compatibility Check Failed";
            });
            console.error("WebGPU not supported.");
            return; // Stop initialization if WebGPU is missing
        }
        runInAction(() => {
            this.isWebGPUSupported = true;
        });

        // 2. Get GPU Adapter Info & Estimate Memory
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                throw new Error("Failed to get GPU adapter.");
            }

            let vendor = "N/A";
            let architecture = "N/A";
            let description: string | undefined = undefined;

            // Attempt to get detailed adapter info using standard API first
            if ((adapter as any).requestAdapterInfo) {
                 try {
                     const info = await (adapter as any).requestAdapterInfo();
                     vendor = info.vendor || "N/A";
                     architecture = info.architecture || "N/A";
                     description = info.description || undefined;
                     console.log("GPU Adapter Info:", info);
                 } catch (infoError) {
                     console.warn("adapter.requestAdapterInfo() failed:", infoError);
                     // Fallback to adapter name if info request fails
                     if ((adapter as any).name) { description = (adapter as any).name; }
                 }
            } else if ((adapter as any).info) { // Non-standard fallback
                 console.warn("Using non-standard adapter.info");
                 const info = (adapter as any).info;
                 vendor = info.vendor || "N/A";
                 architecture = info.architecture || "N/A";
                 description = info.description || undefined;
            } else if ((adapter as any).name) { // Basic fallback
                 description = (adapter as any).name;
            }

            // Process and store GPU info
            runInAction(() => {
                let displayArch = architecture;
                // Clean up description if it contains the vendor name
                if (description && vendor !== "N/A" && description.toLowerCase().includes(vendor.toLowerCase())) {
                    description = description.substring(vendor.length).trim();
                }
                // Use description if it's more descriptive than architecture
                if (description && description !== architecture) {
                   displayArch = description;
                }
                this.gpuAdapterInfo = { vendor, architecture: displayArch };
            });

            // Estimate device memory (System RAM)
            if ('deviceMemory' in navigator && typeof navigator.deviceMemory === 'number') {
                const memoryGB = navigator.deviceMemory;
                runInAction(() => {
                    this.estimatedDeviceMemoryGB = memoryGB;
                    let statusMsg = `Compatibility checks passed. GPU: ${this.gpuAdapterInfo?.vendor} / ${this.gpuAdapterInfo?.architecture}. System RAM: ~${this.estimatedDeviceMemoryGB}GB.`;
                    // Warn if estimated RAM is low
                    if (this.estimatedDeviceMemoryGB !== null && this.estimatedDeviceMemoryGB < MIN_WARN_DEVICE_MEMORY_GB) {
                        console.warn(`Low estimated system RAM (${this.estimatedDeviceMemoryGB}GB) may impact performance.`);
                        statusMsg += " (Note: Low system RAM)";
                    }
                    this.engineStatus = statusMsg;
                });
            } else {
                // Handle case where deviceMemory is not supported
                runInAction(() => {
                    this.engineStatus = `Compatibility checks passed. GPU: ${this.gpuAdapterInfo?.vendor} / ${this.gpuAdapterInfo?.architecture}. System RAM: Unknown.`;
                });
                console.warn("'navigator.deviceMemory' not supported or not a number, cannot estimate system RAM.");
            }

        } catch (err) {
            // Handle errors during GPU info retrieval
            console.error("Error during GPU adapter check:", err);
            runInAction(() => {
                this.compatibilityError = `Failed to access GPU information. ${err instanceof Error ? err.message : String(err)}`;
                this.engineStatus = "Compatibility Check Failed";
            });
        }

        // 3. Prepare Models and Load Initial (if compatible)
        this.prepareModels();

        const defaultModelExists = this.models.some(m => m.id === DEFAULT_MODEL_ID);
        const initialModelId = defaultModelExists ? DEFAULT_MODEL_ID : this.models[0]?.id;

        if (initialModelId && !this.compatibilityError) {
             // If a model is available and no compatibility errors, load it
             runInAction(() => {
                 this.selectedModelId = initialModelId;
                 this.engineStatus = `Select a model or load default: ${initialModelId}`;
             });
             this.loadModel(initialModelId);
        } else if (!initialModelId && !this.compatibilityError) {
            // Handle case where no suitable models are found
            runInAction(() => {
                this.engineStatus = 'No suitable models found!';
                this.modelLoadError = 'Could not find any models matching the specified criteria.';
                this.models = [];
            });
        } else if (this.compatibilityError) {
             // Log if loading is skipped due to prior errors
             console.log("Skipping initial model load due to compatibility error.");
        }
    }

    // Filters and prepares the list of models based on configuration constants
    prepareModels() {
         const filteredModels = [...webllm.prebuiltAppConfig.model_list]
            .sort((a, b) => (a?.vram_required_MB ?? 0) - (b?.vram_required_MB ?? 0))
            .filter(m =>
                m.vram_required_MB && m.vram_required_MB > 0 &&
                m.vram_required_MB < MAX_VRAM_MB_FILTER &&
                m.model_type !== MODEL_TYPE_FILTER &&
                m.model_id.includes(ALLOWED_QUANTIZATION_FILTER)
            )
            .map(({ model_id, vram_required_MB }) => ({
                id: model_id,
                displayName: `${model_id} (~${vram_required_MB}MB VRAM req.)`
            }));

         runInAction(() => {
            this.models = filteredModels;
         });
    }

    // Initializes the Web Worker and sets up error handling
    #initializeWorker() {
        try {
            this.#worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
            this.#worker.onerror = (event: Event | string) => {
                 console.error("Unhandled error in Web Worker:", event);
                 const errorMsg = event instanceof ErrorEvent
                     ? event.message
                     : typeof event === 'string'
                         ? event
                         : `An unknown error occurred in the Web Worker.`;
                 runInAction(() => {
                     this.workerError = errorMsg;
                     this.engineStatus = "Worker Error. Check console.";
                     this.isGenerating = false; // Stop generation on worker error
                     this.#engine = null;      // Engine is unusable
                     // Promote worker error to compatibility error if none exists
                     this.compatibilityError = this.compatibilityError || this.workerError;
                 });
            };
        } catch (error) {
            console.error("Failed to initialize Web Worker:", error);
             runInAction(() => {
                 const errorMsg = error instanceof Error ? error.message : 'Failed to create Web Worker.';
                 this.workerError = errorMsg;
                 this.engineStatus = "Failed to create worker. Check console.";
                 // Promote worker error to compatibility error
                 this.compatibilityError = this.compatibilityError || this.workerError;
             });
        }
    }

    // Loads the specified LLM model, including VRAM checks
    loadModel(modelId: string) {
        // --- Pre-flight Checks ---
        // Don't load if there's a non-memory compatibility error
        if (this.compatibilityError && !this.compatibilityError.startsWith("Insufficient memory")) {
            console.warn(`Skipping model load due to compatibility error: ${this.compatibilityError}`);
            runInAction(() => { this.engineStatus = `Cannot load model: ${this.compatibilityError}`; });
            return;
        }
        // Check if worker is available
        if (!this.#worker) {
            runInAction(() => { this.modelLoadError = "Web Worker is not available."; this.engineStatus = "Error: Worker not initialized."; });
            return;
        }
        // Find model configuration
        const modelInfo = webllm.prebuiltAppConfig.model_list.find(m => m.model_id === modelId);
        if (!modelInfo || !modelInfo.vram_required_MB) {
             console.warn(`Attempted to load invalid or misconfigured modelId: ${modelId}`);
             runInAction(() => {
                 this.modelLoadError = `Model configuration error for ${modelId}.`;
                 this.engineStatus = `Error: Invalid model selected.`;
                 this.selectedModelVramRequirementMB = null;
                 // Clear potential old VRAM error if model is invalid
                 if (this.compatibilityError?.startsWith("Insufficient memory")) this.compatibilityError = null;
             });
             return;
        }

        // --- VRAM Check ---
        const requiredVramMB = modelInfo.vram_required_MB;
        runInAction(() => {
            this.selectedModelVramRequirementMB = requiredVramMB;
            // Clear previous VRAM-specific error before re-checking
            if (this.compatibilityError?.startsWith("Insufficient memory")) {
                this.compatibilityError = null;
            }
        });

        if (this.estimatedDeviceMemoryGB !== null) {
            const availableMemoryMB = this.estimatedDeviceMemoryGB * 1024; // Convert GB to MB
            if (requiredVramMB > availableMemoryMB) {
                // If insufficient memory, set error and stop loading
                const errorMsg = `Insufficient memory for ${modelId}. Requires ~${requiredVramMB}MB, estimated available system RAM is ~${(availableMemoryMB).toFixed(0)}MB. Select a smaller model.`;
                console.warn(errorMsg);
                runInAction(() => {
                    this.compatibilityError = errorMsg;
                    this.engineStatus = "Error: Insufficient Memory";
                    this.modelLoadError = null; // This is a compatibility issue, not load fail
                    this.engineProgress = 0;
                    this.modelLoadTimeMs = null;
                });
                return; // Stop loading this model
            }
        } else {
            // Proceed if memory cannot be estimated, but warn user
            console.warn("Cannot estimate device memory. Proceeding without VRAM check for model:", modelId);
        }

        // --- Proceed with Loading ---
        runInAction(() => {
            // Reset state for the new load attempt
            this.modelLoadError = null;
            this.chatError = null;
            this.selectedModelId = modelId;
            this.engineStatus = `Loading ${modelId}...`;
            this.engineProgress = 0;
            this.messages = []; // Clear chat on new model load
            this.modelLoadTimeMs = null;
            this.isGenerating = false;
        });

        const startTime = performance.now();
        // Initialize or re-initialize the LLM engine
        this.#initializeEngine(modelId)
            .then(() => {
                // Handle successful load
                const endTime = performance.now();
                const duration = endTime - startTime;
                runInAction(() => {
                    // Ensure the model loaded is still the selected one and no errors occurred during load
                    if (this.selectedModelId === modelId && !this.compatibilityError && !this.modelLoadError) {
                        this.modelLoadTimeMs = duration;
                        this.engineStatus = `${modelId} loaded. Ready.`;
                        this.engineProgress = 1;
                        this.modelLoadError = null; // Explicitly clear error on success
                    } else {
                         console.log(`Model ${modelId} finished loading, but selection/state changed. Unloading.`);
                         // Unload the engine if selection changed or an error occurred meanwhile
                         this.#engine?.unload();
                    }
                });
            })
            .catch(err => {
                // Handle errors during engine initialization
                console.error(`Error loading model ${modelId}:`, err);
                 runInAction(() => {
                     // Update state only if this model is still the selected one
                     if (this.selectedModelId === modelId) {
                         this.engineProgress = 0;
                         const errorMsg = err instanceof Error ? err.message : String(err);
                         this.modelLoadError = `Failed to load ${modelId}: ${errorMsg}`;
                         // Don't overwrite a more specific compatibility error
                         if (!this.compatibilityError) {
                            this.engineStatus = `Failed to load ${modelId}. Check console.`;
                         }
                         this.modelLoadTimeMs = null;
                         this.#engine = null; // Engine failed to initialize
                     }
                 });
            });
    }

    // Updates the system prompt and resets the chat context
    setSystemPrompt(prompt: string) {
        const newPrompt = prompt.trim();
        if (newPrompt !== this.systemPrompt) {
            console.log('System prompt changed, resetting chat context.');
            runInAction(() => {
                this.systemPrompt = newPrompt;
                this.messages = []; // Clear messages
                this.chatError = null; // Clear chat errors
            });
            // Reset the LLM's internal context if the engine is loaded
            if (this.#engine) {
                this.#engine.resetChat()
                    .then(() => console.log('WebLLM chat context reset successfully.'))
                    .catch(err => console.error('Error resetting WebLLM chat context:', err));
            }
        }
    }

    // Resets the chat messages and LLM context
    resetChat() {
        runInAction(() => {
            this.messages = [];
            this.isGenerating = false;
            this.chatError = null;
        });
        if (this.#engine) {
            this.#engine.resetChat().catch(err => console.error('Error resetting WebLLM chat context:', err));
        }
    }

    // Sends a user message to the LLM for completion
    async sendMessage(usrPrompt: string) {
        // --- Pre-checks ---
        if (this.compatibilityError) {
             alert(`Error: Cannot send message. ${this.compatibilityError}`);
             return;
        }
        if (this.workerError) {
             alert(`Error: Worker issue prevents sending message: ${this.workerError}`);
             return;
        }
        if (this.modelLoadError || !this.#engine || this.engineProgress < 1) {
             alert('Error: Model is not loaded or ready.');
             return;
        }
        const currentUsrPrompt = usrPrompt.trim();
        if (!currentUsrPrompt) {
            console.warn('User prompt is empty.');
            return;
        }
        if (this.isGenerating) {
             console.warn('Already generating response.');
             return;
        }
        // --- End Pre-checks ---

        const currentSysPrompt = this.systemPrompt;

        runInAction(() => {
            this.isGenerating = true;
            this.chatError = null;
            // Add user message optimistically
            this.messages.push({ role: 'user', content: currentUsrPrompt });
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
                temperature: CHAT_TEMPERATURE,
                max_tokens: MAX_COMPLETION_TOKENS,
                response_format: { type: "json_object" }, // Specify JSON output
            };

            const startTime = performance.now();
            // Ensure engine exists via non-null assertion (checks performed above)
            const completion = await this.#engine!.chat.completions.create(request);
            const endTime = performance.now();
            duration = endTime - startTime;

            response = completion.choices[0]?.message?.content ?? '';
            const formattedResponse = this.#formatAndValidateJsonResponse(response);

            runInAction(() => {
                // Add assistant response to chat
                this.messages.push({
                    role: 'assistant',
                    content: formattedResponse,
                    executionTimeMs: duration
                });
                this.isGenerating = false;
            });

        } catch (error: any) {
            // Handle errors during chat completion
            console.error("Error during chat completion:", error);
            const errorMsg = error?.message || String(error) || 'Unknown error during generation';
            runInAction(() => {
                this.chatError = `Error generating response: ${errorMsg}`;
                // Add system message indicating error
                this.messages.push({
                    role: 'system',
                    content: `Error generating response. Check console for details.`
                });
                this.isGenerating = false;
            });
        }
    }

    // Initializes the WebLLM engine via the worker
    async #initializeEngine(selectedModel: string) {
        if (!this.#worker) {
             throw new Error("Web Worker is not initialized.");
        }
        // Unload previous engine if exists
        if (this.#engine) {
             await this.#engine.unload();
             this.#engine = null;
             console.log('Previous engine unloaded.');
        }

        // Callback to report initialization progress
        const initProgressCallback = (report: webllm.InitProgressReport) => {
            runInAction(() => {
                // Update progress only for the currently selected model load process
                if (this.selectedModelId === selectedModel && this.modelLoadTimeMs === null && !this.modelLoadError) {
                    this.engineStatus = report.text;
                    // Prioritize numerical progress if available
                    if (typeof report.progress === 'number') {
                         this.engineProgress = report.progress;
                    } else {
                         // Fallback to parsing progress from text
                         const match = report.text.match(/\[(\d+)\/(\d+)\]/);
                         if (match) {
                             const current = parseInt(match[1], 10);
                             const total = parseInt(match[2], 10);
                             this.engineProgress = total > 0 ? Math.min(current / total, 0.99) : 0; // Cap at 0.99 until fully loaded
                         } else if (report.text.toLowerCase().includes("fetching")) {
                             this.engineProgress = Math.max(this.engineProgress, 0.1);
                         } else if (report.text.toLowerCase().includes("initializing")) {
                             this.engineProgress = Math.max(this.engineProgress, 0.9);
                         }
                    }
                }
            });
        };

        console.log(`Creating WebLLM engine for model: ${selectedModel}`);
        // Create the engine instance
        this.#engine = await webllm.CreateWebWorkerMLCEngine(
            this.#worker,
            selectedModel,
            { initProgressCallback: initProgressCallback }
        );
        console.log(`Engine created for ${selectedModel}`);
    }

    // Parses and validates the LLM's JSON response
    #formatAndValidateJsonResponse(rawResponse: string): string {
        let potentialJson = rawResponse.trim();
        let parsedJson: LLMClassificationResponse | null = null;
        let parseMethod = 'direct'; // Track parsing method for debugging

        try {
            // 1. Try parsing directly
            parsedJson = JSON.parse(potentialJson) as LLMClassificationResponse;
        } catch (e1) {
             // 2. If direct parse fails, try extracting from markdown ```json ... ``` block
             console.warn("Direct JSON parsing failed. Trying markdown extraction.", e1);
             parseMethod = 'markdown';
             const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
             const match = potentialJson.match(jsonRegex);
             if (match && match[1]) {
                 potentialJson = match[1].trim();
                 try {
                     parsedJson = JSON.parse(potentialJson) as LLMClassificationResponse;
                 } catch (e2) {
                     console.error("Failed to parse JSON extracted from markdown.", e2);
                     parsedJson = null;
                 }
             } else {
                 console.warn("Could not find JSON markdown block in response.");
                 parsedJson = null;
             }
        }

        // 3. Validate the parsed JSON structure
        if (parsedJson) {
            const isValid = typeof parsedJson === 'object' && parsedJson !== null &&
                           typeof parsedJson.classification === 'string' &&
                           typeof parsedJson.translation === 'string' &&
                           ["QUESTION", "ACTION", "NOSENSE"].includes(parsedJson.classification);

            if (isValid) {
                 // Return pretty-printed valid JSON
                 console.log(`JSON parsed successfully using method: ${parseMethod}`);
                 return JSON.stringify(parsedJson, null, 2);
            } else {
                 // Return warning and the invalid JSON structure
                 console.warn('Parsed JSON does not match expected schema:', parsedJson);
                 return `Warning: Response structure mismatch (parsed with ${parseMethod}).\nRaw JSON:\n${JSON.stringify(parsedJson, null, 2)}`;
            }
        } else {
            // Return error if JSON parsing failed completely
            console.error('Failed to parse LLM response as JSON.', "\nRaw response:", rawResponse);
            return `Error: Could not parse AI response as valid JSON.\nRaw response:\n${rawResponse}`;
        }
    }
}

// Create and export the singleton store instance
export const chatStore = new Store();
