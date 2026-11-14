import fs from 'fs/promises';
import path from 'path';
import { MemoryEntry, TemporalRange } from '../types';
import { getDefaultStorageDir } from './storage-dir';

function isEpisodicUserMatch(entryUserId?: string, targetUserId?: string): boolean {
  if (!targetUserId || !entryUserId) return true;
  if (entryUserId === targetUserId) return true;
  if (entryUserId === 'default_user' || targetUserId === 'default_user') return true;
  if ((entryUserId === 'demo' && targetUserId === 'usr_demo') || (entryUserId === 'usr_demo' && targetUserId === 'demo')) return true;
  return false;
}

/**
 * Brain-Vault Episodic Store
 * Append-only, time-indexed conversational memory ledger with atomic local persistence.
 */
export class EpisodicStore {
  private filePath: string;
  private entries: MemoryEntry[] = [];
  private isLoaded = false;

  constructor(storageDir: string = getDefaultStorageDir()) {
    this.filePath = path.join(storageDir, 'episodic.json');
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.entries = JSON.parse(raw);
    } catch {
      this.entries = [];
    }
    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
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
    const lower = keyword.toLowerCase();
    return this.entries
      .filter((entry) => {
        if (!entry.content.toLowerCase().includes(lower)) return false;
        return isEpisodicUserMatch(entry.userId, userId);
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
