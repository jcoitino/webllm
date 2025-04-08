// src/globals.d.ts

declare global {
  interface Navigator {
      /**
       * Provides an estimate of the device's RAM in gigabytes.
       * Note: This is an experimental feature and may not be available in all browsers.
       * It primarily reflects system RAM, not dedicated GPU VRAM.
       * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
       */
      readonly deviceMemory?: number; // Make it optional as support varies
  }

  interface GPUAdapter {
      requestAdapterInfo(unrestricted?: boolean): Promise<GPUAdapterInfo>;
      readonly name: string;
      readonly info?: unknown;
  }
  interface GPUAdapterInfo {
      vendor: string;
      architecture: string;
      device: string;
      description: string;
  }
}

export {};
