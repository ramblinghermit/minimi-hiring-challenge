<template>
  <div class="benchmark-panel bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm">
    <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-neutral-800">
      <div>
        <h2 class="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Benchmark Suite</h2>
        <p class="text-[11px] text-slate-500 dark:text-neutral-400">Hiring evaluation scenarios</p>
      </div>
      <button 
        @click="resetMemory" 
        data-agent-confirm="Purges session memory vault and temporal event log"
        class="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white transition-colors"
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
        class="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900 dark:hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-800 dark:text-white group-hover:text-[#4c4c4c] dark:group-hover:text-neutral-200">1. CRM Shortlist Delta</span>
          <span class="text-[10px] text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-slate-600 dark:text-neutral-400 mt-1 line-clamp-2">"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">Monday Anchor</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">Pricing Delta</span>
        </div>
      </div>

      <!-- Scenario 2: 3 Nov -->
      <div 
        @click="selectScenario(scenarios[1])" 
        class="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900 dark:hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-800 dark:text-white group-hover:text-[#4c4c4c] dark:group-hover:text-neutral-200">2. Absolute Date Recall</span>
          <span class="text-[10px] text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-slate-600 dark:text-neutral-400 mt-1 line-clamp-2">"What did I ask you on 3 November? Is your answer still correct today?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">Nov 3 Anchor</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">Live Validation</span>
        </div>
      </div>

      <!-- Scenario 3: Postgres -->
      <div 
        @click="selectScenario(scenarios[2])" 
        class="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900 dark:hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-800 dark:text-white group-hover:text-[#4c4c4c] dark:group-hover:text-neutral-200">3. Relative Date & Postgres</span>
          <span class="text-[10px] text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-slate-600 dark:text-neutral-400 mt-1 line-clamp-2">"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">Last Tuesday</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">Supabase/Neon</span>
        </div>
      </div>

      <!-- Scenario 4: Vector DBs -->
      <div 
        @click="selectScenario(scenarios[3])" 
        class="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900 dark:hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-800 dark:text-white group-hover:text-[#4c4c4c] dark:group-hover:text-neutral-200">4. Vector DB Evaluation</span>
          <span class="text-[10px] text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-slate-600 dark:text-neutral-400 mt-1 line-clamp-2">"Two weeks ago we compared vector databases for our RAG agent. Has Pinecone or Qdrant announced any new serverless pricing or hybrid search updates since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">2 Weeks Ago</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">Pinecone/Qdrant</span>
        </div>
      </div>

      <!-- Scenario 5: Frameworks -->
      <div 
        @click="selectScenario(scenarios[4])" 
        class="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900 dark:hover:border-neutral-700 cursor-pointer transition-all group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-800 dark:text-white group-hover:text-[#4c4c4c] dark:group-hover:text-neutral-200">5. Framework Changelogs</span>
          <span class="text-[10px] text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300">Run ↗</span>
        </div>
        <p class="text-[11px] text-slate-600 dark:text-neutral-400 mt-1 line-clamp-2">"Three days ago I asked you about Drizzle ORM and Prisma. Have there been any new version releases or breaking changes since?"</p>
        <div class="mt-1.5 flex gap-1.5 text-[10px]">
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">3 Days Ago</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-mono">Releases</span>
        </div>
      </div>
    </div>

    <!-- Reset Feedback Toast -->
    <div v-if="resetMessage" class="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-700 dark:text-emerald-300">
      {{ resetMessage }}
    </div>

    <!-- Governance Setting -->
    <div class="mt-4 pt-3 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between text-xs">
      <span class="text-slate-500 dark:text-neutral-400">Governance:</span>
      <button 
        @click="toggleGovernance" 
        class="px-2.5 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1.5"
        :class="autoPilot ? 'bg-slate-100 border-slate-300 text-slate-900 dark:bg-neutral-900 dark:border-neutral-700 dark:text-white' : 'bg-slate-200 border-slate-300 text-slate-800 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-200'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="autoPilot ? 'bg-[#4c4c4c]' : 'bg-slate-400 dark:bg-neutral-400'"></span>
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
      resetMessage.value = 'Memory system reseeded with benchmark scenarios!';
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
