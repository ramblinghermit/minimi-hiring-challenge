<template>
  <div class="benchmark-panel bg-neutral-950 border border-neutral-800 rounded-xl p-4 shadow-md">
    <div class="flex items-center justify-between pb-3 border-b border-neutral-800">
      <div>
        <h2 class="text-xs font-semibold text-white uppercase tracking-wider">Benchmark Suite</h2>
        <p class="text-[11px] text-neutral-400">Hiring evaluation scenarios</p>
      </div>
      <button 
        @click="resetMemory" 
        class="text-xs px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors"
        :disabled="isResetting"
      >
        <span>{{ isResetting ? 'Resetting...' : 'Reset Memory' }}</span>
      </button>
    </div>

    <!-- Scenarios -->
    <div class="mt-3 space-y-2">
      <!-- Scenario 1: CRM -->
      <div 
        @click="selectScenario(scenarios[0])" 
        class="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-white group-hover:text-blue-400">1. CRM Shortlist Delta</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-neutral-400 mt-1 line-clamp-2">"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">Monday Anchor</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">Pricing Delta</span>
        </div>
      </div>

      <!-- Scenario 2: 3 Nov -->
      <div 
        @click="selectScenario(scenarios[1])" 
        class="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-white group-hover:text-blue-400">2. Absolute Date Recall</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-neutral-400 mt-1 line-clamp-2">"What did I ask you on 3 November? Is your answer still correct today?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">Nov 3 Anchor</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">Live Validation</span>
        </div>
      </div>

      <!-- Scenario 3: Postgres -->
      <div 
        @click="selectScenario(scenarios[2])" 
        class="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-white group-hover:text-blue-400">3. Relative Date & Postgres</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-neutral-400 mt-1 line-clamp-2">"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">Last Tuesday</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">Supabase/Neon</span>
        </div>
      </div>

      <!-- Scenario 4: Vector DBs -->
      <div 
        @click="selectScenario(scenarios[3])" 
        class="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-white group-hover:text-blue-400">4. Vector DB Evaluation</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-neutral-400 mt-1 line-clamp-2">"Two weeks ago we compared vector databases for our RAG agent. Has Pinecone or Qdrant announced any new serverless pricing or hybrid search updates since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">2 Weeks Ago</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">Pinecone/Qdrant</span>
        </div>
      </div>

      <!-- Scenario 5: Frameworks -->
      <div 
        @click="selectScenario(scenarios[4])" 
        class="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-white group-hover:text-blue-400">5. Framework Changelogs</span>
          <span class="text-[10px] text-neutral-500 group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-neutral-400 mt-1 line-clamp-2">"Three days ago I asked you about Drizzle ORM and Prisma. Have there been any new version releases or breaking changes since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">3 Days Ago</span>
          <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">Releases</span>
        </div>
      </div>
    </div>

    <!-- Reset Feedback Toast -->
    <div v-if="resetMessage" class="mt-2 p-2 rounded-lg bg-emerald-950/80 border border-emerald-800 text-[11px] text-emerald-300">
      {{ resetMessage }}
    </div>

    <!-- Governance Setting -->
    <div class="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs">
      <span class="text-neutral-400">Governance:</span>
      <button 
        @click="toggleGovernance" 
        class="px-2.5 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1.5"
        :class="autoPilot ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-neutral-800 border-neutral-600 text-neutral-200'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="autoPilot ? 'bg-blue-500' : 'bg-neutral-400'"></span>
        <span>{{ autoPilot ? 'Auto-Pilot' : 'Supervised' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['run-scenario', 'update:auto-pilot', 'memory-reset']);

const props = defineProps({
  autoPilot: {
    type: Boolean,
    default: true
  }
});

const isResetting = ref(false);
const resetMessage = ref('');

const scenarios = [
  'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
  'What did I ask you on 3 November? Is your answer still correct today?',
  'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?',
  'Two weeks ago we evaluated vector databases for our RAG agent. Has Pinecone or Qdrant announced any new serverless pricing or hybrid search updates since?',
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
  resetMessage.value = '';
  try {
    const token = localStorage.getItem('minimi_auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/memory/reset', { method: 'POST', headers });
    if (res.ok) {
      resetMessage.value = '✓ Brain-Vault reseeded with benchmark scenarios!';
      emit('memory-reset');
      setTimeout(() => { resetMessage.value = ''; }, 3500);
    }
  } catch (err) {
    console.error(err);
  } finally {
    isResetting.value = false;
  }
};
</script>
