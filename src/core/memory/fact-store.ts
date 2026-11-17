import fs from 'fs/promises';
import path from 'path';
import { FactEntry } from '../types';
import { getDefaultStorageDir } from './storage-dir';
import { AtomicFileWriter } from './atomic-file-writer';

export function isFactUserMatch(factUserId?: string, targetUserId?: string): boolean {
  const normFact = factUserId || 'default_user';
  const normTarget = targetUserId || 'default_user';

  if (normFact === normTarget) return true;
  if ((normFact === 'demo' && normTarget === 'usr_demo') || (normFact === 'usr_demo' && normTarget === 'demo')) return true;
  if ((normTarget === 'demo' || normTarget === 'usr_demo') && normFact === 'default_user') return true;
  return false;
}

/**
 * Tri-Temporal Fact Store
 * Models truth as (subject, predicate, object) with validFrom, validUntil, isSuperseded.
 */
export class FactStore {
  private filePath: string;
  private facts: FactEntry[] = [];
  private isLoaded = false;
  private lastMtimeMs = 0;

  constructor(storageDir: string = getDefaultStorageDir()) {
    this.filePath = path.join(storageDir, 'facts.json');
  }

  private async ensureLoaded(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const stat = await fs.stat(this.filePath);
      if (this.isLoaded && stat.mtimeMs <= this.lastMtimeMs) {
        return;
      }
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.facts = JSON.parse(raw);
      this.lastMtimeMs = stat.mtimeMs;
      this.isLoaded = true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.facts = [];
        this.lastMtimeMs = 0;
        this.isLoaded = true;
      } else if (!this.isLoaded) {
        this.facts = [];
        this.isLoaded = true;
      }
    }
  }

  private async persist(): Promise<void> {
    await AtomicFileWriter.write(this.filePath, this.facts);
    try {
      const stat = await fs.stat(this.filePath);
      this.lastMtimeMs = stat.mtimeMs;
    } catch {
      this.lastMtimeMs = Date.now();
    }
  }

  /**
   * Create a new fact or supersede an existing one
   */
  public async addFact(fact: Omit<FactEntry, 'id' | 'createdAt' | 'isSuperseded'> & { isSuperseded?: boolean }): Promise<FactEntry> {
    await this.ensureLoaded();

    // Check if this fact supersedes an active fact with same subject and predicate for this user/shared
    const nowIso = new Date().toISOString();
    const existing = this.facts.find(
      (f) => !f.isSuperseded &&
        f.subject.toLowerCase() === fact.subject.toLowerCase() &&
        f.predicate.toLowerCase() === fact.predicate.toLowerCase() &&
        isFactUserMatch(f.userId, fact.userId)
    );

    if (existing) {
      existing.isSuperseded = true;
      existing.validUntil = nowIso;
    }

    const newFact: FactEntry = {
      ...fact,
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      isSuperseded: fact.isSuperseded ?? false,
      validFrom: fact.validFrom || nowIso,
      validUntil: fact.validUntil ?? null,
      createdAt: nowIso,
    };

    this.facts.push(newFact);
    await this.persist();
    return newFact;
  }

  /**
   * Search active (non-superseded) facts by subject or keyword
   */
  public async getActiveFacts(query?: string, userId?: string): Promise<FactEntry[]> {
    await this.ensureLoaded();
    const active = this.facts.filter((f) => !f.isSuperseded && isFactUserMatch(f.userId, userId));
    if (!query) return active;

    const lower = query.toLowerCase();
    return active.filter(
      (f) =>
        f.subject.toLowerCase().includes(lower) ||
        f.predicate.toLowerCase().includes(lower) ||
        f.object.toLowerCase().includes(lower)
    );
  }

  /**
   * Get all facts for subject (including superseded history)
   */
  public async getFactHistory(subject: string): Promise<FactEntry[]> {
    await this.ensureLoaded();
    const lower = subject.toLowerCase();
    return this.facts
      .filter((f) => f.subject.toLowerCase() === lower)
      .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
  }

  public async getAll(): Promise<FactEntry[]> {
    await this.ensureLoaded();
    return [...this.facts];
  }

  public async clear(): Promise<void> {
    this.facts = [];
    await this.persist();
  }
}
