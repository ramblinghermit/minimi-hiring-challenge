<template>
  <aside 
    class="sidebar flex flex-col h-full bg-slate-50 dark:bg-neutral-950 border-r border-slate-200 dark:border-neutral-800 transition-all duration-300 z-40 select-none"
    :class="isOpen ? 'w-64 md:w-72' : 'w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-none'"
  >
    <!-- Top Branding & New Chat -->
    <div class="p-3 border-b border-slate-200 dark:border-neutral-800 flex flex-col gap-2.5">
      <!-- Mobile Close Sidebar (visible only on small screens) -->
      <div class="flex items-center justify-end md:hidden px-1">
        <button 
          @click="$emit('close-sidebar')"
          class="text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white p-1 rounded-md hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"
          title="Close sidebar"
        >
          ✕
        </button>
      </div>

      <!-- + New Chat Button -->
      <button 
        @click="$emit('new-chat')"
        class="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#4c4c4c] hover:bg-[#3d3d3d] text-white text-xs font-medium transition-all shadow-sm group"
      >
        <div class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>New Chat</span>
        </div>
        <span class="text-[10px] bg-[#3d3d3d] group-hover:bg-[#2e2e2e] px-1.5 py-0.5 rounded font-mono">⌘K</span>
      </button>
    </div>

    <!-- Chat History Section -->
    <div class="flex-1 overflow-y-auto px-2 py-3 space-y-4 styled-scrollbar">
      
      <div v-if="sessions.length === 0" class="text-center py-8 px-3">
        <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 flex items-center justify-center text-slate-400 dark:text-neutral-500 mx-auto mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <p class="text-xs text-slate-600 dark:text-neutral-400 font-medium">No chat history</p>
        <p class="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">Start a conversation above</p>
      </div>

      <!-- Grouped Session List -->
      <div v-for="(group, groupName) in groupedSessions" :key="groupName" class="space-y-1">
        <div v-if="group.length > 0" class="px-2 pt-1 pb-1 text-[10px] font-mono font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
          {{ groupName }}
        </div>

        <div 
          v-for="s in group" 
          :key="s.id"
          @click="selectSession(s.id)"
          class="group/item relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all border"
          :class="s.id === activeSessionId ? 'bg-white border-slate-300 dark:bg-neutral-800/80 dark:border-neutral-700 text-slate-900 dark:text-white font-medium shadow-xs' : 'border-transparent text-slate-600 dark:text-neutral-300 hover:bg-slate-200/60 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-white'"
        >
          <!-- Title or Inline Edit -->
          <div class="flex items-center gap-2 min-w-0 flex-1 mr-1">
            <span class="text-slate-400 dark:text-neutral-500 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </span>

            <input 
              v-if="editingId === s.id"
              v-model="editTitleText"
              @click.stop
              @keydown.enter="saveRename(s.id)"
              @keydown.esc="cancelRename"
              ref="editInput"
              type="text"
              class="w-full bg-white dark:bg-neutral-950 border border-[#4c4c4c] rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            <span v-else class="truncate text-xs">{{ s.title }}</span>
          </div>

          <!-- Action Buttons on Hover -->
          <div v-if="editingId !== s.id" class="hidden group-hover/item:flex items-center gap-1 flex-shrink-0 text-slate-400 dark:text-neutral-400">
            <!-- Rename Button -->
            <button 
              @click.stop="startRename(s)"
              class="p-1 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-neutral-800 rounded transition-colors"
              title="Rename chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <!-- Delete Button -->
            <button 
              @click.stop="$emit('delete-session', s.id)"
              class="p-1 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-neutral-800 rounded transition-colors"
              title="Delete chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>

        </div>
      </div>

    </div>

    <!-- Bottom User Profile Card & Switcher -->
    <div class="p-2.5 border-t border-slate-200/80 dark:border-neutral-800/80 bg-slate-50/60 dark:bg-neutral-950/60 backdrop-blur-xs">
      <div class="group/profile relative flex items-center justify-between p-2 rounded-xl bg-white dark:bg-neutral-900/80 border border-slate-200/80 dark:border-neutral-800/80 hover:border-slate-300 dark:hover:border-neutral-700 transition-all shadow-2xs hover:shadow-xs">
        
        <!-- User Identity Info (Clickable for Account Switch / Auth) -->
        <button 
          @click="$emit('open-auth')"
          type="button"
          class="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer focus:outline-none"
          title="Switch User / Account"
        >
          <div class="relative flex-shrink-0">
            <div class="w-8 h-8 rounded-full bg-[rgb(76,76,76)] dark:bg-neutral-800 text-white flex items-center justify-center font-semibold text-xs shadow-xs border border-neutral-700/40">
              {{ userInitial }}
            </div>
            <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" title="Active"></span>
          </div>
          
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold text-slate-800 dark:text-neutral-100 truncate group-hover/profile:text-[#4c4c4c] dark:group-hover/profile:text-neutral-200 transition-colors leading-tight">
              {{ currentUser?.name || 'Guest User' }}
            </div>
            <div class="text-[10px] text-slate-400 dark:text-neutral-500 font-mono truncate leading-tight mt-0.5">
              @{{ currentUser?.username || 'anonymous' }}
            </div>
          </div>
        </button>

        <!-- Action Buttons -->
        <div class="flex items-center gap-1 flex-shrink-0 ml-1.5">
          <!-- Switch User Button -->
          <button 
            @click="$emit('open-auth')"
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Switch User"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>

          <!-- Logout Button -->
          <button 
            @click="$emit('logout')"
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            title="Log out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>

      </div>
    </div>

  </aside>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';

const props = defineProps({
  sessions: {
    type: Array,
    default: () => []
  },
  activeSessionId: {
    type: String,
    default: ''
  },
  currentUser: {
    type: Object,
    default: () => null
  },
  isOpen: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits([
  'select-session', 
  'new-chat', 
  'delete-session', 
  'rename-session', 
  'open-auth', 
  'logout',
  'close-sidebar'
]);

const editingId = ref(null);
const editTitleText = ref('');
const editInput = ref(null);

const userInitial = computed(() => {
  if (!props.currentUser?.name) return '?';
  return props.currentUser.name.charAt(0).toUpperCase();
});

const selectSession = (id) => {
  if (editingId.value) return;
  emit('select-session', id);
};

const startRename = (session) => {
  editingId.value = session.id;
  editTitleText.value = session.title;
  nextTick(() => {
    if (editInput.value && editInput.value[0]) {
      editInput.value[0].focus();
    }
  });
};

const saveRename = (id) => {
  if (!editTitleText.value.trim()) return;
  emit('rename-session', { sessionId: id, title: editTitleText.value.trim() });
  editingId.value = null;
};

const cancelRename = () => {
  editingId.value = null;
};

// Group sessions by date
const groupedSessions = computed(() => {
  const groups = {
    'Today': [],
    'Yesterday': [],
    'Previous 7 Days': [],
    'Older': []
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 7 * 86400000;

  for (const s of props.sessions) {
    const time = new Date(s.updatedAt || s.createdAt).getTime();
    if (time >= todayStart) {
      groups['Today'].push(s);
    } else if (time >= yesterdayStart) {
      groups['Yesterday'].push(s);
    } else if (time >= weekStart) {
      groups['Previous 7 Days'].push(s);
    } else {
      groups['Older'].push(s);
    }
  }

  return groups;
});
</script>
