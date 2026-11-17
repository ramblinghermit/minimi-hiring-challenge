import { brainVault } from '../memory/brain-vault';
import { QueryPlanner } from '../search/query-planner';
import { searchRouter } from '../search/search-router';
import { LLMClient, LLMMessage, WEB_SEARCH_TOOL } from '../llm/llm-client';
import { formatSearchContext, SYSTEM_PROMPT } from '../llm/prompts';
import { PermissionGate } from './permission-gate';
import { executionManager, ExecutionTerminatedError } from './execution-manager';
import { ScratchpadEvent, SourceCitation } from '../types';
import { SecurityGuardrails } from '../security/guardrails';

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
  onDone: (durationMs?: number) => void;
  onPaused?: (data: { sessionId: string; step?: string }) => void;
  onResumed?: (data: { sessionId: string }) => void;
  onTerminated?: (data: { sessionId: string; reason: string }) => void;
}

/**
 * Minimi Agent Orchestrator
 * Fuses Memory System (Episodic + State + Entity Profiles), AgentBridge Governance, Web Search,
 * and Stateful Execution Lifecycle (Pause / Resume / Terminate).
 */
export class AgentOrchestrator {
  public static async execute(prompt: string, options: AgentRunOptions): Promise<void> {
    const executionStartTime = Date.now();
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

    // Register active execution with ExecutionManager
    const exec = executionManager.startExecution(sessionId, userId, {
      onPaused: (data) => {
        emitScratchpad({
          type: 'agent_status',
          content: '⏸ Agent execution paused by user.',
        });
        options.onPaused?.(data);
      },
      onResumed: (data) => {
        emitScratchpad({
          type: 'agent_status',
          content: '▶ Agent execution resumed.',
        });
        options.onResumed?.(data);
      },
      onTerminated: (data) => {
        emitScratchpad({
          type: 'agent_status',
          content: `⏹ Agent execution terminated (${data.reason}).`,
        });
        options.onTerminated?.(data);
      },
    });

    try {
      // Checkpoint before initial step
      await executionManager.checkpoint(sessionId, 'initialization');

      // =================================================================
      // STEP 0: Security Guardrails & Prompt Injection Pre-Flight Check
      // =================================================================
      const inputValidation = SecurityGuardrails.validateInput(prompt);
      if (!inputValidation.allowed) {
        emitScratchpad({
          type: 'agent_status',
          content: inputValidation.message || 'Prompt rejected by security guardrails',
        });

        const refusalMessage = `### 🛡️ Security Guardrail Notice\n**${inputValidation.message}**\n\nThe chat agent operates with active prompt injection protection and strict safety guardrails. Please rephrase your query without attempting to override system directives or request harmful material.`;

        options.onToken(refusalMessage);

        const executionDurationMs = Date.now() - executionStartTime;
        await brainVault.captureTurn(
          userId,
          sessionId,
          prompt,
          refusalMessage,
          [],
          scratchpadThoughts,
          options.referenceDate ? refDate.toISOString() : undefined,
          executionDurationMs
        );

        executionManager.completeExecution(sessionId);
        options.onDone(executionDurationMs);
        return;
      }

      const activePrompt = inputValidation.sanitizedPrompt;

      // =================================================================
      // STEP 1: Memory System Proactive Direct Recall (Pre-Invocation)
      // =================================================================
      emitScratchpad({
        type: 'agent_status',
        content: 'Reviewing context from past conversations...',
      });
      await executionManager.checkpoint(sessionId, 'memory_recall_start');
      await executionManager.checkpoint(sessionId, 'memory_recall');

      const memoryContext = await brainVault.retrieve(activePrompt, 'auto', refDate, userId);

      await executionManager.checkpoint(sessionId, 'memory_processing');

      if (memoryContext.temporalAnchor) {
        emitScratchpad({
          type: 'memory_recall',
          content: `Resolved Temporal Anchor: ${memoryContext.temporalAnchor.label} (${memoryContext.temporalAnchor.anchorType})`,
        });
      }

      if (memoryContext.hasZeroMatchingHistory) {
        emitScratchpad({
          type: 'memory_recall',
          content: `No records found in episodic memory for ${memoryContext.temporalAnchor?.label}.`,
        });
      } else if (memoryContext.episodicMemories.length > 0) {
        emitScratchpad({
          type: 'memory_recall',
          content: `Recalled ${memoryContext.episodicMemories.length} relevant past turns from episodic memory.`,
        });
      } else {
        emitScratchpad({
          type: 'memory_recall',
          content: 'Context verified within active session history.',
        });
      }

      if (memoryContext.entityProfiles.length > 0) {
        const entityList = memoryContext.entityProfiles.map((p) => p.entityName).join(', ');
        emitScratchpad({
          type: 'memory_recall',
          content: `Deterministic Entity Profile Injection: ${entityList}`,
        });
      }

      // Build multi-turn message history from the current active session
      const sessionHistory = await brainVault.episodic.getSessionHistory(sessionId, userId);
      const historyMessages: LLMMessage[] = sessionHistory
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10) // Keep last 10 turns to stay within context limits
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Inject comprehensive temporal awareness: ISO date, day of week, IANA timezone and UTC offset
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const offsetMin = -refDate.getTimezoneOffset();
      const tzSign = offsetMin >= 0 ? '+' : '-';
      const tzPad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
      const tzOffset = `UTC${tzSign}${tzPad(offsetMin / 60)}:${tzPad(offsetMin % 60)}`;
      const dayName = refDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      let temporalAnchorHeader = '';
      if (memoryContext.temporalAnchor) {
        temporalAnchorHeader = `RESOLVED TEMPORAL ANCHOR: "${memoryContext.temporalAnchor.label}" -> ${memoryContext.temporalAnchor.dateString || memoryContext.temporalAnchor.startDate.split('T')[0]} (${memoryContext.temporalAnchor.anchorType})\n`;
      }

      const baseSystemPrompt = `${SYSTEM_PROMPT}

CURRENT SYSTEM TIME: ${refDate.toISOString()} (${dayName} | Timezone: ${tzName} / ${tzOffset})
${temporalAnchorHeader}
${memoryContext.injectedContextString}
`;

      const initialMessages: LLMMessage[] = [
        { role: 'system', content: baseSystemPrompt },
        ...historyMessages,
        { role: 'user', content: activePrompt },
      ];

      let citations: SourceCitation[] = [];
      let fullAssistantText = '';

      // =================================================================
      // OPTION A: Model-Driven Tool Calling (Agentic Loop)
      // The prompt goes to the model first with available tool definitions.
      // The model decides whether it needs live web data.
      // =================================================================
      await executionManager.checkpoint(sessionId, 'model_tool_decision');

      const displayModelName = options.model || (LLMClient.hasVertexCredentials() ? 'Gemini 3.5 Flash (Vertex AI)' : 'Gemini (Google AI)');
      emitScratchpad({
        type: 'agent_status',
        content: `Evaluating query with ${displayModelName}...`,
      });

      // Special check: If temporal memory recall query had ZERO historical turns recorded,
      // trigger gap honesty directly without unnecessary roundtrips
      if (memoryContext.hasZeroMatchingHistory) {
        emitScratchpad({
          type: 'agent_status',
          content: 'Grounded on conversation history.',
        });
        await executionManager.checkpoint(sessionId, 'llm_streaming');
        fullAssistantText = await LLMClient.stream(initialMessages, {
          provider: options.modelProvider,
          model: options.model,
          signal: exec.abortController.signal,
          sessionId,
          checkpoint: () => executionManager.checkpoint(sessionId, 'llm_streaming'),
          onToken: options.onToken,
        });
      } else {
        const stepResult = await LLMClient.stepWithTools(
          initialMessages,
          [WEB_SEARCH_TOOL],
          {
            provider: options.modelProvider,
            model: options.model,
            signal: exec.abortController.signal,
            sessionId,
            checkpoint: () => executionManager.checkpoint(sessionId, 'model_tool_decision'),
          }
        );

        if (stepResult.toolCall && stepResult.toolCall.name === 'web_search') {
          // Model decided to search!
          const rawQuery = String(stepResult.toolCall.args.query || activePrompt);
          const sanitizedValidation = SecurityGuardrails.validateSearchQuery(rawQuery);
          const searchQuery = sanitizedValidation.valid ? sanitizedValidation.sanitizedQuery : activePrompt;

          emitScratchpad({
            type: 'agent_status',
            content: `Model requested live web search: "${searchQuery}"`,
          });
          await executionManager.checkpoint(sessionId, 'governance_approval');

          // AgentBridge Governance / Permission Gate
          const toolPayload = {
            query: searchQuery,
            queries: [searchQuery],
            provider: searchRouter.getActiveProvider(),
          };

          emitScratchpad({
            type: 'tool_start',
            content: 'Requesting permission to execute web search tool',
            tool_name: 'web_search',
            tool_input: toolPayload,
          });

          if (!options.autoPilot) {
            PermissionGate.setApprovalCallback(sessionId, (req) => {
              options.onApprovalRequired({
                approvalId: req.approvalId,
                toolName: req.toolName,
                serverName: req.serverName,
                payload: req.payload,
              });
            });
          }

          const decisionPromise = PermissionGate.requestApproval(
            'web_search',
            toolPayload,
            'minimi-search-service',
            options.autoPilot ?? true,
            sessionId,
            userId
          );

          const decision = await Promise.race([
            decisionPromise,
            new Promise<never>((_, reject) => {
              const onAbort = () => reject(new ExecutionTerminatedError('Terminated while waiting for tool approval'));
              if (exec.abortController.signal.aborted) {
                onAbort();
              } else {
                exec.abortController.signal.addEventListener('abort', onAbort, { once: true });
              }
            }),
          ]);

          PermissionGate.setApprovalCallback(sessionId, null);
          await executionManager.checkpoint(sessionId, 'search_execution_prep');

          let searchContextStr = '';
          if (!decision.approved) {
            emitScratchpad({
              type: 'agent_status',
              content: 'Web search execution was denied by user. Falling back to existing memory.',
            });
          } else {
            options.onToolApproved?.({ toolName: 'web_search' });

            emitScratchpad({
              type: 'agent_status',
              content: `Executing parallel web search via ${searchRouter.getActiveProvider().toUpperCase()}...`,
            });
            await executionManager.checkpoint(sessionId, 'executing_search');

            const searchOutput = await searchRouter.searchParallel([searchQuery]);
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

          // Round 2: Stream final response with search context
          const synthesisPrompt = `${baseSystemPrompt}

${searchContextStr}
`;
          const secondTurnMessages: LLMMessage[] = [
            { role: 'system', content: synthesisPrompt },
            ...historyMessages,
            { role: 'user', content: activePrompt },
          ];

          await executionManager.checkpoint(sessionId, 'llm_streaming');
          fullAssistantText = await LLMClient.stream(secondTurnMessages, {
            provider: options.modelProvider,
            model: options.model,
            signal: exec.abortController.signal,
            sessionId,
            checkpoint: () => executionManager.checkpoint(sessionId, 'llm_streaming'),
            onToken: options.onToken,
          });

        } else if (stepResult.text && stepResult.text.trim()) {
          // Model decided NO search is needed! Direct answer!
          emitScratchpad({
            type: 'agent_status',
            content: 'Grounded directly on conversation context.',
          });
          fullAssistantText = stepResult.text;

          // Stream direct answer tokens to the user
          const tokens = fullAssistantText.split(/(\s+)/);
          for (const chunk of tokens) {
            if (exec.abortController.signal.aborted) break;
            if (chunk) {
              options.onToken(chunk);
              await new Promise((r) => setTimeout(r, 6));
            }
          }
        } else {
          // Direct fallback stream
          emitScratchpad({
            type: 'agent_status',
            content: 'Grounded directly on conversation context.',
          });
          await executionManager.checkpoint(sessionId, 'llm_streaming');
          fullAssistantText = await LLMClient.stream(initialMessages, {
            provider: options.modelProvider,
            model: options.model,
            signal: exec.abortController.signal,
            sessionId,
            checkpoint: () => executionManager.checkpoint(sessionId, 'llm_streaming'),
            onToken: options.onToken,
          });
        }
      }

      await executionManager.checkpoint(sessionId, 'citations_reveal');

      // =================================================================
      // STEP 6: Sources Reveal (Pop up AFTER text has completely loaded)
      // =================================================================
      if (citations && citations.length > 0) {
        options.onCitations(citations);
      }

      await executionManager.checkpoint(sessionId, 'knowledge_capture');

      // =================================================================
      // STEP 7: Memory System Post-Turn Knowledge Capture & Output Guardrails
      // =================================================================
      const outputValidation = SecurityGuardrails.validateOutput(fullAssistantText);
      const safeAssistantText = outputValidation.sanitizedText;
      if (outputValidation.redactedCount > 0) {
        emitScratchpad({
          type: 'agent_status',
          content: `🛡️ Output Guardrail: Redacted ${outputValidation.redactedCount} sensitive credential(s) from response.`,
        });
      }

      const executionDurationMs = Date.now() - executionStartTime;
      await brainVault.captureTurn(
        userId,
        sessionId,
        prompt,
        safeAssistantText,
        citations,
        scratchpadThoughts,
        options.referenceDate ? refDate.toISOString() : undefined,
        executionDurationMs
      );

      executionManager.completeExecution(sessionId);
      options.onDone(executionDurationMs);
    } catch (err: any) {
      if (err instanceof ExecutionTerminatedError || err?.code === 'EXECUTION_TERMINATED' || err?.name === 'ExecutionTerminatedError') {
        // Clean termination handling: clean up without logging error crash
        PermissionGate.cancelPendingForSession(sessionId);
        options.onTerminated?.({ sessionId, reason: err.message });
        options.onDone();
      } else {
        executionManager.failExecution(sessionId, err);
        options.onError(err);
      }
    }
  }
}
