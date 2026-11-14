<template>
  <div v-if="citations && citations.length > 0" class="citations-container mt-3 pt-3 border-t border-neutral-800 animate-popup">
    <div class="text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span class="text-neutral-300 font-semibold">Verified Web Sources ({{ citations.length }})</span>
      </div>
      <span class="text-[9px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono">Fact Checked</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <a 
        v-for="cite in citations" 
        :key="cite.index" 
        :href="cite.url" 
        target="_blank" 
        rel="noopener noreferrer"
        class="flex items-start gap-2 p-2 rounded-lg bg-neutral-950 hover:bg-neutral-800/60 border border-neutral-800 hover:border-neutral-700 transition-colors group shadow-sm"
      >
        <span class="flex-shrink-0 w-4 h-4 rounded bg-neutral-800 text-neutral-300 text-[10px] font-mono flex items-center justify-center font-bold">
          {{ cite.index }}
        </span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-neutral-200 group-hover:text-blue-400 truncate">
            {{ cite.title }}
          </div>
          <div class="text-[10px] text-neutral-500 truncate flex items-center gap-1 mt-0.5">
            <span>{{ cite.domain }}</span>
            <span v-if="cite.publishedDate" class="text-neutral-600">• {{ cite.publishedDate }}</span>
          </div>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup>
defineProps({
  citations: {
    type: Array,
    default: () => []
  }
});
</script>
