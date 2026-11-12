<template>
  <div class="permission-card my-3 p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 shadow-lg animate-fadeIn">
    <!-- Header -->
    <div class="flex items-start gap-3">
      <div class="p-2 rounded-lg bg-amber-500/20 text-amber-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-amber-300">Tool Execution Request (AgentBridge Governance)</h3>
        <p class="text-xs text-amber-400/80 mt-0.5">The agent requests permission to execute the web search tool.</p>
        
        <div class="mt-2 text-xs flex gap-4 text-amber-300/70">
          <div><span class="font-medium text-amber-400">Tool:</span> {{ toolName }}</div>
          <div><span class="font-medium text-amber-400">Service:</span> {{ serverName }}</div>
        </div>
      </div>
    </div>

    <!-- Payload Details Accordion -->
    <div class="mt-3 text-xs">
      <details class="group bg-black/40 rounded-lg p-2.5 border border-amber-500/20">
        <summary class="cursor-pointer text-amber-400 hover:text-amber-300 font-medium select-none flex items-center justify-between">
          <span>Inspect Search Payload & Parameters</span>
          <span class="text-[10px] text-amber-500 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <pre class="mt-2 p-2 bg-black/60 rounded text-[11px] font-mono text-emerald-400 overflow-x-auto">{{ formattedPayload }}</pre>
      </details>
    </div>

    <!-- Action Buttons -->
    <div class="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
      <button 
        @click="deny" 
        class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors"
      >
        Deny
      </button>
      <button 
        @click="allowOnce" 
        class="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-colors"
      >
        Allow Once
      </button>
      <button 
        @click="allowAlways" 
        class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
      >
        Always Allow (Auto-Pilot)
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  toolName: { type: String, default: 'web_search' },
  serverName: { type: String, default: 'minimi-search-service' },
  payload: { type: Object, default: () => ({}) },
  approvalId: { type: String, required: true }
});

const emit = defineEmits(['approve', 'deny']);

const formattedPayload = computed(() => {
  if (!props.payload) return '{}';
  return JSON.stringify(props.payload, null, 2);
});

const deny = () => {
  emit('deny', { approvalId: props.approvalId });
};

const allowOnce = () => {
  emit('approve', {
    approvalId: props.approvalId,
    approvalType: 'once',
    toolName: props.toolName,
    serverName: props.serverName
  });
};

const allowAlways = () => {
  emit('approve', {
    approvalId: props.approvalId,
    approvalType: 'always',
    toolName: props.toolName,
    serverName: props.serverName
  });
};
</script>
