// src/worker.ts
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
    handler.onmessage(msg);
};

self.onerror = (event: Event | string): boolean | void => {
    let errorMessage: string;
    let errorDetails: any = event;
    if (event instanceof ErrorEvent) {
        errorMessage = `Worker script error: ${event.message} in ${event.filename}:${event.lineno}`;
        errorDetails = {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        };
        console.error("Worker ErrorEvent:", errorMessage, errorDetails.error || '');
    } else if (typeof event === 'string') {
        errorMessage = `Worker error: ${event}`;
        console.error("Worker error string:", errorMessage);
    } else {
        errorMessage = `An unknown error event occurred in the Web Worker (type: ${event?.type ?? 'N/A'}).`;
        console.error(errorMessage, event);
    }
    try {
        self.postMessage({ type: 'WORKER_ERROR', message: errorMessage, details: errorDetails });
    } catch (postError) {
        console.error("Failed to post error message back to main thread:", postError);
    }
    return true;
};

self.onunhandledrejection = (event: PromiseRejectionEvent) => {
     console.error("Worker unhandled promise rejection:", event.reason);
     try {
        self.postMessage({ type: 'WORKER_ERROR', message: `Unhandled Rejection: ${event.reason}`, details: event.reason });
     } catch (postError) {
         console.error("Failed to post rejection message back to main thread:", postError);
     }
};

console.log("WebLLM Worker script initialized.");
