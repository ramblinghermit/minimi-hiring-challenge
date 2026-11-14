import fs from 'fs/promises';
import path from 'path';
import { FactEntry } from '../types';
import { getDefaultStorageDir } from './storage-dir';

/**
 * Brain-Vault Tri-Temporal Fact Store
 * Models truth as (subject, predicate, object) with validFrom, validUntil, isSuperseded.
 * Directly based on Brain-Vault's fact_service.py logic.
 */
export class FactStore {
  private filePath: string;
  private facts: FactEntry[] = [];
  private isLoaded = false;

  constructor(storageDir: string = getDefaultStorageDir()) {
    this.filePath = path.join(storageDir, 'facts.json');
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.facts = JSON.parse(raw);
    } catch {
      this.facts = [];
    }
    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.facts, null, 2), 'utf-8');
  }

  /**
   * Create a new fact or supersede an existing one
   */
  public async addFact(fact: Omit<FactEntry, 'id' | 'createdAt' | 'isSuperseded'> & { isSuperseded?: boolean }): Promise<FactEntry> {
    await this.ensureLoaded();

    // Check if this fact supersedes an active fact with same subject and predicate
    const nowIso = new Date().toISOString();
    const existing = this.facts.find(
      (f) => !f.isSuperseded && f.subject.toLowerCase() === fact.subject.toLowerCase() && f.predicate.toLowerCase() === fact.predicate.toLowerCase()
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
  public async getActiveFacts(query?: string): Promise<FactEntry[]> {
    await this.ensureLoaded();
    const active = this.facts.filter((f) => !f.isSuperseded);
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
