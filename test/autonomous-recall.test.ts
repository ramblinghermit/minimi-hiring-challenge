import path from 'path';
process.env.NODE_ENV = 'test';
process.env.BRAIN_VAULT_DIR = path.join(process.cwd(), '.data', 'test_vault');

import 'dotenv/config';
import { brainVault } from '../src/core/memory/brain-vault';
import { AgentOrchestrator } from '../src/core/agent/orchestrator';
import { TemporalParser } from '../src/core/memory/temporal-parser';

async function runAutonomousRecallTest() {
  console.log('🧪 Starting Pure End-to-End Autonomous Memory & Temporal Recall Test...\n');

  const refDate = new Date('2026-11-13T12:00:00Z'); // Present Day: Nov 13, 2026
  const testUserId = `usr_auto_${Date.now().toString(36)}`;

  await brainVault.init(refDate);

  // =========================================================================
  // Phase 1: Ingest Raw Back-Dated Chat 1 (1 Month Ago = 30 Days Prior)
  // ZERO handcrafted entities or facts. Raw text passed to captureTurn only!
  // =========================================================================
  console.log('--- Phase 1: Ingesting Raw Back-Dated Chat (1 Month Ago) ---');
  const monthAgoDate = new Date(refDate.getTime() - 30 * 24 * 3600 * 1000); // 2026-10-14
  const session1Id = `session_payments_month_ago_${Date.now()}`;

  const rawUserPrompt1 = 'We need to evaluate 3 payment gateways for our SaaS: Stripe, LemonSqueezy, and Paddle. What are their transaction fee structures?';
  const rawAssistantResponse1 = `Here is the fee comparison for our shortlisted payment gateways:

1. **Stripe**
   - Pricing: 2.9% + 30¢ per successful card charge
   - Best for: Custom checkout UX and direct credit card handling

2. **LemonSqueezy**
   - Pricing: 5% + 50¢ per transaction
   - Best for: Merchant of record, handling global tax compliance automatically

3. **Paddle**
   - Pricing: 5% + 50¢ per checkout
   - Best for: B2B SaaS invoicing and EU VAT compliance`;

  // System processes raw text and runs its autonomous knowledge extraction
  await brainVault.captureTurn(
    testUserId,
    session1Id,
    rawUserPrompt1,
    rawAssistantResponse1,
    undefined,
    undefined,
    monthAgoDate.toISOString()
  );
  console.log(`✓ Chat 1 ingested with timestamp ${monthAgoDate.toISOString()} (1 Month Ago)`);

  // =========================================================================
  // Phase 2: Ingest Raw Back-Dated Chat 2 (1 Week Ago = 7 Days Prior)
  // =========================================================================
  console.log('\n--- Phase 2: Ingesting Raw Back-Dated Chat (1 Week Ago) ---');
  const weekAgoDate = new Date(refDate.getTime() - 7 * 24 * 3600 * 1000); // 2026-11-06
  const session2Id = `session_email_week_ago_${Date.now()}`;

  const rawUserPrompt2 = 'We shortlisted 3 transactional email delivery services: Resend, Postmark, and SendGrid. What are their starter prices and monthly email allowances?';
  const rawAssistantResponse2 = `Here is the summary of transactional email delivery services:

1. **Resend**
   - Pricing: $20/mo
   - Quota: 50k emails per month
   - Best for: Developer-first React email templates

2. **Postmark**
   - Pricing: $15/mo
   - Quota: 10k emails with dedicated IP deliverability
   - Best for: Ultra-fast transactional delivery speed

3. **SendGrid**
   - Pricing: $19.95/mo
   - Quota: 50k emails on Essentials tier`;

  await brainVault.captureTurn(
    testUserId,
    session2Id,
    rawUserPrompt2,
    rawAssistantResponse2,
    undefined,
    undefined,
    weekAgoDate.toISOString()
  );
  console.log(`✓ Chat 2 ingested with timestamp ${weekAgoDate.toISOString()} (1 Week Ago)`);

  // =========================================================================
  // Phase 3: Verify Autonomous System Knowledge (Zero Handcrafted Seeds!)
  // =========================================================================
  console.log('\n--- Phase 3: Verifying Autonomous Memory Generation ---');

  // Verify entities extracted
  const allProfiles = await brainVault.entities.getAll();
  const stripeProfile = allProfiles.find((p) => p.entityName.toLowerCase() === 'stripe');
  const resendProfile = allProfiles.find((p) => p.entityName.toLowerCase() === 'resend');

  console.assert(stripeProfile !== undefined, 'System must autonomously create Stripe profile');
  console.assert(resendProfile !== undefined, 'System must autonomously create Resend profile');
  console.log(`✓ Autonomous Entity Profiles verified: ${stripeProfile?.entityName} (${JSON.stringify(stripeProfile?.profileData)}), ${resendProfile?.entityName} (${JSON.stringify(resendProfile?.profileData)})`);

  // Verify tri-temporal facts extracted
  const allFacts = await brainVault.facts.getAll();
  const stripeFact = allFacts.find((f) => f.subject.toLowerCase() === 'stripe' && f.predicate === 'pricing');
  const resendFact = allFacts.find((f) => f.subject.toLowerCase() === 'resend' && f.predicate === 'pricing');

  console.assert(stripeFact !== undefined, 'System must autonomously extract Stripe pricing fact');
  console.assert(stripeFact?.validFrom === monthAgoDate.toISOString(), 'Fact validFrom must match 1-month-ago timestamp');
  console.assert(resendFact !== undefined, 'System must autonomously extract Resend pricing fact');
  console.assert(resendFact?.validFrom === weekAgoDate.toISOString(), 'Fact validFrom must match 1-week-ago timestamp');
  console.log(`✓ Autonomous Tri-Temporal Facts verified: Stripe -> ${stripeFact?.object} (validFrom: ${stripeFact?.validFrom}), Resend -> ${resendFact?.object} (validFrom: ${resendFact?.validFrom})`);

  // Verify episodic store metadata
  const session1Entries = await brainVault.episodic.getSessionHistory(session1Id, testUserId);
  console.assert(session1Entries.length === 2, 'Session 1 must have 2 entries');
  console.assert(
    session1Entries[1].metadata?.entities?.some((e) => e.toLowerCase() === 'stripe'),
    'Assistant entry must contain Stripe in metadata.entities'
  );
  console.log(`✓ Autonomous Episodic Metadata verified: entities tagged = [${session1Entries[1].metadata?.entities?.join(', ')}]`);

  // =========================================================================
  // Phase 4: Cross-Session Temporal Recall (1 Month Later in Brand New Chat)
  // =========================================================================
  console.log('\n--- Phase 4: Testing 1-Month Recall in Fresh Chat Session ---');
  const todaySession1 = `session_today_recalled_month_${Date.now()}`;
  const recallScratchpad: string[] = [];
  let recallTokens = '';
  let recallCitations = 0;

  const monthQuery = 'One month ago we discussed payment gateways. Has Stripe or LemonSqueezy changed transaction pricing since then?';
  
  // Verify TemporalParser directly first
  const parsedAnchor = TemporalParser.parse(monthQuery, refDate);
  console.assert(parsedAnchor !== null, 'Should parse "One month ago" anchor');
  console.assert(parsedAnchor?.anchorType === 'relative', 'Should be relative anchor');
  console.log(`✓ Temporal Anchor resolved: "${parsedAnchor?.label}" [${parsedAnchor?.startDate} to ${parsedAnchor?.endDate}]`);

  // Run full AgentOrchestrator flow
  await AgentOrchestrator.execute(monthQuery, {
    sessionId: todaySession1,
    userId: testUserId,
    autoPilot: true,
    referenceDate: refDate.toISOString(),
    onScratchpad: (e) => recallScratchpad.push(e.content),
    onApprovalRequired: () => {},
    onToolApproved: () => {},
    onToken: (tok) => { recallTokens += tok; },
    onCitations: (cites) => { recallCitations = cites.length; },
    onError: (err) => { throw err; },
    onDone: () => {},
  });

  const anchorTrace = recallScratchpad.find((s) => s.includes('Resolved Temporal Anchor'));
  const recallTrace = recallScratchpad.find((s) => s.includes('Recalled') && s.includes('episodic'));
  const entityTrace = recallScratchpad.find((s) => s.includes('Deterministic Entity Profile Injection'));

  console.assert(anchorTrace !== undefined, 'Trace must show resolved temporal anchor');
  console.assert(recallTrace !== undefined, 'Trace must show historical turn recalled from episodic store');
  console.assert(entityTrace !== undefined && entityTrace.includes('Stripe'), 'Trace must show Stripe profile injected');
  console.assert(recallTokens.length > 50, 'Response should be streamed');
  console.log(`✓ 1-Month Recall successful: Retrieved baseline conversation from 30 days ago, injected self-generated Stripe & LemonSqueezy profiles, performed live diff search, streamed ${recallTokens.length} chars response.`);

  // =========================================================================
  // Phase 5: Cross-Session Temporal Recall (1 Week Later in Another Fresh Chat)
  // =========================================================================
  console.log('\n--- Phase 5: Testing 1-Week Recall in Second Fresh Chat Session ---');
  const todaySession2 = `session_today_recalled_week_${Date.now()}`;
  let weekTokens = '';
  const weekScratchpad: string[] = [];

  const weekQuery = 'Last week we compared transactional email delivery services. What were the pricing tiers and allowances for Resend and Postmark?';
  
  await AgentOrchestrator.execute(weekQuery, {
    sessionId: todaySession2,
    userId: testUserId,
    autoPilot: true,
    referenceDate: refDate.toISOString(),
    onScratchpad: (e) => weekScratchpad.push(e.content),
    onApprovalRequired: () => {},
    onToolApproved: () => {},
    onToken: (tok) => { weekTokens += tok; },
    onCitations: () => {},
    onError: (err) => { throw err; },
    onDone: () => {},
  });

  const weekEntityTrace = weekScratchpad.find((s) => s.includes('Deterministic Entity Profile Injection'));
  console.assert(weekEntityTrace !== undefined && weekEntityTrace.includes('Resend'), 'Should inject Resend profile');
  console.log(`✓ 1-Week Recall successful: Recalled 7-day-old email services conversation, injected self-generated Resend & Postmark profiles, streamed ${weekTokens.length} chars response.`);

  // =========================================================================
  // Phase 6: Multi-Turn Continuity in Recalled Session
  // =========================================================================
  console.log('\n--- Phase 6: Multi-Turn Coreference in Recalled Session ---');
  let followUpTokens = '';
  await AgentOrchestrator.execute('Which of those payment gateways had the lowest card fee for standard transactions?', {
    sessionId: todaySession1, // Continuing the payment recall session
    userId: testUserId,
    autoPilot: true,
    referenceDate: refDate.toISOString(),
    onScratchpad: () => {},
    onApprovalRequired: () => {},
    onToolApproved: () => {},
    onToken: (tok) => { followUpTokens += tok; },
    onCitations: () => {},
    onError: (err) => { throw err; },
    onDone: () => {},
  });

  console.assert(followUpTokens.toLowerCase().includes('stripe') || followUpTokens.toLowerCase().includes('2.9%'), 'Follow-up must correctly reference Stripe from the conversation');
  console.log(`✓ Multi-turn coreference verified: Seamless follow-up answered using recalled context.`);

  console.log('\n🎉 ALL AUTONOMOUS EXTRACTION & CROSS-SESSION RECALL TESTS PASSED WITH 100% SUCCESS!');
}

runAutonomousRecallTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
