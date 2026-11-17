/**
 * Minimi Agent Execution Manager
 * 
 * Provides stateful lifecycle control for agent executions:
 * - Pause & Resume with non-blocking async checkpoints
 * - Instant Termination with AbortSignal cancellation
 * - Per-session and per-user execution isolation
 * - Real-time event notifications for SSE bridge
 */

export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'terminated' | 'completed' | 'error';

export class ExecutionTerminatedError extends Error {
  public readonly code = 'EXECUTION_TERMINATED';
  constructor(message: string = 'Execution was terminated by user') {
    super(message);
    this.name = 'ExecutionTerminatedError';
  }
}

export interface ExecutionListeners {
  onPaused?: (data: { sessionId: string; step?: string }) => void;
  onResumed?: (data: { sessionId: string }) => void;
  onTerminated?: (data: { sessionId: string; reason: string }) => void;
}

export interface ExecutionState {
  sessionId: string;
  userId: string;
  status: ExecutionStatus;
  currentStep: string;
  abortController: AbortController;
  pausePromise: Promise<void> | null;
  resolvePause: (() => void) | null;
  startedAt: number;
  pausedAt?: number;
  totalPausedMs: number;
  listeners: ExecutionListeners;
  lastError?: Error;
}

export class ExecutionManager {
  private static instance: ExecutionManager;
  private executions = new Map<string, ExecutionState>();

  private constructor() {}

  public static getInstance(): ExecutionManager {
    if (!ExecutionManager.instance) {
      ExecutionManager.instance = new ExecutionManager();
    }
    return ExecutionManager.instance;
  }

  /**
   * Registers a new execution run. If an existing execution is still active for this session,
   * terminates it first to avoid conflicting zombie runs.
   */
  public startExecution(
    sessionId: string,
    userId: string,
    listeners: ExecutionListeners = {}
  ): ExecutionState {
    const existing = this.executions.get(sessionId);
    if (existing && (existing.status === 'running' || existing.status === 'paused')) {
      this.terminate(sessionId, userId, 'superseded_by_new_run');
    }

    const state: ExecutionState = {
      sessionId,
      userId,
      status: 'running',
      currentStep: 'initialization',
      abortController: new AbortController(),
      pausePromise: null,
      resolvePause: null,
      startedAt: Date.now(),
      totalPausedMs: 0,
      listeners,
    };

    this.executions.set(sessionId, state);
    return state;
  }

  /**
   * Attach listeners to an active execution (e.g. for SSE stream hooks)
   */
  public attachListeners(sessionId: string, listeners: Partial<ExecutionListeners>): void {
    const exec = this.executions.get(sessionId);
    if (exec) {
      exec.listeners = { ...exec.listeners, ...listeners };
    }
  }

  /**
   * Checkpoint called by Orchestrator and LLM streaming loops.
   * - If terminated: immediately throws ExecutionTerminatedError.
   * - If paused: awaits unblocking when resume() or terminate() is called.
   */
  public async checkpoint(sessionId: string, stepName?: string): Promise<void> {
    const exec = this.executions.get(sessionId);
    if (!exec) return;

    if (stepName) {
      exec.currentStep = stepName;
    }

    if (exec.status === 'terminated' || exec.abortController.signal.aborted) {
      throw new ExecutionTerminatedError(`Execution terminated at step: ${exec.currentStep}`);
    }

    // If currently paused, wait until resumed or terminated
    while (exec.status === 'paused') {
      if (exec.pausePromise) {
        await exec.pausePromise;
      } else {
        await new Promise((r) => setTimeout(r, 40));
      }

      if ((exec.status as string) === 'terminated' || exec.abortController.signal.aborted) {
        throw new ExecutionTerminatedError(`Execution terminated during pause at step: ${exec.currentStep}`);
      }
    }
  }

  /**
   * Pauses the active execution.
   */
  public pause(sessionId: string, userId?: string): boolean {
    const exec = this.executions.get(sessionId);
    if (!exec) return false;

    // Optional user isolation check
    if (userId && exec.userId !== userId && exec.userId !== 'default_user') {
      return false;
    }

    if (exec.status !== 'running') {
      return false; // Idempotent or already paused/terminated
    }

    exec.status = 'paused';
    exec.pausedAt = Date.now();
    exec.pausePromise = new Promise<void>((resolve) => {
      exec.resolvePause = resolve;
    });

    try {
      exec.listeners.onPaused?.({ sessionId, step: exec.currentStep });
    } catch (err) {
      console.warn(`[ExecutionManager] onPaused listener error:`, err);
    }

    return true;
  }

  /**
   * Resumes a paused execution.
   */
  public resume(sessionId: string, userId?: string): boolean {
    const exec = this.executions.get(sessionId);
    if (!exec) return false;

    if (userId && exec.userId !== userId && exec.userId !== 'default_user') {
      return false;
    }

    if (exec.status !== 'paused') {
      return false; // Not paused
    }

    if (exec.pausedAt) {
      exec.totalPausedMs += Date.now() - exec.pausedAt;
      exec.pausedAt = undefined;
    }

    exec.status = 'running';

    if (exec.resolvePause) {
      const resolve = exec.resolvePause;
      exec.resolvePause = null;
      exec.pausePromise = null;
      resolve();
    }

    try {
      exec.listeners.onResumed?.({ sessionId });
    } catch (err) {
      console.warn(`[ExecutionManager] onResumed listener error:`, err);
    }

    return true;
  }

  /**
   * Immediately terminates the execution run, aborting active streams and unblocking paused loops.
   */
  public terminate(sessionId: string, userId?: string, reason: string = 'user_terminated'): boolean {
    const exec = this.executions.get(sessionId);
    if (!exec) return false;

    if (userId && exec.userId !== userId && exec.userId !== 'default_user') {
      return false;
    }

    if (exec.status === 'terminated' || exec.status === 'completed') {
      return false; // Already finished or terminated
    }

    exec.status = 'terminated';

    // Abort controller
    try {
      exec.abortController.abort(new ExecutionTerminatedError(reason));
    } catch {}

    // If waiting in pause, unblock it so it encounters the termination check immediately
    if (exec.resolvePause) {
      const resolve = exec.resolvePause;
      exec.resolvePause = null;
      exec.pausePromise = null;
      resolve();
    }

    try {
      exec.listeners.onTerminated?.({ sessionId, reason });
    } catch (err) {
      console.warn(`[ExecutionManager] onTerminated listener error:`, err);
    }

    return true;
  }

  /**
   * Marks execution as completed normally.
   */
  public completeExecution(sessionId: string): void {
    const exec = this.executions.get(sessionId);
    if (!exec) return;

    if (exec.status === 'running') {
      exec.status = 'completed';
    }

    // Retain state briefly for telemetry/status queries, then clean up
    setTimeout(() => {
      if (this.executions.get(sessionId) === exec) {
        this.executions.delete(sessionId);
      }
    }, 60000);
  }

  /**
   * Records an execution error.
   */
  public failExecution(sessionId: string, error: Error): void {
    const exec = this.executions.get(sessionId);
    if (!exec) return;

    exec.status = 'error';
    exec.lastError = error;

    setTimeout(() => {
      if (this.executions.get(sessionId) === exec) {
        this.executions.delete(sessionId);
      }
    }, 60000);
  }

  public getStatus(sessionId: string): ExecutionStatus {
    const exec = this.executions.get(sessionId);
    return exec ? exec.status : 'idle';
  }

  public getExecution(sessionId: string): ExecutionState | undefined {
    return this.executions.get(sessionId);
  }

  public isPaused(sessionId: string): boolean {
    return this.executions.get(sessionId)?.status === 'paused';
  }

  public isRunning(sessionId: string): boolean {
    return this.executions.get(sessionId)?.status === 'running';
  }

  public isTerminated(sessionId: string): boolean {
    return this.executions.get(sessionId)?.status === 'terminated';
  }

  public getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.executions.get(sessionId)?.abortController.signal;
  }

  public reset(): void {
    for (const [id, exec] of this.executions.entries()) {
      try {
        exec.abortController.abort();
      } catch {}
      if (exec.resolvePause) {
        exec.resolvePause();
      }
    }
    this.executions.clear();
  }
}

export const executionManager = ExecutionManager.getInstance();
