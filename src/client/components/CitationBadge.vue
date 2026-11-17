<template>
  <div v-if="citations && citations.length > 0" class="citations-container mt-3 pt-3 border-t border-slate-200 dark:border-neutral-800 animate-popup">
    <div class="text-[11px] font-mono text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#4c4c4c] dark:text-neutral-400">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span class="text-slate-700 dark:text-neutral-300 font-medium">Sources ({{ citations.length }})</span>
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <a 
        v-for="cite in citations" 
        :key="cite.index" 
        :href="cite.url" 
        target="_blank" 
        rel="noopener noreferrer"
        :title="cite.snippet || cite.title"
        class="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50/80 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 dark:bg-neutral-900/60 dark:hover:bg-neutral-800/80 dark:border-neutral-800 dark:hover:border-neutral-700 transition-colors group shadow-2xs"
      >
        <span class="flex-shrink-0 w-4 h-4 rounded bg-slate-200/70 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 text-[10px] font-mono flex items-center justify-center font-medium mt-0.5">
          {{ cite.index }}
        </span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-slate-800 dark:text-neutral-200 group-hover:text-[#4c4c4c] dark:group-hover:text-neutral-200 truncate leading-snug">
            {{ cite.title }}
          </div>
          <div class="text-[10px] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1.5 mt-0.5">
            <span class="font-medium text-slate-600 dark:text-neutral-400">{{ cite.domain }}</span>
            <span v-if="formatDate(cite.publishedDate)" class="text-slate-400 dark:text-neutral-500">• {{ formatDate(cite.publishedDate) }}</span>
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

function formatDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d+\s+(hour|day|minute|week|month)s?\s+ago$/i.test(str)) {
    return str;
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}`;
    }
    return null;
  }
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
    return `${hours}h ago`;
  }
  if (diffMs >= 24 * 60 * 60 * 1000 && diffMs < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return `${days}d ago`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = d.getFullYear() === now.getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `${months[d.getMonth()]} ${d.getDate()}${year}`;
}
</script>
