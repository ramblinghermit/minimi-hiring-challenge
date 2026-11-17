import { AsyncFactExtractor } from '../src/core/memory/async-fact-extractor';
import { MemorySystemEngine } from '../src/core/memory/brain-vault';
import { FactStore } from '../src/core/memory/fact-store';
import { EntityProfileStore } from '../src/core/memory/entity-profiles';
import * as assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import * as path from 'path';

async function runAsyncFactExtractorTests() {
  console.log('================================================================================');
  console.log('🧪 TESTING ASYNC CHEAP-MODEL FACT EXTRACTION PIPELINE');
  console.log('================================================================================\n');

  // Test 1: Cheap model resolution
  console.log('📦 TEST 1: Model Resolution & Configuration');
  const defaultConfig = AsyncFactExtractor.getCheapModelConfig();
  assert.ok(defaultConfig.provider, 'Provider must be defined');
  assert.ok(defaultConfig.model, 'Model must be defined');
  console.log(`  ✓ Resolved active cheap model: ${defaultConfig.provider}/${defaultConfig.model}`);

  // Test custom environment override
  process.env.CHEAP_LLM_MODEL = 'gemini-2.5-flash-lite';
  process.env.CHEAP_LLM_PROVIDER = 'vertex';
  const customConfig = AsyncFactExtractor.getCheapModelConfig();
  assert.equal(customConfig.model, 'gemini-2.5-flash-lite');
  assert.equal(customConfig.provider, 'vertex');
  delete process.env.CHEAP_LLM_MODEL;
  delete process.env.CHEAP_LLM_PROVIDER;
  console.log('  ✓ Environment variable override correctly honored');

  // Test 2: Robust JSON payload parsing
  console.log('\n📦 TEST 2: Robust JSON Parsing (Clean, Markdown, and Embedded)');
  const cleanJson = JSON.stringify({
    facts: [{ subject: 'User', predicate: 'preferred_editor', object: 'Neovim', confidence: 0.95 }],
    entities: [{ entityName: 'Neovim', category: 'tool', profileData: { modal: true } }],
  });
  const parsedClean = AsyncFactExtractor.parseJsonPayload(cleanJson);
  assert.equal(parsedClean?.facts?.[0]?.subject, 'User');
  assert.equal(parsedClean?.facts?.[0]?.object, 'Neovim');
  assert.equal(parsedClean?.entities?.[0]?.entityName, 'Neovim');
  console.log('  ✓ Clean JSON parsed successfully');

  const markdownJson = `\`\`\`json\n${cleanJson}\n\`\`\``;
  const parsedMarkdown = AsyncFactExtractor.parseJsonPayload(markdownJson);
  assert.equal(parsedMarkdown?.facts?.[0]?.predicate, 'preferred_editor');
  console.log('  ✓ Markdown-fenced ```json code block parsed successfully');

  const embeddedJson = `Here is the extracted information:\n\n${cleanJson}\n\nHope this helps!`;
  const parsedEmbedded = AsyncFactExtractor.parseJsonPayload(embeddedJson);
  assert.equal(parsedEmbedded?.entities?.[0]?.entityName, 'Neovim');
  console.log('  ✓ Embedded JSON within conversational text parsed successfully');

  const invalidJson = 'Not a json string at all';
  const parsedInvalid = AsyncFactExtractor.parseJsonPayload(invalidJson);
  assert.equal(parsedInvalid, null);
  console.log('  ✓ Malformed non-JSON gracefully returns null without throwing');

  // Test 3: Non-blocking Latency Audit in BrainVault.captureTurn
  console.log('\n📦 TEST 3: Non-Blocking Latency Audit (Dual-Speed Hot Path)');
  const testStorageDir = path.resolve('test-storage-async-extract');
  await fs.rm(testStorageDir, { recursive: true, force: true }).catch(() => {});
  const vault = new MemorySystemEngine(testStorageDir);
  await vault.resetAndReseed(new Date('2026-11-16T12:00:00Z'), 'test_user');

  const startMs = Date.now();
  await vault.captureTurn(
    'test_user',
    'session_perf_test',
    'We switched from Stripe to Lemon Squeezy for tax compliance',
    'Understood, Lemon Squeezy is now recorded as your active payment provider.'
  );
  const elapsedMs = Date.now() - startMs;
  // Local disk writes on Windows take ~100-200ms; an LLM call would take >1,500ms.
  assert.ok(elapsedMs < 500, `captureTurn must return without blocking on LLM (<500ms), took ${elapsedMs}ms`);
  console.log(`  ✓ captureTurn completed in ${elapsedMs}ms (immediate non-blocking execution)`);

  // Test 4: End-to-end Fact Ingestion & Tri-temporal Superseding
  console.log('\n📦 TEST 4: Fact Store Integration & Tri-temporal Superseding');
  const factStore = new FactStore(testStorageDir);
  const profileStore = new EntityProfileStore(testStorageDir);

  // Seed initial fact
  await factStore.addFact({
    userId: 'test_user',
    subject: 'Project',
    predicate: 'payment_gateway',
    object: 'Stripe',
    confidence: 0.95,
    validFrom: '2026-11-01T00:00:00Z',
    validUntil: null,
  });

  const initialFacts = await factStore.getActiveFacts('payment_gateway', 'test_user');
  assert.equal(initialFacts.length, 1);
  assert.equal(initialFacts[0].object, 'Stripe');
  console.log('  ✓ Initial fact: Project payment_gateway = Stripe (active)');

  // Simulate rich extraction callback from background cheap LLM
  await profileStore.upsertProfile({
    userId: 'test_user',
    entityName: 'Lemon Squeezy',
    category: 'service',
    profileData: { merchantOfRecord: true },
  });

  await factStore.addFact({
    userId: 'test_user',
    subject: 'Project',
    predicate: 'payment_gateway',
    object: 'Lemon Squeezy',
    confidence: 0.98,
    validFrom: '2026-11-16T12:00:00Z',
    validUntil: null,
  });

  const updatedFacts = await factStore.getActiveFacts('payment_gateway', 'test_user');
  assert.equal(updatedFacts.length, 1, 'Only one active fact should remain for same subject/predicate');
  assert.equal(updatedFacts[0].object, 'Lemon Squeezy', 'Active fact should now be Lemon Squeezy');

  const allFacts = await factStore.getAll();
  const supersededFact = allFacts.find((f) => f.userId === 'test_user' && f.object === 'Stripe');
  assert.ok(supersededFact?.isSuperseded, 'Stripe fact should be marked as superseded');
  assert.ok(supersededFact?.validUntil, 'Stripe fact should have a non-null validUntil timestamp');
  console.log('  ✓ Updated fact: Project payment_gateway = Lemon Squeezy (superseded Stripe with validUntil timestamp)');

  // Cleanup
  await fs.rm(testStorageDir, { recursive: true, force: true }).catch(() => {});

  console.log('\n================================================================================');
  console.log('🎉 ALL ASYNC CHEAP-MODEL FACT EXTRACTION TESTS PASSED (100% SUCCESS)!');
  console.log('================================================================================\n');
}

runAsyncFactExtractorTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
