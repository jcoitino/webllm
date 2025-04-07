// src/components/model-status.ts
import { IgcSelectComponent } from 'igniteui-webcomponents';
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';

@customElement('model-status')
export class ModelStatus extends LitElement {

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px; /* Adjusted gap */
      padding: 10px 15px; /* Adjusted padding */
      background-color: var(--ig-surface-s-variant, #333);
      color: var(--ig-surface-s-variant-text, #ccc);      
      border-bottom: 1px solid var(--ig-gray-100, #444);
      font-family: sans-serif;
      font-size: 0.9em;
    }

    igc-select {
      width: 100%; /* Make select full width */
    }

    igc-select::part(base) {
      color: var(--ig-gray-900, #fff);
      text-align: left;
      max-height: 300px;
      overflow-y: auto;
    }

    .status-container {
        display: flex;
        flex-direction: column;
        align-items: center; /* Center progress and text */
        gap: 5px;
        min-height: 40px; /* Reserve space */
        text-align: center;
    }

    .status-text {
      color: var(--ig-gray-300, #bbb);
      word-break: break-word; /* Prevent long status text overflow */
    }

    igc-linear-progress {
       width: 80%;
       max-width: 400px;
       height: 10px; /* Slightly smaller progress bar */
    }

    .load-time {
        font-size: 0.85em;
        color: var(--ig-gray-500, #999);
        margin-top: 2px;
    }
  `;

  @property({ type: Array }) models: Array<{ id: string, displayName: string }> = [];
  @property({ type: String }) selectedModelId: string = '';
  @property({ type: String }) status: string = 'Initializing WebLLM Engine...';
  @property({ type: Number }) progress: number = 0;
  @property({ type: Number, attribute: 'model-load-time-ms' }) modelLoadTimeMs: number | null = null;

  render() {
    const isLoading = this.progress > 0 && this.progress < 1;
    const loadTimeSeconds = this.modelLoadTimeMs !== null ? (this.modelLoadTimeMs / 1000).toFixed(2) : null;

    return html`
      <igc-select value="${this.selectedModelId}" @igcChange=${this.selectModel} ?disabled=${isLoading}>
        ${map(this.models, m =>
          html`<igc-select-item value="${m.id}">${m.displayName}</igc-select-item>`
        )}
      </igc-select>

      <div class="status-container">
        <div class="status-text">
          ${this.status}
        </div>
        ${when(isLoading, () => html`
            <igc-linear-progress value="${this.progress}" max="1"></igc-linear-progress>
        `)}
        ${when(loadTimeSeconds !== null && !isLoading, () => html`
            <div class="load-time">
              (Loaded in ${loadTimeSeconds} seconds)
            </div>
        `)}
      </div>
    `;
  }

  private selectModel(event: CustomEvent) {
    const selectElement = event.target as IgcSelectComponent;
    const newModelId = selectElement.value;
    if (newModelId && newModelId !== this.selectedModelId) {
        this.dispatchEvent(new CustomEvent('model-selected', {
            detail: { modelId: newModelId },
            bubbles: true,
            composed: true
        }));
    }
  }
}