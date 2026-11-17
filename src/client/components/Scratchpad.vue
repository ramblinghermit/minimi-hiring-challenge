<template>
  <div v-if="scratchpad && scratchpad.length > 0" class="reasoning-container select-none text-xs my-1">
    
    <!-- Minimalist Reasoning Disclosure Header -->
    <button 
      @click="isExpanded = !isExpanded" 
      type="button"
      class="inline-flex items-center gap-2 py-1 px-2.5 -ml-1 rounded-lg font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 hover:bg-slate-100/70 dark:hover:bg-neutral-800/50 transition-all cursor-pointer group max-w-full"
      :title="isExpanded ? 'Collapse reasoning trace' : 'Expand full reasoning trace'"
    >
      <!-- Discreet Icon: Walking Cat when active, Lightbulb / Brain when completed -->
      <span class="flex items-center justify-center text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300 transition-colors flex-shrink-0">
        <CatProgressLoader v-if="isProcessing" />
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z"></path>
          <line x1="10" y1="22" x2="14" y2="22"></line>
        </svg>
      </span>

      <!-- Label: Shows current step while processing, or summary when completed -->
      <span class="inline-flex items-center gap-1.5 min-w-0">
        <!-- Live Current Step (Modern Agent Style) -->
        <template v-if="isProcessing">
          <span class="truncate font-medium text-slate-700 dark:text-neutral-200 max-w-[280px] sm:max-w-md md:max-w-lg">
            {{ currentStep }}
          </span>
          <span v-if="displayDuration" class="text-slate-400 dark:text-neutral-500 font-mono text-[11px] font-normal flex-shrink-0">
            • {{ displayDuration }}
          </span>
        </template>

        <!-- Completed Summary -->
        <template v-else>
          <span>{{ completedSummary }}</span>
        </template>
      </span>

      <!-- Subtle chevron indicating expandable disclosure -->
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="11" 
        height="11" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2.2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
        class="text-slate-400 dark:text-neutral-500 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-neutral-300 flex-shrink-0 ml-0.5"
        :class="{ 'rotate-180': isExpanded }"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    
    <!-- Collapsible Trace Steps List (Closed by default; opens only on click) -->
    <div 
      v-if="isExpanded"
      ref="traceContainer"
      class="mt-2 pl-3.5 border-l-2 border-slate-200/90 dark:border-neutral-800 space-y-1.5 max-h-60 overflow-y-auto styled-scrollbar"
    >
      <div 
        v-for="(thought, idx) in scratchpad" 
        :key="idx" 
        class="text-xs leading-relaxed transition-opacity break-words flex items-start gap-1.5"
        :class="isProcessing && idx === scratchpad.length - 1 ? 'text-slate-800 dark:text-neutral-200 font-medium' : 'text-slate-500 dark:text-neutral-400'"
      >
        <span class="text-slate-300 dark:text-neutral-600 select-none">•</span>
        <span class="flex-1">{{ formatThought(thought) }}</span>
      </div>
    </div>

    <!-- Clean divider separating reasoning from the final message -->
    <div v-if="hasResponseText" class="mt-2.5 mb-2 border-b border-slate-100 dark:border-neutral-800/80"></div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import CatProgressLoader from './CatProgressLoader.vue';

const props = defineProps({
  scratchpad: {
    type: Array,
    default: () => []
  },
  isOpen: {
    type: Boolean,
    default: false
  },
  isProcessing: {
    type: Boolean,
    default: false
  },
  hasResponseText: {
    type: Boolean,
    default: false
  },
  durationMs: {
    type: Number,
    default: null
  },
  startTime: {
    type: Number,
    default: null
  }
});

// Collapsed by default - only opens when user explicitly toggles it
const isExpanded = ref(false);
const traceContainer = ref(null);

const elapsedSeconds = ref(0);
let timer = null;

const startLiveTimer = () => {
  if (timer) clearInterval(timer);
  const start = props.startTime || Date.now();
  elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - start) / 1000));
  timer = setInterval(() => {
    elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - start) / 1000));
  }, 500);
};

const stopLiveTimer = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

onMounted(() => {
  if (props.isProcessing) {
    startLiveTimer();
  }
});

onUnmounted(() => {
  stopLiveTimer();
});

watch(
  () => props.isProcessing,
  (val) => {
    if (val) {
      startLiveTimer();
    } else {
      stopLiveTimer();
    }
  }
);

const displayDuration = computed(() => {
  if (props.isProcessing) {
    return `${elapsedSeconds.value}s`;
  }
  const ms = props.durationMs;
  if (!ms || ms <= 0) return '';
  if (ms < 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
});

// Returns the clean formatted text of the latest active step
const currentStep = computed(() => {
  if (!props.scratchpad || props.scratchpad.length === 0) return 'Thinking...';
  const latest = props.scratchpad[props.scratchpad.length - 1];
  return formatThought(latest) || 'Thinking...';
});

// Returns modern summary label when reasoning completes
const completedSummary = computed(() => {
  const duration = displayDuration.value;
  const count = props.scratchpad?.length || 0;
  if (duration) {
    return `Thought for ${duration}`;
  }
  return `Reasoned (${count} ${count === 1 ? 'step' : 'steps'})`;
});

watch(
  () => props.scratchpad.length,
  () => {
    if (isExpanded.value) {
      nextTick(() => {
        if (traceContainer.value) {
          traceContainer.value.scrollTop = traceContainer.value.scrollHeight;
        }
      });
    }
  }
);

const formatThought = (text) => {
  if (!text) return '';
  return text
    .replace(/^[⚡▶⏸✓⚠️🛡️]\s*/, '')
    .trim();
};
</script>
