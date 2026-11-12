import { ApprovalType, ToolApprovalDecision, ToolApprovalRequest } from '../types';

interface PendingApproval {
  request: ToolApprovalRequest;
  resolve: (decision: ToolApprovalDecision) => void;
}

/**
 * AgentBridge Tool Permission Governance Manager
 * Controls tool execution permissions:
 * - 'once': allow this specific call
 * - 'always': allow for entire session
 * - 'deny': block execution
 */
export class PermissionGate {
  private static pendingApprovals = new Map<string, PendingApproval>();
  private static alwaysAllowedTools = new Set<string>();

  /**
   * Check if a tool execution is pre-authorized or requires user approval
   */
  public static async requestApproval(
    toolName: string,
    payload: Record<string, any>,
    serverName: string = 'minimi-search-tool',
    autoPilot: boolean = false
  ): Promise<ToolApprovalDecision> {
    // If autoPilot is active or user previously chose "Always Allow"
    if (autoPilot || this.alwaysAllowedTools.has(toolName)) {
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
      this.pendingApprovals.set(approvalId, { request, resolve });
    });
  }

  /**
   * Handle user decision from UI (POST /api/tool/approve)
   */
  public static resolveApproval(decision: ToolApprovalDecision): boolean {
    const pending = this.pendingApprovals.get(decision.approvalId);
    if (!pending) return false;

    if (decision.approved && decision.approvalType === 'always') {
      this.alwaysAllowedTools.add(decision.toolName);
    }

    pending.resolve(decision);
    this.pendingApprovals.delete(decision.approvalId);
    return true;
  }

  public static resetPermissions(): void {
    this.alwaysAllowedTools.clear();
    this.pendingApprovals.clear();
  }
}
