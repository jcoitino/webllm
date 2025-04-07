import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
    handler.onmessage(msg);
};
self.onerror = (error: string | Event) => {
    console.error("Worker error:", error);
};
