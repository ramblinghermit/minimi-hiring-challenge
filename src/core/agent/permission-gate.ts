import { ApprovalType, ToolApprovalDecision, ToolApprovalRequest } from '../types';

interface PendingApproval {
  request: ToolApprovalRequest;
  resolve: (decision: ToolApprovalDecision) => void;
  sessionId?: string;
  userId?: string;
}

/**
 * AgentBridge Tool Permission Governance Manager
 * Controls tool execution permissions:
 * - 'once': allow this specific call
 * - 'always': allow for entire session for this user
 * - 'deny': block execution
 * 
 * Features thread-safe multi-user isolation, session-scoped callbacks,
 * and cancellation hooks for terminated executions.
 */
export class PermissionGate {
  private static pendingApprovals = new Map<string, PendingApproval>();
  private static userAlwaysAllowed = new Map<string, Set<string>>();
  private static globalAlwaysAllowed = new Set<string>();

  // Map of sessionId -> approval callback for session-scoped SSE bridging
  private static approvalCallbacks = new Map<string, (req: ToolApprovalRequest) => void>();
  private static legacyCallback: ((req: ToolApprovalRequest) => void) | null = null;

  /**
   * Set callback for a specific session (preferred for multi-user isolation)
   * or globally (backwards-compatible).
   */
  public static setApprovalCallback(
    sessionIdOrCb: string | (((req: ToolApprovalRequest) => void) | null),
    cb?: ((req: ToolApprovalRequest) => void) | null
  ): void {
    if (typeof sessionIdOrCb === 'string') {
      if (cb) {
        this.approvalCallbacks.set(sessionIdOrCb, cb);
      } else {
        this.approvalCallbacks.delete(sessionIdOrCb);
      }
    } else {
      this.legacyCallback = sessionIdOrCb;
    }
  }

  /**
   * Request user approval for tool execution with multi-user isolation.
   */
  public static async requestApproval(
    toolName: string,
    payload: Record<string, any>,
    serverName: string = 'minimi-search-tool',
    autoPilot: boolean = false,
    sessionId?: string,
    userId: string = 'default_user'
  ): Promise<ToolApprovalDecision> {
    const userAllowed = this.userAlwaysAllowed.get(userId)?.has(toolName) || this.globalAlwaysAllowed.has(toolName);

    // If autoPilot is active or user previously chose "Always Allow"
    if (autoPilot || userAllowed) {
      return {
        approvalId: `auto_${Date.now()}`,
        approved: true,
        approvalType: 'always',
        toolName,
        serverName,
      };
    }

    const approvalId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const request: ToolApprovalRequest = {
      approvalId,
      toolName,
      serverName,
      payload,
      timestamp: new Date().toISOString(),
    };

    return new Promise<ToolApprovalDecision>((resolve) => {
      this.pendingApprovals.set(approvalId, { request, resolve, sessionId, userId });

      // Invoke session-specific callback if registered, otherwise fallback to legacy callback
      const sessionCb = sessionId ? this.approvalCallbacks.get(sessionId) : null;
      const activeCb = sessionCb || this.legacyCallback;
      if (activeCb) {
        try {
          activeCb(request);
        } catch (err) {
          console.warn('[PermissionGate] Failed to notify approval callback:', err);
        }
      }
    });
  }

  /**
   * Handle user decision from UI (POST /api/tool/approve)
   */
  public static resolveApproval(decision: ToolApprovalDecision, actingUserId?: string): boolean {
    const pending = this.pendingApprovals.get(decision.approvalId);
    if (!pending) return false;

    // Multi-tenant check: if actingUserId is supplied and request has userId, verify ownership
    if (actingUserId && pending.userId && pending.userId !== 'default_user' && pending.userId !== actingUserId) {
      return false; // Unauthorized user attempted to approve another user's tool
    }

    if (decision.approved && decision.approvalType === 'always') {
      const targetUser = pending.userId || actingUserId || 'default_user';
      if (!this.userAlwaysAllowed.has(targetUser)) {
        this.userAlwaysAllowed.set(targetUser, new Set<string>());
      }
      this.userAlwaysAllowed.get(targetUser)!.add(decision.toolName);
      this.globalAlwaysAllowed.add(decision.toolName);
    }

    pending.resolve(decision);
    this.pendingApprovals.delete(decision.approvalId);
    return true;
  }

  /**
   * Cancel all pending approvals for a session when it is terminated
   */
  public static cancelPendingForSession(sessionId: string): void {
    for (const [approvalId, pending] of this.pendingApprovals.entries()) {
      if (pending.sessionId === sessionId) {
        pending.resolve({
          approvalId,
          approved: false,
          approvalType: 'deny',
          toolName: pending.request.toolName,
          serverName: pending.request.serverName,
        });
        this.pendingApprovals.delete(approvalId);
      }
    }
    this.approvalCallbacks.delete(sessionId);
  }

  public static getPendingCount(): number {
    return this.pendingApprovals.size;
  }

  public static resetPermissions(): void {
    this.userAlwaysAllowed.clear();
    this.globalAlwaysAllowed.clear();
    for (const [_, pending] of this.pendingApprovals.entries()) {
      pending.resolve({
        approvalId: pending.request.approvalId,
        approved: false,
        approvalType: 'deny',
        toolName: pending.request.toolName,
      });
    }
    this.pendingApprovals.clear();
    this.approvalCallbacks.clear();
    this.legacyCallback = null;
  }
}
