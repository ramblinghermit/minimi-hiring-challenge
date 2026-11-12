import { Response } from 'express';
import { StreamEventType } from '../core/types';

export class SSEWriter {
  private res: Response;

  constructor(res: Response) {
    this.res = res;
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no');
    this.res.flushHeaders();
  }

  public send(event: StreamEventType, data: any): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${payload}\n\n`);
  }

  public close(): void {
    this.res.end();
  }
}
