// src/components/model-status.ts
import { IgcSelectComponent } from 'igniteui-webcomponents';
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import type { AppModel, GpuAdapterInfo } from '../types';

@customElement('model-status')
export class ModelStatus extends LitElement {

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 15px;
      background-color: var(--ig-surface-s-variant, #333);
      color: var(--ig-surface-s-variant-text, #ccc);
      border-bottom: 1px solid var(--ig-gray-100, #444);
      font-family: sans-serif;
      font-size: 0.9em;
    }

    igc-select {
      width: 100%;
    }

    igc-select::part(base) {
      color: var(--ig-gray-900, #fff);
      text-align: left;
      max-height: 300px;
      overflow-y: auto;
    }

    .info-container {
      font-size: 0.8em;
      color: var(--ig-gray-400, #aaa);
      text-align: center;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 5px 15px;
      margin-top: 5px;
      padding-top: 5px;
      border-top: 1px dashed var(--ig-gray-700, #555);
    }
    .info-item {
       white-space: nowrap;
    }

    .error-message {
        color: var(--ig-error-500, #f44336);
        font-weight: bold;
        font-size: 0.9em;
        margin-top: 4px;
        padding: 8px;
        background-color: rgba(244, 67, 54, 0.15);
        border: 1px solid var(--ig-error-500, #f44336);
        border-radius: 4px;
        word-break: break-word;
        text-align: center;
    }

    .status-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        min-height: 50px;
        text-align: center;
    }

    .status-text {
      color: var(--ig-gray-300, #bbb);
      word-break: break-word;
    }

    igc-linear-progress {
       width: 80%;
       max-width: 400px;
       height: 10px;
    }

    .load-time {
        font-size: 0.85em;
        color: var(--ig-gray-500, #999);
        margin-top: 2px;
    }
  `;

  @property({ type: Array }) models: ReadonlyArray<AppModel> = [];
  @property({ type: String }) selectedModelId: string = '';
  @property({ type: String }) status: string = 'Initializing...';
  @property({ type: Number }) progress: number = 0;
  @property({ type: Number, attribute: 'model-load-time-ms' }) modelLoadTimeMs: number | null = null;
  @property({ type: String, attribute: 'compatibility-error'}) compatibilityError: string | null = null;
  @property({ type: String, attribute: 'model-load-error'}) modelLoadError: string | null = null;
  @property({ type: Object, attribute: false }) gpuAdapterInfo: GpuAdapterInfo | null = null;
  @property({ type: Number, attribute: 'estimated-device-memory-gb' }) estimatedDeviceMemoryGB: number | null = null;

  render() {
    const errorMessage = this.compatibilityError ?? this.modelLoadError;
    const hasError = !!errorMessage;
    const isLoading = this.progress > 0 && this.progress < 1 && !hasError;
    const isLoaded = this.progress >= 1 && !hasError;
    const loadTimeSeconds = this.modelLoadTimeMs !== null ? (this.modelLoadTimeMs / 1000).toFixed(2) : null;
    const gpuDisplay = this.gpuAdapterInfo
      ? `${this.gpuAdapterInfo.vendor} / ${this.gpuAdapterInfo.architecture}`
      : (this.compatibilityError ? "N/A" : "Checking...");
    const memoryDisplay = this.estimatedDeviceMemoryGB !== null
       ? `~${this.estimatedDeviceMemoryGB} GB System RAM`
       : (this.compatibilityError ? "N/A" : "Unknown");
    return html`
      <igc-select value="${this.selectedModelId}" ?disabled=${isLoading || this.models.length === 0 || hasError} @igcChange=${this.#selectModel}>
        ${this.models.length === 0 && !hasError
            ? html`<igc-select-item disabled value="">No models available</igc-select-item>`
            : map(this.models, m => html`<igc-select-item value="${m.id}">${m.displayName}</igc-select-item>`)
        }
        ${when(hasError || this.models.length === 0, () => html`
            <igc-select-item disabled value="">
                ${hasError ? 'Model selection disabled' : (this.models.length === 0 ? 'No models available' : '')}
            </igc-select-item>
        `)}
      </igc-select>

      <div class="status-container">
        <div class="status-text">${this.status}</div>
        ${when(hasError, () => html`<div class="error-message">${errorMessage}</div>`)}
        ${when(isLoading, () => html`<igc-linear-progress value="${this.progress}" max="1"></igc-linear-progress>`)}
        ${when(isLoaded && loadTimeSeconds !== null, () => html`<div class="load-time">(Loaded in ${loadTimeSeconds} seconds)</div>`)}
      </div>
      <div class="info-container">
          <span class="info-item">GPU: ${gpuDisplay}</span>
          <span class="info-item">Memory: ${memoryDisplay}</span>
      </div>
    `;
  }

  #selectModel(event: CustomEvent) {
    const selectElement = event.target as IgcSelectComponent;
    const newModelId = selectElement.value;
    if (newModelId && newModelId !== this.selectedModelId) {
        this.dispatchEvent(new CustomEvent('model-selected', { detail: { modelId: newModelId }, bubbles: true, composed: true }));
    }
  }
}
