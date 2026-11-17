<template>
  <div class="chat-container flex h-full w-full relative bg-slate-50 dark:bg-black text-slate-800 dark:text-neutral-100 overflow-hidden">
    
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
      <header class="h-14 bg-gradient-to-b from-slate-50 via-slate-50/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent backdrop-blur-xs px-4 md:px-6 flex items-center justify-between z-20 flex-shrink-0">
        <div class="flex items-center gap-3">
          <!-- Sidebar Toggle Button -->
          <button 
            @click="isSidebarOpen = !isSidebarOpen"
            class="p-1.5 rounded-lg text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
            title="Toggle chat history sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>

          <!-- Current Chat Title -->
          <div class="min-w-0 flex items-center">
            <h1 class="text-sm font-semibold text-slate-900 dark:text-white tracking-tight truncate max-w-[200px] md:max-w-md">
              {{ currentSessionTitle }}
            </h1>
          </div>
        </div>

        <!-- Right Header Actions: Benchmark Suite Drawer Toggle -->
        <div class="flex items-center gap-2">
          <button 
            @click="showBenchmark = !showBenchmark"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border shadow-2xs"
            :class="showBenchmark ? 'bg-[#4c4c4c] border-[#3d3d3d] text-white shadow-xs' : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-850'"
            title="Toggle Benchmark Suite"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <span class="hidden sm:inline">Benchmarks</span>
          </button>
        </div>
      </header>

      <!-- Main Messages View & Side Benchmark Drawer -->
      <div class="flex-1 flex overflow-hidden relative">
        
        <!-- Messages Area -->
        <main class="flex-1 flex flex-col justify-between overflow-hidden relative bg-slate-50/50 dark:bg-black">
          <!-- Soft Top Fade Overlay for smooth message scrolling -->
          <div class="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-slate-50/50 dark:from-black/50 to-transparent z-10"></div>
          
          <div 
            ref="chatList" 
            class="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 styled-scrollbar"
          >
            <!-- Centered Landing View if No Messages in Session -->
            <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-4">
              <div class="w-10 h-10 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 flex items-center justify-center text-[#4c4c4c] dark:text-neutral-300 shadow-2xs mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <h2 class="text-base font-semibold text-slate-900 dark:text-white mb-1">Chat Agent</h2>
              <p class="text-xs text-slate-500 dark:text-neutral-400 mb-6 max-w-md">
                Multi-tenant temporal memory recall with verified live search & tool governance.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
                <button 
                  v-for="(sample, idx) in quickSamples" 
                  :key="idx"
                  @click="sendQuick(sample.prompt)"
                  class="p-3 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:bg-slate-100/70 dark:hover:bg-neutral-900 hover:border-slate-300 dark:hover:border-neutral-700 text-xs text-slate-700 dark:text-neutral-300 transition-all text-left group shadow-2xs"
                >
                  <div class="font-medium text-slate-900 dark:text-white group-hover:text-[#4c4c4c] dark:group-hover:text-neutral-200 mb-1 flex items-center justify-between">
                    <span>{{ sample.title }}</span>
                    <span class="text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300">↗</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2">{{ sample.prompt }}</p>
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
                  
                  <!-- Message Bubble Card (Unified card for reasoning trace + message text) -->
                  <div 
                    class="message-bubble rounded-2xl px-5 py-4 text-sm leading-relaxed max-w-full shadow-2xs transition-all"
                    :class="msg.role === 'user' ? 'bg-[#4c4c4c] text-white rounded-tr-none ml-12' : 'bg-white border border-slate-200/90 text-slate-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100 rounded-tl-none w-full'"
                  >
                    <!-- Agent Thoughts / Reasoning Trace (Seamlessly merged inside the bubble) -->
                    <div v-if="msg.role === 'assistant' && msg.scratchpad && msg.scratchpad.length > 0">
                      <Scratchpad 
                        :scratchpad="msg.scratchpad" 
                        :isProcessing="Boolean(msg.isStreaming)"
                        :hasResponseText="Boolean(msg.text)"
                        :durationMs="msg.durationMs"
                        :startTime="msg.startTime"
                      />
                    </div>

                    <!-- Markdown rendered response: Only visible when response tokens exist (No badge placeholder) -->
                    <div 
                      v-if="msg.role === 'assistant' && msg.text" 
                      class="markdown-body prose prose-slate dark:prose-invert prose-sm max-w-none text-slate-800 dark:text-neutral-100"
                    >
                      <div v-html="renderMarkdown(msg.text, msg.citations)"></div>
                      <span v-if="msg.isStreaming" class="inline-block w-1.5 h-3.5 ml-0.5 bg-[#4c4c4c] dark:bg-neutral-300 animate-pulse rounded-xs align-middle"></span>
                    </div>

                    <!-- User plain text -->
                    <div v-else-if="msg.role === 'user'">{{ msg.text }}</div>

                  </div>

                  <!-- Action Toolbar (Timing & Copy Button) -->
                  <div 
                    v-if="msg.time || msg.text" 
                    class="flex items-center gap-2 mt-1.5 px-1 text-[11px] text-slate-400 dark:text-neutral-500 font-mono select-none"
                    :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
                  >
                    <span v-if="msg.time">{{ msg.time }}</span>
                    <template v-if="msg.text">
                      <span v-if="msg.time">•</span>
                      <button 
                        @click="copyText(msg.text, index)" 
                        class="inline-flex items-center gap-1 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
                        :title="copiedIndex === index ? 'Copied to clipboard' : 'Copy message'"
                      >
                        <svg v-if="copiedIndex !== index" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>{{ copiedIndex === index ? 'Copied' : 'Copy' }}</span>
                      </button>
                    </template>
                  </div>

                </div>
              </div>
            </div>
          </div>

          <!-- Floating Chat Input Area (matching modern agent UI) -->
          <div class="px-3 sm:px-6 pb-6 pt-2 bg-gradient-to-t from-slate-100/90 via-slate-50/70 to-transparent dark:from-black/95 dark:via-black/70 dark:to-transparent z-20 flex-shrink-0">
            <div class="max-w-3xl mx-auto relative">

              <!-- Floating Jump to Latest Button (Centered directly above the chat bar) -->
              <transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 translate-y-2 scale-95"
                enter-to-class="opacity-100 translate-y-0 scale-100"
                leave-active-class="transition-all duration-150 ease-in"
                leave-from-class="opacity-100 translate-y-0 scale-100"
                leave-to-class="opacity-0 translate-y-2 scale-95"
              >
                <button
                  v-if="!isFollowing && (hasUnseen || !isAtBottom)"
                  @click="handleJumpToLatest"
                  class="absolute -top-11 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#4c4c4c] hover:bg-[#3d3d3d] active:scale-95 text-white text-xs font-medium shadow-md hover:shadow-lg transition-all border border-neutral-600/40 backdrop-blur cursor-pointer whitespace-nowrap"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                  </svg>
                  <span>{{ hasUnseen ? 'New updates below' : 'Jump to latest' }}</span>
                  <span v-if="hasUnseen" class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                </button>
              </transition>

              <div class="relative bg-white dark:bg-neutral-900 border border-slate-200/90 dark:border-neutral-800 rounded-[28px] shadow-[0_10px_35px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] focus-within:border-slate-300 dark:focus-within:border-neutral-700 transition-all p-3 px-4 sm:px-5">
              
              <!-- Textarea with modern placeholder -->
              <textarea 
                ref="promptTextarea"
                v-model="inputPrompt" 
                @keydown.ctrl.enter.prevent="sendMessage"
                @keydown.exact.enter.prevent="handleEnter"
                placeholder="Ask anything, @ to mention, / for actions"
                class="w-full bg-transparent text-[15px] sm:text-base text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none resize-none px-1 py-1 min-h-[46px] max-h-36 leading-relaxed selection:bg-neutral-200 dark:selection:bg-neutral-700"
                rows="1"
                :disabled="isProcessing"
              ></textarea>

              <!-- Bottom Controls Toolbar -->
              <div class="flex items-center justify-between pt-1.5 gap-2">
                
                <!-- Left: Model Dropdown -->
                <div class="flex items-center gap-1 sm:gap-1.5">
                  <!-- Model Selector Dropdown Button (matching image) -->
                  <div class="relative" ref="modelDropdownRef">
                    <button 
                      @click.stop="isModelMenuOpen = !isModelMenuOpen" 
                      type="button"
                      :disabled="isProcessing"
                      class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors select-none cursor-pointer"
                    >
                      <span class="font-medium text-slate-800 dark:text-neutral-100">{{ currentModelInfo.name }}</span>
                      <span v-if="currentModelInfo.tier" class="text-slate-400 dark:text-neutral-500 font-normal">{{ currentModelInfo.tier }}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': isModelMenuOpen }">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    <!-- Floating Model Menu -->
                    <transition
                      enter-active-class="transition duration-150 ease-out"
                      enter-from-class="opacity-0 translate-y-2 scale-95"
                      enter-to-class="opacity-100 translate-y-0 scale-100"
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="opacity-100 translate-y-0 scale-100"
                      leave-to-class="opacity-0 translate-y-2 scale-95"
                    >
                      <div 
                        v-if="isModelMenuOpen" 
                        class="absolute bottom-full mb-3 left-0 z-50 w-72 max-h-80 overflow-y-auto styled-scrollbar bg-white/95 dark:bg-neutral-900/95 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 backdrop-blur-xl"
                      >
                        <div class="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          AI Model
                        </div>
                        <div class="space-y-0.5">
                          <button 
                            v-for="model in availableModels" 
                            :key="model.id"
                            @click="selectModel(model.id)"
                            class="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer"
                            :class="selectedModel === model.id ? 'bg-slate-100 dark:bg-neutral-800/90 text-slate-900 dark:text-white font-medium' : 'text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800/60'"
                          >
                            <div class="min-w-0 pr-2">
                              <div class="flex items-center gap-1.5 truncate">
                                <span>{{ model.name }}</span>
                                <span v-if="model.tier" class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400">{{ model.tier }}</span>
                              </div>
                              <div class="text-[10px] text-slate-400 dark:text-neutral-500 truncate mt-0.5">{{ model.description }}</div>
                            </div>
                            <svg v-if="selectedModel === model.id" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#4c4c4c] dark:text-neutral-200 flex-shrink-0">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </transition>
                  </div>

                </div>

                <!-- Right: Governance Mode, Voice Mic & Send/Sparkle Button -->
                <div class="flex items-center gap-1.5 sm:gap-2">
                  
                  <!-- Governance Mode Selector Dropdown (Shield/Zap icon + Turbo/Supervised ⌵) -->
                  <div class="relative" ref="modeDropdownRef">
                    <button 
                      @click.stop="isModeMenuOpen = !isModeMenuOpen" 
                      type="button"
                      :disabled="isProcessing"
                      class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors select-none cursor-pointer"
                    >
                      <svg v-if="autoPilot" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-600 dark:text-neutral-400">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-600 dark:text-neutral-400">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                      <span class="font-medium">{{ autoPilot ? 'Turbo' : 'Supervised' }}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': isModeMenuOpen }">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    <!-- Floating Mode Menu -->
                    <transition
                      enter-active-class="transition duration-150 ease-out"
                      enter-from-class="opacity-0 translate-y-2 scale-95"
                      enter-to-class="opacity-100 translate-y-0 scale-100"
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="opacity-100 translate-y-0 scale-100"
                      leave-to-class="opacity-0 translate-y-2 scale-95"
                    >
                      <div 
                        v-if="isModeMenuOpen" 
                        class="absolute bottom-full mb-3 right-0 z-50 w-64 bg-white/95 dark:bg-neutral-900/95 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-xl p-1.5 backdrop-blur-xl"
                      >
                        <div class="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          Execution Mode
                        </div>
                        <div class="space-y-0.5">
                          <button 
                            @click="autoPilot = true; isModeMenuOpen = false"
                            class="w-full flex items-start justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer"
                            :class="autoPilot ? 'bg-slate-100 dark:bg-neutral-800/90 text-slate-900 dark:text-white font-medium' : 'text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800/60'"
                          >
                            <div>
                              <div class="font-medium flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500 dark:text-neutral-400">
                                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                </svg>
                                <span>Turbo (Auto-Pilot)</span>
                              </div>
                              <div class="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">Auto-executes safe tools in background</div>
                            </div>
                            <svg v-if="autoPilot" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#4c4c4c] dark:text-neutral-200 pt-0.5">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>

                          <button 
                            @click="autoPilot = false; isModeMenuOpen = false"
                            class="w-full flex items-start justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer"
                            :class="!autoPilot ? 'bg-slate-100 dark:bg-neutral-800/90 text-slate-900 dark:text-white font-medium' : 'text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800/60'"
                          >
                            <div>
                              <div class="font-medium flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500 dark:text-neutral-400">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                                <span>Supervised</span>
                              </div>
                              <div class="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">Prompts for human approval before tools</div>
                            </div>
                            <svg v-if="!autoPilot" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#4c4c4c] dark:text-neutral-200 pt-0.5">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </transition>
                  </div>

                  <!-- When Processing: Terminate / Stop Button -->
                  <button 
                    v-if="isProcessing"
                    @click="terminateAgent" 
                    class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900 hover:bg-rose-600 dark:bg-white dark:hover:bg-rose-500 text-white dark:text-black dark:hover:text-white flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm flex-shrink-0 cursor-pointer"
                    title="Stop generating"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="5" y="5" width="14" height="14" rx="2"></rect>
                    </svg>
                  </button>

                  <!-- When Idle: Circular Send Button -->
                  <button 
                    v-else
                    @click="sendMessage" 
                    :disabled="!inputPrompt.trim()"
                    class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-black flex items-center justify-center transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-sm flex-shrink-0 cursor-pointer"
                    title="Send message"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                  </button>

                </div>

              </div>
            </div>
            </div>
          </div>
        </main>

        <!-- Benchmark Drawer (Collapsible Right Panel) -->
        <aside 
          v-if="showBenchmark" 
          class="w-80 border-l border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 overflow-y-auto styled-scrollbar z-30 transition-all flex-shrink-0"
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import Sidebar from './Sidebar.vue';
import AuthModal from './AuthModal.vue';
import ToolPermissionMessage from './ToolPermissionMessage.vue';
import Scratchpad from './Scratchpad.vue';
import BenchmarkDrawer from './BenchmarkDrawer.vue';
import { createStickToBottom } from '../ui/stick-to-bottom';
import { fitContent } from '../ui/textarea';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

const renderMarkdown = (text, citations = []) => {
  if (!text) return '';
  try {
    const raw = String(text);
    const html = md.render(raw);
    if (!citations || citations.length === 0) {
      return html;
    }

    const citeMap = new Map();
    for (const c of citations) {
      if (c && c.index !== undefined) {
        citeMap.set(Number(c.index), c);
      }
    }

    // Replace [1], [2], [1, 2] etc. with interactive website badges outside of code blocks
    return html.replace(
      /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)|\[(\d+(?:\s*,\s*\d+)*)\]/gi,
      (match, tag, numsStr) => {
        if (tag || !numsStr) return match;
        const nums = numsStr
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));

        const badges = nums.map((num) => {
          const cite = citeMap.get(num);
          if (!cite) return `[${num}]`;

          const domain = (cite.domain || 'web').replace(/^www\./, '');
          const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
          const titleAttr = (cite.title || domain).replace(/"/g, '&quot;');
          const safeUrl = cite.url ? cite.url.replace(/"/g, '&quot;') : '#';

          return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${titleAttr}" class="inline-cite-badge not-prose" onclick="event.stopPropagation()"><img src="${faviconUrl}" alt="" class="cite-favicon" loading="lazy" onerror="this.style.display='none'" /><span class="cite-site">${domain}</span></a>`;
        });

        return badges.join('');
      }
    );
  } catch (err) {
    console.warn('renderMarkdown error:', err);
    return String(text);
  }
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
const selectedModel = ref('gemini-3.5-flash');
const currentAgentMessageIndex = ref(-1);
const copiedIndex = ref(null);
const chatList = ref(null);
const promptTextarea = ref(null);
const isFollowing = ref(true);
const isAtBottom = ref(true);
const hasUnseen = ref(false);
let stickInstance = null;
let unbindTextareaFit = null;
let eventSource = null;

// Floating Dropdown Menus & Dictation State
const isModelMenuOpen = ref(false);
const isModeMenuOpen = ref(false);
const isPlusMenuOpen = ref(false);
const modelDropdownRef = ref(null);
const modeDropdownRef = ref(null);
const plusDropdownRef = ref(null);
const isListening = ref(false);
let recognitionInstance = null;

const availableModels = ref([
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', tier: 'Fast', provider: 'Google', description: 'Recommended • Fast sub-2s streaming & accurate recall' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tier: 'Instant', provider: 'Google', description: 'Lowest latency • Sub-second TTFT streaming' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tier: 'Reasoning', provider: 'Google', description: 'Deep reasoning & multithreaded analysis' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'Flash', provider: 'Google', description: 'Google AI Studio standard model' },
  { id: 'gpt-4o', name: 'GPT-4o', tier: 'Reasoning', provider: 'OpenAI', description: 'Deep reasoning & instruction following' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tier: 'Fast', provider: 'OpenAI', description: 'Lightweight & cost-efficient' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', tier: 'Smart', provider: 'Anthropic', description: 'State-of-the-art coding and nuanced recall' },
  { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', tier: 'Fast', provider: 'Anthropic', description: 'High-speed Anthropic model' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tier: 'Groq', provider: 'Groq', description: 'High-throughput open weights inference' },
]);

const currentModelInfo = computed(() => {
  const match = availableModels.value.find(m => m.id === selectedModel.value);
  if (match) return match;
  return { id: selectedModel.value, name: 'Gemini 3.5 Flash', tier: 'Fast', provider: 'Google' };
});

const selectModel = (id) => {
  selectedModel.value = id;
  isModelMenuOpen.value = false;
};

const insertAction = (text) => {
  inputPrompt.value = text;
  isPlusMenuOpen.value = false;
  nextTick(() => {
    promptTextarea.value?.focus();
  });
};

const toggleSpeechRecognition = () => {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert('Voice dictation (Web Speech API) is not supported in this browser. Please use Chrome, Edge, or Safari.');
    return;
  }

  if (isListening.value) {
    if (recognitionInstance) {
      recognitionInstance.stop();
    }
    isListening.value = false;
    return;
  }

  try {
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      isListening.value = true;
    };

    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((result) => result[0].transcript)
        .join('');
      inputPrompt.value = transcript;
    };

    rec.onerror = () => {
      isListening.value = false;
    };

    rec.onend = () => {
      isListening.value = false;
    };

    rec.start();
    recognitionInstance = rec;
  } catch (err) {
    console.warn('Speech recognition start failed:', err);
    isListening.value = false;
  }
};

const handleGlobalClick = (e) => {
  const target = e.target;
  if (modelDropdownRef.value && !modelDropdownRef.value.contains(target)) {
    isModelMenuOpen.value = false;
  }
  if (modeDropdownRef.value && !modeDropdownRef.value.contains(target)) {
    isModeMenuOpen.value = false;
  }
  if (plusDropdownRef.value && !plusDropdownRef.value.contains(target)) {
    isPlusMenuOpen.value = false;
  }
};

const handleGlobalKeydown = (e) => {
  if (e.key === 'Escape') {
    isModelMenuOpen.value = false;
    isModeMenuOpen.value = false;
    isPlusMenuOpen.value = false;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    startNewChat();
  }
};

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
  // Initialize UI SDK StickToBottom for intelligent scroll following & jitter prevention
  if (chatList.value) {
    stickInstance = createStickToBottom({
      threshold: 36,
      initial: true,
      onChange: (state) => {
        isFollowing.value = state.following;
        isAtBottom.value = state.atBottom;
        hasUnseen.value = state.unseen;
      }
    });
    stickInstance.connect(chatList.value);
  }

  // Initialize UI SDK auto-resizing textarea behavior
  if (promptTextarea.value) {
    unbindTextareaFit = fitContent(promptTextarea.value);
  }

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

  // 3. Register global event listeners for click-outside dismissal and shortcuts
  window.addEventListener('click', handleGlobalClick);
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  if (unbindTextareaFit) {
    unbindTextareaFit();
  }
  if (recognitionInstance) {
    try { recognitionInstance.stop(); } catch {}
  }
  window.removeEventListener('click', handleGlobalClick);
  window.removeEventListener('keydown', handleGlobalKeydown);
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

const scrollToBottom = (options = {}) => {
  nextTick(() => {
    if (stickInstance) {
      stickInstance.scrollToBottom(options);
    } else if (chatList.value) {
      chatList.value.scrollTop = chatList.value.scrollHeight;
    }
  });
};

const handleJumpToLatest = () => {
  scrollToBottom({ behavior: 'smooth' });
};

const handleEnter = (e) => {
  if (e.shiftKey || e.isComposing) return;
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
  const nowMs = Date.now();
  const agentMsg = reactive({
    id: `msg_${nowMs}`,
    role: 'assistant',
    text: '',
    scratchpad: ['Reviewing context and notes...'],
    citations: [],
    startTime: nowMs,
    durationMs: null,
    isStreaming: true, // Marked as streaming so citations DO NOT pop up early!
    time: nowTime
  });
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
          if (agentMsg.scratchpad.length === 1 && agentMsg.scratchpad[0] === thought) {
            return;
          }
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

    // Robust token ingestion: handles object ({ content, token, text, delta }), JSON string, or raw token text
    const appendToken = (raw) => {
      if (raw === undefined || raw === null) return;
      let token = '';
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'string') {
            token = parsed;
          } else if (parsed && typeof parsed === 'object') {
            token = parsed.content ?? parsed.token ?? parsed.text ?? parsed.delta ?? '';
          }
        } catch {
          token = raw;
        }
      } else if (typeof raw === 'object') {
        token = raw.content ?? raw.token ?? raw.text ?? raw.delta ?? '';
      }

      if (token) {
        agentMsg.text += token;
        const curIdx = currentAgentMessageIndex.value;
        if (curIdx >= 0 && messages.value[curIdx] && messages.value[curIdx] !== agentMsg) {
          messages.value[curIdx].text = agentMsg.text;
        }
        scrollToBottom();
      }
    };

    eventSource.addEventListener('llm_token', (e) => appendToken(e.data));
    eventSource.addEventListener('token', (e) => appendToken(e.data));
    eventSource.onmessage = (e) => appendToken(e.data);

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
      try {
        const data = JSON.parse(e.data);
        agentMsg.durationMs = data.durationMs || (Date.now() - agentMsg.startTime);
      } catch {
        agentMsg.durationMs = Date.now() - agentMsg.startTime;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      scrollToBottom();
      localStorage.setItem('minimi_active_session_id', activeSessionId.value);
      // Reload sessions so sidebar reflects new chat title and updated timestamp
      loadSessions();
    });

    eventSource.addEventListener('agent_terminated', (e) => {
      isProcessing.value = false;
      agentMsg.isStreaming = false;
      agentMsg.durationMs = Date.now() - agentMsg.startTime;
      if (!agentMsg.text) {
        agentMsg.text = '*Agent execution terminated by user.*';
      } else if (!agentMsg.text.includes('terminated')) {
        agentMsg.text += '\n\n*(Agent execution terminated by user)*';
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      scrollToBottom();
    });

    eventSource.addEventListener('agent_error', (e) => {
      try {
        const data = JSON.parse(e.data);
        agentMsg.text = `**Error**: ${data.message || 'An error occurred during response synthesis.'}`;
      } catch {
        agentMsg.text = '**Error**: An error occurred during response synthesis.';
      }
      isProcessing.value = false;
      agentMsg.isStreaming = false;
      agentMsg.durationMs = Date.now() - agentMsg.startTime;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      scrollToBottom();
    });

    eventSource.addEventListener('error', (e) => {
      if (!eventSource || !isProcessing.value) return;
      console.warn('SSE Error or stream end:', e);
      isProcessing.value = false;
      agentMsg.isStreaming = false;
      if (!agentMsg.text || !agentMsg.text.trim()) {
        agentMsg.text = '**Connection Interrupted**: No response tokens were received. The upstream AI provider may have hit its rate limit or rejected the request. Please try again or switch model.';
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      scrollToBottom();
    });

  } catch (err) {
    console.error('Failed to initiate chat stream:', err);
    isProcessing.value = false;
    agentMsg.isStreaming = false;
    agentMsg.text = `**Initialization Failed**: ${err && err.message ? err.message : 'Could not connect to the agent service.'}`;
  }
};

const handleToolApproval = async (data, index) => {
  try {
    const approvalId = data.approvalId || data.approval_id;
    const toolName = data.toolName || data.tool_name || 'web_search';
    let approvalType = data.approvalType || data.approval_type || 'once';
    if (approvalType === 'permanent') approvalType = 'always';
    if (approvalType === 'one_time') approvalType = 'once';

    const res = await fetch('/api/tool/approve', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        approval_id: approvalId,
        approvalId: approvalId,
        approved: true,
        approval_type: approvalType,
        approvalType: approvalType,
        tool_name: toolName,
        toolName: toolName,
        user_id: currentUser.value?.id || 'default_user'
      })
    });
    if (res.ok) {
      messages.value.splice(index, 1);
    } else {
      console.error('Approval failed:', await res.text());
    }
  } catch (err) {
    console.error('Approval failed:', err);
  }
};

const handleToolDenial = async (data, index) => {
  try {
    const approvalId = data.approvalId || data.approval_id;
    const toolName = data.toolName || data.tool_name || 'web_search';

    const res = await fetch('/api/tool/approve', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        approval_id: approvalId,
        approvalId: approvalId,
        approved: false,
        approval_type: 'deny',
        approvalType: 'deny',
        tool_name: toolName,
        toolName: toolName,
        user_id: currentUser.value?.id || 'default_user'
      })
    });
    if (res.ok) {
      messages.value.splice(index, 1);
    } else {
      console.error('Denial failed:', await res.text());
    }
  } catch (err) {
    console.error('Denial failed:', err);
  }
};
const terminateAgent = async () => {
  if (!activeSessionId.value) return;
  try {
    await fetch('/api/chat/terminate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ session_id: activeSessionId.value, reason: 'user_terminated' })
    });
  } catch (err) {
    console.error('Failed to terminate agent:', err);
  } finally {
    isProcessing.value = false;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    const curIdx = currentAgentMessageIndex.value;
    if (curIdx >= 0 && messages.value[curIdx]) {
      messages.value[curIdx].isStreaming = false;
      if (!messages.value[curIdx].text) {
        messages.value[curIdx].text = '⏹ *Agent execution terminated by user.*';
      } else if (!messages.value[curIdx].text.includes('terminated')) {
        messages.value[curIdx].text += '\n\n*(Agent execution terminated by user)*';
      }
    }
  }
};
</script>
