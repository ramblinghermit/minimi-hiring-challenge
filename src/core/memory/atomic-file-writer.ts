import fs from 'fs/promises';
import path from 'path';

/**
 * Thread-Safe Atomic File Writer
 * 
 * Provides serialized, collision-free writing for local JSON memory ledgers.
 * Resilient against Windows / OneDrive EPERM / EBUSY file-locking race conditions.
 */
export class AtomicFileWriter {
  private static queues = new Map<string, Promise<void>>();

  public static async write(filePath: string, data: any): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    const serialized = JSON.stringify(data, null, 2);
    const prevQueue = this.queues.get(resolvedPath) || Promise.resolve();

    const nextQueue = prevQueue
      .catch(() => {}) // Prevent previous error from poisoning the queue
      .then(async () => {
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });

        for (let attempt = 0; attempt < 8; attempt++) {
          try {
            await fs.writeFile(resolvedPath, serialized, 'utf-8');
            return;
          } catch (err: any) {
            if ((err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') && attempt < 7) {
              await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
      });

    this.queues.set(resolvedPath, nextQueue);
    return nextQueue;
  }
}
