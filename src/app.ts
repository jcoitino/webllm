// src/my-chat-app.ts
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { autorun, IReactionDisposer } from 'mobx';
import { chatStore } from './store';
import './components/model-status';
import './components/chat-log';
import './components/chat-input';

@customElement('my-app')
export class App extends LitElement {

  static styles = css`
    :host {
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
  `;

  #mobxAutorunDisposer: IReactionDisposer | null = null;
  private store = chatStore;

  render() {
    return html`
      <model-status
        .models=${this.store.models}
        .selectedModelId=${this.store.selectedModelId}
        .status=${this.store.engineStatus}
        .progress=${this.store.engineProgress}
        .modelLoadTimeMs=${this.store.modelLoadTimeMs}
        @model-selected=${this.handleModelSelected}>
      </model-status>
      <chat-log
        .messages=${[...this.store.messages]}>
      </chat-log>
      <chat-input
        .sysPrompt=${this.store.systemPrompt}
        .isGenerating=${this.store.isGenerating}
        @sys-prompt-changed=${this.handleSysPromptChanged}
        @reset-chat=${this.handleResetChat}
        @send-message=${this.handleSendMessage}>
      </chat-input>
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
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#mobxAutorunDisposer) {
      this.#mobxAutorunDisposer();
    }
  }

  private handleModelSelected(evt: CustomEvent) {
    const modelId = evt.detail.modelId;
    if (modelId && modelId !== this.store.selectedModelId) {
        this.store.loadModel(modelId);
    }
  }

  private handleSysPromptChanged(event: CustomEvent) {
    const newPrompt = event.detail;
    this.store.setSystemPrompt(newPrompt);
  }

  private handleResetChat() {
    this.store.resetChat();
  }

  private handleSendMessage(event: CustomEvent) {
    const { usrPrompt } = event.detail;
    this.store.sendMessage(usrPrompt);
  }
}