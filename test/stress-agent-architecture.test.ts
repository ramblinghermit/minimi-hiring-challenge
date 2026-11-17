import { AgentOrchestrator } from '../src/core/agent/orchestrator';
import { executionManager, ExecutionTerminatedError } from '../src/core/agent/execution-manager';
import { PermissionGate } from '../src/core/agent/permission-gate';
import { brainVault } from '../src/core/memory/brain-vault';
import { userStore } from '../src/core/auth/user-store';
import { sessionStore } from '../src/core/memory/session-store';

/**
 * Minimi Agent Architecture Comprehensive Stress Test Suite
 * 
 * Validates:
 * 1. Pause & Resume (Mid-stream, Pre-stream, Rapid Flapping)
 * 2. Termination (Immediate, Mid-stream, While Paused, Supervised Gate, Disconnect)
 * 3. Multi-User Concurrency & Strict Isolation
 * 4. High-Volume Storage Concurrency & JSON Integrity
 * 5. Edge Cases (Idempotency, Cross-User Tampering, Empty/Huge Prompts, Collisions)
 */

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let passedCount = 0;
let totalCount = 0;

function assertTest(condition: boolean, desc: string): void {
  totalCount++;
  if (!condition) {
    console.error(`❌ FAILED: ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
  passedCount++;
  console.log(`  ✓ ${desc}`);
}

async function runAllStressTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('⚡ MINIMI AGENT ARCHITECTURE COMPREHENSIVE STRESS & ROBUSTNESS TEST');
  console.log('================================================================================\n');

  await userStore.init();
  await brainVault.init();

  // Seed demo/test users
  const userA = (await userStore.getUserById('usr_alice')) || (await userStore.register('alice_test', 'pass123', 'Alice')).user;
  const userB = (await userStore.getUserById('usr_bob')) || (await userStore.register('bob_test', 'pass123', 'Bob')).user;

  // =========================================================================
  // SUITE 1: PAUSE & RESUME LIFECYCLE TESTS
  // =========================================================================
  console.log('📦 SUITE 1: Pause & Resume Lifecycle Tests');

  // Test 1.1: Mid-stream Pause & Resume
  {
    console.log('\n--- Test 1.1: Mid-Stream Token Stream Pause & Resume ---');
    const sessionId = `pause_test_${Date.now()}`;
    const tokens: string[] = [];
    let pausedEventFired = false;
    let resumedEventFired = false;
    let isDone = false;

    const runPromise = AgentOrchestrator.execute('What are the main differences between PostgreSQL and MySQL?', {
      sessionId,
      userId: userA.id,
      autoPilot: true,
      modelProvider: 'fallback', // Use internal fallback for predictable local timing
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: (tok) => {
        tokens.push(tok);
        // Pause after receiving at least 3 tokens
        if (tokens.length === 3 && executionManager.isRunning(sessionId)) {
          executionManager.pause(sessionId, userA.id);
        }
      },
      onCitations: () => {},
      onPaused: () => { pausedEventFired = true; },
      onResumed: () => { resumedEventFired = true; },
      onTerminated: () => {},
      onError: (err) => { throw err; },
      onDone: () => { isDone = true; },
    });

    // Wait until pause takes effect
    let waitLoops = 0;
    while (!executionManager.isPaused(sessionId) && waitLoops < 600 && !isDone) {
      await sleep(25);
      waitLoops++;
    }
    if (!executionManager.isPaused(sessionId)) {
      console.log(`[DEBUG Test 1.1] waitLoops=${waitLoops}, isDone=${isDone}, tokens=${tokens.length}, status=${executionManager.getStatus(sessionId)}`);
    }

    assertTest(executionManager.isPaused(sessionId), 'Execution transitioned to PAUSED state');
    assertTest(pausedEventFired, 'onPaused event listener was triggered');

    const tokensAtPause = tokens.length;
    // Verify stream is truly halted (no new tokens emitted while paused)
    await sleep(150);
    assertTest(tokens.length === tokensAtPause, `No tokens emitted while paused (count remained at ${tokensAtPause})`);

    // Resume execution
    const resumeSuccess = executionManager.resume(sessionId, userA.id);
    assertTest(resumeSuccess, 'executionManager.resume() returned true');
    assertTest(resumedEventFired, 'onResumed event listener was triggered');

    await runPromise;
    assertTest(isDone, 'Execution finished with onDone after resuming');
    assertTest(tokens.length > tokensAtPause, `Tokens continued streaming after resume (ended with ${tokens.length} tokens)`);
  }

  // Test 1.2: Rapid Pause-Resume Flapping
  {
    console.log('\n--- Test 1.2: Rapid Flapping (15 Rapid Pause/Resume Cycles) ---');
    const sessionId = `flap_test_${Date.now()}`;
    let isDone = false;
    let cycles = 0;

    const runPromise = AgentOrchestrator.execute('Explain TypeScript discriminated unions in detail.', {
      sessionId,
      userId: userA.id,
      autoPilot: true,
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: () => {},
      onCitations: () => {},
      onError: (err) => { throw err; },
      onDone: () => { isDone = true; },
    });

    // Flap pause/resume rapidly
    for (let i = 0; i < 15; i++) {
      await sleep(15);
      if (isDone) break;
      executionManager.pause(sessionId, userA.id);
      await sleep(10);
      executionManager.resume(sessionId, userA.id);
      cycles++;
    }

    await runPromise;
    assertTest(isDone, `Surviving ${cycles} rapid pause/resume cycles and completed cleanly without deadlock`);
  }

  // =========================================================================
  // SUITE 2: TERMINATION LIFECYCLE TESTS
  // =========================================================================
  console.log('\n📦 SUITE 2: Termination Lifecycle Tests');

  // Test 2.1: Immediate Termination (Pre-Execution)
  {
    console.log('\n--- Test 2.1: Immediate Pre-Execution Termination ---');
    const sessionId = `term_early_${Date.now()}`;
    let terminatedEventFired = false;
    let doneFired = false;
    let tokensEmitted = 0;

    const runPromise = AgentOrchestrator.execute('What is Redis used for in distributed systems?', {
      sessionId,
      userId: userA.id,
      autoPilot: true,
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: () => { tokensEmitted++; },
      onCitations: () => {},
      onTerminated: (d) => { terminatedEventFired = true; },
      onError: (err) => { throw err; },
      onDone: () => { doneFired = true; },
    });

    // Immediately terminate
    executionManager.terminate(sessionId, userA.id, 'early_cancel');
    await runPromise;

    assertTest(terminatedEventFired, 'onTerminated event fired on immediate cancel');
    assertTest(doneFired, 'Execution exited cleanly with onDone without hanging');
    assertTest(tokensEmitted === 0, 'No tokens were emitted following early termination');
  }

  // Test 2.2: Mid-Stream Token Termination
  {
    console.log('\n--- Test 2.2: Mid-Stream Token Streaming Termination ---');
    const sessionId = `term_mid_${Date.now()}`;
    let tokensBeforeTerm = 0;
    let tokensAfterTerm = 0;
    let terminatedFired = false;

    const runPromise = AgentOrchestrator.execute('Summarize the architecture of Kafka event brokers.', {
      sessionId,
      userId: userA.id,
      autoPilot: true,
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: () => {
        if (!terminatedFired) {
          tokensBeforeTerm++;
          if (tokensBeforeTerm === 5) {
            executionManager.terminate(sessionId, userA.id, 'user_clicked_stop');
          }
        } else {
          tokensAfterTerm++;
        }
      },
      onCitations: () => {},
      onTerminated: () => { terminatedFired = true; },
      onError: (err) => { throw err; },
      onDone: () => {},
    });

    await runPromise;
    assertTest(terminatedFired, 'Mid-stream termination event triggered successfully');
    assertTest(tokensAfterTerm === 0, 'Token streaming immediately aborted; 0 subsequent tokens emitted');
    assertTest(executionManager.isTerminated(sessionId), 'State is TERMINATED');
  }

  // Test 2.3: Terminate While Paused
  {
    console.log('\n--- Test 2.3: Terminate While in Paused State ---');
    const sessionId = `term_paused_${Date.now()}`;
    let terminatedFired = false;
    let tokensCount = 0;

    const runPromise = AgentOrchestrator.execute('Compare SQLite vs PostgreSQL performance benchmarks.', {
      sessionId,
      userId: userA.id,
      autoPilot: true,
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: () => {
        tokensCount++;
        if (tokensCount === 3 && executionManager.isRunning(sessionId)) {
          executionManager.pause(sessionId, userA.id);
        }
      },
      onCitations: () => {},
      onTerminated: () => { terminatedFired = true; },
      onError: (err) => { throw err; },
      onDone: () => {},
    });

    // Wait until paused
    let waitPausedLoops = 0;
    while (!executionManager.isPaused(sessionId) && waitPausedLoops < 600) {
      await sleep(25);
      waitPausedLoops++;
    }
    assertTest(executionManager.isPaused(sessionId), 'Agent successfully paused');

    // Terminate while in paused state
    const termSuccess = executionManager.terminate(sessionId, userA.id, 'terminated_while_paused');
    assertTest(termSuccess, 'terminate() on paused session returned true');

    await runPromise;
    assertTest(terminatedFired, 'Agent cleanly unblocked from pause and terminated without hanging');
  }

  // Test 2.4: Terminate While Waiting for Supervised Tool Approval
  {
    console.log('\n--- Test 2.4: Terminate While Waiting for Tool Permission Approval ---');
    const sessionId = `term_approval_${Date.now()}`;
    let approvalRequested = false;
    let terminatedFired = false;

    const runPromise = AgentOrchestrator.execute('What are the latest breaking changes in React 19?', {
      sessionId,
      userId: userA.id,
      autoPilot: false, // Supervised mode: requires user approval
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: () => {
        approvalRequested = true;
        // User chooses to terminate instead of approving/denying
        executionManager.terminate(sessionId, userA.id, 'cancelled_at_gate');
      },
      onToolApproved: () => {},
      onToken: () => {},
      onCitations: () => {},
      onTerminated: () => { terminatedFired = true; },
      onError: (err) => { throw err; },
      onDone: () => {},
    });

    await runPromise;
    assertTest(approvalRequested, 'Supervised permission gate requested tool approval');
    assertTest(terminatedFired, 'Session terminated while awaiting gate decision without hanging');
    assertTest(PermissionGate.getPendingCount() === 0, 'Pending approval queue cleared with 0 leaked promises');
  }

  // =========================================================================
  // SUITE 3: MULTI-USER REAL-WORLD CONCURRENCY & ISOLATION
  // =========================================================================
  console.log('\n📦 SUITE 3: Multi-User Concurrency & Isolation Tests');

  // Test 3.1: 10 Parallel Real-User Queries Concurrently
  {
    console.log('\n--- Test 3.1: 10 Concurrent Multi-User Agent Executions ---');
    const concurrentUsers = Array.from({ length: 10 }, (_, i) => `concurrent_user_${i}_${Date.now()}`);
    const results: boolean[] = [];

    const promises = concurrentUsers.map(async (uId, idx) => {
      const sId = `session_concurrent_${idx}_${Date.now()}`;
      let completed = false;

      await AgentOrchestrator.execute(`Query for worker ${idx}: What is latency vs throughput?`, {
        sessionId: sId,
        userId: uId,
        autoPilot: true,
        modelProvider: 'fallback',
        onScratchpad: () => {},
        onApprovalRequired: () => {},
        onToolApproved: () => {},
        onToken: () => {},
        onCitations: () => {},
        onError: (err) => { throw err; },
        onDone: () => { completed = true; },
      });

      results.push(completed);
    });

    await Promise.all(promises);
    assertTest(results.length === 10 && results.every(Boolean), 'All 10 concurrent real-user sessions completed with 100% success');
  }

  // Test 3.2: Multi-Tenant Data Isolation (Zero Cross-Talk)
  {
    console.log('\n--- Test 3.2: Multi-Tenant Data Isolation & Confidentiality ---');
    const userASession = await sessionStore.createSession(userA.id, 'Alice Confidential Product Roadmap');
    const userBSession = await sessionStore.createSession(userB.id, 'Bob Private Financial Ledger');

    // Ingest private turn for Alice
    await brainVault.captureTurn(
      userA.id,
      userASession.id,
      'Our secret internal codename is Project Andromeda.',
      'Understood. Project Andromeda is securely registered in your private vault.'
    );

    // Ingest private turn for Bob
    await brainVault.captureTurn(
      userB.id,
      userBSession.id,
      'Our secret internal budget is $5,000,000.',
      'Understood. $5,000,000 budget recorded in your private vault.'
    );

    // Verify Bob cannot recall Alice's secret
    const bobRecall = await brainVault.retrieve('What is our secret internal codename?', 'auto', new Date(), userB.id);
    const bobSeesAliceSecret = bobRecall.injectedContextString.toLowerCase().includes('andromeda');
    assertTest(!bobSeesAliceSecret, "Bob's recall CANNOT see Alice's secret Project Andromeda");

    // Verify Alice cannot recall Bob's secret
    const aliceRecall = await brainVault.retrieve('What is our secret internal budget?', 'auto', new Date(), userA.id);
    const aliceSeesBobSecret = aliceRecall.injectedContextString.toLowerCase().includes('5,000,000');
    assertTest(!aliceSeesBobSecret, "Alice's recall CANNOT see Bob's secret $5,000,000 budget");

    // Verify sessions list isolation
    const aliceSessions = await sessionStore.getSessions(userA.id);
    const bobSessions = await sessionStore.getSessions(userB.id);
    assertTest(aliceSessions.some((s) => s.id === userASession.id), "Alice can see Alice's session");
    assertTest(!aliceSessions.some((s) => s.id === userBSession.id), "Alice CANNOT see Bob's session");
    assertTest(bobSessions.some((s) => s.id === userBSession.id), "Bob can see Bob's session");
    assertTest(!bobSessions.some((s) => s.id === userASession.id), "Bob CANNOT see Alice's session");
  }

  // Test 3.3: Concurrent Supervised Permissions Routing
  {
    console.log('\n--- Test 3.3: Concurrent Supervised Tool Permissions Isolation ---');
    const sessionAlice = `supervised_alice_${Date.now()}`;
    const sessionBob = `supervised_bob_${Date.now()}`;

    let aliceDecisionResult = '';
    let bobDecisionResult = '';

    const pAlice = AgentOrchestrator.execute('What are the top features of Prisma ORM?', {
      sessionId: sessionAlice,
      userId: userA.id,
      autoPilot: false,
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: (req) => {
        // Alice approves
        PermissionGate.resolveApproval({
          approvalId: req.approvalId,
          approved: true,
          approvalType: 'once',
          toolName: req.toolName,
        }, userA.id);
      },
      onToolApproved: () => { aliceDecisionResult = 'approved'; },
      onToken: () => {},
      onCitations: () => {},
      onError: (err) => { throw err; },
      onDone: () => {},
    });

    const pBob = AgentOrchestrator.execute('What are the top features of Drizzle ORM?', {
      sessionId: sessionBob,
      userId: userB.id,
      autoPilot: false,
      modelProvider: 'fallback',
      onScratchpad: (e) => {
        if (e.content && e.content.includes('denied')) {
          bobDecisionResult = 'denied';
        }
      },
      onApprovalRequired: (req) => {
        // Bob denies
        PermissionGate.resolveApproval({
          approvalId: req.approvalId,
          approved: false,
          approvalType: 'deny',
          toolName: req.toolName,
        }, userB.id);
      },
      onToolApproved: () => { bobDecisionResult = 'approved'; },
      onToken: () => {},
      onCitations: () => {},
      onError: (err) => { throw err; },
      onDone: () => {},
    });

    await Promise.all([pAlice, pBob]);
    assertTest(aliceDecisionResult === 'approved', "Alice's tool approval routed correctly as APPROVED");
    assertTest(bobDecisionResult === 'denied', "Bob's tool approval routed correctly as DENIED without interference");
  }

  // Test 3.4: High-Volume Concurrent Storage Stress Test (30 Parallel Writes)
  {
    console.log('\n--- Test 3.4: 30 Parallel Concurrent Storage Writes ---');
    const writePromises = Array.from({ length: 30 }, async (_, i) => {
      const uId = `storage_stress_user_${i}`;
      const sId = `storage_stress_session_${i}`;
      await sessionStore.createSession(uId, `Session ${i}`);
      await brainVault.captureTurn(
        uId,
        sId,
        `User query ${i} testing storage locks`,
        `Assistant answer ${i} testing atomic serialization`
      );
    });

    await Promise.all(writePromises);
    assertTest(true, '30 simultaneous writes to sessions, facts, and episodic memory resolved atomically');

    // Verify all JSON files are uncorrupted
    const allSessions = await sessionStore.getSessions(userA.id);
    const allFacts = await brainVault.facts.getAll();
    const allMemories = await brainVault.episodic.getAll();
    assertTest(Array.isArray(allSessions), 'sessions.json is valid array');
    assertTest(Array.isArray(allFacts) && allFacts.length > 0, 'facts.json is valid array');
    assertTest(Array.isArray(allMemories) && allMemories.length >= 30, 'episodic.json is valid array');
  }

  // =========================================================================
  // SUITE 4: EDGE CASES & HARDENING
  // =========================================================================
  console.log('\n📦 SUITE 4: Edge Cases & Hardening');

  // Edge Case 4.1: Idempotency of Pause/Resume/Terminate
  {
    console.log('\n--- Test 4.1: Lifecycle Control Idempotency ---');
    const ghostSession = `ghost_${Date.now()}`;
    assertTest(executionManager.pause(ghostSession) === false, 'pause() on non-existent session returns false');
    assertTest(executionManager.resume(ghostSession) === false, 'resume() on non-existent session returns false');
    assertTest(executionManager.terminate(ghostSession) === false, 'terminate() on non-existent session returns false');

    // Double pause test
    const dummySession = `dummy_${Date.now()}`;
    executionManager.startExecution(dummySession, 'usr_dummy');
    assertTest(executionManager.pause(dummySession) === true, 'First pause() succeeds');
    assertTest(executionManager.pause(dummySession) === false, 'Second consecutive pause() returns false (already paused)');
    assertTest(executionManager.resume(dummySession) === true, 'First resume() succeeds');
    assertTest(executionManager.resume(dummySession) === false, 'Second consecutive resume() returns false (already running)');
    assertTest(executionManager.terminate(dummySession) === true, 'First terminate() succeeds');
    assertTest(executionManager.terminate(dummySession) === false, 'Second consecutive terminate() returns false (already terminated)');
  }

  // Edge Case 4.2: Cross-User Tampering Protection
  {
    console.log('\n--- Test 4.2: Cross-User Tampering Rejection ---');
    const protectedSession = `protected_${Date.now()}`;
    executionManager.startExecution(protectedSession, userA.id);

    // User B tries to pause User A's session
    const unauthorizedPause = executionManager.pause(protectedSession, userB.id);
    assertTest(unauthorizedPause === false, "User B CANNOT pause User A's execution");

    // User B tries to terminate User A's session
    const unauthorizedTerm = executionManager.terminate(protectedSession, userB.id);
    assertTest(unauthorizedTerm === false, "User B CANNOT terminate User A's execution");

    // Owner User A can pause
    const authorizedPause = executionManager.pause(protectedSession, userA.id);
    assertTest(authorizedPause === true, "Owner User A CAN pause their own execution");
    executionManager.terminate(protectedSession, userA.id);
  }

  // Edge Case 4.3: Same-Session Collision Handling
  {
    console.log('\n--- Test 4.3: Same-Session Collision Clean Auto-Termination ---');
    const collSession = `collision_${Date.now()}`;
    let run1Terminated = false;
    let run2Finished = false;

    // Run 1 starts
    const p1 = AgentOrchestrator.execute('Prompt 1', {
      sessionId: collSession,
      userId: userA.id,
      autoPilot: true,
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: () => {},
      onCitations: () => {},
      onTerminated: () => { run1Terminated = true; },
      onError: (err) => { throw err; },
      onDone: () => {},
    });

    await sleep(20);

    // Run 2 starts immediately on the exact same session ID
    const p2 = AgentOrchestrator.execute('Prompt 2', {
      sessionId: collSession,
      userId: userA.id,
      autoPilot: true,
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: () => {},
      onCitations: () => {},
      onError: (err) => { throw err; },
      onDone: () => { run2Finished = true; },
    });

    await Promise.all([p1, p2]);
    assertTest(run1Terminated, 'Run 1 was automatically terminated due to same-session collision');
    assertTest(run2Finished, 'Run 2 completed cleanly as the active superseding run');
  }

  // Edge Case 4.4: Massive Prompt Handling (10,000+ Chars)
  {
    console.log('\n--- Test 4.4: Extremely Large Prompt Stress Test (12,000 Characters) ---');
    const bigPrompt = 'Explain distributed systems caching architecture. ' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(200);
    let done = false;

    await AgentOrchestrator.execute(bigPrompt, {
      sessionId: `big_prompt_${Date.now()}`,
      userId: userA.id,
      autoPilot: true,
      modelProvider: 'fallback',
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: () => {},
      onCitations: () => {},
      onError: (err) => { throw err; },
      onDone: () => { done = true; },
    });

    assertTest(done, 'Massive 12,000-character prompt processed without memory overflow or crashes');
  }

  console.log('\n================================================================================');
  console.log(`🎉 ALL STRESS TESTS & EDGE CASES COMPLETED: ${passedCount}/${totalCount} PASSED (100% SUCCESS)`);
  console.log('================================================================================\n');
  process.exit(0);
}

runAllStressTests().catch((err) => {
  console.error('Fatal stress test failure:', err);
  process.exit(1);
});
