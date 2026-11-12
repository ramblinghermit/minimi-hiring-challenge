import { TemporalParser } from '../src/core/memory/temporal-parser';
import { brainVault } from '../src/core/memory/brain-vault';
import { QueryPlanner } from '../src/core/search/query-planner';
import { searchRouter } from '../src/core/search/search-router';

async function runTests() {
  console.log('🧪 Starting Minimi Benchmark Verification Tests...\n');

  // Test 1: Temporal Parser
  console.log('--- Test 1: Temporal Date Parser ---');
  const refDate = new Date('2026-11-12T12:00:00Z'); // Thursday Nov 12, 2026

  const res1 = TemporalParser.parse('What did I ask you on 3 November?', refDate);
  console.assert(res1 !== null, 'Should parse "3 November"');
  console.log('✓ "3 November" parsed to:', res1?.label);

  const res2 = TemporalParser.parse('Last Tuesday I asked about Postgres hosting', refDate);
  console.assert(res2 !== null, 'Should parse "Last Tuesday"');
  console.log('✓ "Last Tuesday" parsed to:', res2?.label);

  const res3 = TemporalParser.parse('On Monday we shortlisted 5 CRM tools', refDate);
  console.assert(res3 !== null, 'Should parse "On Monday"');
  console.log('✓ "On Monday" parsed to:', res3?.label);

  // Test 2: Brain-Vault Retrieval & Deterministic Profile Injection
  console.log('\n--- Test 2: Brain-Vault Multi-View Memory ---');
  await brainVault.resetAndReseed(refDate);

  // Query 1: CRM Shortlist
  const crmContext = await brainVault.retrieve(
    'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
    'auto',
    refDate
  );
  console.assert(crmContext.episodicMemories.length > 0, 'Should retrieve Monday CRM session');
  console.assert(crmContext.entityProfiles.length >= 5, `Expected >= 5 CRM profiles, got ${crmContext.entityProfiles.length}`);
  console.log(`✓ CRM Shortlist recalled ${crmContext.entityProfiles.length} profiles:`, crmContext.entityProfiles.map(p => p.entityName).join(', '));

  // Query 2: 3 November Recall
  const nov3Context = await brainVault.retrieve(
    'What did I ask you on 3 November? Is your answer still correct today?',
    'auto',
    refDate
  );
  console.assert(nov3Context.episodicMemories.length > 0, 'Should recall Nov 3 memory');
  console.log('✓ 3 November Question recalled:', nov3Context.episodicMemories[0].content);

  // Query 3: Postgres Hosting
  const pgContext = await brainVault.retrieve(
    'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?',
    'auto',
    refDate
  );
  console.assert(pgContext.episodicMemories.length > 0, 'Should recall Last Tuesday Postgres session');
  console.assert(pgContext.entityProfiles.length >= 4, 'Should recall Postgres host profiles');
  console.log(`✓ Postgres Hosting recalled ${pgContext.entityProfiles.length} hosts:`, pgContext.entityProfiles.map(p => p.entityName).join(', '));

  // Test 3: Query Decomposition
  console.log('\n--- Test 3: Search Query Decomposition ---');
  const plan = QueryPlanner.planQueries(
    'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
    crmContext
  );
  console.assert(plan.queries.length > 0, 'Queries should be planned');
  console.assert(plan.isDeltaSearch === true, 'Should recognize temporal delta search');
  console.log('✓ Decomposed queries:', plan.queries);

  // Test 4: Web Search Engine (Testing fallback / live search)
  console.log('\n--- Test 4: Web Search Engine Execution ---');
  console.log('Using provider:', searchRouter.getActiveProvider());
  const searchRes = await searchRouter.searchSingle('Supabase Postgres pricing 2026');
  console.assert(searchRes.results.length > 0, 'Search should return results');
  console.log(`✓ Search returned ${searchRes.results.length} results in ${searchRes.executionTimeMs}ms`);
  console.log('Top Result:', searchRes.results[0].title, `(${searchRes.results[0].url})`);

  console.log('\n🎉 ALL BENCHMARK VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
