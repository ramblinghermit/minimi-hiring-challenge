<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
    <div class="w-full max-w-md bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      
      <!-- Modal Header -->
      <div class="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#4c4c4c] flex items-center justify-center text-white font-bold text-sm shadow-md">
            M
          </div>
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-white tracking-tight">Chat Agent Workspace</h2>
            <p class="text-xs text-slate-500 dark:text-neutral-400">User Authentication & Multi-Tenant Recall</p>
          </div>
        </div>

        <button 
          v-if="canClose" 
          @click="$emit('close')"
          class="text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Quick 1-Click Demo Accounts -->
      <div class="px-6 pt-4 pb-2 bg-slate-50 dark:bg-neutral-950/60 border-b border-slate-200 dark:border-neutral-800/80">
        <div class="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-2.5 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Instant Demo Switcher</span>
          </div>
          <span class="text-[10px] text-[#4c4c4c] dark:text-neutral-400 font-mono">Isolated Data</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <button 
            v-for="demo in demoAccounts" 
            :key="demo.username"
            @click="quickLogin(demo.username, 'password123')"
            :disabled="isLoading"
            class="flex flex-col items-center p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-850 hover:border-slate-300 dark:hover:border-neutral-700 transition-all text-center group disabled:opacity-50 shadow-2xs"
          >
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mb-1 shadow-sm" :class="demo.bg">
              {{ demo.avatar }}
            </div>
            <span class="text-xs font-medium text-slate-800 dark:text-neutral-200 group-hover:text-[#4c4c4c] dark:group-hover:text-neutral-200 truncate w-full">{{ demo.name }}</span>
            <span class="text-[10px] text-slate-400 dark:text-neutral-500 font-mono">@{{ demo.username }}</span>
          </button>
        </div>
      </div>

      <!-- Tabs: Sign In / Create Account -->
      <div class="px-6 pt-4 flex gap-4 border-b border-slate-200 dark:border-neutral-800">
        <button 
          @click="activeTab = 'login'; errorMsg = ''"
          class="pb-2 text-xs font-semibold uppercase tracking-wider transition-colors relative"
          :class="activeTab === 'login' ? 'text-[#4c4c4c] dark:text-neutral-100 border-b-2 border-[#4c4c4c] dark:border-neutral-200' : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'"
        >
          Sign In
        </button>
        <button 
          @click="activeTab = 'register'; errorMsg = ''"
          class="pb-2 text-xs font-semibold uppercase tracking-wider transition-colors relative"
          :class="activeTab === 'register' ? 'text-[#4c4c4c] dark:text-neutral-100 border-b-2 border-[#4c4c4c] dark:border-neutral-200' : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'"
        >
          Create Account
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div v-if="errorMsg" class="p-3 rounded-lg bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-200">
          {{ errorMsg }}
        </div>

        <div v-if="activeTab === 'register'">
          <label class="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">Full Name</label>
          <input 
            v-model="nameInput"
            type="text" 
            placeholder="e.g. Alex Johnson" 
            class="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#4c4c4c] transition-colors"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">Username</label>
          <input 
            v-model="usernameInput"
            type="text" 
            required
            placeholder="e.g. alex" 
            class="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#4c4c4c] transition-colors"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">Password</label>
          <input 
            v-model="passwordInput"
            type="password" 
            required
            placeholder="••••••••" 
            class="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-[#4c4c4c] transition-colors"
          />
        </div>

        <button 
          type="submit" 
          :disabled="isLoading"
          class="w-full py-2.5 rounded-lg bg-[#4c4c4c] hover:bg-[#3d3d3d] disabled:opacity-50 text-white text-xs font-medium transition-all shadow-md mt-2 flex items-center justify-center gap-2"
        >
          <span v-if="isLoading" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
          <span>{{ isLoading ? 'Authenticating...' : (activeTab === 'login' ? 'Sign In' : 'Create Account') }}</span>
        </button>
      </form>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  canClose: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close', 'auth-success']);

const activeTab = ref('login');
const usernameInput = ref('');
const passwordInput = ref('');
const nameInput = ref('');
const isLoading = ref(false);
const errorMsg = ref('');

const demoAccounts = [
  { name: 'Alice Chen', username: 'alice', avatar: 'A', bg: 'bg-emerald-600' },
  { name: 'Bob Martinez', username: 'bob', avatar: 'B', bg: 'bg-purple-600' },
  { name: 'Demo Evaluator', username: 'demo', avatar: 'D', bg: 'bg-[#4c4c4c]' }
];

const quickLogin = async (username, password) => {
  usernameInput.value = username;
  passwordInput.value = password;
  await doAuth(username, password);
};

const handleSubmit = async () => {
  if (activeTab.value === 'login') {
    await doAuth(usernameInput.value, passwordInput.value);
  } else {
    await doRegister(usernameInput.value, passwordInput.value, nameInput.value);
  }
};

const doAuth = async (username, password) => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');
    emit('auth-success', data);
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const doRegister = async (username, password, name) => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name: name || username })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    emit('auth-success', data);
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    isLoading.value = false;
  }
};
</script>
