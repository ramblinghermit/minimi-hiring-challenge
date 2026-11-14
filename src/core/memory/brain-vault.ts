import { EpisodicStore } from './episodic-store';
import { FactStore } from './fact-store';
import { EntityProfileStore } from './entity-profiles';
import { SessionStore } from './session-store';
import { TemporalParser } from './temporal-parser';
import { KnowledgeExtractor } from './knowledge-extractor';
import { BrainVaultContext, BrainVaultView, EntityProfile, FactEntry, MemoryEntry } from '../types';
import { seedBenchmarkScenarios } from './seed-scenarios';
import { getDefaultStorageDir } from './storage-dir';

/**
 * Brain-Vault Memory Engine (TypeScript Port)
 * Direct architectural implementation of Brain-Vault's Multi-View Retrieval (retrieval_service_v2.py)
 * Supports:
 * - Episodic View (time-based memory log)
 * - State View (current truth / active facts)
 * - Deterministic Entity Profile Injection
 * - Auto Hybrid routing
 * - Pre-invocation Proactive Recall
 * - Persistent User-Scoped Chat Sessions
 */
export class BrainVaultEngine {
  public episodic: EpisodicStore;
  public facts: FactStore;
  public entities: EntityProfileStore;
  public sessions: SessionStore;
  private isInitialized = false;

  constructor(storageDir?: string) {
    const dir = storageDir || getDefaultStorageDir();
    this.episodic = new EpisodicStore(dir);
    this.facts = new FactStore(dir);
    this.entities = new EntityProfileStore(dir);
    this.sessions = new SessionStore(dir);
  }

  public async init(referenceDate: Date = new Date()): Promise<void> {
    if (this.isInitialized) return;
    await this.sessions.init();
    // Auto-seed benchmark scenarios if storage is empty
    const allMemories = await this.episodic.getAll();
    if (allMemories.length === 0) {
      await seedBenchmarkScenarios(this.episodic, this.facts, this.entities, referenceDate);
      await this.sessions.seedBenchmarkSessions('default_user', referenceDate);
    }
    this.isInitialized = true;
  }

  /**
   * Proactive Direct Recall (Pre-Invocation)
   * Intercepts the user prompt, resolves temporal anchors, retrieves relevant views,
   * and prepares enriched context before the model or search tool begins reasoning.
   */
  public async retrieve(
    prompt: string,
    view: BrainVaultView = 'auto',
    referenceDate: Date = new Date(),
    userId?: string
  ): Promise<BrainVaultContext> {
    await this.init(referenceDate);

    // 1. Resolve Temporal Anchor if present
    const temporalAnchor = TemporalParser.parse(prompt, referenceDate);
    const hasDeltaIntent = TemporalParser.hasTemporalDeltaIntent(prompt);

    let episodicMemories: MemoryEntry[] = [];
    let activeFacts: FactEntry[] = [];
    let matchedProfiles: EntityProfile[] = [];

    // 2. Deterministic Entity Profile Injection (Bypasses fuzzy search)
    // First match against prompt text directly
    matchedProfiles = await this.entities.matchProfiles(prompt);

    // 3. Multi-View Routing
    if (view === 'episodic' || view === 'auto') {
      if (temporalAnchor) {
        episodicMemories = await this.episodic.getByTemporalRange(temporalAnchor, userId);
        
        // If exact range yielded 0, try a slightly relaxed +/- 24h window
        if (episodicMemories.length === 0) {
          const startMs = new Date(temporalAnchor.startDate).getTime() - 86400000;
          const endMs = new Date(temporalAnchor.endDate).getTime() + 86400000;
          episodicMemories = await this.episodic.getByTemporalRange({
            startDate: new Date(startMs).toISOString(),
            endDate: new Date(endMs).toISOString(),
            label: temporalAnchor.label,
            anchorType: temporalAnchor.anchorType,
          }, userId);
        }
      }
      
      // Dynamic Salient Keyword & Cross-Chat Memory Search:
      // Search episodic store for relevant words from user prompt
      const stopwords = new Set([
        'what', 'which', 'where', 'when', 'who', 'how', 'why', 'did', 'does', 'have', 'has',
        'asked', 'about', 'tell', 'show', 'pricing', 'changed', 'since', 'then', 'today',
        'there', 'their', 'they', 'with', 'from', 'that', 'this', 'last', 'week', 'days',
        'the', 'and', 'for', 'our', 'use', 'just', 'say', 'like', 'mention', 'pick', 'favorite'
      ]);

      const words = prompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopwords.has(w));

      for (const w of words) {
        const found = await this.episodic.searchByKeyword(w, 5, userId);
        for (const mem of found) {
          if (!episodicMemories.some((m) => m.id === mem.id)) {
            episodicMemories.push(mem);
          }
        }
        if (episodicMemories.length >= 10) break;
      }

      // If user is asking about prior discussions/preferences ("what did I say", "which ORM do we use", "what is my favorite")
      // pull recent user conversational turns across previous sessions
      const isRecallIntent = /(what|which|who|where)\s+(did|do|was)\s+(i|we|you)|(favorite|remember|preference|stack|choice|decision|say|said|tell|told|use|pick)/i.test(prompt);
      if (isRecallIntent && episodicMemories.length < 5) {
        const allUserEntries = (await this.episodic.getAll())
          .filter((e) => (!userId || e.userId === userId || e.userId === 'default_user'))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);
        for (const mem of allUserEntries) {
          if (!episodicMemories.some((m) => m.id === mem.id)) {
            episodicMemories.push(mem);
          }
        }
      }

      // If we found episodic memories, dynamically inject entity profiles mentioned inside them
      if (episodicMemories.length > 0) {
        for (const mem of episodicMemories) {
          if (mem.metadata?.entities) {
            for (const entName of mem.metadata.entities) {
              const profiles = await this.entities.matchProfiles(entName);
              for (const p of profiles) {
                if (!matchedProfiles.some((existing) => existing.id === p.id)) {
                  matchedProfiles.push(p);
                }
              }
            }
          }
        }
      }
    }

    if (view === 'state' || view === 'auto') {
      activeFacts = await this.facts.getActiveFacts();
      // Filter active facts relevant to matched profiles or prompt keywords
      if (matchedProfiles.length > 0) {
        const entityNames = new Set(matchedProfiles.map((p) => p.entityName.toLowerCase()));
        activeFacts = activeFacts.filter((f) => entityNames.has(f.subject.toLowerCase()) || f.subject.toLowerCase() === 'user' || f.subject.toLowerCase() === 'project');
      } else {
        const promptLower = prompt.toLowerCase();
        const relevantFacts = activeFacts.filter((f) =>
          f.subject.toLowerCase() === 'user' ||
          f.subject.toLowerCase() === 'project' ||
          promptLower.includes(f.subject.toLowerCase()) ||
          promptLower.includes(f.predicate.toLowerCase()) ||
          promptLower.includes(f.object.toLowerCase())
        );
        if (relevantFacts.length > 0) {
          activeFacts = relevantFacts;
        }
      }
    }

    // 4. Construct Structured Context String for LLM
    let contextParts: string[] = [];

    if (temporalAnchor) {
      contextParts.push(`[TEMPORAL ANCHOR DETECTED: ${temporalAnchor.label}]`);
    }

    if (episodicMemories.length > 0) {
      contextParts.push('### Retrieved Episodic Memory (Past Conversations):');
      for (const mem of episodicMemories) {
        const dateStr = new Date(mem.createdAt).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        contextParts.push(`- [${dateStr}] ${mem.role.toUpperCase()}: ${mem.content}`);
      }
    }

    if (matchedProfiles.length > 0) {
      contextParts.push('### Deterministic Entity Profiles (Shortlisted / Baseline State):');
      for (const prof of matchedProfiles) {
        contextParts.push(`- **${prof.entityName}** (${prof.category}): ${JSON.stringify(prof.profileData)}`);
      }
    }

    if (activeFacts.length > 0) {
      contextParts.push('### Active Brain-Vault Facts:');
      for (const fact of activeFacts) {
        contextParts.push(`- ${fact.subject} -> ${fact.predicate}: "${fact.object}" (valid from: ${fact.validFrom})`);
      }
    }

    const injectedContextString = contextParts.join('\n\n');

    return {
      episodicMemories,
      activeFacts,
      entityProfiles: matchedProfiles,
      temporalAnchor: temporalAnchor || undefined,
      injectedContextString,
    };
  }

  /**
   * Post-turn knowledge capture
   * Asynchronously records the new turn and extracts facts
   */
  public async captureTurn(
    userId: string,
    sessionId: string,
    userQuery: string,
    assistantResponse: string,
    citations?: any[],
    scratchpad?: string[],
    customTimestamp?: string
  ): Promise<void> {
    const nowIso = customTimestamp || new Date().toISOString();

    // 1. Run Autonomous Knowledge & Fact Extraction (System-level, Zero LLM cost)
    const extracted = KnowledgeExtractor.extract(userQuery, assistantResponse, userId, nowIso);

    // 2. Add user message to episodic store
    await this.episodic.addEntry({
      userId,
      sessionId,
      role: 'user',
      content: userQuery,
      createdAt: nowIso,
    });

    // 3. Add assistant message with discovered entities & topics
    await this.episodic.addEntry({
      userId,
      sessionId,
      role: 'assistant',
      content: assistantResponse,
      createdAt: nowIso,
      metadata: {
        citations,
        scratchpad,
        entities: extracted.entities,
        topics: extracted.topics,
      },
    });

    // 4. Automatically upsert discovered entity profiles
    for (const profile of extracted.profiles) {
      await this.entities.upsertProfile(profile);
    }

    // 5. Automatically record tri-temporal facts
    for (const fact of extracted.facts) {
      await this.facts.addFact(fact);
    }

    // 6. Update session metadata and auto-title
    await this.sessions.touchSession(sessionId, userId, userQuery, userQuery);
  }

  /**
   * Reset data to clean state and reseed
   */
  public async resetAndReseed(referenceDate: Date = new Date(), userId: string = 'default_user'): Promise<void> {
    await this.episodic.clear();
    await this.facts.clear();
    await this.entities.clear();
    await seedBenchmarkScenarios(this.episodic, this.facts, this.entities, referenceDate);
    await this.sessions.seedBenchmarkSessions(userId, referenceDate);
  }
}

export const brainVault = new BrainVaultEngine();
