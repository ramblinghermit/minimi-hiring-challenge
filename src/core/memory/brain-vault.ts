import { EpisodicStore, isEpisodicUserMatch } from './episodic-store';
import { FactStore } from './fact-store';
import { EntityProfileStore } from './entity-profiles';
import { SessionStore } from './session-store';
import { TemporalParser } from './temporal-parser';
import { KnowledgeExtractor } from './knowledge-extractor';
import { AsyncFactExtractor } from './async-fact-extractor';
import { BrainVaultContext, BrainVaultView, EntityProfile, FactEntry, MemoryEntry } from '../types';
import { seedBenchmarkScenarios } from './seed-scenarios';
import { getDefaultStorageDir } from './storage-dir';

interface SemanticDomainEntry {
  triggers: RegExp;
  expandedKeywords: string[];
  candidateEntities: string[];
}

const SEMANTIC_DOMAIN_MAP: SemanticDomainEntry[] = [
  {
    triggers: /\b(crm|customer relationship|sales pipeline|sales reps|sales team|sales software|account executives|sales tools)\b/i,
    expandedKeywords: ['crm', 'sales', 'shortlist', 'pipeline', 'hubspot', 'pipedrive', 'zoho', 'salesforce', 'close', 'freshsales', 'folk', 'attio', 'copper'],
    candidateEntities: ['HubSpot', 'Pipedrive', 'Zoho CRM', 'Close', 'Salesforce', 'Freshsales', 'Folk', 'Attio', 'Copper', 'Capsule', 'Apollo.io', 'ZoomInfo', 'Salesloft', 'Outreach'],
  },
  {
    triggers: /\b(postgres|postgresql|sql database|relational database|managed postgres|postgres hosting|serverless database)\b/i,
    expandedKeywords: ['postgres', 'postgresql', 'database', 'hosting', 'supabase', 'neon', 'aurora', 'crunchy bridge', 'timescale', 'sql'],
    candidateEntities: ['Supabase', 'Neon', 'AWS Aurora Serverless', 'Crunchy Bridge', 'TimescaleDB', 'PostgreSQL'],
  },
  {
    triggers: /\b(vector|vector database|embedding|embeddings|similarity search|semantic search|rag agent|vector db)\b/i,
    expandedKeywords: ['vector', 'pinecone', 'qdrant', 'milvus', 'weaviate', 'chroma', 'vespa', 'rag', 'embedding'],
    candidateEntities: ['Pinecone', 'Qdrant', 'Milvus', 'Weaviate', 'Chroma', 'Vespa'],
  },
  {
    triggers: /\b(orm|object relational mapper|schema migration|database client|sql client)\b/i,
    expandedKeywords: ['orm', 'prisma', 'drizzle', 'typeorm', 'kysely', 'sequelize'],
    candidateEntities: ['Prisma ORM', 'Drizzle ORM', 'Prisma', 'Drizzle', 'TypeORM', 'Kysely'],
  },
  {
    triggers: /\b(hosting|frontend hosting|edge compute|serverless hosting|jamstack|paas|cloud deployment)\b/i,
    expandedKeywords: ['hosting', 'vercel', 'netlify', 'render', 'railway', 'fly.io', 'koyeb', 'cloudflare workers', 'aws lambda', 'digitalocean', 'heroku'],
    candidateEntities: ['Vercel', 'Netlify', 'Render', 'Railway', 'Fly.io', 'Koyeb', 'Cloudflare Workers', 'AWS Lambda', 'DigitalOcean', 'Heroku', 'Northflank', 'Deno Deploy'],
  },
  {
    triggers: /\b(email|transactional email|email delivery|send emails|inbox delivery|smtp)\b/i,
    expandedKeywords: ['email', 'resend', 'postmark', 'sendgrid', 'brevo', 'mailgun'],
    candidateEntities: ['Resend', 'Postmark', 'SendGrid', 'Brevo'],
  },
  {
    triggers: /\b(payment|payment gateway|merchant of record|checkout|card fee|transaction fee|billing)\b/i,
    expandedKeywords: ['payment', 'stripe', 'lemonsqueezy', 'paddle', 'gateway', 'fee'],
    candidateEntities: ['Stripe', 'LemonSqueezy', 'Paddle'],
  },
  {
    triggers: /\b(speech|transcription|voice ai|text to speech|tts|audio transcription)\b/i,
    expandedKeywords: ['speech', 'transcription', 'elevenlabs', 'deepgram', 'whisper', 'voice'],
    candidateEntities: ['ElevenLabs', 'Deepgram'],
  },
  {
    triggers: /\b(analytics|event tracking|feature flags|session replay|product analytics)\b/i,
    expandedKeywords: ['analytics', 'posthog', 'mixpanel', 'amplitude', 'tracking'],
    candidateEntities: ['PostHog', 'Mixpanel'],
  },
  {
    triggers: /\b(cache|caching|key value|redis cache|serverless cache)\b/i,
    expandedKeywords: ['cache', 'redis', 'memcached', 'upstash', 'momento'],
    candidateEntities: ['Redis', 'Memcached', 'Upstash Redis', 'Momento'],
  },
];

/**
 * Multi-View Memory System Engine
 * Supports:
 * - Episodic View (time-based memory log)
 * - State View (current truth / active facts)
 * - Deterministic Entity Profile Injection
 * - Auto Hybrid routing
 * - Pre-invocation Proactive Recall
 * - Persistent User-Scoped Chat Sessions
 */
export class MemorySystemEngine {
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
    // Allow explicitly skipping auto-seeding if SEED_BENCHMARK is disabled
    const shouldSeed = process.env.AUTO_SEED_BENCHMARK !== 'false';
    const allMemories = await this.episodic.getAll();
    if (allMemories.length === 0 && shouldSeed) {
      await seedBenchmarkScenarios(this.episodic, this.facts, this.entities, referenceDate);
      await this.sessions.seedBenchmarkSessions('default_user', referenceDate);
    }
    this.isInitialized = true;
  }

  public async seedBenchmark(referenceDate: Date = new Date()): Promise<void> {
    await this.sessions.init();
    await seedBenchmarkScenarios(this.episodic, this.facts, this.entities, referenceDate);
    await this.sessions.seedBenchmarkSessions('default_user', referenceDate);
  }

  public async clearMemory(): Promise<void> {
    await this.episodic.clear();
    await this.facts.clear();
    await this.entities.clear();
    this.isInitialized = false;
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

    // 2. Deterministic Entity Profile Injection
    // First match against prompt text directly
    matchedProfiles = await this.entities.matchProfiles(prompt, userId);

    // Semantic Concept & Domain Expansion (defeats lexical blindness)
    const semanticKeywords: string[] = [];
    for (const domain of SEMANTIC_DOMAIN_MAP) {
      if (domain.triggers.test(prompt)) {
        semanticKeywords.push(...domain.expandedKeywords);
        for (const candidate of domain.candidateEntities) {
          const profiles = await this.entities.matchProfiles(candidate, userId);
          for (const p of profiles) {
            if (!matchedProfiles.some((existing) => existing.id === p.id)) {
              matchedProfiles.push(p);
            }
          }
        }
      }
    }

    // 3. Multi-View Routing
    let hasZeroMatchingHistory = false;
    const isDateRecallQuery = /\b(what did i ask|what was my question|what did we discuss|what did i say|what did we talk about|did i ask)\b/i.test(prompt);

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
            dateString: temporalAnchor.dateString,
          }, userId);
        }

        // If user specifically asked about their past question on this date and nothing exists:
        if (episodicMemories.length === 0 && isDateRecallQuery) {
          hasZeroMatchingHistory = true;
        }
      }
      
      // Dynamic Salient Keyword Search only if this is NOT an empty date-inquiry
      if (!hasZeroMatchingHistory) {
        const stopwords = new Set([
          'what', 'which', 'where', 'when', 'who', 'how', 'why', 'did', 'does', 'have', 'has',
          'asked', 'about', 'tell', 'show', 'pricing', 'changed', 'since', 'then', 'today',
          'there', 'their', 'they', 'with', 'from', 'that', 'this', 'last', 'week', 'days',
          'the', 'and', 'for', 'our', 'use', 'just', 'say', 'like', 'mention', 'pick', 'favorite',
          'price', 'cost', 'stock', 'stocks', 'tool', 'tools', 'service', 'services'
        ]);

        const words = Array.from(
          new Set(
            prompt
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, ' ')
              .split(/\s+/)
              .filter((w) => w.length >= 3 && !stopwords.has(w))
          )
        ).slice(0, 6);

        const searchTokens = Array.from(new Set([...words, ...semanticKeywords.slice(0, 4)]));

        for (const w of searchTokens) {
          const found = await this.episodic.searchByKeyword(w, 5, userId);
          for (const mem of found) {
            if (!episodicMemories.some((m) => m.id === mem.id)) {
              episodicMemories.push(mem);
            }
          }
          if (episodicMemories.length >= 10) break;
        }

        // If user is asking about prior discussions/preferences ("what did I say", "which ORM do we use", "what is my favorite")
        const isRecallIntent = /(what|which|who|where)\s+(did|do|was)\s+(i|we|you)|(favorite|remember|preference|stack|choice|decision|say|said|tell|told|use|pick)/i.test(prompt);
        if (isRecallIntent && episodicMemories.length < 5) {
          const allUserEntries = (await this.episodic.getAll())
            .filter((e) => isEpisodicUserMatch(e.userId, userId))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 10);
          for (const mem of allUserEntries) {
            if (!episodicMemories.some((m) => m.id === mem.id)) {
              episodicMemories.push(mem);
            }
          }
        }
      }

      // Only inject entity profiles from episodic memories if there is an explicit temporal anchor OR delta intent
      if (episodicMemories.length > 0 && (temporalAnchor || hasDeltaIntent)) {
        for (const mem of episodicMemories) {
          if (mem.metadata?.entities) {
            for (const entName of mem.metadata.entities) {
              const profiles = await this.entities.matchProfiles(entName, userId);
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
      activeFacts = await this.facts.getActiveFacts(undefined, userId);
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
        activeFacts = relevantFacts;
      }
    }

    // 4. Construct Structured Context String for LLM
    let contextParts: string[] = [];

    if (temporalAnchor) {
      contextParts.push(`[TEMPORAL ANCHOR DETECTED: ${temporalAnchor.label} (${temporalAnchor.anchorType})]`);
      if (hasZeroMatchingHistory) {
        contextParts.push(`[TEMPORAL AUDIT: ZERO historical turns found in memory ledger for ${temporalAnchor.label}. Do NOT invent past topics.]`);
      }
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
      contextParts.push('### Structured Claim Snapshots (Baseline State to Compare Against):');
      for (const prof of matchedProfiles) {
        const baselinePricing = prof.profileData?.pricing || 'Standard Tier';
        contextParts.push(`- [CLAIM SNAPSHOT] Entity: "${prof.entityName}" | Category: ${prof.category} | Baseline: "${baselinePricing}" | Profile: ${JSON.stringify(prof.profileData)}`);
      }
    }

    if (activeFacts.length > 0) {
      contextParts.push('### Active Ground Truth Facts:');
      for (const fact of activeFacts) {
        contextParts.push(`- [FACT SNAPSHOT] ${fact.subject} -> ${fact.predicate}: "${fact.object}" (Established: ${fact.validFrom})`);
      }
    }

    const injectedContextString = contextParts.join('\n\n');

    return {
      episodicMemories,
      activeFacts,
      entityProfiles: matchedProfiles,
      temporalAnchor: temporalAnchor || undefined,
      injectedContextString,
      hasZeroMatchingHistory,
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
    customTimestamp?: string,
    durationMs?: number
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
        durationMs,
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

    // 7. Background Cheap LLM Fact Distillation (Dual-Speed Cold Path)
    // Non-blocking fire-and-forget background worker; never delays response completion
    if (process.env.DISABLE_ASYNC_FACT_EXTRACTION !== 'true') {
      AsyncFactExtractor.distillTurnAsync({
        userId,
        userQuery,
        assistantResponse,
        timestamp: nowIso,
        onExtracted: async ({ profiles, facts }) => {
          for (const profile of profiles) {
            await this.entities.upsertProfile(profile);
          }
          for (const fact of facts) {
            await this.facts.addFact(fact);
          }
        },
      }).catch((err) => {
        console.warn(`[BrainVault] Background fact distillation notice: ${err?.message || err}`);
      });
    }
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

export const memorySystem = new MemorySystemEngine();

// Aliases for backward compatibility
export const BrainVaultEngine = MemorySystemEngine;
export const BrainVault = MemorySystemEngine;
export const brainVault = memorySystem;
