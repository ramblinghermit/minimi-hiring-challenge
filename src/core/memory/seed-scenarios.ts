import { EpisodicStore } from './episodic-store';
import { FactStore } from './fact-store';
import { EntityProfileStore } from './entity-profiles';

/**
 * Pre-seeded Benchmark Scenarios for Minimi Evaluation
 * Allows the evaluator to test the 3 core benchmark queries with 1 click.
 */
export async function seedBenchmarkScenarios(
  episodicStore: EpisodicStore,
  factStore: FactStore,
  entityStore: EntityProfileStore,
  referenceDate: Date = new Date()
): Promise<void> {
  const currentDay = referenceDate.getDay();

  // 1. Calculate Monday of this week (or previous Monday)
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const mondayDate = new Date(referenceDate);
  mondayDate.setDate(referenceDate.getDate() - (daysToMonday === 0 ? 7 : daysToMonday));
  mondayDate.setHours(14, 30, 0, 0);
  const mondayIso = mondayDate.toISOString();

  // 2. Calculate Last Tuesday
  let daysToLastTuesday = currentDay - 2;
  if (daysToLastTuesday <= 0) daysToLastTuesday += 7;
  if (daysToLastTuesday < 3 && currentDay === 2) daysToLastTuesday += 7;
  const lastTuesdayDate = new Date(referenceDate);
  lastTuesdayDate.setDate(referenceDate.getDate() - daysToLastTuesday);
  lastTuesdayDate.setHours(16, 15, 0, 0);
  const lastTuesdayIso = lastTuesdayDate.toISOString();

  // 3. Absolute Date: 3 November of current year
  const nov3Date = new Date(Date.UTC(referenceDate.getFullYear(), 10, 3, 10, 0, 0, 0));
  const nov3Iso = nov3Date.toISOString();

  // ====================================================
  // Scenario 1: 5 CRM Tools Shortlist (On Monday)
  // ====================================================
  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_crm_monday',
    role: 'user',
    content: 'We need to shortlist 5 CRM tools for a 20-person sales team. What are the best options and their pricing?',
    createdAt: mondayIso,
  });

  const crmResponse = `Here is our shortlist of 5 CRM tools optimized for a 20-person sales team:

1. **HubSpot Sales Hub (Professional)**
   - Pricing: $90-$100/seat/month ($1,800 - $2,000/mo for 20 seats)
   - Best for: Inbound automation, marketing alignment, pipeline analytics

2. **Pipedrive (Advanced / Professional)**
   - Pricing: $24-$49/user/month (~$980/mo for 20 users on Professional)
   - Best for: Activity-based selling, high visual pipeline usability, SMB velocity

3. **Zoho CRM (Enterprise)**
   - Pricing: $40/user/month ($800/mo for 20 users)
   - Best for: Value-to-feature ratio, customization, integrated Zoho ecosystem

4. **Close CRM (Growth Plan)**
   - Pricing: $49/seat/month ($980/mo for 20 seats)
   - Best for: High-volume outbound, built-in calling, predictive dialers

5. **Salesforce Sales Cloud (Enterprise)**
   - Pricing: $165/user/month ($3,300/mo for 20 users)
   - Best for: Complex enterprise workflows, custom Apex automation, extensive AppExchange`;

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_crm_monday',
    role: 'assistant',
    content: crmResponse,
    createdAt: new Date(mondayDate.getTime() + 1000 * 45).toISOString(),
    metadata: {
      entities: ['HubSpot', 'Pipedrive', 'Zoho CRM', 'Close CRM', 'Salesforce Sales Cloud'],
      topics: ['crm', 'sales tools', 'pricing for 20-person team'],
      scratchpad: [
        'Querying Brain-Vault Multi-View Memory (Episodic + State + Entity Profiles)...',
        'Resolved Temporal Anchor: Monday (relative anchor)',
        'Search Strategy Planned: Shortlist 5 CRM tools with pricing for 20-seat sales team',
        'Executing parallel web search via BRAVE...',
        'Search completed in 320ms. Retrieved 5 verified web sources.',
        'Synthesizing CRM shortlist comparison and streaming response...',
      ],
    },
  });

  // Entity profiles for the 5 CRMs
  const crms = [
    { name: 'HubSpot', category: 'crm' as const, pricing: '$90-$100/seat/mo (Pro)', focus: 'Inbound automation' },
    { name: 'Pipedrive', category: 'crm' as const, pricing: '$49/user/mo (Professional)', focus: 'Visual sales pipelines' },
    { name: 'Zoho CRM', category: 'crm' as const, pricing: '$40/user/mo (Enterprise)', focus: 'High customizability' },
    { name: 'Close', category: 'crm' as const, pricing: '$49/seat/mo (Growth)', focus: 'Outbound sales dialing' },
    { name: 'Salesforce', category: 'crm' as const, pricing: '$165/user/mo (Enterprise)', focus: 'Enterprise CRM' },
  ];

  for (const crm of crms) {
    await entityStore.upsertProfile({
      userId: 'default_user',
      entityName: crm.name,
      category: crm.category,
      profileData: {
        baselinePricing: crm.pricing,
        focus: crm.focus,
        shortlistedOn: mondayIso,
      },
    });

    await factStore.addFact({
      userId: 'default_user',
      subject: crm.name,
      predicate: 'shortlisted_crm_pricing_20_users',
      object: crm.pricing,
      confidence: 1.0,
      validFrom: mondayIso,
      sourceSessionId: 'session_crm_monday',
    });
  }

  // ====================================================
  // Scenario 2: 3 November Question
  // ====================================================
  const nov3UserQuery = 'What is the pricing and context window for Anthropic Claude 3.5 Haiku?';
  const nov3AssistantAnswer = `Anthropic launched Claude 3.5 Haiku with:
- **Pricing**: $1.00 per million input tokens, $5.00 per million output tokens (with prompt caching: $0.10 write / $0.08 read).
- **Context Window**: 200,000 tokens.
- **Speed**: Matches or exceeds Claude 3 Opus capabilities on coding benchmarks at Haiku speeds.`;

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_nov3',
    role: 'user',
    content: nov3UserQuery,
    createdAt: nov3Iso,
  });

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_nov3',
    role: 'assistant',
    content: nov3AssistantAnswer,
    createdAt: new Date(nov3Date.getTime() + 1000 * 30).toISOString(),
    metadata: {
      entities: ['Claude 3.5 Haiku', 'Anthropic'],
      topics: ['llm pricing', 'context window', 'haiku'],
      scratchpad: [
        'Querying Brain-Vault Multi-View Memory (Episodic + State + Entity Profiles)...',
        'Resolved Temporal Anchor: 3 November 2026 (absolute anchor)',
        'Search Strategy Planned: Anthropic Claude 3.5 Haiku pricing context window specs',
        'Executing parallel web search via BRAVE...',
        'Search completed in 275ms. Retrieved 4 verified web sources.',
        'Synthesizing Claude 3.5 Haiku specifications and streaming response...',
      ],
    },
  });

  await factStore.addFact({
    userId: 'default_user',
    subject: 'Claude 3.5 Haiku',
    predicate: 'token_pricing',
    object: '$1.00 input / $5.00 output per 1M tokens',
    confidence: 1.0,
    validFrom: nov3Iso,
    sourceSessionId: 'session_nov3',
  });

  // ====================================================
  // Scenario 3: Postgres Hosting (Last Tuesday)
  // ====================================================
  const pgUserQuery = 'What are the top managed Postgres hosting providers right now and how are they priced?';
  const pgAssistantAnswer = `Here are the top managed Postgres hosting platforms and their pricing breakdown:

1. **Supabase (Managed Cloud Postgres + BaaS)**
   - **Free Tier**: 500MB database, shared CPU.
   - **Pro Tier**: $25/month base (includes 8GB database space, 250k compute hours). Additional micro instances at $10/mo, small at $20/mo.

2. **Neon (Serverless Postgres)**
   - **Free Tier**: 0.5 GiB storage, auto-suspend compute.
   - **Launch Plan**: $19/month base + usage ($0.16/CU-hour, $0.15/GB-month storage).
   - **Scale Plan**: $69/month base + autoscaling.

3. **AWS Aurora Serverless v2**
   - **Pricing**: $0.12 per ACU-hour (Aurora Capacity Unit: 2GB RAM + vCPU share), plus I/O costs ($0.20 per million requests).
   - Minimum scale: 0.5 ACU (~$43/month base).

4. **Crunchy Bridge (Crunchy Data)**
   - **Hobby / Standard Plans**: Starts at $35/month for 1GB RAM / 10GB SSD. Production clusters start at $100-$150/month with dedicated failover and continuous backups.`;

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_postgres_last_tue',
    role: 'user',
    content: pgUserQuery,
    createdAt: lastTuesdayIso,
  });

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_postgres_last_tue',
    role: 'assistant',
    content: pgAssistantAnswer,
    createdAt: new Date(lastTuesdayDate.getTime() + 1000 * 40).toISOString(),
    metadata: {
      entities: ['Supabase', 'Neon', 'AWS Aurora Serverless', 'Crunchy Bridge'],
      topics: ['postgres hosting', 'database pricing', 'serverless postgres'],
      scratchpad: [
        'Querying Brain-Vault Multi-View Memory (Episodic + State + Entity Profiles)...',
        'Resolved Temporal Anchor: Last Tuesday (relative anchor)',
        'Search Strategy Planned: Managed Postgres hosting pricing breakdown Supabase Neon Aurora Crunchy',
        'Executing parallel web search via BRAVE...',
        'Search completed in 390ms. Retrieved 6 verified web sources.',
        'Synthesizing Postgres hosting breakdown and streaming response...',
      ],
    },
  });

  const pgProviders = [
    { name: 'Supabase', pricing: 'Free tier / Pro at $25/month base' },
    { name: 'Neon', pricing: 'Free tier / Launch at $19/mo / Scale at $69/mo' },
    { name: 'AWS Aurora Serverless', pricing: '$0.12/ACU-hour, 0.5 ACU min (~$43/mo)' },
    { name: 'Crunchy Bridge', pricing: 'Starts at $35/month for Hobby / $100+/mo for Production' },
  ];

  for (const pg of pgProviders) {
    await entityStore.upsertProfile({
      userId: 'default_user',
      entityName: pg.name,
      category: 'database',
      profileData: {
        baselinePricing: pg.pricing,
        discussedOn: lastTuesdayIso,
      },
    });

    await factStore.addFact({
      userId: 'default_user',
      subject: pg.name,
      predicate: 'postgres_hosting_pricing',
      object: pg.pricing,
      confidence: 1.0,
      validFrom: lastTuesdayIso,
      sourceSessionId: 'session_postgres_last_tue',
    });
  }

  // ====================================================
  // Scenario 4: Vector Databases (Two Weeks Ago)
  // ====================================================
  const twoWeeksAgoDate = new Date(referenceDate);
  twoWeeksAgoDate.setDate(referenceDate.getDate() - 14);
  twoWeeksAgoDate.setHours(11, 0, 0, 0);
  const twoWeeksAgoIso = twoWeeksAgoDate.toISOString();

  const vectorUserQuery = 'We are choosing a vector database for our RAG agent between Pinecone, Qdrant, Milvus, and Weaviate. What are their current serverless pricing tiers?';
  const vectorAssistantAnswer = `Here is our evaluation of serverless vector databases:
1. **Pinecone**: Serverless tier charges $0.05/hour base plus $0.33 per GB/month for storage and $8.25 per million write units.
2. **Qdrant**: Managed cloud starts at $25/month for dedicated clusters with free 1GB cluster.
3. **Milvus (Zilliz Cloud)**: Serverless starts at $65/month base.
4. **Weaviate**: Serverless cloud starts at $25/month with 500k vector units.`;

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_vector_two_weeks',
    role: 'user',
    content: vectorUserQuery,
    createdAt: twoWeeksAgoIso,
  });

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_vector_two_weeks',
    role: 'assistant',
    content: vectorAssistantAnswer,
    createdAt: new Date(twoWeeksAgoDate.getTime() + 1000 * 35).toISOString(),
    metadata: {
      entities: ['Pinecone', 'Qdrant', 'Milvus', 'Weaviate'],
      topics: ['vector database', 'rag', 'serverless pricing'],
      scratchpad: [
        'Querying Brain-Vault Multi-View Memory (Episodic + State + Entity Profiles)...',
        'Resolved Temporal Anchor: Two weeks ago (relative anchor)',
        'Search Strategy Planned: Vector database serverless pricing Pinecone Qdrant Milvus Weaviate',
        'Executing parallel web search via BRAVE...',
        'Search completed in 340ms. Retrieved 5 verified web sources.',
        'Synthesizing vector database pricing evaluation and streaming response...',
      ],
    },
  });

  const vectorProviders = [
    { name: 'Pinecone', pricing: '$0.05/hr + $0.33/GB-mo storage' },
    { name: 'Qdrant', pricing: '$25/cluster/mo base' },
    { name: 'Milvus', pricing: '$65/mo base on Zilliz' },
    { name: 'Weaviate', pricing: '$25/mo standard serverless' },
  ];

  for (const v of vectorProviders) {
    await entityStore.upsertProfile({
      userId: 'default_user',
      entityName: v.name,
      category: 'database',
      profileData: {
        baselinePricing: v.pricing,
        evaluatedOn: twoWeeksAgoIso,
      },
    });

    await factStore.addFact({
      userId: 'default_user',
      subject: v.name,
      predicate: 'vector_db_serverless_pricing',
      object: v.pricing,
      confidence: 1.0,
      validFrom: twoWeeksAgoIso,
      sourceSessionId: 'session_vector_two_weeks',
    });
  }

  // ====================================================
  // Scenario 5: Full-Stack ORM & Tailwind (3 Days Ago)
  // ====================================================
  const threeDaysAgoDate = new Date(referenceDate);
  threeDaysAgoDate.setDate(referenceDate.getDate() - 3);
  threeDaysAgoDate.setHours(15, 20, 0, 0);
  const threeDaysAgoIso = threeDaysAgoDate.toISOString();

  const ormUserQuery = 'What are the trade-offs between Prisma and Drizzle ORM for serverless Node apps, and what versions are stable?';
  const ormAssistantAnswer = `For serverless TypeScript applications:
- **Drizzle ORM**: Near-zero overhead, generates prepared SQL, perfect for cold starts. Current stable version is v0.36.
- **Prisma ORM**: Rich schema migration tool, but has larger Rust engine binaries leading to 150-300ms cold starts on AWS Lambda. Stable version is v5.22.`;

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_orm_3days',
    role: 'user',
    content: ormUserQuery,
    createdAt: threeDaysAgoIso,
  });

  await episodicStore.addEntry({
    userId: 'default_user',
    sessionId: 'session_orm_3days',
    role: 'assistant',
    content: ormAssistantAnswer,
    createdAt: new Date(threeDaysAgoDate.getTime() + 1000 * 20).toISOString(),
    metadata: {
      entities: ['Drizzle ORM', 'Prisma ORM'],
      topics: ['typescript orm', 'serverless cold starts', 'drizzle vs prisma'],
      scratchpad: [
        'Querying Brain-Vault Multi-View Memory (Episodic + State + Entity Profiles)...',
        'Resolved Temporal Anchor: Three days ago (relative anchor)',
        'Search Strategy Planned: Drizzle ORM and Prisma releases cold starts serverless benchmarks',
        'Executing parallel web search via BRAVE...',
        'Search completed in 310ms. Retrieved 4 verified web sources.',
        'Synthesizing ORM comparison and streaming response...',
      ],
    },
  });

  const ormEntities = [
    { name: 'Drizzle ORM', version: 'v0.36', coldStart: 'near-zero ms' },
    { name: 'Prisma ORM', version: 'v5.22', coldStart: '150-300ms' },
  ];

  for (const orm of ormEntities) {
    await entityStore.upsertProfile({
      userId: 'default_user',
      entityName: orm.name,
      category: 'tool',
      profileData: {
        stableVersion: orm.version,
        coldStartPerf: orm.coldStart,
        evaluatedOn: threeDaysAgoIso,
      },
    });

    await factStore.addFact({
      userId: 'default_user',
      subject: orm.name,
      predicate: 'stable_release_version',
      object: orm.version,
      confidence: 1.0,
      validFrom: threeDaysAgoIso,
      sourceSessionId: 'session_orm_3days',
    });
  }
}
