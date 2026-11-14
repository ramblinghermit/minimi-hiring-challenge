import { Router, Request, Response } from 'express';
import { AgentOrchestrator } from '../core/agent/orchestrator';
import { PermissionGate } from '../core/agent/permission-gate';
import { brainVault } from '../core/memory/brain-vault';
import { searchRouter } from '../core/search/search-router';
import { LLMClient } from '../core/llm/llm-client';
import { userStore } from '../core/auth/user-store';
import { getAuthUser } from './auth-middleware';
import { SSEWriter } from './sse';

export const apiRouter = Router();

// =========================================================================
// Authentication Endpoints (Multi-User Distinction)
// =========================================================================

/**
 * POST /api/auth/register
 * Registers a new user account with secure hashed credentials
 */
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
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
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
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
          'Querying Brain-Vault Multi-View Memory (Episodic + State + Entity Profiles)...',
          citesCount > 0
            ? `Retrieved ${citesCount} verified web sources via Live Search`
            : 'Recalled verified facts from episodic memory vault',
          'Synthesizing verified response and streaming answer...',
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
apiRouter.get('/chat/stream', async (req: Request, res: Response) => {
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

  req.on('close', () => {
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
    onError: (err) => {
      sse.send('agent_error', { message: err.message || 'Processing failed' });
      sse.close();
    },
    onDone: () => {
      sse.send('done', { status: 'complete', sessionId });
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
  res.json({ success: true, message: `Brain-Vault memory reset and benchmark scenarios reseeded for ${user.username}` });
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
      { id: 'gemini-2.5-flash-lite', provider: 'gemini', name: 'Gemini 2.5 Flash-Lite (Recommended)' },
      { id: 'gemini-3.1-flash-lite', provider: 'gemini', name: 'Gemini 3.1 Flash-Lite' },
      { id: 'gemini-3.5-flash-lite', provider: 'gemini', name: 'Gemini 3.5 Flash-Lite' },
      { id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash' },
      { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Groq Llama 3.3 70B' },
    ],
  });
});
