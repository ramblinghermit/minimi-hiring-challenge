/**
 * Core Domain Types
 * Minimi Web Search Agent with Brain-Vault Memory & AgentBridge Governance
 */

// ==========================================
// Brain-Vault Memory Types
// ==========================================

export type BrainVaultView = 'episodic' | 'state' | 'semantic' | 'auto';

export interface MemoryEntry {
  id: string;
  userId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string; // ISO 8601 string
  metadata?: {
    entities?: string[];
    topics?: string[];
    pricingMentioned?: Record<string, string>;
    citations?: SourceCitation[];
    scratchpad?: string[];
  };
}

export interface FactEntry {
  id: string;
  userId: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  validFrom: string; // ISO 8601
  validUntil?: string | null; // ISO 8601 or null if current
  isSuperseded: boolean;
  sourceSessionId?: string;
  sourceUrl?: string;
  createdAt: string;
}

export interface EntityProfile {
  id: string;
  userId: string;
  entityName: string;
  category: 'crm' | 'database' | 'hosting' | 'tool' | 'service' | 'general';
  profileData: Record<string, any>;
  lastObservedAt: string;
}

export interface TemporalRange {
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  label: string;     // e.g. "Last Tuesday (2026-11-04)"
  anchorType: 'relative' | 'absolute' | 'none';
}

export interface BrainVaultContext {
  episodicMemories: MemoryEntry[];
  activeFacts: FactEntry[];
  entityProfiles: EntityProfile[];
  temporalAnchor?: TemporalRange;
  injectedContextString: string;
}

// ==========================================
// Web Search Tool Types
// ==========================================

export interface SearchOptions {
  maxResults?: number;
  publishedAfter?: string; // ISO date filter
  domains?: string[];
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  publishedDate?: string;
  score?: number;
}

export interface SearchResponse {
  query: string;
  provider: 'brave' | 'tavily' | 'fallback';
  results: SearchResultItem[];
  executionTimeMs: number;
}

export interface SourceCitation {
  index: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedDate?: string;
}

// ==========================================
// AgentBridge Tool Permission Governance Types
// ==========================================

export type ApprovalType = 'once' | 'always' | 'deny';

export interface ToolApprovalRequest {
  approvalId: string;
  toolName: string;
  serverName: string;
  payload: Record<string, any>;
  timestamp: string;
}

export interface ToolApprovalDecision {
  approvalId: string;
  approved: boolean;
  approvalType?: ApprovalType;
  toolName: string;
  serverName?: string;
}

// ==========================================
// Stream Protocol Types (SSE)
// ==========================================

export type StreamEventType =
  | 'scratchpad'
  | 'tool_approval_required'
  | 'tool_approved'
  | 'llm_token'
  | 'citations'
  | 'plain_text_answer'
  | 'agent_error'
  | 'error'
  | 'done';

export interface ScratchpadEvent {
  type: 'agent_status' | 'memory_recall' | 'tool_start' | 'tool_end';
  content: string;
  tool_name?: string;
  tool_input?: any;
  observation?: any;
}

// ==========================================
// Authentication & User Types
// ==========================================

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role?: string;
  avatar?: string;
  createdAt: string;
}

export type SafeUser = Omit<User, 'passwordHash'>;

export interface AuthSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

// ==========================================
// Chat Session & History Types
// ==========================================

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessagePreview?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'permission_request';
  text: string;
  time: string;
  createdAt?: string;
  scratchpad?: string[];
  citations?: SourceCitation[];
  isStreaming?: boolean;
}

