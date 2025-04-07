// src/components/chat-log.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { ref, createRef } from 'lit/directives/ref.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  executionTimeMs?: number;
}

@customElement('chat-log')
export class ChatLog extends LitElement {

  static styles = css`
    :host {
      display: block;
      flex-grow: 1;
      overflow-y: auto;
      padding: 15px;
      background-color: var(--ig-surface-s, #1e1e1e);
      color: var(--ig-surface-s-text, #e0e0e0);
      font-family: sans-serif;
    }

    .log-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .message {
      color: var(--ig-gray-100, #f0f0f0)
      margin-bottom: 10px;
      padding: 8px 12px;
      border-radius: 15px;
      max-width: 80%;
      word-wrap: break-word;
      position: relative;
    }

    .user-message {
      background-color: var(--ig-secondary-500, #0b4f6c);
      color: var(--ig-secondary-500-text, #fff);
      margin-left: auto;
      border-bottom-right-radius: 5px;
    }

    .assistant-message {
      background-color: var(--ig-gray-200, #555);
      color: var(--ig-gray-800-text, #eee);
      margin-right: auto;
      border-bottom-left-radius: 5px;
    }

    .system-message {
      font-style: italic;
      text-align: center;
      background-color: transparent;
      color: var(--ig-gray-500, #aaa);
      font-size: 0.9em;
      max-width: 100%;
      margin-bottom: 15px;
    }

    .role {
      font-weight: bold;
      display: block;
      margin-bottom: 4px;
      font-size: 0.8em;
      color: var(--ig-gray-400, #bbb);
    }

    p {
        margin: 0;
        word-wrap: break-word;
        white-space: pre-wrap;
    }

    .execution-time {
      display: block;
      font-size: 0.75em;
      color: var(--ig-gray-400, #bbb);
      text-align: right;
      margin-top: 5px;
      padding-top: 3px;
      border-top: 1px dashed var(--ig-gray-300, #555);
    }
  `;

  @property({ type: Array }) messages: ChatMessage[] = [];
  private _logContainerRef = createRef<HTMLDivElement>();

  render() {
    return html`
      <div ${ref(this._logContainerRef)} class="log-container">
        ${map(this.messages, (msg) =>
          html`
            <div class="message ${msg.role}-message">
              ${msg.role !== 'system'
                ? html`<span class="role">${msg.role === 'assistant' ? 'AI Bot:' : 'You:'}</span>`
                : ''
              }
              <p>${msg.content}</p>
              ${msg.role === 'assistant' && msg.executionTimeMs !== undefined
                ? html`<span class="execution-time">Time: ${(msg.executionTimeMs / 1000).toFixed(2)}s</span>`
                : ''
              }
            </div>
          `
        )}
      </div>
    `;
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('messages') && this._logContainerRef.value) {
      requestAnimationFrame(() => {
          if (this._logContainerRef.value) {
             this._logContainerRef.value.scrollTo({
                top: this._logContainerRef.value.scrollHeight,
                behavior: 'smooth'
             });
          }
      });
    }
  }
}