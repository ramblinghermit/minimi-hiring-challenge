<template>
  <div v-if="scratchpad && scratchpad.length > 0" class="scratchpad-wrapper my-2.5">
    <div class="border border-neutral-800 bg-neutral-950/80 rounded-lg overflow-hidden transition-all duration-150 shadow-sm">
      <button 
        @click="isExpanded = !isExpanded" 
        type="button"
        class="w-full flex items-center justify-between px-3 py-2 cursor-pointer select-none text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-900/70 border-b transition-colors text-left"
        :class="isExpanded ? 'border-neutral-800' : 'border-transparent'"
        :title="isExpanded ? 'Click to collapse execution trace' : 'Click to expand execution trace'"
      >
        <div class="flex items-center gap-2">
          <div 
            class="w-2 h-2 rounded-full transition-colors" 
            :class="isProcessing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'"
          ></div>
          <span class="font-mono text-[11px] font-semibold text-neutral-200">
            Execution Trace ({{ scratchpad.length }})
          </span>
          <span v-if="isProcessing" class="text-[10px] text-blue-400 animate-pulse font-mono">
            running...
          </span>
          <span v-else class="text-[10px] text-neutral-500 font-mono">
            completed
          </span>
        </div>

        <div class="flex items-center gap-1.5 text-[10px] text-neutral-400 hover:text-neutral-200">
          <span class="font-mono">{{ isExpanded ? 'Collapse' : 'Expand' }}</span>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
            class="transition-transform duration-200"
            :class="{ 'rotate-180': isExpanded }"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </button>
      
      <div 
        v-show="isExpanded" 
        class="p-3 text-[11px] font-mono space-y-1.5 bg-black/80 max-h-64 overflow-y-auto styled-scrollbar"
      >
        <div 
          v-for="(thought, idx) in scratchpad" 
          :key="idx" 
          class="flex items-start gap-2 leading-relaxed"
        >
          <span class="text-neutral-600 select-none text-[10px] pt-0.5 font-mono">{{ idx + 1 }}.</span>
          <span :class="getThoughtClass(thought)">{{ thought }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

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

// Default to expanded so traces are ALWAYS immediately visible!
const isExpanded = ref(true);

const getThoughtClass = (text) => {
  if (text.includes('Temporal Anchor') || text.includes('Brain-Vault') || text.includes('Recalled')) {
    return 'text-white font-medium';
  }
  if (text.includes('Tool') || text.includes('Search') || text.includes('Executing') || text.includes('Planned')) {
    return 'text-blue-400';
  }
  if (text.includes('completed') || text.includes('Retrieved') || text.includes('approved')) {
    return 'text-emerald-300';
  }
  if (text.includes('Denied') || text.includes('Error')) {
    return 'text-rose-400 underline';
  }
  return 'text-neutral-300';
};
</script>
