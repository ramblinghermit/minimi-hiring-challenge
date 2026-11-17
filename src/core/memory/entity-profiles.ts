import fs from 'fs/promises';
import path from 'path';
import { EntityProfile } from '../types';
import { getDefaultStorageDir } from './storage-dir';
import { AtomicFileWriter } from './atomic-file-writer';

export function isProfileUserMatch(profileUserId?: string, targetUserId?: string): boolean {
  const normProf = profileUserId || 'default_user';
  const normTarget = targetUserId || 'default_user';
  if (normProf === normTarget) return true;
  if ((normProf === 'demo' && normTarget === 'usr_demo') || (normProf === 'usr_demo' && normTarget === 'demo')) return true;
  if ((normTarget === 'demo' || normTarget === 'usr_demo') && normProf === 'default_user') return true;
  return false;
}

/**
 * Deterministic Entity Profile Store
 * Bypasses fuzzy vector search to guarantee 100% deterministic recall of shortlisted entities.
 */
export class EntityProfileStore {
  private filePath: string;
  private profiles: EntityProfile[] = [];
  private isLoaded = false;
  private lastMtimeMs = 0;

  constructor(storageDir: string = getDefaultStorageDir()) {
    this.filePath = path.join(storageDir, 'entities.json');
  }

  private async ensureLoaded(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const stat = await fs.stat(this.filePath);
      if (this.isLoaded && stat.mtimeMs <= this.lastMtimeMs) {
        return;
      }
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.profiles = JSON.parse(raw);
      this.lastMtimeMs = stat.mtimeMs;
      this.isLoaded = true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.profiles = [];
        this.lastMtimeMs = 0;
        this.isLoaded = true;
      } else if (!this.isLoaded) {
        this.profiles = [];
        this.isLoaded = true;
      }
    }
  }

  private async persist(): Promise<void> {
    await AtomicFileWriter.write(this.filePath, this.profiles);
    try {
      const stat = await fs.stat(this.filePath);
      this.lastMtimeMs = stat.mtimeMs;
    } catch {
      this.lastMtimeMs = Date.now();
    }
  }

  public async upsertProfile(profile: Omit<EntityProfile, 'id' | 'lastObservedAt'>): Promise<EntityProfile> {
    await this.ensureLoaded();
    const nowIso = new Date().toISOString();
    const existingIndex = this.profiles.findIndex(
      (p) => p.entityName.toLowerCase() === profile.entityName.toLowerCase() &&
        isProfileUserMatch(p.userId, profile.userId)
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
   * Regex pattern with word boundaries to avoid false substring matches.
   */
  public async matchProfiles(query: string, userId?: string): Promise<EntityProfile[]> {
    await this.ensureLoaded();
    const queryLower = query.toLowerCase();
    const matched: EntityProfile[] = [];

    for (const profile of this.profiles) {
      if (userId && !isProfileUserMatch(profile.userId, userId)) continue;
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
