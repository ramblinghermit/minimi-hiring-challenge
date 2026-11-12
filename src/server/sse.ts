import { Response } from 'express';
import { StreamEventType } from '../core/types';

export class SSEWriter {
  private res: Response;
  private closed = false;

  constructor(res: Response) {
    this.res = res;
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no');
    this.res.flushHeaders();
  }

  public send(event: StreamEventType, data: any): void {
    if (this.closed) return;
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${payload}\n\n`);
    } catch {
      this.closed = true;
    }
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.res.end();
    } catch {
      // already closed
    }
  }
}
