import { Router, Request, Response } from 'express';
import { AgentOrchestrator } from '../core/agent/orchestrator';
import { PermissionGate } from '../core/agent/permission-gate';
import { executionManager } from '../core/agent/execution-manager';
import { brainVault } from '../core/memory/brain-vault';
import { searchRouter } from '../core/search/search-router';
import { LLMClient } from '../core/llm/llm-client';
import { userStore } from '../core/auth/user-store';
import { getAuthUser } from './auth-middleware';
import { SSEWriter } from './sse';
import {
  authRateLimiter,
  chatRateLimiter,
  generalApiRateLimiter,
  createRateLimitMiddleware,
} from '../core/security';

export const apiRouter = Router();

// Apply General API Rate Limiting across all API routes (120 req/min)
apiRouter.use(
  createRateLimitMiddleware(generalApiRateLimiter, {
    windowMs: 60 * 1000,
    maxRequests: 120,
    keyPrefix: 'api',
    message: 'API rate limit exceeded. Please wait a minute before making more requests.',
  })
);

// =========================================================================
// Authentication Endpoints (Multi-User Distinction)
// =========================================================================

/**
 * POST /api/auth/register
 * Registers a new user account with secure hashed credentials
 */
apiRouter.post(
  '/auth/register',
  createRateLimitMiddleware(authRateLimiter, {
    windowMs: 60 * 1000,
    maxRequests: 15,
    keyPrefix: 'auth',
    message: 'Too many registration attempts. Please wait 1 minute before retrying.',
  }),
  async (req: Request, res: Response) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const { user, token } = await userStore.register(username, password, name);
    // Seed benchmark sessions for this newly registered user so they can explore
    await brainVault.sessions.seedBenchmarkSessions(user.id);

    res.json({ success: true, user, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues session token
 */
apiRouter.post(
  '/auth/login',
  createRateLimitMiddleware(authRateLimiter, {
    windowMs: 60 * 1000,
    maxRequests: 15,
    keyPrefix: 'auth',
    message: 'Too many login attempts. Please wait 1 minute before retrying.',
  }),
  async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const { user, token } = await userStore.login(username, password);
    // Ensure benchmark sessions exist for this user
    await brainVault.sessions.seedBenchmarkSessions(user.id);

    res.json({ success: true, user, token });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidates the current session token
 */
apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      await userStore.revokeToken(token);
    }
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile
 */
apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  res.json({ user });
});

/**
 * GET /api/auth/demo-users
 * Returns list of demo users for 1-click login UI
 */
apiRouter.get('/auth/demo-users', async (_req: Request, res: Response) => {
  const users = await userStore.listDemoUsers();
  res.json({ users });
});

// =========================================================================
// Chat Sessions & History Endpoints
// =========================================================================

/**
 * GET /api/sessions
 * Returns all chat sessions for the current authenticated user
 */
apiRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    await brainVault.sessions.init();
    await brainVault.sessions.seedBenchmarkSessions(user.id);
    const sessions = await brainVault.sessions.getSessions(user.id);
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sessions
 * Creates a new blank chat session
 */
apiRouter.post('/sessions', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    const title = req.body?.title || 'New Chat';
    const session = await brainVault.sessions.createSession(user.id, title);
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/:sessionId/messages
 * Returns full message history for the requested session
 */
apiRouter.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    const sessionId = String(req.params.sessionId);

    const entries = await brainVault.episodic.getSessionHistory(sessionId, user.id);

    const messages = entries.map((e) => {
      const date = new Date(e.createdAt);
      const time = isNaN(date.getTime())
        ? 'Now'
        : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let scratchpad = e.metadata?.scratchpad;
      if ((!scratchpad || scratchpad.length === 0) && e.role === 'assistant') {
        const citesCount = e.metadata?.citations?.length || 0;
        scratchpad = [
          'Reviewing past discussions and context...',
          citesCount > 0
            ? `Retrieved ${citesCount} verified web sources via Live Search`
            : 'Recalled relevant context from earlier notes',
          'Synthesizing verified response...',
        ];
      }

      return {
        id: e.id,
        role: e.role,
        text: e.content,
        time,
        createdAt: e.createdAt,
        citations: e.metadata?.citations || [],
        scratchpad: scratchpad || [],
        durationMs: e.metadata?.durationMs || (scratchpad?.length ? Math.round(scratchpad.length * 650 + 400) : null),
        isStreaming: false,
      };
    });

    res.json({ sessionId, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/sessions/:sessionId
 * Renames a chat session
 */
apiRouter.patch('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    const sessionId = String(req.params.sessionId);
    const { title } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const updated = await brainVault.sessions.updateTitle(sessionId, user.id, title.trim());
    res.json({ success: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Deletes a chat session and its historical messages
 */
apiRouter.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    const sessionId = String(req.params.sessionId);

    await brainVault.sessions.deleteSession(sessionId, user.id);
    await brainVault.episodic.deleteSession(sessionId, user.id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// Real-time Chat Streaming (AgentBridge SSE)
// =========================================================================

/**
 * GET /api/chat/stream
 * Server-Sent Events stream implementing AgentBridge chat protocol
 */
apiRouter.get(
  '/chat/stream',
  createRateLimitMiddleware(chatRateLimiter, {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'chat',
    isSseEndpoint: true,
    message: 'Too many chat requests. Please wait a moment before sending another prompt.',
  }),
  async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  const prompt = String(req.query.prompt || '').trim();
  const sessionId = String(req.query.session_id || `session_${Date.now()}`);
  const modelProvider = req.query.model_provider ? String(req.query.model_provider) : undefined;
  const model = req.query.model ? String(req.query.model) : undefined;
  const autoPilot = req.query.auto_pilot !== 'false';
  const referenceDate = req.query.reference_date ? String(req.query.reference_date) : undefined;

  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt parameter' });
    return;
  }

  const sse = new SSEWriter(res);

  // Terminate execution and close SSE cleanly when client disconnects
  req.on('close', () => {
    executionManager.terminate(sessionId, user.id, 'client_disconnect');
    sse.close();
  });

  await AgentOrchestrator.execute(prompt, {
    sessionId,
    userId: user.id,
    modelProvider,
    model,
    autoPilot,
    referenceDate,
    onScratchpad: (event) => sse.send('scratchpad', event),
    onApprovalRequired: (data) => sse.send('tool_approval_required', data),
    onToolApproved: (data) => sse.send('tool_approved', data),
    onToken: (content) => sse.send('llm_token', { content }),
    onCitations: (citations) => sse.send('citations', { citations }),
    onPaused: (data) => sse.send('agent_paused', data),
    onResumed: (data) => sse.send('agent_resumed', data),
    onTerminated: (data) => sse.send('agent_terminated', data),
    onError: (err) => {
      sse.send('agent_error', { message: err.message || 'Processing failed' });
      sse.close();
    },
    onDone: (durationMs?: number) => {
      sse.send('done', { status: 'complete', sessionId, durationMs });
      sse.close();
    },
  });
});

/**
 * POST /api/chat/pause
 * Pauses active agent execution for the session
 */
apiRouter.post('/chat/pause', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    const sessionId = String(req.body?.session_id || '').trim();
    if (!sessionId) {
      res.status(400).json({ error: 'Missing session_id parameter' });
      return;
    }
    const success = executionManager.pause(sessionId, user.id);
    res.json({ success, status: executionManager.getStatus(sessionId) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat/resume
 * Resumes paused agent execution for the session
 */
apiRouter.post('/chat/resume', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    const sessionId = String(req.body?.session_id || '').trim();
    if (!sessionId) {
      res.status(400).json({ error: 'Missing session_id parameter' });
      return;
    }
    const success = executionManager.resume(sessionId, user.id);
    res.json({ success, status: executionManager.getStatus(sessionId) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat/terminate
 * Immediately terminates active agent execution for the session
 */
apiRouter.post('/chat/terminate', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    const sessionId = String(req.body?.session_id || '').trim();
    const reason = String(req.body?.reason || 'user_requested');
    if (!sessionId) {
      res.status(400).json({ error: 'Missing session_id parameter' });
      return;
    }
    const success = executionManager.terminate(sessionId, user.id, reason);
    res.json({ success, status: executionManager.getStatus(sessionId) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/chat/status/:sessionId
 * Returns live status of an agent execution run
 */
apiRouter.get('/chat/status/:sessionId', async (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const exec = executionManager.getExecution(sessionId);
  res.json({
    sessionId,
    status: executionManager.getStatus(sessionId),
    isPaused: executionManager.isPaused(sessionId),
    isRunning: executionManager.isRunning(sessionId),
    isTerminated: executionManager.isTerminated(sessionId),
    currentStep: exec?.currentStep || 'idle',
    totalPausedMs: exec?.totalPausedMs || 0,
  });
});

/**
 * POST /api/tool/approve
 * Resolves AgentBridge tool execution permission
 */
apiRouter.post('/tool/approve', async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  const approvalId = req.body?.approval_id || req.body?.approvalId;
  const toolName = req.body?.tool_name || req.body?.toolName || 'web_search';
  const approved = req.body?.approved !== false && req.body?.approved !== 'false';

  let rawType = req.body?.approval_type || req.body?.approvalType || 'once';
  let approvalType: 'once' | 'always' | 'deny' = 'once';
  if (rawType === 'always' || rawType === 'permanent') {
    approvalType = 'always';
  } else if (rawType === 'deny' || !approved) {
    approvalType = 'deny';
  } else {
    approvalType = 'once';
  }

  if (!approvalId) {
    res.status(400).json({ error: 'Missing approval_id' });
    return;
  }

  const success = PermissionGate.resolveApproval(
    {
      approvalId,
      approved,
      approvalType,
      toolName,
    },
    user.id
  );

  res.json({ success });
});

/**
 * GET /api/memory/status
 * Returns Memory System statistics and stored facts
 */
apiRouter.get('/memory/status', async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  await brainVault.init();
  const memories = await brainVault.episodic.getAll();
  const facts = await brainVault.facts.getAll();
  const entities = await brainVault.entities.getAll();
  const userSessions = await brainVault.sessions.getSessions(user.id);

  res.json({
    user,
    counts: {
      episodicCount: memories.length,
      factsCount: facts.length,
      entityProfilesCount: entities.length,
      userSessionsCount: userSessions.length,
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
  const user = await getAuthUser(req);
  const refDate = req.body?.reference_date ? new Date(req.body.reference_date) : new Date();
  await brainVault.resetAndReseed(refDate, user.id);
  res.json({ success: true, message: `Memory System reset and benchmark scenarios reseeded for ${user.username}` });
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
      { id: 'gemini-3.5-flash', provider: 'vertex', name: 'Gemini 3.5 Flash (Vertex AI • Recommended)' },
      { id: 'gemini-3.1-flash-lite', provider: 'vertex', name: 'Gemini 3.1 Flash-Lite (Vertex AI)' },
      { id: 'gemini-3.5-flash-lite', provider: 'vertex', name: 'Gemini 3.5 Flash-Lite (Vertex AI)' },
      { id: 'gemini-2.5-flash-lite', provider: 'gemini', name: 'Gemini 2.5 Flash-Lite' },
      { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini (Fast)' },
      { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o (Reasoning)' },
      { id: 'claude-3-5-haiku-latest', provider: 'anthropic', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-5-sonnet-latest', provider: 'anthropic', name: 'Claude 3.5 Sonnet' },
      { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Groq Llama 3.3 70B' },
    ],
  });
});
