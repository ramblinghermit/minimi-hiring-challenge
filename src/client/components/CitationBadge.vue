<template>
  <div v-if="citations && citations.length > 0" class="citations-container mt-4 pt-3 border-t border-neutral-800">
    <div class="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <span>🌐 Verified Web Sources ({{ citations.length }})</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <a 
        v-for="cite in citations" 
        :key="cite.index" 
        :href="cite.url" 
        target="_blank" 
        rel="noopener noreferrer"
        class="flex items-start gap-2 p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 transition-colors group"
      >
        <span class="flex-shrink-0 w-5 h-5 rounded-md bg-neutral-800 group-hover:bg-neutral-700 text-neutral-300 text-[11px] font-mono flex items-center justify-center font-bold">
          {{ cite.index }}
        </span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-neutral-200 group-hover:text-sky-400 truncate">
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
