<template>
  <div v-if="scratchpad && scratchpad.length > 0" class="scratchpad-wrapper my-2">
    <details :open="isOpen" class="group border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden transition-all duration-150">
      <summary class="flex items-center justify-between px-3 py-2 cursor-pointer select-none text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-900/60 border-b border-transparent group-open:border-neutral-800">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full" :class="isProcessing ? 'bg-blue-500 animate-pulse' : 'bg-neutral-500'"></div>
          <span class="font-mono text-[11px] font-medium text-neutral-300">Trace ({{ scratchpad.length }})</span>
        </div>
        <span class="text-[10px] text-neutral-500 group-open:rotate-180 transition-transform">▼</span>
      </summary>
      
      <div class="p-3 text-[11px] font-mono space-y-1.5 bg-black/60 max-h-60 overflow-y-auto styled-scrollbar">
        <div v-for="(thought, idx) in scratchpad" :key="idx" class="flex items-start gap-2 text-neutral-300">
          <span class="text-neutral-600 select-none">›</span>
          <span :class="getThoughtClass(thought)">{{ thought }}</span>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
defineProps({
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
  if (text.includes('Temporal Anchor') || text.includes('Brain-Vault')) return 'text-white font-medium';
  if (text.includes('Tool') || text.includes('Search') || text.includes('Executing')) return 'text-blue-400';
  if (text.includes('Completed') || text.includes('Verified')) return 'text-neutral-300';
  if (text.includes('Denied') || text.includes('Error')) return 'text-neutral-400 underline';
  return 'text-neutral-400';
};
</script>
