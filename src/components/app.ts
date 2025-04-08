// src/app.ts
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { autorun, IReactionDisposer } from 'mobx';
import { chatStore } from '../store';
import './model-status';
import './chat-log';
import './chat-input';
import type { ChatMessage, AppModel } from '../types';

@customElement('my-app')
export class App extends LitElement {

  static styles = css`
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100%;
      max-width: 800px;
      margin: 0 auto; /* Center the app */
      background-color: var(--ig-surface-s, #252526);
      color: var(--ig-surface-s-text, #e0e0e0);
      border: 1px solid var(--ig-gray-100, #333);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
      box-sizing: border-box;
      overflow: hidden;
    }

    model-status {
      flex-shrink: 0;
    }

    chat-log {
      flex-grow: 1;
      overflow-y: auto;
    }

    chat-input {
      flex-shrink: 0; /* Prevent input area from shrinking */
      border-top: 1px solid var(--ig-gray-100, #444);
    }

    .compatibility-placeholder {
        flex-grow: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 20px;
        font-style: italic;
        color: var(--ig-gray-500, #aaa);
    }
  `;

  #mobxAutorunDisposer: IReactionDisposer | null = null;
  private store = chatStore;

  render() {
    const displayError = this.store.compatibilityError ?? this.store.modelLoadError ?? this.store.workerError;
    const showChatUI = this.store.isWebGPUSupported === true && !this.store.compatibilityError;
    return html`
      <model-status
        .models=${this.store.models as ReadonlyArray<AppModel>}
        .selectedModelId=${this.store.selectedModelId}
        .status=${this.store.engineStatus}
        .progress=${this.store.engineProgress}
        .modelLoadTimeMs=${this.store.modelLoadTimeMs}
        .compatibilityError=${this.store.compatibilityError}
        .modelLoadError=${this.store.modelLoadError}
        .gpuAdapterInfo=${this.store.gpuAdapterInfo}
        .estimatedDeviceMemoryGB=${this.store.estimatedDeviceMemoryGB}
        @model-selected=${this.#handleModelSelected}>
      </model-status>
      ${when(showChatUI,
      () => html`
              <chat-log .messages=${[...this.store.messages] as ReadonlyArray<ChatMessage>}></chat-log>
              <chat-input
                .sysPrompt=${this.store.systemPrompt}
                .isGenerating=${this.store.isGenerating}
                ?disabled=${this.store.isGenerating || this.store.engineProgress < 1 || !!displayError}
                @sys-prompt-changed=${this.#handleSysPromptChanged}
                @reset-chat=${this.#handleResetChat}
                @send-message=${this.#handleSendMessage}>
              </chat-input>
            `,
      () => html`
              <div class="compatibility-placeholder">
                ${this.store.isWebGPUSupported === null ? 'Checking compatibility...' : this.store.compatibilityError ? '' : 'Chat features disabled due to compatibility issues.'}
              </div>
            `
    )}
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#mobxAutorunDisposer = autorun(() => {
      this.store.selectedModelId;
      this.store.engineStatus;
      this.store.engineProgress;
      this.store.modelLoadTimeMs;
      this.store.messages.length;
      this.store.isGenerating;
      this.store.systemPrompt;
      this.store.isWebGPUSupported;
      this.store.gpuAdapterInfo;
      this.store.estimatedDeviceMemoryGB;
      this.store.compatibilityError;
      this.store.selectedModelVramRequirementMB;
      this.store.modelLoadError;
      this.store.chatError;
      this.store.workerError;
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#mobxAutorunDisposer) {
      this.#mobxAutorunDisposer();
    }
  }

  #handleModelSelected(evt: CustomEvent<{ modelId: string }>) {
    const modelId = evt.detail.modelId;
    if (modelId && modelId !== this.store.selectedModelId) {
      this.store.loadModel(modelId);
    }
  }

  #handleSysPromptChanged(event: CustomEvent<string>) {
    const newPrompt = event.detail;
    this.store.setSystemPrompt(newPrompt);
  }

  #handleResetChat() {
    this.store.resetChat();
  }

  #handleSendMessage(event: CustomEvent<{ usrPrompt: string }>) {
    const { usrPrompt } = event.detail;
    this.store.sendMessage(usrPrompt);
  }
}
