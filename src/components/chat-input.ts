// src/components/chat-input.ts
import { IgcTextareaComponent } from 'igniteui-webcomponents';
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('chat-input')
export class ChatInput extends LitElement {

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 15px;
      background-color: var(--ig-surface-s-variant, #333);
      font-family: sans-serif;
    }

    igc-textarea::part(label) {
        color: var(--ig-surface-s-variant-text, #ccc);
    }

    .text-area-group {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      justify-content: flex-end;
    }

    igc-textarea {
        width: 100%;
    }

    igc-button {
        font-weight: 500;
    }

    igc-button[variant="contained"]::part(base) {
       color: var(--ig-primary-contrast-text, #fff);
    }

    igc-button igc-circular-progress {
        width: 18px;
        height: 18px;
        margin-right: 8px;
        --ig-secondary-500: var(--ig-primary-contrast-text, #fff);
    }
  `;

  @property({ type: String }) sysPrompt: string = '';
  @property({ type: Boolean }) isGenerating: boolean = false;
  @property({ type: Boolean }) disabled: boolean = false;
  @state() private usrPrompt: string = '';

  render() {
    const isDisabled = this.disabled || this.isGenerating;
    return html`
      <div class="text-area-group">
        <igc-textarea
          label="System Prompt:"
          placeholder="Optional: Set the AI's behavior (changing resets chat)..."
          rows="3"
          .value=${this.sysPrompt} /* Bind directly, store handles trimming */
          ?disabled=${isDisabled}
          @blur="${this.#handleSysPromptBlur}" /* Suggestion 1: Use blur */
        >
        </igc-textarea>
        <igc-textarea
          label="Your Message:"
          placeholder="Type your message (Ctrl+Enter or Cmd+Enter to send)..."
          rows="3"
          .value=${this.usrPrompt} /* Bind directly */
          ?disabled=${isDisabled}
          @input="${this.#updateUsrPrompt}" /* Use input for instant state update */
          @keydown="${this.#keyPressed}"
        >
        </igc-textarea>
      </div>
      <div class="button-group">
        <igc-button variant="outlined" size="large" ?disabled=${isDisabled} @click="${this.#reset}">
          Reset Chat
        </igc-button>
        <igc-button variant="contained" size="large" ?disabled=${isDisabled || !this.usrPrompt.trim()} @click="${this.#sendMessage}">
          ${this.isGenerating ? html`<igc-circular-progress indeterminate></igc-circular-progress> Generating...` : 'Send'}
        </igc-button>
      </div>
    `;
  }

  #handleSysPromptBlur(evt: FocusEvent) {
    const target = evt.target as IgcTextareaComponent | null;
    if (target) {
      const newSysPrompt = target.value ?? '';
      if (newSysPrompt.trim() !== this.sysPrompt.trim()) {
        this.dispatchEvent(new CustomEvent('sys-prompt-changed', { detail: newSysPrompt, bubbles: true, composed: true }));
      }
    }
  }

  #updateUsrPrompt(evt: Event) {
    const target = evt.target as IgcTextareaComponent | null;
    if (target) {
      this.usrPrompt = target.value ?? '';
    }
  }

  #keyPressed(evt: KeyboardEvent) {
    if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
      evt.preventDefault();
      if (!this.isGenerating && this.usrPrompt.trim()) {
        this.#sendMessage();
      }
    }
  }

  #sendMessage() {
    const trimmedPrompt = this.usrPrompt.trim();
    if (!this.isGenerating && trimmedPrompt) {
      this.dispatchEvent(new CustomEvent('send-message', { detail: { usrPrompt: trimmedPrompt }, bubbles: true, composed: true }));
      this.usrPrompt = '';
    }
  }

  #reset() {
    this.usrPrompt = '';
    this.dispatchEvent(new CustomEvent('reset-chat', { bubbles: true, composed: true }));
    this.shadowRoot?.querySelector<IgcTextareaComponent>('igc-textarea[label="Your Message:"]')?.focus();
  }
}
