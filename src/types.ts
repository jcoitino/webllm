// src/types.ts

/** Represents a message in the chat log */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  executionTimeMs?: number;
}

/** Represents a model available for selection in the UI */
export interface AppModel {
  id: string;
  displayName: string;
}

/** Structure of the expected JSON response from the LLM */
export interface LLMClassificationResponse {
  classification: 'QUESTION' | 'ACTION' | 'NOSENSE';
  translation: string;
}

/** Structure for storing relevant GPU Adapter Info */
export interface GpuAdapterInfo {
  vendor: string;
  architecture: string; // Sometimes includes model name
  description?: string; // Fallback if vendor/arch missing
}
