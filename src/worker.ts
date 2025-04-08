// src/worker.ts
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Initialize the handler
const handler = new WebWorkerMLCEngineHandler();

// Standard message handling
self.onmessage = (msg: MessageEvent) => {
    handler.onmessage(msg);
};

// Corrected Error Handling
// The event parameter type should match the expected OnErrorEventHandler: Event | string
self.onerror = (event: Event | string): boolean | void => {
    let errorMessage: string;
    let errorDetails: any = event; // For logging the original event/string

    // Use type guards to check the actual type of the event
    if (event instanceof ErrorEvent) {
        // It's a detailed script error
        errorMessage = `Worker script error: ${event.message} in ${event.filename}:${event.lineno}`;
        errorDetails = { // Log richer details if available
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error // The actual Error object, if provided
        };
        console.error("Worker ErrorEvent:", errorMessage, errorDetails.error || '');
    } else if (typeof event === 'string') {
        // It's a simple string message (less common for script errors)
        errorMessage = `Worker error: ${event}`;
        console.error("Worker error string:", errorMessage);
    } else {
        // It might be a generic Event or something unexpected
        errorMessage = `An unknown error event occurred in the Web Worker (type: ${event?.type ?? 'N/A'}).`;
        console.error(errorMessage, event); // Log the full event object
    }

    // Optional: Post a message back to the main thread with the error info
    try {
        self.postMessage({ type: 'WORKER_ERROR', message: errorMessage, details: errorDetails });
    } catch (postError) {
        console.error("Failed to post error message back to main thread:", postError);
    }

    // Returning true might prevent the default error handling in some browsers.
    // You can experiment with returning true or void/undefined.
    return true;
};

// Optional: Catch unhandled promise rejections within the worker
self.onunhandledrejection = (event: PromiseRejectionEvent) => {
     console.error("Worker unhandled promise rejection:", event.reason);
     // Optionally post message back
     try {
        self.postMessage({ type: 'WORKER_ERROR', message: `Unhandled Rejection: ${event.reason}`, details: event.reason });
     } catch (postError) {
         console.error("Failed to post rejection message back to main thread:", postError);
     }
};

console.log("WebLLM Worker script initialized."); // Log worker start
