<template>
  <aside 
    class="sidebar flex flex-col h-full bg-neutral-950 border-r border-neutral-800 transition-all duration-300 z-40 select-none"
    :class="isOpen ? 'w-64 md:w-72' : 'w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-none'"
  >
    <!-- Top Branding & New Chat -->
    <div class="p-3 border-b border-neutral-800 flex flex-col gap-2.5">
      <div class="flex items-center justify-between px-1 pt-1">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
            M
          </div>
          <span class="text-sm font-semibold text-white tracking-tight">minimi</span>
        </div>
        <button 
          @click="$emit('close-sidebar')"
          class="md:hidden text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors"
          title="Close sidebar"
        >
          ✕
        </button>
      </div>

      <!-- + New Chat Button -->
      <button 
        @click="$emit('new-chat')"
        class="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm group"
      >
        <div class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>New Chat</span>
        </div>
        <span class="text-[10px] bg-blue-700/60 group-hover:bg-blue-600 px-1.5 py-0.5 rounded font-mono">⌘K</span>
      </button>
    </div>

    <!-- Chat History Section -->
    <div class="flex-1 overflow-y-auto px-2 py-3 space-y-4 styled-scrollbar">
      
      <div v-if="sessions.length === 0" class="text-center py-8 px-3">
        <div class="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mx-auto mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <p class="text-xs text-neutral-400 font-medium">No chat history</p>
        <p class="text-[11px] text-neutral-500 mt-0.5">Start a conversation above</p>
      </div>

      <!-- Grouped Session List -->
      <div v-for="(group, groupName) in groupedSessions" :key="groupName" class="space-y-1">
        <div v-if="group.length > 0" class="px-2 pt-1 pb-1 text-[10px] font-mono font-medium text-neutral-500 uppercase tracking-wider">
          {{ groupName }}
        </div>

        <div 
          v-for="s in group" 
          :key="s.id"
          @click="selectSession(s.id)"
          class="group/item relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all border"
          :class="s.id === activeSessionId ? 'bg-neutral-800/80 border-neutral-700 text-white font-medium shadow-sm' : 'border-transparent text-neutral-300 hover:bg-neutral-900 hover:text-white'"
        >
          <!-- Title or Inline Edit -->
          <div class="flex items-center gap-2 min-w-0 flex-1 mr-1">
            <span class="text-neutral-500 flex-shrink-0">
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
              class="w-full bg-neutral-950 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            />
            <span v-else class="truncate text-xs">{{ s.title }}</span>
          </div>

          <!-- Action Buttons on Hover -->
          <div v-if="editingId !== s.id" class="hidden group-hover/item:flex items-center gap-1 flex-shrink-0 text-neutral-400">
            <!-- Rename Button -->
            <button 
              @click.stop="startRename(s)"
              class="p-1 hover:text-white hover:bg-neutral-800 rounded transition-colors"
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
              class="p-1 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
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
    <div class="p-2.5 border-t border-neutral-800 bg-neutral-950/80">
      <div class="p-2 rounded-xl bg-neutral-900 border border-neutral-800/80 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-inner flex-shrink-0">
            {{ userInitial }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-medium text-white truncate">{{ currentUser?.name || 'Guest' }}</div>
            <div class="text-[10px] text-neutral-400 font-mono truncate">@{{ currentUser?.username || 'anonymous' }}</div>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button 
            @click="$emit('open-auth')"
            class="text-[10px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-colors border border-neutral-700/60"
            title="Switch User / Login"
          >
            Switch
          </button>
          <button 
            @click="$emit('logout')"
            class="p-1 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
            title="Log out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
