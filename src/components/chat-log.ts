// src/components/chat-log.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { ref, createRef } from 'lit/directives/ref.js';
import type { ChatMessage } from '../types'; // Import shared type

@customElement('chat-log')
export class ChatLog extends LitElement {

  static styles = css`
    :host {
      display: block;
      flex-grow: 1;
      overflow-y: auto;
      padding: 15px;
      background-color: var(--ig-surface-s, #1e1e1e); /* Use variable */
      color: var(--ig-surface-s-text, #e0e0e0); /* Use variable */
      font-family: sans-serif;
      scroll-behavior: smooth; /* Enable smooth scrolling */
    }

    .log-container {
      display: flex;
      flex-direction: column;
      gap: 12px; /* Slightly increased gap */
    }

    .message {
      /* Base message styling */
      padding: 10px 15px; /* Adjusted padding */
      border-radius: 18px; /* More rounded corners */
      max-width: 85%; /* Slightly wider max width */
      word-wrap: break-word;
      position: relative;
      line-height: 1.4;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); /* Subtle shadow */
    }

    .user-message {
      background-color: var(--ig-secondary-600, #0a5b7d); /* Darker secondary shade */
      color: var(--ig-secondary-contrast-text, #fff); /* Use contrast text variable */
      margin-left: auto; /* Align right */
      border-bottom-right-radius: 5px; /* Tail */
    }

    .assistant-message {
      background-color: var(--ig-gray-700, #4a4a4a); /* Slightly darker gray */
      color: var(--ig-gray-contrast-text, #777); /* Use contrast text variable */
      margin-right: auto; /* Align left */
      border-bottom-left-radius: 5px; /* Tail */
    }

    .system-message {
      font-style: italic;
      text-align: center;
      background-color: transparent;
      color: var(--ig-gray-500, #aaa); /* Use variable */
      font-size: 0.9em;
      max-width: 100%;
      margin-top: 5px;
      margin-bottom: 15px;
      padding: 5px;
    }

    .role {
      font-weight: bold;
      display: block;
      margin-bottom: 5px; /* Increased space */
      font-size: 0.8em;
      /* Use a slightly lighter color for role */
      color: var(--ig-gray-400, #bbb);
      text-transform: capitalize;
    }

    p {
        margin: 0;
        word-wrap: break-word; /* Ensure wrapping */
        white-space: pre-wrap; /* Preserve whitespace and newlines */
    }

    .execution-time {
      display: block;
      font-size: 0.75em;
      color: var(--ig-gray-400, #bbb); /* Use variable */
      text-align: right;
      margin-top: 8px; /* Increased space */
      padding-top: 5px; /* Increased space */
      /* Use a lighter dashed line */
      border-top: 1px dashed var(--ig-gray-600, #555);
    }

    /* Style for JSON content */
    pre {
        background-color: rgba(0,0,0,0.2);
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto; /* Allow horizontal scroll for long lines */
        white-space: pre; /* Preserve formatting strictly */
        font-family: monospace;
        font-size: 0.9em;
        margin: 5px 0 0 0; /* Add margin only if content above */
    }
  `;

  @property({ type: Array }) messages: ReadonlyArray<ChatMessage> = [];
  private _logContainerRef = createRef<HTMLDivElement>();
  private _isNearBottom = true;

  render() {
    return html`
      <div
        ${ref(this._logContainerRef)}
        class="log-container"
        @scroll=${this._handleScroll}
      >
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
              ${msg.role !== 'system'
                ? html`<span class="role">${msg.role === 'assistant' ? 'AI Bot' : 'You'}:</span>`
                : ''
              }
              ${contentHtml}
              ${msg.role === 'assistant' && msg.executionTimeMs !== undefined
                ? html`<span class="execution-time">Time: ${(msg.executionTimeMs / 1000).toFixed(2)}s</span>`
                : ''
              }
            </div>
          `
         })}
      </div>
    `;
  }

  private _handleScroll() {
    const container = this._logContainerRef.value;
    if (container) {
      const threshold = 50;
      const position = container.scrollTop + container.clientHeight;
      const height = container.scrollHeight;
      this._isNearBottom = position >= height - threshold;
    }
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('messages') && this._logContainerRef.value) {
        if (this._isNearBottom) {
            requestAnimationFrame(() => {
                const container = this._logContainerRef.value;
                if (container) {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-log': ChatLog;
  }
}
