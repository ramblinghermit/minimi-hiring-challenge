import fs from 'fs/promises';
import path from 'path';
import { MemoryEntry, TemporalRange } from '../types';
import { getDefaultStorageDir } from './storage-dir';
import { AtomicFileWriter } from './atomic-file-writer';

export function isEpisodicUserMatch(entryUserId?: string, targetUserId?: string): boolean {
  const normEntry = entryUserId || 'default_user';
  const normTarget = targetUserId || 'default_user';

  if (normEntry === normTarget) return true;
  // Demo aliases for demo/eval sessions
  if ((normEntry === 'demo' && normTarget === 'usr_demo') || (normEntry === 'usr_demo' && normTarget === 'demo')) return true;
  // Allow demo users to inherit pre-seeded default_user benchmark history
  if ((normTarget === 'demo' || normTarget === 'usr_demo') && normEntry === 'default_user') return true;

  return false;
}

/**
 * Episodic Store
 * Append-only, time-indexed conversational memory ledger with atomic local persistence.
 */
export class EpisodicStore {
  private filePath: string;
  private entries: MemoryEntry[] = [];
  private isLoaded = false;
  private lastMtimeMs = 0;

  constructor(storageDir: string = getDefaultStorageDir()) {
    this.filePath = path.join(storageDir, 'episodic.json');
  }

  private async ensureLoaded(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const stat = await fs.stat(this.filePath);
      if (this.isLoaded && stat.mtimeMs <= this.lastMtimeMs) {
        return;
      }
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.entries = JSON.parse(raw);
      this.lastMtimeMs = stat.mtimeMs;
      this.isLoaded = true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.entries = [];
        this.lastMtimeMs = 0;
        this.isLoaded = true;
      } else if (!this.isLoaded) {
        this.entries = [];
        this.isLoaded = true;
      }
    }
  }

  private async persist(): Promise<void> {
    await AtomicFileWriter.write(this.filePath, this.entries);
    try {
      const stat = await fs.stat(this.filePath);
      this.lastMtimeMs = stat.mtimeMs;
    } catch {
      this.lastMtimeMs = Date.now();
    }
  }

  public async addEntry(entry: Omit<MemoryEntry, 'id' | 'createdAt'> & { createdAt?: string }): Promise<MemoryEntry> {
    await this.ensureLoaded();
    const newEntry: MemoryEntry = {
      ...entry,
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    this.entries.push(newEntry);
    await this.persist();
    return newEntry;
  }

  public async getByTemporalRange(range: TemporalRange, userId?: string): Promise<MemoryEntry[]> {
    await this.ensureLoaded();
    const start = new Date(range.startDate).getTime();
    const end = new Date(range.endDate).getTime();

    return this.entries.filter((entry) => {
      const entryTime = new Date(entry.createdAt).getTime();
      const inRange = entryTime >= start && entryTime <= end;
      if (!inRange) return false;
      return isEpisodicUserMatch(entry.userId, userId);
    });
  }

  public async searchByKeyword(keyword: string, limit: number = 10, userId?: string): Promise<MemoryEntry[]> {
    await this.ensureLoaded();
    const lower = keyword.toLowerCase().trim();
    const stem = lower.length > 4 ? lower.slice(0, Math.max(3, lower.length - 2)) : lower;

    return this.entries
      .filter((entry) => {
        if (!isEpisodicUserMatch(entry.userId, userId)) return false;
        const contentLower = entry.content.toLowerCase();
        if (contentLower.includes(lower)) return true;
        if (stem.length >= 3 && contentLower.includes(stem)) return true;
        if (entry.metadata?.entities?.some(e => e.toLowerCase().includes(lower) || (stem.length >= 3 && e.toLowerCase().includes(stem)))) return true;
        if (entry.metadata?.topics?.some(t => t.toLowerCase().includes(lower) || (stem.length >= 3 && t.toLowerCase().includes(stem)))) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  public async getSessionHistory(sessionId: string, userId?: string): Promise<MemoryEntry[]> {
    await this.ensureLoaded();
    return this.entries
      .filter((e) => {
        if (e.sessionId !== sessionId) return false;
        return isEpisodicUserMatch(e.userId, userId);
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  public async deleteSession(sessionId: string, userId?: string): Promise<boolean> {
    await this.ensureLoaded();
    const initialLen = this.entries.length;
    this.entries = this.entries.filter((e) => {
      if (e.sessionId === sessionId) {
        if (!userId || isEpisodicUserMatch(e.userId, userId)) {
          return false;
        }
      }
      return true;
    });
    const changed = this.entries.length < initialLen;
    if (changed) {
      await this.persist();
    }
    return changed;
  }

  public async getAll(): Promise<MemoryEntry[]> {
    await this.ensureLoaded();
    return [...this.entries];
  }

  public async clear(): Promise<void> {
    this.entries = [];
    await this.persist();
  }
}
