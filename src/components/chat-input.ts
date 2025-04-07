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
      gap: 32px;
      padding: 10px;
      background-color: var(--ig-surface-s-variant, #333);
      font-family: sans-serif;
    }

    .button-group {
      display: flex;
      gap: 10px;
    }

    igc-textarea {
        width: 100%;
    }

    igc-button {
        font-weight: 500;
    }

     igc-button[variant="contained"] {
       color: var(--ig-primary-500-text, #fff);
     }        
  `;

  @property({ type: String }) sysPrompt: string = '';
  @property({ type: Boolean }) isGenerating: boolean = false;
  @state() private usrPrompt: string = '';

  render() {
    const isDisabled = this.isGenerating;
    return html`
        <igc-textarea
          label="System Prompt:"
          placeholder="Optional: Set the AI's behavior..."
          rows="3"
          .value=${this.sysPrompt.trim()}
          ?disabled=${isDisabled}
          @igcInput="${this.updateSysPrompt}">
        </igc-textarea>
        <igc-textarea
          label="Your Message:"
          placeholder="Type your message (Ctrl+Enter to send)..."
          rows="3"
          .value=${this.usrPrompt.trim()}
          ?disabled=${isDisabled}
          @igcInput="${this.updateUsrPrompt}"
          @keydown="${this.keyPressed}">
        </igc-textarea>
        <div class="button-group">
          <igc-button variant="outlined" size="large" ?disabled=${isDisabled} @click="${this.reset}">
            Reset Chat
          </igc-button>
          <igc-button
            variant="contained"
            size="large"
            ?disabled=${isDisabled || !this.usrPrompt.trim()}
            @click="${this.sendMessage}">
            ${this.isGenerating ? html`<igc-circular-progress indeterminate></igc-circular-progress> Generating...` : 'Send'}
          </igc-button>
        </div>
    `;
  }

  private updateSysPrompt(evt: Event) {
    const target = evt.target as IgcTextareaComponent | null;
    if (target) {
      const newSysPrompt = target.value ?? '';
      if (newSysPrompt !== this.sysPrompt) {
        this.dispatchEvent(new CustomEvent('sys-prompt-changed', { detail: newSysPrompt, bubbles: true, composed: true }));
      }
    }
  }

  private updateUsrPrompt(evt: Event) {
    const target = evt.target as IgcTextareaComponent | null;
    if (target) {
      this.usrPrompt = target.value ?? '';
    }
  }

  private reset() {
    this.usrPrompt = '';
    this.dispatchEvent(new CustomEvent('reset-chat', { bubbles: true, composed: true }));
  }

  private keyPressed(evt: KeyboardEvent) {
    if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
      evt.preventDefault();
      this.sendMessage();
    }
  }

  private sendMessage() {
    if (!this.isGenerating && this.usrPrompt.trim()) {
      this.dispatchEvent(new CustomEvent('send-message', {
        detail: {
          usrPrompt: this.usrPrompt,
          sysPrompt: this.sysPrompt
        },
        bubbles: true,
        composed: true
      }));
      this.usrPrompt = '';
    }
  }
}