<template>
  <div class="benchmark-panel bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl">
    <div class="flex items-center justify-between pb-3 border-b border-neutral-800">
      <div class="flex items-center gap-2">
        <span class="text-base">🧪</span>
        <div>
          <h2 class="text-sm font-semibold text-neutral-100">Evaluator Benchmark Suite</h2>
          <p class="text-[11px] text-neutral-400">Test the hiring challenge prompts with 1 click</p>
        </div>
      </div>
      <button 
        @click="resetMemory" 
        class="text-xs px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex items-center gap-1.5"
        :disabled="isResetting"
      >
        <span>{{ isResetting ? 'Resetting...' : '🔄 Reseed Memory' }}</span>
      </button>
    </div>

    <!-- Scenarios -->
    <div class="mt-3 space-y-2">
      <!-- Scenario 1: CRM -->
      <div 
        @click="selectScenario(scenarios[0])" 
        class="p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-950/40 hover:bg-neutral-800/50 hover:border-sky-500/40 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-sky-400">Scenario 1: CRM Shortlist Delta</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Click to Run ↗</span>
        </div>
        <p class="text-[12px] text-neutral-300 mt-1 line-clamp-2">"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px] text-neutral-500">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Brain-Vault Episodic</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Temporal Diff Search</span>
        </div>
      </div>

      <!-- Scenario 2: 3 Nov -->
      <div 
        @click="selectScenario(scenarios[1])" 
        class="p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-950/40 hover:bg-neutral-800/50 hover:border-purple-500/40 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-purple-400">Scenario 2: Absolute Date Recall & Verification</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Click to Run ↗</span>
        </div>
        <p class="text-[12px] text-neutral-300 mt-1 line-clamp-2">"What did I ask you on 3 November? Is your answer still correct today?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px] text-neutral-500">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Date Anchor: Nov 3</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Live Web Validation</span>
        </div>
      </div>

      <!-- Scenario 3: Postgres -->
      <div 
        @click="selectScenario(scenarios[2])" 
        class="p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-950/40 hover:bg-neutral-800/50 hover:border-emerald-500/40 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-emerald-400">Scenario 3: Relative Date & Postgres Pricing</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Click to Run ↗</span>
        </div>
        <p class="text-[12px] text-neutral-300 mt-1 line-clamp-2">"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px] text-neutral-500">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Anchor: Last Tuesday</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Supabase/Neon Diff</span>
        </div>
      </div>

      <!-- Scenario 4: Vector DBs (2 Weeks Ago) -->
      <div 
        @click="selectScenario(scenarios[3])" 
        class="p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-950/40 hover:bg-neutral-800/50 hover:border-amber-500/40 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-amber-400">Scenario 4: Multi-Week Vector DB Evaluation</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Click to Run ↗</span>
        </div>
        <p class="text-[12px] text-neutral-300 mt-1 line-clamp-2">"Two weeks ago we compared vector databases for our RAG agent. Has Pinecone or Qdrant announced any new serverless pricing or hybrid search updates since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px] text-neutral-500">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Anchor: 2 Weeks Ago</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Pinecone/Qdrant Diff</span>
        </div>
      </div>

      <!-- Scenario 5: Full-Stack ORM & Tailwind (3 Days Ago) -->
      <div 
        @click="selectScenario(scenarios[4])" 
        class="p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-950/40 hover:bg-neutral-800/50 hover:border-cyan-500/40 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-cyan-400">Scenario 5: Frameworks & Stable Versions</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Click to Run ↗</span>
        </div>
        <p class="text-[12px] text-neutral-300 mt-1 line-clamp-2">"Three days ago I asked you about Drizzle ORM and Prisma. Have there been any new version releases or breaking changes since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px] text-neutral-500">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Anchor: 3 Days Ago</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">Release Changelogs</span>
        </div>
      </div>
    </div>

    <!-- Governance Setting -->
    <div class="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs">
      <div class="flex items-center gap-1.5 text-neutral-400">
        <span>🛡️</span>
        <span>Tool Governance Mode:</span>
      </div>
      <button 
        @click="toggleGovernance" 
        class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
        :class="autoPilot ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/40 border-amber-500/40 text-amber-300'"
      >
        {{ autoPilot ? '⚡ Auto-Pilot' : '⚠️ Supervised (Ask First)' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['run-scenario', 'update:auto-pilot']);

const props = defineProps({
  autoPilot: {
    type: Boolean,
    default: true
  }
});

const isResetting = ref(false);

const scenarios = [
  'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
  'What did I ask you on 3 November? Is your answer still correct today?',
  'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?',
  'Two weeks ago we compared vector databases for our RAG agent. Has Pinecone or Qdrant announced any new serverless pricing or hybrid search updates since?',
  'Three days ago I asked you about Drizzle ORM and Prisma. Have there been any new version releases or breaking changes since?'
];

const selectScenario = (prompt) => {
  emit('run-scenario', prompt);
};

const toggleGovernance = () => {
  emit('update:auto-pilot', !props.autoPilot);
};

const resetMemory = async () => {
  isResetting.value = true;
  try {
    const res = await fetch('/api/memory/reset', { method: 'POST' });
    if (res.ok) {
      alert('Brain-Vault memory reseeded with benchmark datasets!');
    }
  } catch (err) {
    console.error(err);
  } finally {
    isResetting.value = false;
  }
};
</script>
