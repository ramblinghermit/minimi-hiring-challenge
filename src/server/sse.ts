import { Response } from 'express';
import { StreamEventType } from '../core/types';

export class SSEWriter {
  private res: Response;
  private closed = false;
  private keepAliveTimer: NodeJS.Timeout | null = null;

  constructor(res: Response) {
    this.res = res;
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no');
    (this.res as any).socket?.setNoDelay?.(true);
    this.res.flushHeaders();
    // Immediate padding flush so browser EventSource starts dispatching events on millisecond 0
    this.res.write(': ' + ' '.repeat(2048) + '\n\n');
    if (typeof (this.res as any).flush === 'function') {
      (this.res as any).flush();
    }

    // Heartbeat keepalive ping to prevent connection timeout while awaiting user permission
    this.keepAliveTimer = setInterval(() => {
      if (!this.closed) {
        try {
          this.res.write(': keepalive\n\n');
          if (typeof (this.res as any).flush === 'function') {
            (this.res as any).flush();
          }
        } catch {
          this.close();
        }
      }
    }, 15000);
  }

  public send(event: StreamEventType, data: any): void {
    if (this.closed) return;
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${payload}\n\n`);
      if (typeof (this.res as any).flush === 'function') {
        (this.res as any).flush();
      }
    } catch {
      this.closed = true;
    }
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    try {
      this.res.end();
    } catch {
      // already closed
    }
  }
}
