import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Minimal async event bus. Every event is journaled to a JSONL file. */
export class EventBus {
  constructor(logFile, { reset = true } = {}) {
    this.logFile = logFile;
    this.handlers = new Map();
    mkdirSync(dirname(logFile), { recursive: true });
    if (reset) writeFileSync(logFile, '');
  }

  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(handler);
  }

  /** Journals the event, then awaits each subscriber in registration order. */
  async emit(type, payload = {}) {
    const event = { ts: new Date().toISOString(), type, payload };
    appendFileSync(this.logFile, JSON.stringify(event) + '\n');
    // '*' subscribers observe every event (used for the "last event" line).
    for (const handler of [...(this.handlers.get('*') ?? []), ...(this.handlers.get(type) ?? [])]) {
      await handler(payload, event);
    }
  }
}
