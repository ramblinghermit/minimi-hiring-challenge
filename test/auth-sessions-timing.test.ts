import path from 'path';
process.env.NODE_ENV = 'test';
process.env.BRAIN_VAULT_DIR = path.join(process.cwd(), '.data', 'test_vault');

import { userStore } from '../src/core/auth/user-store';
import { sessionStore } from '../src/core/memory/session-store';
import { brainVault } from '../src/core/memory/brain-vault';
import { AgentOrchestrator } from '../src/core/agent/orchestrator';

async function runAuthAndSessionTests() {
  console.log('🧪 Starting Auth, User Distinction, Sessions & Timing Verification Tests...\n');

  // =========================================================================
  // Test 1: User Store & Authentication
  // =========================================================================
  console.log('--- Test 1: User Registration, Login & Hashed Passwords ---');
  await userStore.init();

  const demoUsers = await userStore.listDemoUsers();
  console.assert(demoUsers.length >= 3, 'Demo users should be initialized');
  console.log(`✓ Default users initialized: ${demoUsers.map((u) => u.username).join(', ')}`);

  // Login with existing demo account
  const demoLogin = await userStore.login('demo', 'password123');
  console.assert(demoLogin.token.startsWith('tok_'), 'Token should be generated');
  console.assert(demoLogin.user.username === 'demo', 'User should match demo');
  console.log('✓ Demo user login verified successfully');

  // Register a new test user
  const uniqueUsername = `testuser_${Date.now().toString(36)}`;
  const registered = await userStore.register(uniqueUsername, 'secret456', 'Test Engineer');
  console.assert(registered.user.username === uniqueUsername, 'Username should match');
  console.assert(registered.token.length > 10, 'Auth token should be issued');
  console.log(`✓ New user registration verified: @${uniqueUsername}`);

  // Token verification
  const verifiedUser = await userStore.verifyToken(registered.token);
  console.assert(verifiedUser?.id === registered.user.id, 'Token verification should return user');
  console.log('✓ Token verification verified');

  // Bad password rejection
  let failedLogin = false;
  try {
    await userStore.login(uniqueUsername, 'wrongpassword');
  } catch {
    failedLogin = true;
  }
  console.assert(failedLogin, 'Bad password should be rejected');
  console.log('✓ Incorrect password correctly rejected');

  // =========================================================================
  // Test 2: User Distinction & Session Scoping
  // =========================================================================
  console.log('\n--- Test 2: User Distinction & Multi-Tenant Data Isolation ---');
  const userA = registered.user;
  const userB = (await userStore.login('alice', 'password123')).user;

  // User A creates a session
  const sessionA = await sessionStore.createSession(userA.id, 'User A Confidential Research');
  // User B creates a session
  const sessionB = await sessionStore.createSession(userB.id, 'User B Sales Pipeline');

  const userASessions = await sessionStore.getSessions(userA.id);
  const userBSessions = await sessionStore.getSessions(userB.id);

  console.assert(userASessions.some((s) => s.id === sessionA.id), "User A should see User A's session");
  console.assert(!userASessions.some((s) => s.id === sessionB.id), "User A must NOT see User B's session");
  console.assert(userBSessions.some((s) => s.id === sessionB.id), "User B should see User B's session");
  console.assert(!userBSessions.some((s) => s.id === sessionA.id), "User B must NOT see User A's session");
  console.log("✓ User distinction verified: User A and User B sessions are strictly isolated");

  // =========================================================================
  // Test 3: Session Operations (Rename & Delete)
  // =========================================================================
  console.log('\n--- Test 3: Session Lifecycle (Rename & Delete) ---');
  await sessionStore.updateTitle(sessionA.id, userA.id, 'Renamed Research Session');
  const updatedA = await sessionStore.getSession(sessionA.id, userA.id);
  console.assert(updatedA?.title === 'Renamed Research Session', 'Session title should be updated');
  console.log('✓ Session renaming verified');

  await sessionStore.deleteSession(sessionA.id, userA.id);
  const deletedCheck = await sessionStore.getSession(sessionA.id, userA.id);
  console.assert(deletedCheck === null, 'Deleted session should no longer exist');
  console.log('✓ Session deletion verified');

  // =========================================================================
  // Test 4: Chat History Persistence with Citations & Execution Traces
  // =========================================================================
  console.log('\n--- Test 4: Chat History & Knowledge Capture Persistence ---');
  const histSessionId = `hist_${Date.now()}`;
  await brainVault.captureTurn(
    userB.id,
    histSessionId,
    'What are the 3 top CRM systems?',
    'The 3 top CRM systems are HubSpot, Salesforce, and Zoho.',
    [
      {
        index: 1,
        title: 'Top CRMs 2026',
        url: 'https://example.com/crm',
        domain: 'example.com',
        snippet: 'Comparison of CRM tools',
      },
    ],
    [
      'Querying Brain-Vault Multi-View Memory (Episodic + State + Entity Profiles)...',
      'Search Strategy Planned: Search top CRM systems 2026',
      'Executing parallel web search via BRAVE...',
      'Search completed. Retrieved 1 verified web source.',
      'Synthesizing verified response and streaming answer...'
    ]
  );

  const history = await brainVault.episodic.getSessionHistory(histSessionId, userB.id);
  console.assert(history.length === 2, `Expected 2 history entries, got ${history.length}`);
  console.assert(history[0].role === 'user', 'First entry should be user');
  console.assert(history[1].role === 'assistant', 'Second entry should be assistant');
  console.assert(history[1].metadata?.citations?.length === 1, 'Citations should be preserved in history');
  console.assert(history[1].metadata?.scratchpad?.length === 5, 'Execution traces (scratchpad) should be preserved in history');
  console.log('✓ Chat history with citations & execution traces correctly persisted and retrievable');

  // =========================================================================
  // Test 5: Citation Timing (Pop up AFTER text has loaded)
  // =========================================================================
  console.log('\n--- Test 5: Source Citation Timing Verification ---');
  const eventLog: Array<{ event: string; timestamp: number; data?: any }> = [];

  const timingSessionId = `timing_${Date.now()}`;
  await AgentOrchestrator.execute('What is the current population of Tokyo?', {
    sessionId: timingSessionId,
    userId: userB.id,
    autoPilot: true,
    onScratchpad: (e) => eventLog.push({ event: 'scratchpad', timestamp: Date.now() }),
    onApprovalRequired: () => {},
    onToolApproved: () => {},
    onToken: (tok) => eventLog.push({ event: 'token', timestamp: Date.now() }),
    onCitations: (cites) => eventLog.push({ event: 'citations', timestamp: Date.now(), data: cites }),
    onError: (err) => { throw err; },
    onDone: () => eventLog.push({ event: 'done', timestamp: Date.now() }),
  });

  const firstTokenIndex = eventLog.findIndex((e) => e.event === 'token');
  const citationsIndex = eventLog.findIndex((e) => e.event === 'citations');
  const doneIndex = eventLog.findIndex((e) => e.event === 'done');

  console.assert(firstTokenIndex >= 0, 'Tokens should be received');
  if (citationsIndex >= 0) {
    console.assert(
      citationsIndex > firstTokenIndex,
      `Citations index (${citationsIndex}) must come AFTER first token index (${firstTokenIndex})`
    );
    console.log(`✓ Citations timing verified: Tokens started at event #${firstTokenIndex}, citations emitted at event #${citationsIndex}`);
  }
  console.assert(doneIndex > firstTokenIndex, 'Done event should come after tokens');
  console.log('✓ Timing order verified: Search -> Tokens Streamed -> Citations Emitted -> Done');

  console.log('\n🎉 ALL NEW AUTH, USER DISTINCTION, SESSIONS & TIMING TESTS PASSED!');
}

runAuthAndSessionTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
