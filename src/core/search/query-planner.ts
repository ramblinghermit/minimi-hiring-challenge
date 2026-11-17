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
 * using Memory System context.
 */
export class QueryPlanner {
  /**
   * Determine if the user prompt requires web search
   */
  public static shouldSearch(prompt: string, context?: BrainVaultContext, inChatHistory?: any[]): boolean {
    const text = prompt.toLowerCase().trim();

    // Pure conversational greetings / meta questions do not require search
    if (/^(hi|hello|hey|who are you|what can you do|good morning|thanks|thank you)\b/i.test(text) && text.length < 100) {
      return false;
    }

    // Explicit check: If temporal memory recall query had ZERO matching historical turns,
    // do NOT waste time searching the web to guess what the user asked in the past
    if (context?.hasZeroMatchingHistory) {
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

    // In-chat or conversational memory recall queries should NOT trigger web search
    const isMemoryRecallQuery =
      /^(what|which|who|where|how)\b.*?\b(did|do|was|is|are|were|have)\s+(i|we|you|our|my)\b/i.test(text) ||
      /\b(did i|did we|do we|have we|did you)\s+(say|mention|tell|discuss|state|pick|choose)\b/i.test(text) ||
      /\b(what did i (just )?say|what did i tell you|what is (my|our)|which (orm|database|cache|tool|stack) do we use|do you remember|what do you remember about me|who am i|what do you know about me)\b/i.test(text);

    if (isMemoryRecallQuery) {
      return false;
    }

    // PRIORITY 1: In-chat conversational continuation
    // If there is active in-chat history and the user is asking a conversational follow-up or coreference,
    // prioritize resolving it from the current chat history without external web search
    if (inChatHistory && inChatHistory.length > 0) {
      const isConversationalFollowup =
        /^(why|how|explain|elaborate|clarify|what about|tell me more|what did you mean|expand on|summarize that)\b/i.test(text) ||
        /\b(that|this|it|the first one|the second one|above|mentioned)\b/i.test(text);
      if (isConversationalFollowup) {
        return false;
      }
    }

    // If temporal anchor is detected and user is asking about past context validity
    if (context?.temporalAnchor) {
      return true;
    }

    // Default to search to ensure factual freshness
    return true;
  }

  /**
   * Plan decomposed targeted queries using Memory System context
   */
  public static planQueries(prompt: string, context: BrainVaultContext): PlannedSearch {
    const text = prompt.toLowerCase();
    const currentYear = new Date().getFullYear();
    const targetEntities: string[] = [];
    const queries: string[] = [];
    let isDeltaSearch = false;

    // 1. Check if we have entity profiles from Memory System
    if (context.entityProfiles.length > 0) {
      for (const prof of context.entityProfiles) {
        targetEntities.push(prof.entityName);
      }
    }

    // 2. Check if we have entities from episodic memories (only for temporal anchor or delta intent)
    if (context.temporalAnchor && targetEntities.length === 0 && context.episodicMemories.length > 0) {
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

    // 3. Temporal Delta Intent (Requires a temporal anchor OR explicit delta keywords)
    const anchorDate = context.temporalAnchor?.dateString || context.temporalAnchor?.label;
    const dateBound = anchorDate ? `since ${anchorDate}` : `${currentYear}`;
    const hasExplicitDeltaKeywords = /\b(changed|change|changes|since|shipped|updates since|still correct|still accurate|new features)\b/i.test(prompt);

    if (context.temporalAnchor || hasExplicitDeltaKeywords) {
      isDeltaSearch = true;

      // Filter target entities to only those actually relevant to the prompt or temporal context
      const relevantEntities = targetEntities.filter((ent) => 
        new RegExp(`\\b${ent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(prompt)
      );
      const entitiesToQuery = relevantEntities.length > 0 ? relevantEntities : (context.temporalAnchor ? targetEntities.slice(0, 4) : []);

      if (entitiesToQuery.length > 0) {
        for (const entity of entitiesToQuery) {
          if (text.includes('pricing') || text.includes('cost') || text.includes('price')) {
            queries.push(`${entity} pricing changes ${dateBound}`);
          } else if (text.includes('shipped') || text.includes('feature')) {
            queries.push(`${entity} changelog new features ${dateBound}`);
          } else {
            queries.push(`${entity} updates and changes ${dateBound}`);
          }
        }
      } else {
        const topicMatch = prompt.match(/\b([A-Z][a-zA-Z0-9_\-\. ]{2,20}|(?:crm|postgres|vector database|database|orm|email api|hosting))\b/i);
        const topic = topicMatch ? topicMatch[1] : 'service';
        queries.push(`${topic} pricing changes ${dateBound}`);
      }
    }

    // 4. If no specialized queries were generated, create focused, length-capped query
    if (queries.length === 0) {
      // Clean query of conversational filler and truncate to max 120 characters to avoid URL overflow
      const cleaned = prompt
        .replace(/^(can you|please|tell me|what did i ask you|is your answer still correct today)\s*/i, '')
        .replace(/[^a-zA-Z0-9\s\.\-_]/g, ' ')
        .trim()
        .slice(0, 120)
        .trim();

      const alreadyHasYear = /\b(19\d\d|20\d\d)\b/.test(cleaned);
      const querySuffix = alreadyHasYear ? '' : ` ${currentYear}`;

      const isFinancialOrEarnings =
        /\b(earnings|quarterly|q1|q2|q3|q4|revenue|support level|resistance level|stock|guidance|conference call|financial results)\b/i.test(prompt);

      if (isFinancialOrEarnings) {
        const entityMatch = prompt.match(/\b([A-Z][a-zA-Z0-9_\-\.]{2,15}|NVDA|AAPL|MSFT|GOOGL|AMZN|TSLA|META)\b/);
        const entity = entityMatch ? entityMatch[1] : '';
        if (entity && /\bearnings\b/i.test(prompt)) {
          queries.push(`${entity} earnings report conference call transcript${querySuffix}`.trim());
        }
      }

      queries.push(`${cleaned}${querySuffix}`.trim());
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
