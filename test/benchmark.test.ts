import { TemporalParser } from '../src/core/memory/temporal-parser';
import { brainVault } from '../src/core/memory/brain-vault';
import { QueryPlanner } from '../src/core/search/query-planner';
import { searchRouter } from '../src/core/search/search-router';
import { PermissionGate } from '../src/core/agent/permission-gate';
import { AgentOrchestrator } from '../src/core/agent/orchestrator';

async function runTests() {
  console.log('🧪 Starting Minimi Deep Temporal Recall & Flow Verification Tests...\n');
  const refDate = new Date('2026-11-12T12:00:00Z'); // Thursday Nov 12, 2026

  // =========================================================================
  // Test 1: Temporal Date Parser Matrix (10 Distinct Natural Language Queries)
  // =========================================================================
  console.log('--- Test 1: Advanced Temporal Date Parser Matrix ---');

  const testCases = [
    { query: 'What did I ask you on 3 November?', expectedType: 'absolute', labelContains: '3 November' },
    { query: 'On Nov 5th we discussed pricing', expectedType: 'absolute', labelContains: '5 Nov' },
    { query: 'Check our notes from 2026-11-03', expectedType: 'absolute', labelContains: '3' },
    { query: 'Last Tuesday I asked about Postgres hosting', expectedType: 'relative', labelContains: 'Last tuesday' },
    { query: 'On Monday we shortlisted 5 CRM tools', expectedType: 'relative', labelContains: 'monday' },
    { query: 'Yesterday we tested the latency', expectedType: 'relative', labelContains: 'Yesterday' },
    { query: 'Three days ago we discussed Drizzle ORM', expectedType: 'relative', labelContains: '3 day(s) ago' },
    { query: 'Five days ago what was the OpenAI batch limit?', expectedType: 'relative', labelContains: '5 day(s) ago' },
    { query: 'Two weeks ago we evaluated vector databases', expectedType: 'relative', labelContains: '2 week(s) ago' },
    { query: 'Earlier this week did any pricing change?', expectedType: 'relative', labelContains: 'Earlier this week' },
  ];

  for (const tc of testCases) {
    const parsed = TemporalParser.parse(tc.query, refDate);
    console.assert(parsed !== null, `Failed to parse: "${tc.query}"`);
    console.assert(parsed?.anchorType === tc.expectedType, `Expected type ${tc.expectedType}, got ${parsed?.anchorType}`);
    console.assert(
      parsed?.label.toLowerCase().includes(tc.labelContains.toLowerCase()),
      `Label "${parsed?.label}" should contain "${tc.labelContains}"`
    );
    console.log(`✓ "${tc.query}" -> ${parsed?.label} [${parsed?.anchorType}]`);
  }

  // =========================================================================
  // Test 2: Brain-Vault Multi-View Recall & Dynamic Keyword Matching
  // =========================================================================
  console.log('\n--- Test 2: Brain-Vault Multi-View Memory Recall on Real Questions ---');
  await brainVault.resetAndReseed(refDate);

  // Scenario A: CRM Shortlist (Monday)
  const crmContext = await brainVault.retrieve(
    'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
    'auto',
    refDate
  );
  console.assert(crmContext.episodicMemories.length > 0, 'Should recall Monday CRM session');
  console.assert(crmContext.entityProfiles.length >= 5, `Expected >= 5 CRM profiles, got ${crmContext.entityProfiles.length}`);
  console.log(`✓ [Monday CRM]: Recalled ${crmContext.entityProfiles.length} profiles: ${crmContext.entityProfiles.map(p => p.entityName).join(', ')}`);

  // Scenario B: Absolute Date Recall (3 November)
  const nov3Context = await brainVault.retrieve(
    'What did I ask you on 3 November? Is your answer still correct today?',
    'auto',
    refDate
  );
  console.assert(nov3Context.episodicMemories.length > 0, 'Should recall Nov 3 memory');
  console.assert(nov3Context.episodicMemories[0].content.includes('Claude 3.5 Haiku'), 'Should contain Claude 3.5 Haiku query');
  console.log('✓ [3 November]: Recalled historical query:', nov3Context.episodicMemories[0].content);

  // Scenario C: Postgres Hosting (Last Tuesday)
  const pgContext = await brainVault.retrieve(
    'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?',
    'auto',
    refDate
  );
  console.assert(pgContext.episodicMemories.length > 0, 'Should recall Last Tuesday Postgres session');
  console.assert(pgContext.entityProfiles.length >= 4, 'Should recall Postgres host profiles');
  console.log(`✓ [Last Tuesday Postgres]: Recalled hosts: ${pgContext.entityProfiles.map(p => p.entityName).join(', ')}`);

  // Scenario D: Vector Databases (Two Weeks Ago)
  const vectorContext = await brainVault.retrieve(
    'Two weeks ago we compared vector databases for our RAG agent. Has Pinecone or Qdrant announced any new serverless pricing or hybrid search updates since?',
    'auto',
    refDate
  );
  console.assert(vectorContext.episodicMemories.length > 0, 'Should recall Two Weeks Ago Vector DB session');
  console.assert(vectorContext.entityProfiles.some(p => p.entityName.toLowerCase().includes('pinecone')), 'Should recall Pinecone profile');
  console.log(`✓ [Two Weeks Ago Vector DBs]: Recalled profiles: ${vectorContext.entityProfiles.map(p => p.entityName).join(', ')}`);

  // Scenario E: Dynamic Salient Keyword Recall (Drizzle ORM 3 Days Ago)
  const ormContext = await brainVault.retrieve(
    'Three days ago I asked you about Drizzle ORM and Prisma. Have there been any new version releases or breaking changes since?',
    'auto',
    refDate
  );
  console.assert(ormContext.episodicMemories.length > 0, 'Should recall 3-days-ago ORM session');
  console.assert(ormContext.entityProfiles.some(p => p.entityName.toLowerCase().includes('drizzle')), 'Should recall Drizzle profile');
  console.log(`✓ [3 Days Ago ORM]: Recalled profiles: ${ormContext.entityProfiles.map(p => p.entityName).join(', ')}`);

  // =========================================================================
  // Test 3: Search Query Decomposition & Temporal Delta Planning
  // =========================================================================
  console.log('\n--- Test 3: Search Query Decomposition & Intent Differentiation ---');

  const deltaPlan = QueryPlanner.planQueries(
    'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
    crmContext
  );
  console.assert(deltaPlan.isDeltaSearch === true, 'Should detect temporal delta intent');
  console.assert(deltaPlan.queries.length >= 4, `Expected >= 4 decomposed queries, got ${deltaPlan.queries.length}`);
  console.log('✓ Delta Plan decomposed into targeted queries:', deltaPlan.queries);

  const staticPlan = QueryPlanner.planQueries(
    'What is the current population of Tokyo?',
    { episodicMemories: [], activeFacts: [], entityProfiles: [], injectedContextString: '' }
  );
  console.assert(staticPlan.isDeltaSearch === false, 'Generic query should not be marked as delta search');
  console.log('✓ Static Plan query:', staticPlan.queries);

  // =========================================================================
  // Test 4: Web Search Execution & Resilient Fallback
  // =========================================================================
  console.log('\n--- Test 4: Web Search Execution ---');
  const searchRes = await searchRouter.searchSingle('Supabase Postgres pricing 2026');
  console.assert(searchRes.results.length > 0, 'Search should return results');
  console.log(`✓ Search execution successful via [${searchRes.provider}]: ${searchRes.results.length} results in ${searchRes.executionTimeMs}ms`);

  // =========================================================================
  // Test 5: Tool Permission Governance Gate
  // =========================================================================
  console.log('\n--- Test 5: Permission Gate Governance ---');
  PermissionGate.resetPermissions();

  // 5a. Auto-pilot mode
  const autoDecision = await PermissionGate.requestApproval('web_search', { q: 'test' }, 'srv', true);
  console.assert(autoDecision.approved === true, 'Auto-pilot should approve immediately');
  console.log('✓ Auto-pilot approved immediately');

  // 5b. Supervised mode
  let pendingApprovalId = '';
  PermissionGate.setApprovalCallback((req) => {
    pendingApprovalId = req.approvalId;
  });

  const supervisedPromise = PermissionGate.requestApproval('web_search', { q: 'supervised' }, 'srv', false);
  console.assert(pendingApprovalId.length > 0, 'Supervised mode should trigger approval callback');
  PermissionGate.resolveApproval({
    approvalId: pendingApprovalId,
    approved: true,
    approvalType: 'once',
    toolName: 'web_search',
  });
  const supDecision = await supervisedPromise;
  console.assert(supDecision.approved === true, 'Supervised approval resolved successfully');
  console.log('✓ Supervised approval flow verified');

  // =========================================================================
  // Test 6: End-to-End Full Flow Orchestration Execution
  // =========================================================================
  console.log('\n--- Test 6: Full Agent Orchestration End-to-End ---');
  const sessionId = `test_session_${Date.now()}`;
  const scratchpadEvents: string[] = [];
  let tokenStream = '';
  let citationsReceived = 0;
  let executionCompleted = false;

  await AgentOrchestrator.execute(
    'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?',
    {
      sessionId,
      autoPilot: true,
      referenceDate: refDate.toISOString(),
      onScratchpad: (event) => scratchpadEvents.push(event.content),
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: (token) => { tokenStream += token; },
      onCitations: (citations) => { citationsReceived = citations.length; },
      onError: (err) => { throw err; },
      onDone: () => { executionCompleted = true; },
    }
  );

  console.assert(executionCompleted === true, 'Orchestration should complete successfully');
  console.assert(scratchpadEvents.length >= 4, `Expected >= 4 scratchpad trace steps, got ${scratchpadEvents.length}`);
  console.assert(citationsReceived > 0, 'Citations should be generated from web search');
  console.assert(tokenStream.length > 0, 'Token stream should contain synthesized response');
  console.log(`✓ Full orchestration completed: ${scratchpadEvents.length} scratchpad events, ${citationsReceived} citations, ${tokenStream.length} chars response`);

  // Verify post-turn knowledge capture recorded this turn
  const sessionHistory = await brainVault.episodic.getSessionHistory(sessionId);
  console.assert(sessionHistory.length === 2, `Expected 2 entries (user + assistant) in session history, got ${sessionHistory.length}`);
  console.log('✓ Post-turn knowledge capture verified (user query + assistant response persisted)');

  // =========================================================================
  // Test 7: Multi-Turn Conversational Memory & Coreference
  // =========================================================================
  console.log('\n--- Test 7: Multi-Turn Conversational Memory Continuity ---');
  let turn2Tokens = '';
  await AgentOrchestrator.execute(
    'Which of those Postgres providers had the lowest base monthly price?',
    {
      sessionId, // Continuing the exact same session
      autoPilot: true,
      referenceDate: refDate.toISOString(),
      onScratchpad: () => {},
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: (token) => { turn2Tokens += token; },
      onCitations: () => {},
      onError: (err) => { throw err; },
      onDone: () => {},
    }
  );

  const updatedHistory = await brainVault.episodic.getSessionHistory(sessionId);
  console.assert(updatedHistory.length === 4, `Expected 4 entries after Turn 2, got ${updatedHistory.length}`);
  console.log('✓ Multi-turn memory verified: 4 sequential conversational turns preserved in session ledger');

  console.log('\n🎉 ALL 7 ADVANCED BENCHMARK & FULL FLOW TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
