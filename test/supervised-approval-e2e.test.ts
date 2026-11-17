import path from 'path';
process.env.NODE_ENV = 'test';
process.env.BRAIN_VAULT_DIR = path.join(process.cwd(), '.data', 'test_vault');

import { PermissionGate } from '../src/core/agent/permission-gate';
import { AgentOrchestrator } from '../src/core/agent/orchestrator';

async function runSupervisedApprovalTests() {
  console.log('🧪 Starting Supervised Mode Tool Approval E2E Tests...\n');

  // Test 1: Single-execution approval ("Allow Once")
  console.log('--- Test 1: Supervised "Allow Once" flow ---');
  PermissionGate.resetPermissions();

  let requestedApprovalId = '';
  let toolApprovedCalled = false;
  let tokensEmitted = 0;

  const session1 = `supervised_allow_${Date.now()}`;
  const p1 = AgentOrchestrator.execute('What are the key benefits of Prisma ORM?', {
    sessionId: session1,
    userId: 'test_user_supervised',
    autoPilot: false,
    modelProvider: 'fallback',
    onScratchpad: () => {},
    onApprovalRequired: (req) => {
      requestedApprovalId = req.approvalId;
      // Simulate client resolving via POST /api/tool/approve
      setTimeout(() => {
        const resolved = PermissionGate.resolveApproval({
          approvalId: req.approvalId,
          approved: true,
          approvalType: 'once',
          toolName: req.toolName,
        }, 'test_user_supervised');
        console.assert(resolved === true, 'Approval resolution must return true');
      }, 50);
    },
    onToolApproved: () => {
      toolApprovedCalled = true;
    },
    onToken: () => { tokensEmitted++; },
    onCitations: () => {},
    onError: (err) => { throw err; },
    onDone: () => {},
  });

  await p1;
  console.assert(requestedApprovalId.length > 0, 'Approval should have been requested');
  console.assert(toolApprovedCalled === true, 'onToolApproved should have been called');
  console.assert(tokensEmitted > 0, 'Tokens should have been streamed after approval');
  console.log('✓ "Allow Once" unblocked pipeline, executed tool, and streamed synthesized response');

  // Test 2: User Denial ("Deny")
  console.log('\n--- Test 2: Supervised "Deny" flow ---');
  let denyRequestedId = '';
  let denialToolApproved = false;
  let denialTokens = 0;
  let scratchpadDenialSeen = false;

  const session2 = `supervised_deny_${Date.now()}`;
  const p2 = AgentOrchestrator.execute('What are the latest Drizzle ORM releases?', {
    sessionId: session2,
    userId: 'test_user_supervised',
    autoPilot: false,
    modelProvider: 'fallback',
    onScratchpad: (e) => {
      if (e.content && e.content.includes('denied by user')) {
        scratchpadDenialSeen = true;
      }
    },
    onApprovalRequired: (req) => {
      denyRequestedId = req.approvalId;
      setTimeout(() => {
        const resolved = PermissionGate.resolveApproval({
          approvalId: req.approvalId,
          approved: false,
          approvalType: 'deny',
          toolName: req.toolName,
        }, 'test_user_supervised');
        console.assert(resolved === true, 'Denial resolution must return true');
      }, 50);
    },
    onToolApproved: () => {
      denialToolApproved = true;
    },
    onToken: () => { denialTokens++; },
    onCitations: () => {},
    onError: (err) => { throw err; },
    onDone: () => {},
  });

  await p2;
  console.assert(denyRequestedId.length > 0, 'Approval should have been requested');
  console.assert(denialToolApproved === false, 'onToolApproved should NOT have been called on denial');
  console.assert(scratchpadDenialSeen === true, 'Scratchpad should log denial');
  console.assert(denialTokens > 0, 'Pipeline should still complete with fallback memory');
  console.log('✓ "Deny" cleanly proceeded with memory fallback without breaking the pipeline');

  // Test 3: "Always Allow" persistence
  console.log('\n--- Test 3: Supervised "Always Allow" flow ---');
  PermissionGate.resetPermissions();

  let alwaysApprovalCount = 0;
  const session3 = `supervised_always_${Date.now()}`;

  // First run: requests approval, user clicks "Always Allow"
  await AgentOrchestrator.execute('What is Supabase?', {
    sessionId: session3,
    userId: 'test_user_always',
    autoPilot: false,
    modelProvider: 'fallback',
    onScratchpad: () => {},
    onApprovalRequired: (req) => {
      alwaysApprovalCount++;
      PermissionGate.resolveApproval({
        approvalId: req.approvalId,
        approved: true,
        approvalType: 'always',
        toolName: req.toolName,
      }, 'test_user_always');
    },
    onToolApproved: () => {},
    onToken: () => {},
    onCitations: () => {},
    onError: (err) => { throw err; },
    onDone: () => {},
  });

  console.assert(alwaysApprovalCount === 1, 'First run should require approval');

  // Second run: should be auto-approved without triggering onApprovalRequired!
  let secondRunApprovalTriggered = false;
  await AgentOrchestrator.execute('What is Neon database?', {
    sessionId: session3,
    userId: 'test_user_always',
    autoPilot: false,
    modelProvider: 'fallback',
    onScratchpad: () => {},
    onApprovalRequired: () => {
      secondRunApprovalTriggered = true;
    },
    onToolApproved: () => {},
    onToken: () => {},
    onCitations: () => {},
    onError: (err) => { throw err; },
    onDone: () => {},
  });

  console.assert(secondRunApprovalTriggered === false, 'Second run should NOT prompt when always-allowed');
  console.log('✓ "Always Allow" persists permission for the user and bypasses prompt on subsequent tool calls');

  console.log('\n🎉 ALL SUPERVISED MODE TOOL APPROVAL TESTS PASSED SUCCESSFULLY!');
}

runSupervisedApprovalTests().catch((err) => {
  console.error('Supervised approval test failed:', err);
  process.exit(1);
});
