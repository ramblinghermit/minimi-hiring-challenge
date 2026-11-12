<template>
  <div class="chat-container flex flex-col h-full w-full relative">
    
    <!-- Top Header Bar -->
    <header class="h-14 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur px-6 flex items-center justify-between z-20 flex-shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
          M
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-bold text-neutral-100 tracking-tight">minimi</h1>
            <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">Search Agent</span>
          </div>
          <p class="text-[10px] text-neutral-400">Ambient Brain-Vault Memory × AgentBridge Governance</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Model Selector -->
        <select 
          v-model="selectedModel" 
          :disabled="isProcessing"
          class="bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 transition-colors"
        >
          <option value="gpt-4o-mini">OpenAI: GPT-4o Mini</option>
          <option value="gpt-4o">OpenAI: GPT-4o</option>
          <option value="claude-3-5-haiku-latest">Anthropic: Claude 3.5 Haiku</option>
          <option value="claude-3-5-sonnet-latest">Anthropic: Claude 3.5 Sonnet</option>
          <option value="gemini-2.0-flash">Google: Gemini 2.0 Flash</option>
          <option value="llama-3.3-70b-versatile">Groq: Llama 3.3 70B</option>
        </select>

        <!-- Benchmark Drawer Toggle -->
        <button 
          @click="showBenchmark = !showBenchmark"
          class="text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-medium"
          :class="showBenchmark ? 'bg-sky-600 border-sky-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'"
        >
          <span>🧪 Benchmark Suite</span>
        </button>
      </div>
    </header>

    <!-- Main Content Area: Messages & Side Benchmark Drawer -->
    <div class="flex-1 flex overflow-hidden relative">
      
      <!-- Messages List -->
      <main class="flex-1 flex flex-col justify-between overflow-hidden relative">
        <div 
          ref="chatList" 
          class="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 styled-scrollbar"
        >
          <!-- Centered Landing View if No Messages -->
          <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-purple-500/20 border border-sky-500/30 flex items-center justify-center text-2xl shadow-inner mb-4">
              ✨
            </div>
            <h2 class="text-xl font-bold text-neutral-100 mb-1">State-of-the-Art Web Search Chat Agent</h2>
            <p class="text-xs text-neutral-400 mb-6">
              Equipped with <span class="text-purple-400 font-medium">Brain-Vault Episodic Memory</span> for temporal recall & <span class="text-sky-400 font-medium">AgentBridge Governance</span> for tool execution permissions.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              <button 
                v-for="(sample, idx) in quickSamples" 
                :key="idx"
                @click="sendQuick(sample.prompt)"
                class="p-3 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/80 hover:border-neutral-700 text-xs text-neutral-300 transition-all text-left group"
              >
                <div class="font-medium text-neutral-200 group-hover:text-sky-400 mb-1 flex items-center justify-between">
                  <span>{{ sample.title }}</span>
                  <span class="text-neutral-500 group-hover:text-neutral-300">↗</span>
                </div>
                <p class="text-[11px] text-neutral-500 line-clamp-2">{{ sample.prompt }}</p>
              </button>
            </div>
          </div>

          <!-- Messages Stream -->
          <div v-else class="max-w-3xl mx-auto space-y-6 w-full pb-8">
            <div 
              v-for="(msg, index) in messages" 
              :key="index" 
              class="message-row flex flex-col"
              :class="msg.role === 'user' ? 'items-end' : 'items-start'"
            >
              <!-- Role label & timestamp -->
              <div class="flex items-center gap-2 mb-1.5 px-1 text-[11px] text-neutral-500">
                <span class="font-semibold uppercase tracking-wider" :class="msg.role === 'user' ? 'text-sky-400' : 'text-purple-400'">
                  {{ msg.role === 'user' ? 'You' : 'Minimi' }}
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
                
                <!-- Agent Thoughts / Scratchpad (AgentBridge Accordion) -->
                <div v-if="msg.role === 'assistant' && msg.scratchpad && msg.scratchpad.length > 0" class="w-full">
                  <Scratchpad 
                    :scratchpad="msg.scratchpad" 
                    :isOpen="isProcessing && index === currentAgentMessageIndex"
                    :isProcessing="isProcessing && index === currentAgentMessageIndex"
                  />
                </div>

                <!-- Message Bubble Text -->
                <div 
                  class="message-bubble rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-full"
                  :class="msg.role === 'user' ? 'bg-sky-600 text-white rounded-tr-sm ml-12' : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-sm w-full'"
                >
                  <div 
                    v-if="msg.role === 'assistant' && msg.text" 
                    class="markdown-body prose prose-invert prose-sm max-w-none"
                    v-html="renderMarkdown(msg.text)"
                  ></div>

                  <!-- Typing indicator -->
                  <div v-else-if="isProcessing && index === currentAgentMessageIndex && !msg.text" class="flex items-center gap-1.5 py-1">
                    <span class="w-2 h-2 rounded-full bg-sky-400 animate-bounce"></span>
                    <span class="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]"></span>
                    <span class="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]"></span>
                  </div>

                  <div v-else>{{ msg.text }}</div>

                  <!-- Citations Badge Card -->
                  <div v-if="msg.citations && msg.citations.length > 0">
                    <CitationBadge :citations="msg.citations" />
                  </div>
                </div>

                <!-- Actions (Copy, etc.) -->
                <div v-if="msg.text" class="flex items-center gap-2 mt-1.5 px-1 text-[11px] text-neutral-500">
                  <button @click="copyText(msg.text, index)" class="hover:text-neutral-300 transition-colors">
                    {{ copiedIndex === index ? '✓ Copied' : 'Copy' }}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- Input Area (AgentBridge Bottom Bar) -->
        <div class="p-4 border-t border-neutral-800/80 bg-neutral-950/80 backdrop-blur z-10 flex-shrink-0">
          <div class="max-w-3xl mx-auto relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl focus-within:border-sky-500/60 transition-colors p-2.5">
            <textarea 
              v-model="inputPrompt" 
              @keydown.ctrl.enter.prevent="sendMessage"
              @keydown.exact.enter.prevent="handleEnter"
              placeholder="Ask Minimi anything (searches live web with Brain-Vault memory)... [Enter or Ctrl+Enter to send]"
              class="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none resize-none px-2 py-1 max-h-32 min-h-[48px]"
              rows="2"
              :disabled="isProcessing"
            ></textarea>

            <div class="flex items-center justify-between pt-2 px-1 border-t border-neutral-800/40">
              <div class="flex items-center gap-2 text-xs text-neutral-500">
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full" :class="autoPilot ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                  {{ autoPilot ? 'Auto-Pilot Mode' : 'Supervised Mode' }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <button 
                  @click="sendMessage" 
                  :disabled="!inputPrompt.trim() || isProcessing"
                  class="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>{{ isProcessing ? 'Thinking...' : 'Send' }}</span>
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
        />
      </aside>

    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
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

const inputPrompt = ref('');
const isProcessing = ref(false);
const showBenchmark = ref(true);
const autoPilot = ref(true);
const selectedModel = ref('gpt-4o-mini');
const messages = ref([]);
const currentAgentMessageIndex = ref(-1);
const copiedIndex = ref(null);
const chatList = ref(null);
let eventSource = null;

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
    title: 'Live Web Search',
    prompt: 'What are the biggest developer features shipped in Next.js 16?'
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

const sendMessage = async () => {
  const prompt = inputPrompt.value.trim();
  if (!prompt || isProcessing.value) return;

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Add User Message
  messages.value.push({
    role: 'user',
    text: prompt,
    time: nowTime
  });

  inputPrompt.value = '';

  // 2. Prepare Agent Message placeholder
  currentAgentMessageIndex.value = messages.value.length;
  messages.value.push({
    role: 'assistant',
    text: '',
    scratchpad: [],
    citations: [],
    time: nowTime
  });

  isProcessing.value = true;
  scrollToBottom();

  try {
    if (eventSource) eventSource.close();

    const params = new URLSearchParams({
      prompt,
      model: selectedModel.value,
      auto_pilot: String(autoPilot.value)
    });

    eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);

    eventSource.addEventListener('scratchpad', (e) => {
      try {
        const data = JSON.parse(e.data);
        const thought = data.content || data.type;
        const currentMsg = messages.value[currentAgentMessageIndex.value];
        if (currentMsg && thought) {
          currentMsg.scratchpad.push(thought);
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

    eventSource.addEventListener('tool_approved', (e) => {
      const currentMsg = messages.value[currentAgentMessageIndex.value];
      if (currentMsg) {
        currentMsg.scratchpad.push('Tool execution approved by user');
      }
    });

    eventSource.addEventListener('llm_token', (e) => {
      try {
        const data = JSON.parse(e.data);
        const currentMsg = messages.value[currentAgentMessageIndex.value];
        if (currentMsg && data.content) {
          currentMsg.text += data.content;
          scrollToBottom();
        }
      } catch {}
    });

    eventSource.addEventListener('citations', (e) => {
      try {
        const data = JSON.parse(e.data);
        const currentMsg = messages.value[currentAgentMessageIndex.value];
        if (currentMsg && data.citations) {
          currentMsg.citations = data.citations;
          scrollToBottom();
        }
      } catch {}
    });

    eventSource.addEventListener('done', () => {
      isProcessing.value = false;
      if (eventSource) eventSource.close();
      scrollToBottom();
    });

    eventSource.addEventListener('error', (e) => {
      console.error('SSE Error:', e);
      isProcessing.value = false;
      if (eventSource) eventSource.close();
    });

  } catch (err) {
    console.error('Failed to initiate chat stream:', err);
    isProcessing.value = false;
  }
};

const handleToolApproval = async (data, index) => {
  try {
    await fetch('/api/tool/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval_id: data.approvalId,
        approved: true,
        approval_type: data.approvalType,
        tool_name: data.toolName
      })
    });
    // Remove permission card once handled
    messages.value.splice(index, 1);
  } catch (err) {
    console.error('Approval failed:', err);
  }
};

const handleToolDenial = async (data, index) => {
  try {
    await fetch('/api/tool/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval_id: data.approvalId,
        approved: false,
        tool_name: data.toolName
      })
    });
    // Remove permission card once handled
    messages.value.splice(index, 1);
  } catch (err) {
    console.error('Denial failed:', err);
  }
};
</script>
