// src/components/chat-log.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { ref, createRef } from 'lit/directives/ref.js';
import type { ChatMessage } from '../types';

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
      scroll-behavior: smooth;
    }

    .log-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      padding: 10px 15px;
      border-radius: 18px;
      max-width: 85%;
      word-wrap: break-word;
      position: relative;
      line-height: 1.4;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .user-message {
      background-color: var(--ig-secondary-600, #0a5b7d);
      color: var(--ig-secondary-contrast-text, #fff);
      margin-left: auto;
      border-bottom-right-radius: 5px;
    }

    .assistant-message {
      background-color: var(--ig-gray-700, #4a4a4a);
      color: var(--ig-gray-contrast-text, #777);
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
      margin-top: 5px;
      margin-bottom: 15px;
      padding: 5px;
    }

    .role {
      font-weight: bold;
      display: block;
      margin-bottom: 5px;
      font-size: 0.8em;
      color: var(--ig-gray-400, #bbb);
      text-transform: capitalize;
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
      margin-top: 8px;
      padding-top: 5px;
      border-top: 1px dashed var(--ig-gray-600, #555);
    }

    pre {
        background-color: rgba(0,0,0,0.2);
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
        white-space: pre;
        font-family: monospace;
        font-size: 0.9em;
        margin: 5px 0 0 0;
    }
  `;

  @property({ type: Array }) messages: ReadonlyArray<ChatMessage> = [];
  #logContainerRef = createRef<HTMLDivElement>();
  #isNearBottom = true;

  render() {
    return html`
      <div ${ref(this.#logContainerRef)} class="log-container" @scroll=${this.#handleScroll}>
        ${map(this.messages, (msg) => {
          const isAssistantJson = msg.role === 'assistant' && msg.content.startsWith('{') && msg.content.endsWith('}');
          let contentHtml;
          try {
            if (isAssistantJson) {
              const parsed = JSON.parse(msg.content);
              contentHtml = html`<pre>${JSON.stringify(parsed, null, 2)}</pre>`;
            } else {
              contentHtml = html`<p>${msg.content}</p>`;
            }
          } catch (e) {
            contentHtml = html`<p>${msg.content}</p>`;
          }
          return html`
            <div class="message ${msg.role}-message">
              ${msg.role !== 'system' ? html`<span class="role">${msg.role === 'assistant' ? 'AI Bot' : 'You'}:</span>` : ''}
              ${contentHtml}
              ${msg.role === 'assistant' && msg.executionTimeMs !== undefined ? html`<span class="execution-time">Time: ${(msg.executionTimeMs / 1000).toFixed(2)}s</span>` : ''}
            </div>
          `
        })}
      </div>
    `;
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('messages') && this.#logContainerRef.value && this.#isNearBottom) {
      requestAnimationFrame(() => {
        const container = this.#logContainerRef.value;
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      });
    }
  }

  #handleScroll() {
    const container = this.#logContainerRef.value;
    if (container) {
      const threshold = 50;
      const position = container.scrollTop + container.clientHeight;
      const height = container.scrollHeight;
      this.#isNearBottom = position >= height - threshold;
    }
  }
}
