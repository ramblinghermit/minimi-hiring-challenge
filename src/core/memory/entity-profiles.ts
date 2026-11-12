import fs from 'fs/promises';
import path from 'path';
import { EntityProfile } from '../types';

/**
 * Brain-Vault Deterministic Entity Profile Store
 * Bypasses fuzzy vector search to guarantee 100% deterministic recall of shortlisted entities.
 * (Directly ports Brain-Vault's _inject_entity_profiles pattern)
 */
export class EntityProfileStore {
  private filePath: string;
  private profiles: EntityProfile[] = [];
  private isLoaded = false;

  constructor(storageDir: string = path.join(process.cwd(), '.data', 'brain_vault')) {
    this.filePath = path.join(storageDir, 'entities.json');
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.profiles = JSON.parse(raw);
    } catch {
      this.profiles = [];
    }
    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.profiles, null, 2), 'utf-8');
  }

  public async upsertProfile(profile: Omit<EntityProfile, 'id' | 'lastObservedAt'>): Promise<EntityProfile> {
    await this.ensureLoaded();
    const nowIso = new Date().toISOString();
    const existingIndex = this.profiles.findIndex(
      (p) => p.entityName.toLowerCase() === profile.entityName.toLowerCase()
    );

    if (existingIndex >= 0) {
      this.profiles[existingIndex] = {
        ...this.profiles[existingIndex],
        ...profile,
        profileData: {
          ...this.profiles[existingIndex].profileData,
          ...profile.profileData,
        },
        lastObservedAt: nowIso,
      };
      await this.persist();
      return this.profiles[existingIndex];
    }

    const newProfile: EntityProfile = {
      ...profile,
      id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      lastObservedAt: nowIso,
    };
    this.profiles.push(newProfile);
    await this.persist();
    return newProfile;
  }

  /**
   * Deterministic matching on query string (word boundary match)
   * Matches Brain-Vault's regex pattern to avoid false substring matches.
   */
  public async matchProfiles(query: string): Promise<EntityProfile[]> {
    await this.ensureLoaded();
    const queryLower = query.toLowerCase();
    const matched: EntityProfile[] = [];

    for (const profile of this.profiles) {
      const name = profile.entityName.toLowerCase();
      // Word boundary regex check
      const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(queryLower)) {
        matched.push(profile);
      }
    }

    return matched;
  }

  public async getByCategory(category: EntityProfile['category']): Promise<EntityProfile[]> {
    await this.ensureLoaded();
    return this.profiles.filter((p) => p.category === category);
  }

  public async getAll(): Promise<EntityProfile[]> {
    await this.ensureLoaded();
    return [...this.profiles];
  }

  public async clear(): Promise<void> {
    this.profiles = [];
    await this.persist();
  }
}
