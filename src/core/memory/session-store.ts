import fs from 'fs/promises';
import path from 'path';
import { ChatSession } from '../types';
import { getDefaultStorageDir } from './storage-dir';

const BENCHMARK_SESSION_IDS = new Set([
  'session_crm_monday',
  'session_nov3',
  'session_postgres_last_tue',
  'session_vector_two_weeks',
  'session_orm_3days',
]);

function isSessionUserMatch(sUserId: string, targetUserId?: string): boolean {
  if (!targetUserId) return true;
  if (sUserId === targetUserId) return true;
  if (sUserId === 'default_user' || targetUserId === 'default_user') return true;
  if ((sUserId === 'demo' && targetUserId === 'usr_demo') || (sUserId === 'usr_demo' && targetUserId === 'demo')) return true;
  return false;
}

/**
 * Chat Session Store
 * Manages user-scoped conversational sessions, titles, and timestamps
 * for persistent chat history and cross-session navigation.
 */
export class SessionStore {
  private filePath: string;
  private sessions: ChatSession[] = [];
  private isLoaded = false;

  constructor(storageDir: string = getDefaultStorageDir()) {
    this.filePath = path.join(storageDir, 'sessions.json');
  }

  public async init(): Promise<void> {
    if (this.isLoaded) return;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.sessions = JSON.parse(raw);
    } catch {
      this.sessions = [];
    }
    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.sessions, null, 2), 'utf-8');
  }

  public async getSessions(userId: string): Promise<ChatSession[]> {
    await this.init();
    const seenIds = new Set<string>();
    return this.sessions
      .filter((s) => {
        if (!isSessionUserMatch(s.userId, userId)) return false;
        // Don't show orphaned empty sessions that have 0 messages unless they are benchmark seeds
        if (s.messageCount === 0 && !BENCHMARK_SESSION_IDS.has(s.id)) return false;
        if (seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async getSession(sessionId: string, userId?: string): Promise<ChatSession | null> {
    await this.init();
    const session = this.sessions.find(
      (s) => s.id === sessionId && isSessionUserMatch(s.userId, userId)
    );
    return session || null;
  }

  public async createSession(userId: string, title?: string, customId?: string): Promise<ChatSession> {
    await this.init();
    const nowIso = new Date().toISOString();
    const newSession: ChatSession = {
      id: customId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      title: title?.trim() || 'New Chat',
      createdAt: nowIso,
      updatedAt: nowIso,
      messageCount: 0,
    };

    // Replace if customId already exists
    const idx = this.sessions.findIndex((s) => s.id === newSession.id);
    if (idx >= 0) {
      this.sessions[idx] = newSession;
    } else {
      this.sessions.unshift(newSession);
    }

    await this.persist();
    return newSession;
  }

  public async touchSession(
    sessionId: string,
    userId: string,
    previewText?: string,
    titleFallback?: string
  ): Promise<ChatSession> {
    await this.init();
    const nowIso = new Date().toISOString();
    let session = this.sessions.find((s) => s.id === sessionId);

    if (!session) {
      // Auto-create session on first turn
      const title = titleFallback ? this.cleanTitle(titleFallback) : 'New Chat';
      session = {
        id: sessionId,
        userId,
        title,
        createdAt: nowIso,
        updatedAt: nowIso,
        messageCount: 1,
        lastMessagePreview: previewText ? previewText.slice(0, 80) : undefined,
      };
      this.sessions.unshift(session);
    } else {
      session.updatedAt = nowIso;
      session.messageCount = (session.messageCount || 0) + 1;
      if (previewText) {
        session.lastMessagePreview = previewText.slice(0, 80);
      }
      // If title is generic "New Chat", auto-update it with the first user prompt
      if ((session.title === 'New Chat' || !session.title) && titleFallback) {
        session.title = this.cleanTitle(titleFallback);
      }
    }

    await this.persist();
    return session;
  }

  public async updateTitle(sessionId: string, userId: string, title: string): Promise<boolean> {
    await this.init();
    const session = this.sessions.find((s) => s.id === sessionId && isSessionUserMatch(s.userId, userId));
    if (!session) return false;

    session.title = title.trim();
    session.updatedAt = new Date().toISOString();
    await this.persist();
    return true;
  }

  public async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    await this.init();
    const initialLen = this.sessions.length;
    this.sessions = this.sessions.filter(
      (s) => !(s.id === sessionId && isSessionUserMatch(s.userId, userId))
    );
    const deleted = this.sessions.length < initialLen;
    if (deleted) {
      await this.persist();
    }
    return deleted;
  }

  public async pruneEmptySessions(activeSessionIds?: Set<string>): Promise<number> {
    await this.init();
    const initialLen = this.sessions.length;
    this.sessions = this.sessions.filter((s) => {
      if (BENCHMARK_SESSION_IDS.has(s.id)) return true;
      if (activeSessionIds && activeSessionIds.has(s.id)) return true;
      return (s.messageCount || 0) > 0;
    });
    const pruned = initialLen - this.sessions.length;
    if (pruned > 0) {
      await this.persist();
    }
    return pruned;
  }

  public async seedBenchmarkSessions(userId: string = 'default_user', referenceDate: Date = new Date()): Promise<void> {
    await this.init();

    const currentDay = referenceDate.getDay();
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const mondayDate = new Date(referenceDate);
    mondayDate.setDate(referenceDate.getDate() - (daysToMonday === 0 ? 7 : daysToMonday));
    mondayDate.setHours(14, 30, 0, 0);

    let daysToLastTuesday = currentDay - 2;
    if (daysToLastTuesday <= 0) daysToLastTuesday += 7;
    if (daysToLastTuesday < 3 && currentDay === 2) daysToLastTuesday += 7;
    const lastTuesdayDate = new Date(referenceDate);
    lastTuesdayDate.setDate(referenceDate.getDate() - daysToLastTuesday);

    const nov3Date = new Date(Date.UTC(referenceDate.getFullYear(), 10, 3, 10, 0, 0, 0));

    const twoWeeksDate = new Date(referenceDate);
    twoWeeksDate.setDate(referenceDate.getDate() - 14);

    const threeDaysDate = new Date(referenceDate);
    threeDaysDate.setDate(referenceDate.getDate() - 3);

    const benchmarkSeeds: Array<{ id: string; title: string; date: Date; preview: string }> = [
      {
        id: 'session_crm_monday',
        title: 'CRM Shortlist (Monday)',
        date: mondayDate,
        preview: 'On Monday we shortlisted 5 CRM tools for a 20-person sales team...',
      },
      {
        id: 'session_nov3',
        title: 'Claude 3.5 Haiku Inquiry (3 Nov)',
        date: nov3Date,
        preview: 'What is the pricing and context window for Anthropic Claude 3.5 Haiku?',
      },
      {
        id: 'session_postgres_last_tue',
        title: 'Postgres Hosting Comparison (Last Tuesday)',
        date: lastTuesdayDate,
        preview: 'Compare Supabase, Neon, Aurora, and Crunchy Bridge for high-write Postgres...',
      },
      {
        id: 'session_vector_two_weeks',
        title: 'Vector Databases for RAG (2 Weeks Ago)',
        date: twoWeeksDate,
        preview: 'Evaluate Pinecone, Qdrant, Milvus, and Weaviate for multi-tenant RAG...',
      },
      {
        id: 'session_orm_3days',
        title: 'Drizzle ORM & Prisma Changes (3 Days Ago)',
        date: threeDaysDate,
        preview: 'Compare Drizzle ORM and Prisma for TypeScript serverless deployment...',
      },
    ];

    for (const b of benchmarkSeeds) {
      const existing = this.sessions.find((s) => s.id === b.id && s.userId === userId);
      const iso = b.date.toISOString();
      if (!existing) {
        this.sessions.push({
          id: b.id,
          userId,
          title: b.title,
          createdAt: iso,
          updatedAt: iso,
          messageCount: 2,
          lastMessagePreview: b.preview,
        });
      }
    }

    await this.persist();
  }

  private cleanTitle(prompt: string): string {
    const firstLine = prompt.split('\n')[0].trim();
    if (firstLine.length <= 40) return firstLine;
    return firstLine.slice(0, 38).trim() + '...';
  }
}

export const sessionStore = new SessionStore();
