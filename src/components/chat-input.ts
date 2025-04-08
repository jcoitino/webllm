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
      gap: 10px; /* Reduced gap */
      padding: 15px; /* Slightly more padding */
      background-color: var(--ig-surface-s-variant, #333); /* Use variable */
      font-family: sans-serif;
    }
    /* Ensure labels use theme color */
    igc-textarea::part(label) {
        color: var(--ig-surface-s-variant-text, #ccc);
    }

    .text-area-group {
        display: flex;
        flex-direction: column;
        gap: 15px; /* Gap between text areas */
    }

    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 10px; /* Add some space above buttons */
      justify-content: flex-end; /* Align buttons to the right */
    }

    igc-textarea {
        width: 100%;
        /* Use theme variables for text area text/background if needed */
        /* --ig-surface-s: ...; */
        /* --ig-surface-s-text: ...; */
    }

    igc-button {
        font-weight: 500;
    }

    /* Ensure contained button text uses the correct variable */
    igc-button[variant="contained"]::part(base) {
       color: var(--ig-primary-contrast-text, #fff); /* Check variable name in theme */
    }

    /* Style for progress indicator inside button */
    igc-button igc-circular-progress {
        width: 18px;
        height: 18px;
        margin-right: 8px;
        /* Use theme colors for progress */
        --ig-secondary-500: var(--ig-primary-contrast-text, #fff);
    }
  `;

  @property({ type: String }) sysPrompt: string = '';
  @property({ type: Boolean }) isGenerating: boolean = false;
  @property({ type: Boolean }) disabled: boolean = false; // General disabled state
  @state() private usrPrompt: string = '';

  render() {
    // Combined disabled state
    const isDisabled = this.disabled || this.isGenerating;

    return html`
      <div class="text-area-group">
        <igc-textarea
          label="System Prompt:"
          placeholder="Optional: Set the AI's behavior (changing resets chat)..."
          rows="3"
          .value=${this.sysPrompt} /* Bind directly, store handles trimming */
          ?disabled=${isDisabled}
          @blur="${this.handleSysPromptBlur}" /* Suggestion 1: Use blur */
        >
        </igc-textarea>
        <igc-textarea
          label="Your Message:"
          placeholder="Type your message (Ctrl+Enter or Cmd+Enter to send)..."
          rows="3"
          .value=${this.usrPrompt} /* Bind directly */
          ?disabled=${isDisabled}
          @input="${this.updateUsrPrompt}" /* Use input for instant state update */
          @keydown="${this.keyPressed}"
        >
        </igc-textarea>
      </div>
      <div class="button-group">
        <igc-button variant="outlined" size="large" ?disabled=${isDisabled} @click="${this.reset}">
          Reset Chat
        </igc-button>
        <igc-button
          variant="contained"
          size="large"
          ?disabled=${isDisabled || !this.usrPrompt.trim()}
          @click="${this.sendMessage}"
        >
          ${this.isGenerating
            ? html`<igc-circular-progress indeterminate></igc-circular-progress> Generating...`
            : 'Send'}
        </igc-button>
      </div>
    `;
  }

  // Suggestion 1: Handle system prompt change on blur
  private handleSysPromptBlur(evt: FocusEvent) {
    const target = evt.target as IgcTextareaComponent | null;
    if (target) {
      const newSysPrompt = target.value ?? '';
      // Only dispatch if the trimmed value actually changed from the prop
      if (newSysPrompt.trim() !== this.sysPrompt.trim()) {
         console.log("Dispatching sys-prompt-changed");
        this.dispatchEvent(new CustomEvent('sys-prompt-changed', {
            detail: newSysPrompt, // Send untrimmed, let store handle it
            bubbles: true,
            composed: true
        }));
      }
    }
  }

  private updateUsrPrompt(evt: Event) {
    const target = evt.target as IgcTextareaComponent | null;
    if (target) {
      // Update internal state directly on input for responsiveness
      this.usrPrompt = target.value ?? '';
    }
  }

  private reset() {
    // Clear local user prompt state as well
    this.usrPrompt = '';
    this.dispatchEvent(new CustomEvent('reset-chat', { bubbles: true, composed: true }));
    // Optionally re-focus the user prompt area
    this.shadowRoot?.querySelector<IgcTextareaComponent>('igc-textarea[label="Your Message:"]')?.focus();
  }

  private keyPressed(evt: KeyboardEvent) {
    if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
      evt.preventDefault(); // Prevent newline in textarea
      if (!this.isGenerating && this.usrPrompt.trim()) {
          this.sendMessage();
      }
    }
  }

  private sendMessage() {
    const trimmedPrompt = this.usrPrompt.trim();
    if (!this.isGenerating && trimmedPrompt) {
      this.dispatchEvent(new CustomEvent('send-message', {
        detail: { usrPrompt: trimmedPrompt }, // Send trimmed prompt
        bubbles: true,
        composed: true
      }));
      // Clear local user prompt state after sending
      this.usrPrompt = '';
    }
  }
}

// Add declaration for the custom element
declare global {
  interface HTMLElementTagNameMap {
    'chat-input': ChatInput;
  }
}
