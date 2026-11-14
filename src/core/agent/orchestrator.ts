import { brainVault } from '../memory/brain-vault';
import { QueryPlanner } from '../search/query-planner';
import { searchRouter } from '../search/search-router';
import { LLMClient, LLMMessage } from '../llm/llm-client';
import { formatSearchContext, SYSTEM_PROMPT } from '../llm/prompts';
import { PermissionGate } from './permission-gate';
import { ScratchpadEvent, SourceCitation } from '../types';

export interface AgentRunOptions {
  sessionId?: string;
  userId?: string;
  modelProvider?: string;
  model?: string;
  autoPilot?: boolean;
  referenceDate?: string; // Optional custom reference date for time travel
  onScratchpad: (event: ScratchpadEvent) => void;
  onApprovalRequired: (req: { approvalId: string; toolName: string; serverName: string; payload: any }) => void;
  onToolApproved: (data: { toolName: string }) => void;
  onToken: (token: string) => void;
  onCitations: (citations: SourceCitation[]) => void;
  onError: (err: Error) => void;
  onDone: () => void;
}

/**
 * Minimi Agent Orchestrator
 * Fuses Brain-Vault Episodic Memory, AgentBridge Governance, and Web Search.
 */
export class AgentOrchestrator {
  public static async execute(prompt: string, options: AgentRunOptions): Promise<void> {
    const userId = options.userId || 'default_user';
    const sessionId = options.sessionId || `session_${Date.now()}`;
    const refDate = options.referenceDate ? new Date(options.referenceDate) : new Date();

    const scratchpadThoughts: string[] = [];
    const emitScratchpad = (event: ScratchpadEvent) => {
      const text = event.content || event.type;
      if (text) {
        scratchpadThoughts.push(text);
      }
      options.onScratchpad(event);
    };

    try {
      // =================================================================
      // STEP 1: Brain-Vault Proactive Direct Recall (Pre-Invocation)
      // =================================================================
      emitScratchpad({
        type: 'agent_status',
        content: 'Querying Brain-Vault Multi-View Memory (Episodic + State + Entity Profiles)...',
      });

      const memoryContext = await brainVault.retrieve(prompt, 'auto', refDate, userId);

      if (memoryContext.temporalAnchor) {
        emitScratchpad({
          type: 'memory_recall',
          content: `Resolved Temporal Anchor: ${memoryContext.temporalAnchor.label} (${memoryContext.temporalAnchor.anchorType})`,
        });
      }

      if (memoryContext.episodicMemories.length > 0) {
        emitScratchpad({
          type: 'memory_recall',
          content: `Recalled ${memoryContext.episodicMemories.length} historical conversation turns from episodic store.`,
        });
      }

      if (memoryContext.entityProfiles.length > 0) {
        const entityList = memoryContext.entityProfiles.map((p) => p.entityName).join(', ');
        emitScratchpad({
          type: 'memory_recall',
          content: `Deterministic Entity Profile Injection: ${entityList}`,
        });
      }

      // Build multi-turn message history from the current active session first
      const sessionHistory = await brainVault.episodic.getSessionHistory(sessionId, userId);
      const historyMessages: LLMMessage[] = sessionHistory
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10) // Keep last 10 turns to stay within context limits
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // =================================================================
      // STEP 2: Query Planning & Search Intent Analysis (Priority-Aware)
      // Prioritizes in-chat history before checking cross-chat memory / web search
      // =================================================================
      const shouldSearch = QueryPlanner.shouldSearch(prompt, memoryContext, historyMessages);
      let citations: SourceCitation[] = [];
      let searchContextStr = '';

      if (shouldSearch) {
        const plan = QueryPlanner.planQueries(prompt, memoryContext);

        emitScratchpad({
          type: 'agent_status',
          content: `Search Strategy Planned: ${plan.reason} (${plan.queries.length} queries)`,
        });

        // =================================================================
        // STEP 3: AgentBridge Governance / Permission Gate
        // =================================================================
        const toolPayload = {
          queries: plan.queries,
          provider: searchRouter.getActiveProvider(),
          isDeltaSearch: plan.isDeltaSearch,
          targetEntities: plan.targetEntities,
        };

        emitScratchpad({
          type: 'tool_start',
          content: 'Requesting permission to execute web search tool',
          tool_name: 'web_search',
          tool_input: toolPayload,
        });

        // If not in autoPilot mode, register approval callback to bridge to SSE
        if (!options.autoPilot) {
          PermissionGate.setApprovalCallback((req) => {
            options.onApprovalRequired({
              approvalId: req.approvalId,
              toolName: req.toolName,
              serverName: req.serverName,
              payload: req.payload,
            });
          });
        }

        const decision = await PermissionGate.requestApproval(
          'web_search',
          toolPayload,
          'minimi-search-service',
          options.autoPilot ?? true
        );

        // Clean up callback
        PermissionGate.setApprovalCallback(null);

        if (!decision.approved) {
          emitScratchpad({
            type: 'agent_status',
            content: 'Web search execution was denied by user. Falling back to existing memory.',
          });
        } else {
          options.onToolApproved({ toolName: 'web_search' });

          // =================================================================
          // STEP 4: Web Search Execution ("The One Tool")
          // =================================================================
          emitScratchpad({
            type: 'agent_status',
            content: `Executing parallel web search via ${searchRouter.getActiveProvider().toUpperCase()}...`,
          });

          const searchOutput = await searchRouter.searchParallel(plan.queries);
          citations = searchOutput.citations;
          searchContextStr = formatSearchContext(citations);

          emitScratchpad({
            type: 'tool_end',
            content: `Search completed in ${searchOutput.executionTimeMs}ms. Retrieved ${searchOutput.results.length} verified web sources.`,
            tool_name: 'web_search',
            observation: {
              sourceCount: searchOutput.results.length,
              sources: searchOutput.results.map((r) => `${r.title} (${r.domain})`),
            },
          });
        }
      }

      // =================================================================
      // STEP 5: Temporal Diff Synthesis & LLM Streaming
      // =================================================================
      emitScratchpad({
        type: 'agent_status',
        content: 'Synthesizing temporal comparison and streaming response...',
      });

      const systemPromptWithContext = `${SYSTEM_PROMPT}

CURRENT SYSTEM TIME: ${refDate.toISOString()} (${refDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})

${memoryContext.injectedContextString}

${searchContextStr}
`;

      const messages: LLMMessage[] = [
        { role: 'system', content: systemPromptWithContext },
        ...historyMessages,
        { role: 'user', content: prompt },
      ];

      const fullAssistantText = await LLMClient.stream(messages, {
        provider: options.modelProvider,
        model: options.model,
        onToken: options.onToken,
      });

      // =================================================================
      // STEP 6: Sources Reveal (Pop up AFTER text has completely loaded)
      // =================================================================
      if (citations && citations.length > 0) {
        options.onCitations(citations);
      }

      // =================================================================
      // STEP 7: Brain-Vault Post-Turn Knowledge Capture
      // =================================================================
      await brainVault.captureTurn(
        userId,
        sessionId,
        prompt,
        fullAssistantText,
        citations,
        scratchpadThoughts,
        options.referenceDate ? refDate.toISOString() : undefined
      );

      options.onDone();
    } catch (err: any) {
      options.onError(err);
    }
  }
}
