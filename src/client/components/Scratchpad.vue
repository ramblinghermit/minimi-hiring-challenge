<template>
  <div v-if="scratchpad && scratchpad.length > 0" class="scratchpad-wrapper my-2">
    <details :open="isOpen" class="group border border-neutral-800 bg-neutral-900/60 rounded-xl overflow-hidden transition-all duration-200">
      <summary class="flex items-center justify-between px-3.5 py-2 cursor-pointer select-none text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-900/80">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" :class="isProcessing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'"></div>
          <span class="font-medium font-mono">Agent Thoughts & Execution Trace ({{ scratchpad.length }})</span>
        </div>
        <span class="text-[10px] text-neutral-500 group-open:rotate-180 transition-transform">▼</span>
      </summary>
      
      <div class="p-3 text-xs font-mono space-y-2 border-t border-neutral-800/60 bg-black/40 max-h-64 overflow-y-auto styled-scrollbar">
        <div v-for="(thought, idx) in scratchpad" :key="idx" class="flex items-start gap-2 text-neutral-300">
          <span class="text-neutral-500 select-none">›</span>
          <span :class="getThoughtClass(thought)">{{ thought }}</span>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
const props = defineProps({
  scratchpad: {
    type: Array,
    default: () => []
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  isProcessing: {
    type: Boolean,
    default: false
  }
});

const getThoughtClass = (text) => {
  if (text.includes('Temporal Anchor') || text.includes('Brain-Vault')) return 'text-purple-400 font-medium';
  if (text.includes('Tool') || text.includes('Search')) return 'text-sky-400';
  if (text.includes('Completed') || text.includes('Verified')) return 'text-emerald-400';
  if (text.includes('Denied') || text.includes('Error')) return 'text-rose-400';
  return 'text-neutral-300';
};
</script>
