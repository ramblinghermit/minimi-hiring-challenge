<template>
  <div class="permission-card my-3 p-4 rounded-xl border border-slate-300 bg-white text-slate-800 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200">
    <!-- Header -->
    <div class="flex items-start gap-3">
      <div class="p-2 rounded-lg bg-slate-100 text-[#4c4c4c] dark:bg-neutral-800 dark:text-neutral-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Tool Permission Required</h3>
        <p class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">The agent requests authorization to execute web search.</p>
        
        <div class="mt-2 text-xs flex gap-4 text-slate-500 dark:text-neutral-400 font-mono">
          <div><span class="text-slate-400 dark:text-neutral-500">Tool:</span> <span class="font-medium text-slate-900 dark:text-white">{{ toolName }}</span></div>
          <div><span class="text-slate-400 dark:text-neutral-500">Service:</span> <span class="font-medium text-slate-900 dark:text-white">{{ serverName }}</span></div>
        </div>
      </div>
    </div>

    <!-- Payload Details Accordion -->
    <div class="mt-3 text-xs">
      <details class="group bg-slate-50 dark:bg-black/60 rounded-lg p-2.5 border border-slate-200 dark:border-neutral-800">
        <summary class="cursor-pointer text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white font-medium select-none flex items-center justify-between">
          <span class="font-mono text-[11px]">Inspect Tool Parameters</span>
          <span class="text-[10px] text-slate-400 dark:text-neutral-500 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <pre class="mt-2 p-2 bg-white dark:bg-black rounded text-[11px] font-mono text-slate-800 dark:text-neutral-300 overflow-x-auto border border-slate-200 dark:border-neutral-800">{{ formattedPayload }}</pre>
      </details>
    </div>

    <!-- Action Buttons -->
    <div class="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-neutral-800">
      <button 
        @click="deny" 
        class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-700 transition-colors cursor-pointer"
      >
        Deny
      </button>
      <button 
        @click="allowOnce" 
        data-agent-confirm="Approves single-execution of requested tool"
        class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-white dark:border-neutral-600 transition-colors cursor-pointer"
      >
        Allow Once
      </button>
      <button 
        @click="allowAlways" 
        data-agent-confirm="Persistently approves this tool for the entire session"
        class="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#4c4c4c] hover:bg-[#3d3d3d] text-white shadow-sm transition-colors cursor-pointer"
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
    approval_id: props.approvalId,
    approved: true,
    approvalType: 'once',
    approval_type: 'once',
    toolName: props.toolName,
    tool_name: props.toolName
  });
};

const allowAlways = () => {
  emit('approve', {
    approvalId: props.approvalId,
    approval_id: props.approvalId,
    approved: true,
    approvalType: 'always',
    approval_type: 'always',
    toolName: props.toolName,
    tool_name: props.toolName
  });
};

const deny = () => {
  emit('deny', {
    approvalId: props.approvalId,
    approval_id: props.approvalId,
    approved: false,
    approvalType: 'deny',
    approval_type: 'deny',
    toolName: props.toolName,
    tool_name: props.toolName
  });
};
</script>
