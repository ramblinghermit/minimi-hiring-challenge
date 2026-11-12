<template>
  <div class="permission-card my-3 p-4 rounded-xl border border-neutral-700 bg-neutral-900/95 text-neutral-200 shadow-md">
    <!-- Header -->
    <div class="flex items-start gap-3">
      <div class="p-2 rounded-lg bg-neutral-800 text-blue-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-white">Tool Permission Required</h3>
        <p class="text-xs text-neutral-400 mt-0.5">The agent requests authorization to execute web search.</p>
        
        <div class="mt-2 text-xs flex gap-4 text-neutral-400 font-mono">
          <div><span class="text-neutral-500">Tool:</span> <span class="text-white">{{ toolName }}</span></div>
          <div><span class="text-neutral-500">Service:</span> <span class="text-white">{{ serverName }}</span></div>
        </div>
      </div>
    </div>

    <!-- Payload Details Accordion -->
    <div class="mt-3 text-xs">
      <details class="group bg-black/60 rounded-lg p-2.5 border border-neutral-800">
        <summary class="cursor-pointer text-neutral-300 hover:text-white font-medium select-none flex items-center justify-between">
          <span class="font-mono text-[11px]">Inspect Tool Parameters</span>
          <span class="text-[10px] text-neutral-500 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <pre class="mt-2 p-2 bg-black rounded text-[11px] font-mono text-neutral-300 overflow-x-auto border border-neutral-800">{{ formattedPayload }}</pre>
      </details>
    </div>

    <!-- Action Buttons -->
    <div class="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
      <button 
        @click="deny" 
        class="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors"
      >
        Deny
      </button>
      <button 
        @click="allowOnce" 
        class="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600 transition-colors"
      >
        Allow Once
      </button>
      <button 
        @click="allowAlways" 
        class="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
      >
        Always Allow
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  toolName: {
    type: String,
    required: true
  },
  serverName: {
    type: String,
    default: 'minimi-service'
  },
  payload: {
    type: Object,
    default: () => ({})
  },
  approvalId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['approve', 'deny']);

const formattedPayload = computed(() => {
  try {
    return JSON.stringify(props.payload, null, 2);
  } catch {
    return String(props.payload);
  }
});

const allowOnce = () => {
  emit('approve', {
    approvalId: props.approvalId,
    toolName: props.toolName,
    approvalType: 'once'
  });
};

const allowAlways = () => {
  emit('approve', {
    approvalId: props.approvalId,
    toolName: props.toolName,
    approvalType: 'always'
  });
};

const deny = () => {
  emit('deny', {
    approvalId: props.approvalId,
    toolName: props.toolName
  });
};
</script>
