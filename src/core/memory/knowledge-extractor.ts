import { EntityProfile, FactEntry } from '../types';

export interface ExtractedKnowledge {
  entities: string[];
  topics: string[];
  profiles: Array<Omit<EntityProfile, 'id' | 'lastObservedAt'>>;
  facts: Array<Omit<FactEntry, 'id' | 'createdAt' | 'isSuperseded'>>;
}

/**
 * Autonomous Knowledge Extractor for Minimi
 * Operates purely in-process using deterministic NLP pattern analysis.
 * Extracts entities, categories, pricing structures, and tri-temporal facts
 * from raw conversational turns without requiring an LLM invocation.
 */
export class KnowledgeExtractor {
  private static readonly STOP_WORDS = new Set([
    'here', 'what', 'which', 'where', 'when', 'who', 'how', 'why', 'this', 'that', 'these',
    'those', 'have', 'been', 'with', 'from', 'your', 'about', 'some', 'there', 'their', 'they',
    'pricing', 'price', 'month', 'today', 'monday', 'tuesday', 'yesterday', 'summary',
    'comparison', 'options', 'features', 'shortlist', 'evaluated', 'looking', 'needed'
  ]);

  public static extract(
    userQuery: string,
    assistantResponse: string,
    userId: string = 'default_user',
    timestamp: string = new Date().toISOString()
  ): ExtractedKnowledge {
    const combined = `${userQuery}\n${assistantResponse}`;
    const entities = this.extractEntities(userQuery, assistantResponse);
    const category = this.inferCategory(combined);
    const topics = this.extractTopics(combined, category);

    const profiles: Array<Omit<EntityProfile, 'id' | 'lastObservedAt'>> = [];
    const facts: Array<Omit<FactEntry, 'id' | 'createdAt' | 'isSuperseded'>> = [];

    for (const entity of entities) {
      const entityPricing = this.extractEntityPricing(entity, combined);
      const entitySpecs = this.extractEntitySpecs(entity, combined);

      const profileData: Record<string, any> = {};
      if (entityPricing) profileData.pricing = entityPricing;
      if (entitySpecs) profileData.specs = entitySpecs;
      profileData.category = category;

      profiles.push({
        userId,
        entityName: entity,
        category,
        profileData,
      });

      // Generate Tri-Temporal Facts
      if (entityPricing) {
        facts.push({
          userId,
          subject: entity,
          predicate: 'pricing',
          object: entityPricing,
          confidence: 0.95,
          validFrom: timestamp,
          validUntil: null,
        });
      }

      facts.push({
        userId,
        subject: entity,
        predicate: 'category',
        object: category,
        confidence: 0.9,
        validFrom: timestamp,
        validUntil: null,
      });
    }

    // 3. User Declarations & Preference Extraction from User Query
    const userPatterns = [
      { regex: /my favorite\s+([a-zA-Z0-9_-]+)\s+is\s+([A-Za-z0-9._-]+)/i, subj: 'User', pred: 'favorite_$1', objIndex: 2 },
      { regex: /(?:we|i)\s+(?:use|picked|chose|selected)\s+([A-Za-z0-9._-]+)\s+for\s+(?:our\s+)?([A-Za-z0-9._-]+)/i, subj: 'Project', pred: '$2', objIndex: 1 },
      { regex: /(?:our|my)\s+([a-zA-Z0-9_-]+)\s+is\s+([A-Za-z0-9._-]+)/i, subj: 'Project', pred: '$1', objIndex: 2 },
      { regex: /(?:i am|i'm|we are|we're)\s+building\s+([A-Za-z0-9._-]+)/i, subj: 'User', pred: 'building', objIndex: 1 },
      { regex: /(?:my name is|i am called)\s+([A-Za-z0-9._-]+)/i, subj: 'User', pred: 'name', objIndex: 1 },
    ];

    for (const pat of userPatterns) {
      const match = pat.regex.exec(userQuery);
      if (match) {
        const objVal = match[pat.objIndex]?.trim().replace(/[.,!?;:]+$/, '');
        const clean1 = (match[1] || '').trim().replace(/[.,!?;:]+$/, '').toLowerCase();
        const clean2 = (match[2] || '').trim().replace(/[.,!?;:]+$/, '').toLowerCase();
        const predVal = pat.pred.replace(/\$1/g, clean1).replace(/\$2/g, clean2);
        if (objVal && predVal) {
          facts.push({
            userId,
            subject: pat.subj,
            predicate: predVal,
            object: objVal,
            confidence: 0.98,
            validFrom: timestamp,
            validUntil: null,
          });

          // Tag semantic tech predicates for high-accuracy recall
          if (/prisma|drizzle|typeorm|sequelize|kysely/i.test(objVal)) {
            facts.push({
              userId,
              subject: pat.subj,
              predicate: 'orm',
              object: objVal,
              confidence: 0.99,
              validFrom: timestamp,
              validUntil: null,
            });
          } else if (/postgres|postgresql|mysql|sqlite|mongodb|redis|supabase|neon/i.test(objVal)) {
            facts.push({
              userId,
              subject: pat.subj,
              predicate: 'database',
              object: objVal,
              confidence: 0.99,
              validFrom: timestamp,
              validUntil: null,
            });
          }

          if (!entities.includes(objVal) && this.isValidEntityName(objVal)) {
            entities.push(objVal);
            profiles.push({
              userId,
              entityName: objVal,
              category,
              profileData: { declaredBy: 'user', role: predVal }
            });
          }
        }
      }
    }

    return {
      entities,
      topics,
      profiles,
      facts,
    };
  }

  /**
   * Discovers candidate entities mentioned in user prompt and assistant response
   */
  public static extractEntities(userQuery: string, assistantResponse: string): string[] {
    const foundEntities = new Set<string>();

    // 1. Check for Markdown Bold entities: e.g. **HubSpot**, **Stripe**, **Resend**
    const boldMatches = assistantResponse.match(/\*\*([A-Za-z0-9\s._-]{2,30})\*\*/g);
    if (boldMatches) {
      for (const raw of boldMatches) {
        const clean = raw.replace(/\*\*/g, '').trim();
        // Remove trailing numbers or generic headings
        const parts = clean.split(/[:(-]/)[0].trim();
        if (this.isValidEntityName(parts)) {
          foundEntities.add(parts);
        }
      }
    }

    // 2. Numbered list entities: e.g. "1. Stripe", "2. LemonSqueezy"
    const numberedMatches = assistantResponse.match(/^\s*\d+\.\s+\*\*?([A-Za-z0-9\s._-]{2,30})\*\*?/gm);
    if (numberedMatches) {
      for (const line of numberedMatches) {
        const match = line.match(/^\s*\d+\.\s+\*\*?([A-Za-z0-9\s._-]{2,30})\*\*?/);
        if (match && match[1]) {
          const name = match[1].split(/[:(-]/)[0].trim();
          if (this.isValidEntityName(name)) {
            foundEntities.add(name);
          }
        }
      }
    }

    // 3. User Query Entity Shortlists: e.g. "Stripe, LemonSqueezy, and Paddle" or "SendGrid, Resend, and Postmark"
    const listPattern = /([A-Z][a-zA-Z0-9]+(?:CRM|ORM|DB)?)(?:,\s*|\s+and\s+)/g;
    let listMatch;
    while ((listMatch = listPattern.exec(userQuery)) !== null) {
      if (this.isValidEntityName(listMatch[1])) {
        foundEntities.add(listMatch[1]);
      }
    }

    // 4. Common Tech & Tool Recognition in User Query
    const knownTech = [
      'PostgreSQL', 'Postgres', 'Prisma', 'Supabase', 'Neon', 'Redis', 'MongoDB',
      'Pinecone', 'Qdrant', 'Milvus', 'Drizzle', 'Next.js', 'React', 'Vue', 'FastAPI',
      'Python', 'TypeScript', 'Node.js', 'Docker', 'Kubernetes', 'Tailwind',
      'Memwyre', 'Minimi', 'Stripe', 'LemonSqueezy', 'Paddle', 'Resend', 'Postmark'
    ];
    for (const tech of knownTech) {
      if (new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(userQuery)) {
        foundEntities.add(tech);
      }
    }

    return Array.from(foundEntities).slice(0, 10);
  }

  private static isValidEntityName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 30) return false;
    const lower = name.toLowerCase();
    if (this.STOP_WORDS.has(lower)) return false;
    // Reject pure numbers or generic words
    if (/^\d+$/.test(name)) return false;
    if (/^(the|best|top|plan|summary|option|options|here|pricing|review)$/i.test(name)) return false;
    return true;
  }

  /**
   * Infers primary category from textual context
   */
  private static inferCategory(text: string): 'crm' | 'database' | 'hosting' | 'tool' | 'service' | 'general' {
    const lower = text.toLowerCase();
    if (lower.includes('payment') || lower.includes('gateway') || lower.includes('checkout') || lower.includes('merchant')) {
      return 'service';
    }
    if (lower.includes('crm') || lower.includes('sales pipeline') || lower.includes('sales team') || lower.includes('sales reps') || lower.includes('account executives') || lower.includes('customer relationship')) {
      return 'crm';
    }
    if (lower.includes('database') || lower.includes('postgres') || lower.includes('vector db') || lower.includes('sql') || lower.includes('nosql') || lower.includes('sqlite') || lower.includes('cache')) {
      return 'database';
    }
    if (lower.includes('hosting') || lower.includes('serverless') || lower.includes('cloud') || lower.includes('paas') || lower.includes('edge functions') || lower.includes('deployment')) {
      return 'hosting';
    }
    if (lower.includes('email') || lower.includes('transactional') || lower.includes('voice') || lower.includes('api') || lower.includes('transcription') || lower.includes('auth') || lower.includes('monitoring') || lower.includes('analytics')) {
      return 'service';
    }
    return 'tool';
  }

  /**
   * Extracts topics for metadata tagging
   */
  private static extractTopics(text: string, category: string): string[] {
    const topics = new Set<string>([category]);
    const lower = text.toLowerCase();

    if (lower.includes('pricing') || lower.includes('cost') || lower.includes('fee')) topics.add('pricing');
    if (lower.includes('features') || lower.includes('shipped')) topics.add('features');
    if (lower.includes('benchmark') || lower.includes('evaluation')) topics.add('evaluation');

    return Array.from(topics);
  }

  /**
   * Discovers pricing stated for a specific entity with multi-currency & unit support
   */
  private static extractEntityPricing(entity: string, text: string): string | null {
    // 1. Look for sentences containing the entity and a currency, fee, or pricing structure
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes(entity.toLowerCase())) {
        // Look ahead 2 lines for price mention
        const block = lines.slice(i, i + 3).join(' ');
        
        // Fee pattern: e.g. "2.9% + 30¢", "5% + 50¢", "2.9% + $0.30"
        const feeMatch = block.match(/(\d+(?:\.\d+)?%\s*(?:\+\s*(?:[\$€£₹¥]?\d+(?:\.\d+)?|\d+¢)))/i);
        if (feeMatch) return feeMatch[1].trim();

        // Multi-currency pricing pattern: $, €, £, ₹, ¥, USD, EUR
        // Supports seat, user, month, vCPU, hourly, per-request, and free tier definitions
        const priceMatch = block.match(
          /((?:[\$€£₹¥]\s*\d+(?:,\d{3})*(?:-\s*[\$€£₹¥]?\d+(?:,\d{3})*)?(?:\.\d{2,6})?|\d+(?:\.\d+)?\s*(?:USD|EUR|GBP|INR|cents|¢))\s*(?:\/(?:mo|month|seat|user|year|day|hour|vCPU\/month|vCPU-hour|node-hour|GB-second|sec|event|seat\/month|user\/month)|(?:\s*per\s+(?:mo|month|seat|user|year|day|hour|vCPU|node|GB|100k\s+requests|1k\s+requests|1m\s+requests|1\s+million\s+requests|successful\s+card\s+charge|event)))?)/i
        );
        if (priceMatch) return priceMatch[1].trim();

        // Free tier or zero monthly fee pattern
        const freeMatch = block.match(/(free(?:\s+for\s+[^\n.,;]+|\s+tier|\s+self-hosted|\s+open-source)?|zero\s+monthly\s+SaaS\s+fee)/i);
        if (freeMatch) return freeMatch[1].trim();
      }
    }

    return null;
  }

  /**
   * Discovers quota or technical specifications stated for a specific entity
   */
  private static extractEntitySpecs(entity: string, text: string): string | null {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes(entity.toLowerCase())) {
        const block = lines.slice(i, i + 3).join(' ');
        // Specs like "50,000 emails", "50k emails", "10k emails", "100,000 characters", "20-person sales team"
        const specMatch = block.match(/(\b\d+(?:,\d{3})*[kKmM]?\s+(?:emails|requests|characters|users|seats|tokens|events)\b)/i);
        if (specMatch) return specMatch[1].trim();
      }
    }
    return null;
  }

  /**
   * Delegates to AsyncFactExtractor for background LLM distillation
   */
  public static async distillAsync(params: import('./async-fact-extractor').DistillTurnParams): Promise<void> {
    const { AsyncFactExtractor } = await import('./async-fact-extractor');
    return AsyncFactExtractor.distillTurnAsync(params);
  }
}

export { AsyncFactExtractor } from './async-fact-extractor';

