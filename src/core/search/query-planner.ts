import { BrainVaultContext } from '../types';

export interface PlannedSearch {
  queries: string[];
  reason: string;
  isDeltaSearch: boolean;
  targetEntities: string[];
}

/**
 * Query Planner for Minimi Web Search Agent
 * Deconstructs ambiguous user prompts into high-precision, parallel search queries
 * using Brain-Vault memory context.
 */
export class QueryPlanner {
  /**
   * Determine if the user prompt requires web search
   */
  public static shouldSearch(prompt: string, context?: BrainVaultContext): boolean {
    const text = prompt.toLowerCase().trim();

    // Pure conversational greetings / meta questions do not require search
    if (/^(hi|hello|hey|who are you|what can you do|good morning|thanks|thank you)\b/i.test(text) && text.length < 30) {
      return false;
    }

    // Explicit requests to search or check freshness
    if (
      text.includes('search') ||
      text.includes('changed') ||
      text.includes('pricing') ||
      text.includes('cost') ||
      text.includes('shipped') ||
      text.includes('new') ||
      text.includes('latest') ||
      text.includes('current') ||
      text.includes('today') ||
      text.includes('still correct') ||
      text.includes('still accurate') ||
      text.includes('status')
    ) {
      return true;
    }

    // If temporal anchor is detected and user is asking about past context validity
    if (context?.temporalAnchor) {
      return true;
    }

    // Default to search to ensure factual freshness
    return true;
  }

  /**
   * Plan decomposed targeted queries using Brain-Vault context
   */
  public static planQueries(prompt: string, context: BrainVaultContext): PlannedSearch {
    const text = prompt.toLowerCase();
    const currentYear = new Date().getFullYear();
    const targetEntities: string[] = [];
    const queries: string[] = [];
    let isDeltaSearch = false;

    // 1. Check if we have entity profiles from Brain-Vault
    if (context.entityProfiles.length > 0) {
      for (const prof of context.entityProfiles) {
        targetEntities.push(prof.entityName);
      }
    }

    // 2. Check if we have entities from episodic memories
    if (targetEntities.length === 0 && context.episodicMemories.length > 0) {
      for (const mem of context.episodicMemories) {
        if (mem.metadata?.entities) {
          for (const ent of mem.metadata.entities) {
            if (!targetEntities.includes(ent)) {
              targetEntities.push(ent);
            }
          }
        }
      }
    }

    // 3. Temporal Delta Intent (e.g., "Has any of them changed pricing or shipped something big since?")
    if (
      text.includes('changed') ||
      text.includes('since') ||
      text.includes('shipped') ||
      text.includes('pricing') ||
      text.includes('still correct')
    ) {
      isDeltaSearch = true;

      if (targetEntities.length > 0) {
        // Formulate targeted queries for the top entities (limit to top 4 for fast parallel execution)
        const topEntities = targetEntities.slice(0, 4);
        for (const entity of topEntities) {
          if (text.includes('pricing') || text.includes('cost') || text.includes('price')) {
            queries.push(`${entity} pricing changes ${currentYear}`);
          } else if (text.includes('shipped') || text.includes('feature')) {
            queries.push(`${entity} changelog new features ${currentYear}`);
          } else {
            queries.push(`${entity} pricing and updates ${currentYear}`);
          }
        }
      } else if (/crm/i.test(prompt)) {
        queries.push(`HubSpot Pipedrive Zoho CRM pricing changes ${currentYear}`);
        queries.push(`CRM tools for sales team pricing updates ${currentYear}`);
      } else if (/postgres/i.test(prompt)) {
        queries.push(`Supabase Neon AWS Aurora Postgres hosting pricing changes ${currentYear}`);
        queries.push(`Managed Postgres hosting pricing ${currentYear}`);
      } else if (/haiku|anthropic|claude/i.test(prompt)) {
        queries.push(`Claude 3.5 Haiku pricing context window official Anthropic`);
      }
    }

    // 4. If no specialized queries were generated, create focused queries from prompt
    if (queries.length === 0) {
      // Clean query of conversational filler
      const cleaned = prompt
        .replace(/^(can you|please|tell me|what did i ask you|is your answer still correct today)\s*/i, '')
        .trim();
      queries.push(`${cleaned} ${currentYear}`);
    }

    return {
      queries: Array.from(new Set(queries)).slice(0, 4),
      reason: isDeltaSearch
        ? `Temporal delta check: Verifying changes since baseline for: ${targetEntities.join(', ') || 'shortlist'}`
        : 'Fresh live web verification',
      isDeltaSearch,
      targetEntities,
    };
  }
}
