<template>
  <div class="chat-container flex h-full w-full relative bg-black text-neutral-100 overflow-hidden">
    
    <!-- Left Navigation Sidebar: Chat History, Sessions, User Switcher -->
    <Sidebar 
      :sessions="sessions"
      :activeSessionId="activeSessionId"
      :currentUser="currentUser"
      :isOpen="isSidebarOpen"
      @select-session="selectSession"
      @new-chat="startNewChat"
      @delete-session="deleteSession"
      @rename-session="renameSession"
      @open-auth="isAuthModalOpen = true"
      @logout="handleLogout"
      @close-sidebar="isSidebarOpen = false"
    />

    <!-- Main Workspace (Header, Messages, Input, Benchmark Drawer) -->
    <div class="flex-1 flex flex-col h-full overflow-hidden relative">

      <!-- Top Header Bar -->
      <header class="h-14 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur px-4 md:px-6 flex items-center justify-between z-20 flex-shrink-0">
        <div class="flex items-center gap-3">
          <!-- Sidebar Toggle Button -->
          <button 
            @click="isSidebarOpen = !isSidebarOpen"
            class="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Toggle chat history sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>

          <!-- Current Chat Title & Status -->
          <div class="min-w-0 flex items-center gap-2">
            <h1 class="text-sm font-semibold text-white tracking-tight truncate max-w-[200px] md:max-w-xs">
              {{ currentSessionTitle }}
            </h1>
            <span class="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60 font-mono">
              live-web
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <!-- Active User Pill Badge (Clickable to switch) -->
          <button 
            @click="isAuthModalOpen = true"
            class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs transition-colors"
            title="Logged in user - click to switch account"
          >
            <span class="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white">
              {{ userInitial }}
            </span>
            <span class="font-medium max-w-[90px] truncate">{{ currentUser?.name || 'Login' }}</span>
          </button>

          <!-- Benchmark Drawer Toggle -->
          <button 
            @click="showBenchmark = !showBenchmark"
            class="text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-medium shadow-sm"
            :class="showBenchmark ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'"
          >
            <span>Benchmark</span>
          </button>
        </div>
      </header>

      <!-- Main Messages View & Side Benchmark Drawer -->
      <div class="flex-1 flex overflow-hidden relative">
        
        <!-- Messages Area -->
        <main class="flex-1 flex flex-col justify-between overflow-hidden relative bg-black">
          <div 
            ref="chatList" 
            class="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 styled-scrollbar"
          >
            <!-- Centered Landing View if No Messages in Session -->
            <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-4">
              <div class="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-blue-400 shadow-sm mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <h2 class="text-base font-semibold text-white mb-1">Minimi Web Search Chat Agent</h2>
              <p class="text-xs text-neutral-400 mb-6 max-w-md">
                Multi-tenant Brain-Vault temporal recall with verified live search & tool governance.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
                <button 
                  v-for="(sample, idx) in quickSamples" 
                  :key="idx"
                  @click="sendQuick(sample.prompt)"
                  class="p-3 rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 hover:border-neutral-700 text-xs text-neutral-300 transition-all text-left group shadow-sm"
                >
                  <div class="font-medium text-white group-hover:text-blue-400 mb-1 flex items-center justify-between">
                    <span>{{ sample.title }}</span>
                    <span class="text-neutral-500 group-hover:text-neutral-300">↗</span>
                  </div>
                  <p class="text-[11px] text-neutral-400 line-clamp-2">{{ sample.prompt }}</p>
                </button>
              </div>
            </div>

            <!-- Messages Stream -->
            <div v-else class="max-w-3xl mx-auto space-y-5 w-full pb-8">
              <div 
                v-for="(msg, index) in messages" 
                :key="msg.id || index" 
                class="message-row flex flex-col"
                :class="msg.role === 'user' ? 'items-end' : 'items-start'"
              >
                <!-- Role label & timestamp -->
                <div class="flex items-center gap-2 mb-1.5 px-1 text-[11px] text-neutral-500 font-mono">
                  <span class="font-semibold uppercase tracking-wider" :class="msg.role === 'user' ? 'text-blue-400' : 'text-neutral-300'">
                    {{ msg.role === 'user' ? (currentUser?.name || 'You') : 'Minimi' }}
                  </span>
                  <span>•</span>
                  <span>{{ msg.time }}</span>
                </div>

                <!-- Permission Request Message (AgentBridge pattern) -->
                <div v-if="msg.role === 'permission_request'" class="w-full">
                  <ToolPermissionMessage 
                    :toolName="msg.toolName"
                    :serverName="msg.serverName"
                    :payload="msg.payload"
                    :approvalId="msg.approvalId"
                    @approve="(data) => handleToolApproval(data, index)"
                    @deny="(data) => handleToolDenial(data, index)"
                  />
                </div>

                <!-- Standard Message Bubble -->
                <div v-else class="w-full flex flex-col" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                  
                  <!-- Agent Thoughts / Scratchpad (Execution Trace) -->
                  <div v-if="msg.role === 'assistant' && msg.scratchpad && msg.scratchpad.length > 0" class="w-full">
                    <Scratchpad 
                      :scratchpad="msg.scratchpad" 
                      :isOpen="true"
                      :isProcessing="Boolean(msg.isStreaming)"
                    />
                  </div>

                  <!-- Message Bubble Text -->
                  <div 
                    class="message-bubble rounded-xl px-4 py-3 text-sm leading-relaxed max-w-full shadow-sm"
                    :class="msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none ml-12' : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-tl-none w-full'"
                  >
                    <!-- Markdown rendered response -->
                    <div 
                      v-if="msg.role === 'assistant' && msg.text" 
                      class="markdown-body prose prose-invert prose-sm max-w-none text-neutral-100"
                      v-html="renderMarkdown(msg.text)"
                    ></div>

                    <!-- Typing indicator while waiting for text -->
                    <div v-else-if="msg.isStreaming && !msg.text" class="flex items-center gap-1.5 py-1">
                      <span class="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
                      <span class="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></span>
                      <span class="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></span>
                    </div>

                    <!-- User plain text -->
                    <div v-else>{{ msg.text }}</div>

                    <!-- Sources Citation Badge: GUARANTEED to pop up ONLY AFTER text has completely loaded -->
                    <div 
                      v-if="!msg.isStreaming && msg.citations && msg.citations.length > 0" 
                      class="animate-popup"
                    >
                      <CitationBadge :citations="msg.citations" />
                    </div>

                  </div>

                  <!-- Action Toolbar (Copy, etc.) -->
                  <div v-if="msg.text" class="flex items-center gap-2 mt-1 px-1 text-[11px] text-neutral-500">
                    <button @click="copyText(msg.text, index)" class="hover:text-neutral-300 transition-colors">
                      {{ copiedIndex === index ? '✓ Copied' : 'Copy' }}
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>

          <!-- Input Area (Bottom Bar) -->
          <div class="p-4 border-t border-neutral-800 bg-neutral-950 z-10 flex-shrink-0">
            <div class="max-w-3xl mx-auto relative bg-neutral-900 border border-neutral-800 rounded-xl shadow-md focus-within:border-neutral-600 transition-colors p-2.5">
              <textarea 
                v-model="inputPrompt" 
                @keydown.ctrl.enter.prevent="sendMessage"
                @keydown.exact.enter.prevent="handleEnter"
                placeholder="Ask Minimi anything (live web search + Brain-Vault recall)... [Enter to send]"
                class="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none resize-none px-2 py-1 max-h-32 min-h-[44px]"
                rows="2"
                :disabled="isProcessing"
              ></textarea>

              <div class="flex items-center justify-between pt-2 px-1 border-t border-neutral-800 gap-2 flex-wrap">
                <!-- Left: Mode Selector & AI Model Selector -->
                <div class="flex items-center gap-2 flex-wrap">
                  <!-- Mode Selector -->
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] uppercase font-mono text-neutral-500 hidden sm:inline">Mode</span>
                    <select 
                      v-model="autoPilot" 
                      :disabled="isProcessing"
                      class="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-neutral-600 transition-colors cursor-pointer"
                      title="Governance Execution Mode"
                    >
                      <option :value="true">⚡ Auto-Pilot Mode</option>
                      <option :value="false">🛡️ Supervised Mode</option>
                    </select>
                  </div>

                  <!-- AI Model Selector -->
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] uppercase font-mono text-neutral-500 hidden sm:inline">Model</span>
                    <select 
                      v-model="selectedModel" 
                      :disabled="isProcessing"
                      class="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-neutral-600 transition-colors cursor-pointer"
                      title="AI Model Selection"
                    >
                      <option value="gpt-4o-mini">OpenAI: GPT-4o Mini</option>
                      <option value="gpt-4o">OpenAI: GPT-4o</option>
                      <option value="claude-3-5-haiku-latest">Anthropic: Claude 3.5 Haiku</option>
                      <option value="claude-3-5-sonnet-latest">Anthropic: Claude 3.5 Sonnet</option>
                      <option value="gemini-2.5-flash">Google: Gemini 2.5 Flash</option>
                      <option value="llama-3.3-70b-versatile">Groq: Llama 3.3 70B</option>
                    </select>
                  </div>
                </div>

                <!-- Right: Send Button -->
                <div class="flex items-center gap-2">
                  <button 
                    @click="sendMessage" 
                    :disabled="!inputPrompt.trim() || isProcessing"
                    class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-medium shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <span>{{ isProcessing ? 'Searching & Synthesizing...' : 'Send' }}</span>
                    <span class="text-[10px] opacity-75">↵</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <!-- Benchmark Drawer (Collapsible Right Panel) -->
        <aside 
          v-if="showBenchmark" 
          class="w-80 border-l border-neutral-800 bg-neutral-950 p-4 overflow-y-auto styled-scrollbar z-30 transition-all flex-shrink-0"
        >
          <BenchmarkDrawer 
            :autoPilot="autoPilot" 
            @run-scenario="sendQuick" 
            @update:auto-pilot="(val) => autoPilot = val"
            @memory-reset="handleMemoryReset"
          />
        </aside>

      </div>

    </div>

    <!-- Auth Modal for Login / Account Switch -->
    <AuthModal 
      :isOpen="isAuthModalOpen"
      :canClose="Boolean(currentUser)"
      @close="isAuthModalOpen = false"
      @auth-success="onAuthSuccess"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import Sidebar from './Sidebar.vue';
import AuthModal from './AuthModal.vue';
import ToolPermissionMessage from './ToolPermissionMessage.vue';
import Scratchpad from './Scratchpad.vue';
import BenchmarkDrawer from './BenchmarkDrawer.vue';
import CitationBadge from './CitationBadge.vue';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

const renderMarkdown = (text) => {
  return md.render(text || '');
};

// State
const currentUser = ref(null);
const authToken = ref(localStorage.getItem('minimi_auth_token') || '');
const isAuthModalOpen = ref(false);
const isSidebarOpen = ref(true);

const sessions = ref([]);
const activeSessionId = ref('');
const messages = ref([]);
const inputPrompt = ref('');
const isProcessing = ref(false);
const showBenchmark = ref(false);
const autoPilot = ref(true);
const selectedModel = ref('gemini-2.5-flash');
const currentAgentMessageIndex = ref(-1);
const copiedIndex = ref(null);
const chatList = ref(null);
let eventSource = null;

const userInitial = computed(() => {
  if (!currentUser.value?.name) return 'U';
  return currentUser.value.name.charAt(0).toUpperCase();
});

const currentSessionTitle = computed(() => {
  if (!activeSessionId.value) return 'New Chat';
  const match = sessions.value.find((s) => s.id === activeSessionId.value);
  return match?.title || 'Chat';
});

const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken.value) {
    headers['Authorization'] = `Bearer ${authToken.value}`;
  }
  return headers;
};

// Lifecycle
onMounted(async () => {
  // 1. Check user auth
  await checkAuth();

  // 2. Fetch available models
  try {
    const res = await fetch('/api/models');
    if (res.ok) {
      const data = await res.json();
      if (data.active?.model && data.active.provider !== 'fallback') {
        selectedModel.value = data.active.model;
      }
    }
  } catch {}

  // 3. Register global keyboard shortcut Ctrl+K / Cmd+K for New Chat
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      startNewChat();
    }
  });
});

const checkAuth = async () => {
  if (authToken.value) {
    try {
      const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          currentUser.value = data.user;
          await loadSessions();
          return;
        }
      }
    } catch {}
  }

  // If no auth token, auto-login with default demo account for instant ease of use
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: 'password123' })
    });
    if (res.ok) {
      const data = await res.json();
      authToken.value = data.token;
      localStorage.setItem('minimi_auth_token', data.token);
      currentUser.value = data.user;
      await loadSessions();
      return;
    }
  } catch {}

  // If failed, open modal
  isAuthModalOpen.value = true;
};

const onAuthSuccess = async ({ user, token }) => {
  currentUser.value = user;
  authToken.value = token;
  localStorage.setItem('minimi_auth_token', token);
  isAuthModalOpen.value = false;
  await loadSessions();
  // Select first session or start new chat
  if (sessions.value.length > 0) {
    await selectSession(sessions.value[0].id);
  } else {
    startNewChat();
  }
};

const handleLogout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch {}
  authToken.value = '';
  localStorage.removeItem('minimi_auth_token');
  localStorage.removeItem('minimi_active_session_id');
  currentUser.value = null;
  sessions.value = [];
  messages.value = [];
  activeSessionId.value = '';
  isAuthModalOpen.value = true;
};

// Session Management
const loadSessions = async () => {
  try {
    const res = await fetch('/api/sessions', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      sessions.value = data.sessions || [];

      const savedSessionId = localStorage.getItem('minimi_active_session_id');
      if (savedSessionId && sessions.value.some((s) => s.id === savedSessionId)) {
        if (activeSessionId.value !== savedSessionId) {
          await selectSession(savedSessionId);
        }
      } else if (!activeSessionId.value && sessions.value.length > 0) {
        await selectSession(sessions.value[0].id);
      }
    }
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
};

const selectSession = async (sessionId) => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    isProcessing.value = false;
  }

  activeSessionId.value = sessionId;
  localStorage.setItem('minimi_active_session_id', sessionId);
  try {
    const res = await fetch(`/api/sessions/${sessionId}/messages`, { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      messages.value = data.messages || [];
      scrollToBottom();
    }
  } catch (err) {
    console.error('Failed to load session messages:', err);
  }
};

const startNewChat = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    isProcessing.value = false;
  }
  const newId = `session_${Date.now()}`;
  activeSessionId.value = newId;
  localStorage.setItem('minimi_active_session_id', newId);
  messages.value = [];
};

const deleteSession = async (sessionId) => {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      sessions.value = sessions.value.filter((s) => s.id !== sessionId);
      if (activeSessionId.value === sessionId) {
        if (sessions.value.length > 0) {
          await selectSession(sessions.value[0].id);
        } else {
          startNewChat();
        }
      }
    }
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
};

const renameSession = async ({ sessionId, title }) => {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title })
    });
    if (res.ok) {
      const match = sessions.value.find((s) => s.id === sessionId);
      if (match) match.title = title;
    }
  } catch (err) {
    console.error('Failed to rename session:', err);
  }
};

const handleMemoryReset = async () => {
  await loadSessions();
  if (sessions.value.length > 0) {
    await selectSession(sessions.value[0].id);
  }
};

// Quick Samples
const quickSamples = [
  {
    title: 'CRM Shortlist Diff (Monday)',
    prompt: 'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?'
  },
  {
    title: '3 November Question Recall',
    prompt: 'What did I ask you on 3 November? Is your answer still correct today?'
  },
  {
    title: 'Postgres Hosting Pricing (Last Tuesday)',
    prompt: 'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?'
  },
  {
    title: 'Vector Databases (2 Weeks Ago)',
    prompt: 'Two weeks ago we compared vector databases for our RAG agent. Has Pinecone or Qdrant announced any new serverless pricing or hybrid search updates since?'
  }
];

const scrollToBottom = () => {
  nextTick(() => {
    if (chatList.value) {
      chatList.value.scrollTop = chatList.value.scrollHeight;
    }
  });
};

const handleEnter = (e) => {
  if (e.shiftKey) return;
  sendMessage();
};

const sendQuick = (prompt) => {
  inputPrompt.value = prompt;
  sendMessage();
};

const copyText = (text, index) => {
  navigator.clipboard.writeText(text);
  copiedIndex.value = index;
  setTimeout(() => { copiedIndex.value = null; }, 2000);
};

// Chat Orchestration
const sendMessage = async () => {
  const prompt = inputPrompt.value.trim();
  if (!prompt || isProcessing.value) return;

  if (!activeSessionId.value) {
    activeSessionId.value = `session_${Date.now()}`;
  }

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Add User Message
  messages.value.push({
    role: 'user',
    text: prompt,
    time: nowTime
  });

  inputPrompt.value = '';

  // 2. Prepare Agent Message placeholder
  const agentMsg = {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    text: '',
    scratchpad: [],
    citations: [],
    isStreaming: true, // Marked as streaming so citations DO NOT pop up early!
    time: nowTime
  };
  messages.value.push(agentMsg);
  currentAgentMessageIndex.value = messages.value.length - 1;

  isProcessing.value = true;
  scrollToBottom();

  try {
    if (eventSource) eventSource.close();

    const params = new URLSearchParams({
      prompt,
      session_id: activeSessionId.value,
      model: selectedModel.value,
      auto_pilot: String(autoPilot.value),
      token: authToken.value || '',
      user_id: currentUser.value?.id || 'default_user'
    });

    eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);

    eventSource.addEventListener('scratchpad', (e) => {
      try {
        const data = JSON.parse(e.data);
        const thought = data.content || data.type;
        if (thought) {
          agentMsg.scratchpad.push(thought);
          scrollToBottom();
        }
      } catch {}
    });

    eventSource.addEventListener('tool_approval_required', (e) => {
      try {
        const data = JSON.parse(e.data);
        messages.value.push({
          role: 'permission_request',
          toolName: data.toolName,
          serverName: data.serverName,
          payload: data.payload,
          approvalId: data.approvalId,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        scrollToBottom();
      } catch {}
    });

    eventSource.addEventListener('tool_approved', () => {
      agentMsg.scratchpad.push('Tool execution approved by user');
    });

    eventSource.addEventListener('llm_token', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.content) {
          agentMsg.text += data.content;
          scrollToBottom();
        }
      } catch {}
    });

    eventSource.addEventListener('citations', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.citations) {
          agentMsg.citations = data.citations;
        }
      } catch {}
    });

    eventSource.addEventListener('done', (e) => {
      isProcessing.value = false;
      // Mark streaming finished: Citations badge pops up AFTER text is loaded!
      agentMsg.isStreaming = false;
      if (eventSource) eventSource.close();
      scrollToBottom();
      localStorage.setItem('minimi_active_session_id', activeSessionId.value);
      // Reload sessions so sidebar reflects new chat title and updated timestamp
      loadSessions();
    });

    eventSource.addEventListener('agent_error', (e) => {
      try {
        const data = JSON.parse(e.data);
        agentMsg.text = `⚠️ **Error**: ${data.message || 'An error occurred during response synthesis.'}`;
      } catch {
        agentMsg.text = '⚠️ **Error**: An error occurred during response synthesis.';
      }
      isProcessing.value = false;
      agentMsg.isStreaming = false;
      if (eventSource) eventSource.close();
      scrollToBottom();
    });

    eventSource.addEventListener('error', (e) => {
      console.warn('SSE Error or stream end:', e);
      isProcessing.value = false;
      agentMsg.isStreaming = false;
      if (!agentMsg.text || !agentMsg.text.trim()) {
        agentMsg.text = '⚠️ **Connection Interrupted**: No response tokens were received. The upstream AI provider may have hit its rate limit or rejected the request. Please try again or switch model.';
      }
      if (eventSource) eventSource.close();
      scrollToBottom();
    });

  } catch (err) {
    console.error('Failed to initiate chat stream:', err);
    isProcessing.value = false;
    agentMsg.isStreaming = false;
    agentMsg.text = `⚠️ **Initialization Failed**: ${err && err.message ? err.message : 'Could not connect to the agent service.'}`;
  }
};

const handleToolApproval = async (data, index) => {
  try {
    await fetch('/api/tool/approve', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        approval_id: data.approvalId,
        approved: true,
        approval_type: data.approvalType,
        tool_name: data.toolName
      })
    });
    messages.value.splice(index, 1);
  } catch (err) {
    console.error('Approval failed:', err);
  }
};

const handleToolDenial = async (data, index) => {
  try {
    await fetch('/api/tool/approve', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        approval_id: data.approvalId,
        approved: false,
        tool_name: data.toolName
      })
    });
    messages.value.splice(index, 1);
  } catch (err) {
    console.error('Denial failed:', err);
  }
};
</script>
