import { Router, Request, Response } from 'express';
import { AgentOrchestrator } from '../core/agent/orchestrator';
import { PermissionGate } from '../core/agent/permission-gate';
import { brainVault } from '../core/memory/brain-vault';
import { searchRouter } from '../core/search/search-router';
import { LLMClient } from '../core/llm/llm-client';
import { SSEWriter } from './sse';

export const apiRouter = Router();

/**
 * GET /api/chat/stream
 * Server-Sent Events stream implementing AgentBridge chat protocol
 */
apiRouter.get('/chat/stream', async (req: Request, res: Response) => {
  const prompt = String(req.query.prompt || '').trim();
  const sessionId = String(req.query.session_id || `session_${Date.now()}`);
  const modelProvider = req.query.model_provider ? String(req.query.model_provider) : undefined;
  const model = req.query.model ? String(req.query.model) : undefined;
  const autoPilot = req.query.auto_pilot !== 'false'; // Default to true unless requested
  const referenceDate = req.query.reference_date ? String(req.query.reference_date) : undefined;

  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt parameter' });
    return;
  }

  const sse = new SSEWriter(res);

  // Handle client disconnect
  req.on('close', () => {
    sse.close();
  });

  await AgentOrchestrator.execute(prompt, {
    sessionId,
    modelProvider,
    model,
    autoPilot,
    referenceDate,
    onScratchpad: (event) => sse.send('scratchpad', event),
    onApprovalRequired: (data) => sse.send('tool_approval_required', data),
    onToolApproved: (data) => sse.send('tool_approved', data),
    onToken: (content) => sse.send('llm_token', { content }),
    onCitations: (citations) => sse.send('citations', { citations }),
    onError: (err) => {
      sse.send('error', { message: err.message });
      sse.close();
    },
    onDone: () => {
      sse.send('done', { status: 'complete' });
      sse.close();
    },
  });
});

/**
 * POST /api/tool/approve
 * Resolves AgentBridge tool execution permission
 */
apiRouter.post('/tool/approve', (req: Request, res: Response) => {
  const { approval_id, approved, approval_type, tool_name } = req.body;

  if (!approval_id) {
    res.status(400).json({ error: 'Missing approval_id' });
    return;
  }

  const success = PermissionGate.resolveApproval({
    approvalId: approval_id,
    approved: Boolean(approved),
    approvalType: approval_type || 'once',
    toolName: tool_name || 'web_search',
  });

  res.json({ success });
});

/**
 * GET /api/memory/status
 * Returns Brain-Vault memory statistics and stored facts
 */
apiRouter.get('/memory/status', async (_req: Request, res: Response) => {
  await brainVault.init();
  const memories = await brainVault.episodic.getAll();
  const facts = await brainVault.facts.getAll();
  const entities = await brainVault.entities.getAll();

  res.json({
    counts: {
      episodicCount: memories.length,
      factsCount: facts.length,
      entityProfilesCount: entities.length,
    },
    activeSearchProvider: searchRouter.getActiveProvider(),
    activeLLMProvider: LLMClient.getAvailableProvider(),
    entities,
    facts,
    recentMemories: memories.slice(-5),
  });
});

/**
 * POST /api/memory/reset
 * Resets memory and reseeds benchmark scenarios
 */
apiRouter.post('/memory/reset', async (req: Request, res: Response) => {
  const refDate = req.body?.reference_date ? new Date(req.body.reference_date) : new Date();
  await brainVault.resetAndReseed(refDate);
  res.json({ success: true, message: 'Brain-Vault memory reset and benchmark scenarios reseeded' });
});

/**
 * GET /api/models
 * Returns available model options
 */
apiRouter.get('/models', (_req: Request, res: Response) => {
  const active = LLMClient.getAvailableProvider();
  res.json({
    active,
    options: [
      { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini (Fast)' },
      { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o (Reasoning)' },
      { id: 'claude-3-5-haiku-latest', provider: 'anthropic', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-5-sonnet-latest', provider: 'anthropic', name: 'Claude 3.5 Sonnet' },
      { id: 'gemini-2.0-flash', provider: 'gemini', name: 'Gemini 2.0 Flash' },
      { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Groq Llama 3.3 70B' },
    ],
  });
});
