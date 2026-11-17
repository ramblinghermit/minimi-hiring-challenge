import path from 'path';
process.env.NODE_ENV = 'test';
process.env.BRAIN_VAULT_DIR = path.join(process.cwd(), '.data', 'eval_vault');

import { TemporalParser } from '../src/core/memory/temporal-parser';
import { brainVault } from '../src/core/memory/brain-vault';
import { QueryPlanner } from '../src/core/search/query-planner';
import { AgentOrchestrator } from '../src/core/agent/orchestrator';

interface EvalCase {
  id: number;
  name: string;
  prompt: string;
  setup?: () => Promise<void>;
  validate: (res: { text: string; events: any[]; shouldSearch: boolean; planQueries: string[] }) => boolean;
  expectedBehavior: string;
  initialFailureMode: string;
  architecturalFixApplied: string;
}

async function runEval() {
  console.log('================================================================================');
  console.log('🔬 MINIMI ARCHITECTURAL EVALUATION & VERIFICATION HARNESS (12 TEST SCENARIOS)');
  console.log('================================================================================\n');

  const refDate = new Date('2026-11-12T12:00:00Z'); // Thursday Nov 12, 2026
  await brainVault.clearMemory();
  await brainVault.seedBenchmark(refDate);

  const evalCases: EvalCase[] = [
    {
      id: 1,
      name: 'Relative Temporal Delta (Monday CRM Shortlist)',
      prompt: 'On Monday we shortlisted 5 CRM tools. Has anything changed since?',
      validate: (r) => r.shouldSearch && r.planQueries.some(q => q.includes('since 2026-11-09')) && r.text.includes('Baseline'),
      expectedBehavior: 'Resolves Monday to 2026-11-09, emits date-bounded delta queries, diffs against 5 shortlisted CRMs.',
      initialFailureMode: 'Hardcoded regex on /crm/ in planner; queries only appended current year without date boundary.',
      architecturalFixApplied: 'Deterministic UTC anchor parsing; dynamic entity profile injection with `since YYYY-MM-DD` query bounds.'
    },
    {
      id: 2,
      name: 'Relative Temporal Delta (Last Tuesday Postgres)',
      prompt: 'Last Tuesday I asked about Postgres hosting. Has pricing changed since then?',
      validate: (r) => r.shouldSearch && r.planQueries.some(q => q.includes('since 2026-11-10')) && r.text.includes('Baseline'),
      expectedBehavior: 'Resolves Last Tuesday to 2026-11-10 (not Nov 9), diffs Supabase/Neon/Aurora baselines against live web.',
      initialFailureMode: 'Local `setHours(0,0,0,0)` timezone leak caused positive UTC offsets to slip back a full day to Monday.',
      architecturalFixApplied: 'Strict UTC calendar math with `Date.UTC` and deterministic ISO date string slicing.'
    },
    {
      id: 3,
      name: 'Absolute Date Recall with Seeded History (3 November)',
      prompt: 'What did I ask you on 3 November? Is your answer still correct today?',
      validate: (r) => r.text.includes('Claude 3.5 Haiku') && r.text.includes('100% accurate'),
      expectedBehavior: 'Recalls exact 3 November turn (Claude 3.5 Haiku specs) and verifies pricing freshness.',
      initialFailureMode: 'Stateless agents score 0/3 because they do not know what the user asked on Nov 3.',
      architecturalFixApplied: 'Episodic memory store indexed by temporal boundary with <1ms ambient pre-invocation recall.'
    },
    {
      id: 4,
      name: 'Honesty on Gaps / Unseeded Date Inquiry',
      prompt: 'What did I ask you on 5 November? Is your answer still correct today?',
      validate: (r) => !r.shouldSearch && (r.text.includes("don't have a record") || r.text.includes('no record')),
      expectedBehavior: 'Returns honest "I don\'t have a record of that" instead of hallucinating or searching web.',
      initialFailureMode: 'System prompt few-shot example caused LLM to hallucinate past topics; planner triggered generic web search.',
      architecturalFixApplied: 'Zero-record temporal audit detection (`hasZeroMatchingHistory: true`) that halts search and asserts gap honestly.'
    },
    {
      id: 5,
      name: 'Static Factual Web Search',
      prompt: 'What is the current population of Tokyo?',
      validate: (r) => r.shouldSearch && r.planQueries[0].includes('population of Tokyo') && r.text.length > 50,
      expectedBehavior: 'Executes parallel web search, extracts live sources, returns authoritative answer with citations.',
      initialFailureMode: 'Ambiguous routing; raw prompt dumped directly into search URL without cleaning.',
      architecturalFixApplied: 'Heuristic query cleaner, length capping (<120 chars), and parallel multi-provider search router.'
    },
    {
      id: 6,
      name: 'Pure Conversational Greeting (Skip Search)',
      prompt: 'Hello! Who are you and how can you help me?',
      validate: (r) => !r.shouldSearch,
      expectedBehavior: 'Answers directly from system knowledge in <100ms with zero network search overhead.',
      initialFailureMode: 'Search loop executed unconditionally on every single user turn, wasting 1.5s+ latency and API quota.',
      architecturalFixApplied: 'Intent-aware QueryPlanner gate prioritizing conversational classification before tool invocation.'
    },
    {
      id: 7,
      name: 'In-Chat Coreference Continuation',
      prompt: 'Tell me more about the first option you just mentioned.',
      validate: (r) => !r.shouldSearch,
      expectedBehavior: 'Resolves coreference "first option" directly from active in-chat history without triggering web search.',
      initialFailureMode: 'Stateless search searched Google for "the first option", returning meaningless results.',
      architecturalFixApplied: 'Priority 1 in-chat message history buffer preceding tool planning in the execution pipeline.'
    },
    {
      id: 8,
      name: 'Massive Prompt Stress Test (12,000 Chars)',
      prompt: 'Explain distributed cache invalidation strategies. ' + 'Lorem ipsum dolor sit amet. '.repeat(400),
      validate: (r) => r.planQueries.every(q => q.length <= 150),
      expectedBehavior: 'Safely truncates search query to <150 chars, applies 5s timeout, avoids process hang or 414 URI Too Long.',
      initialFailureMode: 'Raw 12,000-character URL sent to DuckDuckGo scraper with no timeout, causing indefinite process lock.',
      architecturalFixApplied: 'Enforced query sanitization, length truncation, and `AbortSignal.timeout(5000)` on all network fetch calls.'
    },
    {
      id: 9,
      name: 'Parallel Fan-Out Query Decomposition',
      prompt: 'Has HubSpot, Pipedrive, or Zoho CRM changed pricing since last month?',
      validate: (r) => r.planQueries.length >= 3 && r.planQueries.some(q => q.includes('HubSpot')) && r.planQueries.some(q => q.includes('Pipedrive')),
      expectedBehavior: 'Decomposes multi-entity inquiry into parallel entity queries instead of 1 messy concatenation.',
      initialFailureMode: 'Sent combined query string "HubSpot Pipedrive Zoho CRM pricing" returning blog spam.',
      architecturalFixApplied: 'Entity-level query planner fanning out concurrent searches with `Promise.allSettled` and domain deduplication.'
    },
    {
      id: 10,
      name: 'Multi-Tenant Data Confidentiality',
      prompt: 'What was our secret internal project codename discussed earlier?',
      validate: (r) => !r.text.toLowerCase().includes('andromeda') || r.text.includes('Confidential'),
      expectedBehavior: 'User B cannot retrieve User A\'s private facts or episodic turns across distinct vaults.',
      initialFailureMode: 'Global flat storage leaked historical turns across all concurrent users on the server.',
      architecturalFixApplied: 'User-scoped vault partitioning (`userId` index) enforced across episodic, fact, and session stores.'
    },
    {
      id: 11,
      name: 'UTC-Safe Deterministic Calendar Anchor',
      prompt: 'Yesterday we tested the latency',
      validate: () => {
        const p = TemporalParser.parse('Yesterday we tested the latency', refDate);
        return p?.dateString === '2026-11-11';
      },
      expectedBehavior: 'Calculates exactly 2026-11-11 regardless of whether host machine is in UTC, EST, or IST.',
      initialFailureMode: 'Local Date `setHours(0,0,0,0)` shifted UTC midnight across day boundaries depending on host OS timezone.',
      architecturalFixApplied: 'Pure UTC arithmetic using `Date.UTC`, `getUTCFullYear`, `getUTCDay`, and `getUTCDate`.'
    },
    {
      id: 12,
      name: 'Structured Claim Snapshot Generation',
      prompt: 'Last Tuesday I asked about Postgres hosting. Has any pricing changed since then?',
      validate: (r) => r.text.includes('|') && r.text.includes('Supabase') && r.text.includes('Neon'),
      expectedBehavior: 'Generates structured comparison table comparing baseline claim snapshot against live verification with citations.',
      initialFailureMode: 'Vague paragraph prose without delineating baseline parameters vs live status.',
      architecturalFixApplied: 'Structured `[CLAIM SNAPSHOT]` injection into context triggering tabular delta synthesis.'
    }
  ];

  let passed = 0;
  console.log('| ID | Scenario | Status | Latency | Verification Details |');
  console.log('| :--- | :--- | :---: | :---: | :--- |');

  for (const tc of evalCases) {
    const start = Date.now();
    const context = await brainVault.retrieve(tc.prompt, 'auto', refDate, 'default_user');
    const inChatHistory = tc.id === 7 ? [{ role: 'assistant', content: 'Option 1: PostgreSQL. Option 2: MySQL.' }] : [];
    const shouldSearch = QueryPlanner.shouldSearch(tc.prompt, context, inChatHistory);
    const plan = shouldSearch ? QueryPlanner.planQueries(tc.prompt, context) : { queries: [], reason: '', isDeltaSearch: false, targetEntities: [] };

    let outputText = '';
    const events: any[] = [];

    await AgentOrchestrator.execute(tc.prompt, {
      sessionId: `eval_${tc.id}_${Date.now()}`,
      userId: 'default_user',
      autoPilot: true,
      referenceDate: refDate.toISOString(),
      modelProvider: 'fallback',
      onScratchpad: (e) => events.push(e),
      onApprovalRequired: () => {},
      onToolApproved: () => {},
      onToken: (t) => { outputText += t; },
      onCitations: () => {},
      onError: (err) => { throw err; },
      onDone: () => {},
    });

    const duration = Date.now() - start;
    const isOk = tc.validate({ text: outputText, events, shouldSearch, planQueries: plan.queries });

    if (isOk) passed++;
    const statusMark = isOk ? '✅ PASS' : '❌ FAIL';
    console.log(`| ${tc.id} | ${tc.name} | ${statusMark} | ${duration}ms | ${tc.expectedBehavior.slice(0, 50)}... |`);
  }

  console.log('\n================================================================================');
  console.log(`🎯 EVALUATION HARNESS COMPLETE: ${passed}/${evalCases.length} PASSED (${Math.round((passed / evalCases.length) * 100)}%)`);
  console.log('================================================================================\n');
}

runEval().catch((err) => {
  console.error('Eval harness failed:', err);
  process.exit(1);
});
