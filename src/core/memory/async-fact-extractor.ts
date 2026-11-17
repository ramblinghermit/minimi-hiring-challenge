import { LLMClient, LLMMessage } from '../llm/llm-client';
import { EntityProfile, FactEntry } from '../types';

export interface DistillTurnParams {
  userId: string;
  userQuery: string;
  assistantResponse: string;
  timestamp?: string;
  onExtracted?: (extracted: {
    profiles: Array<Omit<EntityProfile, 'id' | 'lastObservedAt'>>;
    facts: Array<Omit<FactEntry, 'id' | 'createdAt' | 'isSuperseded'>>;
  }) => Promise<void>;
}

export interface ExtractedFactCandidate {
  subject: string;
  predicate: string;
  object: string;
  confidence?: number;
  supersedesPredicate?: string;
}

export interface ExtractedEntityCandidate {
  entityName: string;
  category?: string;
  profileData?: Record<string, any>;
}

export interface CheapModelConfig {
  provider: string;
  model: string;
}

/**
 * Asynchronous Background Knowledge & Fact Extractor
 * Uses a lightweight, low-cost model (e.g. Gemini 2.5 Flash / Flash-Lite, GPT-4o-mini)
 * to distill persistent facts, user declarations, and entity profiles in the background
 * without blocking the user response stream or incurring high-frontier LLM costs.
 */
export class AsyncFactExtractor {
  /**
   * Resolves the cheapest capable LLM provider and model available in the environment.
   */
  public static getCheapModelConfig(): CheapModelConfig {
    if (process.env.CHEAP_LLM_MODEL) {
      return {
        provider: process.env.CHEAP_LLM_PROVIDER || LLMClient.getAvailableProvider().provider,
        model: process.env.CHEAP_LLM_MODEL,
      };
    }
    if (LLMClient.hasVertexCredentials()) {
      return { provider: 'vertex', model: 'gemini-3.5-flash-lite' };
    }
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_FALLBACK;
    if (geminiKey) {
      return { provider: 'gemini', model: 'gemini-2.5-flash' };
    }
    if (process.env.OPENAI_API_KEY) {
      return { provider: 'openai', model: 'gpt-4o-mini' };
    }
    if (process.env.GROQ_API_KEY) {
      return { provider: 'groq', model: 'llama-3.1-8b-instant' };
    }
    return { provider: 'fallback', model: 'minimi-internal' };
  }

  /**
   * Distills conversation turns asynchronously in the background.
   * This is fire-and-forget: it will never throw or disrupt the caller.
   */
  public static async distillTurnAsync(params: DistillTurnParams): Promise<void> {
    const config = this.getCheapModelConfig();
    if (config.provider === 'fallback') {
      // In offline / mock test mode, avoid unconfigured network calls
      return;
    }

    const {
      userId,
      userQuery,
      assistantResponse,
      timestamp = new Date().toISOString(),
      onExtracted,
    } = params;

    // Skip trivial smalltalk or short acknowledgments
    if (userQuery.trim().length < 8 && assistantResponse.trim().length < 8) {
      return;
    }

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an Ambient Memory Distiller.
Analyze the following conversation turn between a user and assistant. Extract atomic, persistent facts, user preferences, technical choices, and named entities.

Rules:
1. Extract ONLY persistent claims: preferences, stack decisions, architecture, project constraints, tool specifications, or temporal state.
2. Ignore transient conversational filler, greetings, and ephemeral questions.
3. If the user explicitly replaces or changes an earlier choice (e.g., "we switched from X to Y", "we no longer use X"), capture the new choice as active.
4. Output valid JSON adhering to the specified schema. If no persistent facts are found, return { "facts": [], "entities": [] }.

JSON Schema:
{
  "facts": [
    {
      "subject": "User" | "Project" | string,
      "predicate": string (concise snake_case or clean descriptor, e.g. "favorite_db", "cloud_provider", "auth_framework", "billing_budget"),
      "object": string,
      "confidence": number (between 0.8 and 1.0)
    }
  ],
  "entities": [
    {
      "entityName": string,
      "category": "database" | "crm" | "hosting" | "tool" | "service" | "general",
      "profileData": object
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `User: ${userQuery}\nAssistant: ${assistantResponse}`,
      },
    ];

    try {
      const rawText = await LLMClient.generate(messages, {
        provider: config.provider,
        model: config.model,
        temperature: 0.1,
      });

      const parsed = this.parseJsonPayload(rawText);
      if (!parsed) return;

      const profiles: Array<Omit<EntityProfile, 'id' | 'lastObservedAt'>> = [];
      const facts: Array<Omit<FactEntry, 'id' | 'createdAt' | 'isSuperseded'>> = [];

      if (Array.isArray(parsed.entities)) {
        for (const ent of parsed.entities) {
          if (ent && typeof ent.entityName === 'string' && ent.entityName.trim()) {
            profiles.push({
              userId,
              entityName: ent.entityName.trim(),
              category: this.normalizeCategory(ent.category),
              profileData: ent.profileData && typeof ent.profileData === 'object' ? ent.profileData : {},
            });
          }
        }
      }

      if (Array.isArray(parsed.facts)) {
        for (const f of parsed.facts) {
          if (f && f.subject && f.predicate && f.object) {
            facts.push({
              userId,
              subject: String(f.subject).trim(),
              predicate: String(f.predicate).trim().toLowerCase(),
              object: String(f.object).trim(),
              confidence: typeof f.confidence === 'number' ? f.confidence : 0.92,
              validFrom: timestamp,
              validUntil: null,
            });
          }
        }
      }

      if (onExtracted && (profiles.length > 0 || facts.length > 0)) {
        await onExtracted({ profiles, facts });
      }
    } catch (err: any) {
      console.warn(`[AsyncFactExtractor] Background extraction notice (${config.provider}/${config.model}): ${err?.message || err}`);
    }
  }

  /**
   * Robust JSON parser extracting JSON arrays or objects even if wrapped in markdown codeblocks.
   */
  public static parseJsonPayload(rawText: string): { facts?: ExtractedFactCandidate[]; entities?: ExtractedEntityCandidate[] } | null {
    if (!rawText || typeof rawText !== 'string') return null;
    try {
      const cleaned = rawText
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }
      return null;
    }
  }

  private static normalizeCategory(cat?: string): 'crm' | 'database' | 'hosting' | 'tool' | 'service' | 'general' {
    if (!cat) return 'general';
    const lower = cat.toLowerCase().trim();
    if (['crm', 'database', 'hosting', 'tool', 'service', 'general'].includes(lower)) {
      return lower as any;
    }
    if (['framework', 'library', 'sdk', 'language', 'api'].includes(lower)) return 'tool';
    if (['cloud', 'platform', 'infra', 'infrastructure', 'paas', 'iaas', 'saas'].includes(lower)) return 'hosting';
    return 'general';
  }
}
