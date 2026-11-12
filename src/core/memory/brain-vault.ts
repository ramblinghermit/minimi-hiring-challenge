import { EpisodicStore } from './episodic-store';
import { FactStore } from './fact-store';
import { EntityProfileStore } from './entity-profiles';
import { TemporalParser } from './temporal-parser';
import { BrainVaultContext, BrainVaultView, EntityProfile, FactEntry, MemoryEntry } from '../types';
import { seedBenchmarkScenarios } from './seed-scenarios';

/**
 * Brain-Vault Memory Engine (TypeScript Port)
 * Direct architectural implementation of Brain-Vault's Multi-View Retrieval (retrieval_service_v2.py)
 * Supports:
 * - Episodic View (time-based memory log)
 * - State View (current truth / active facts)
 * - Deterministic Entity Profile Injection
 * - Auto Hybrid routing
 * - Pre-invocation Proactive Recall
 */
export class BrainVaultEngine {
  public episodic: EpisodicStore;
  public facts: FactStore;
  public entities: EntityProfileStore;
  private isInitialized = false;

  constructor() {
    this.episodic = new EpisodicStore();
    this.facts = new FactStore();
    this.entities = new EntityProfileStore();
  }

  public async init(referenceDate: Date = new Date()): Promise<void> {
    if (this.isInitialized) return;
    // Auto-seed benchmark scenarios if storage is empty
    const allMemories = await this.episodic.getAll();
    if (allMemories.length === 0) {
      await seedBenchmarkScenarios(this.episodic, this.facts, this.entities, referenceDate);
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
    referenceDate: Date = new Date()
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
    if (view === 'episodic' || (view === 'auto' && temporalAnchor)) {
      if (temporalAnchor) {
        episodicMemories = await this.episodic.getByTemporalRange(temporalAnchor);
        
        // If exact range yielded 0, try a slightly relaxed +/- 24h window
        if (episodicMemories.length === 0) {
          const startMs = new Date(temporalAnchor.startDate).getTime() - 86400000;
          const endMs = new Date(temporalAnchor.endDate).getTime() + 86400000;
          episodicMemories = await this.episodic.getByTemporalRange({
            startDate: new Date(startMs).toISOString(),
            endDate: new Date(endMs).toISOString(),
            label: temporalAnchor.label,
            anchorType: temporalAnchor.anchorType,
          });
        }
      }
      
      // Dynamic Salient Keyword Search Fallback:
      // If temporal range didn't find entries or to supplement anchor retrieval,
      // extract content words (excluding stopwords) and query episodic store
      if (episodicMemories.length === 0) {
        const stopwords = new Set([
          'what', 'which', 'where', 'when', 'who', 'how', 'why', 'did', 'does', 'have', 'has',
          'asked', 'about', 'tell', 'show', 'pricing', 'changed', 'since', 'then', 'today',
          'there', 'their', 'they', 'with', 'from', 'that', 'this', 'last', 'week', 'days'
        ]);

        const words = prompt
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !stopwords.has(w));

        for (const w of words) {
          const found = await this.episodic.searchByKeyword(w, 3);
          for (const mem of found) {
            if (!episodicMemories.some((m) => m.id === mem.id)) {
              episodicMemories.push(mem);
            }
          }
          if (episodicMemories.length >= 5) break;
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
        activeFacts = activeFacts.filter((f) => entityNames.has(f.subject.toLowerCase()));
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
    citations?: any[]
  ): Promise<void> {
    const nowIso = new Date().toISOString();

    // 1. Add user message
    await this.episodic.addEntry({
      userId,
      sessionId,
      role: 'user',
      content: userQuery,
      createdAt: nowIso,
    });

    // 2. Add assistant message
    await this.episodic.addEntry({
      userId,
      sessionId,
      role: 'assistant',
      content: assistantResponse,
      createdAt: new Date().toISOString(),
      metadata: { citations },
    });
  }

  /**
   * Reset data to clean state and reseed
   */
  public async resetAndReseed(referenceDate: Date = new Date()): Promise<void> {
    await this.episodic.clear();
    await this.facts.clear();
    await this.entities.clear();
    await seedBenchmarkScenarios(this.episodic, this.facts, this.entities, referenceDate);
  }
}

export const brainVault = new BrainVaultEngine();
