/* src/stan/run/live/supervisor.ts
 * ProcessSupervisor: graceful cancellation with TERM → grace → KILL.
 */
import treeKill from 'tree-kill';

import type { RunBehavior } from '../types';

export class ProcessSupervisor {
  constructor(
    private readonly behavior: Pick<
      RunBehavior,
      'hangWarn' | 'hangKill' | 'hangKillGrace'
    >,
  ) {}

  private readonly pids = new Map<string, number>();

  track(key: string, pid: number): void {
    this.pids.set(key, pid);
  }

  /**
   * Terminate all tracked processes.
   * - Default: TERM, then KILL after hangKillGrace seconds.
   * - immediate=true: TERM, then KILL without delay (user cancellation).
   */
  cancelAll(opts?: { immediate?: boolean }): void {
    const graceSec =
      typeof this.behavior.hangKillGrace === 'number'
        ? this.behavior.hangKillGrace
        : 10;
    const graceMs = opts?.immediate ? 0 : Math.max(0, graceSec * 1000);
    const current = Array.from(this.pids.entries());
    for (const [, pid] of current) {
      try {
        if (Number.isFinite(pid)) process.kill(pid, 'SIGTERM');
      } catch {
        // ignore
      }
    }
    const hardKill = () => {
      for (const [, pid] of current) {
        try {
          if (Number.isFinite(pid)) treeKill(pid, 'SIGKILL');
        } catch {
          // ignore
        }
      }
    };
    if (graceMs <= 0) {
      setTimeout(hardKill, 0);
    } else {
      setTimeout(hardKill, graceMs);
    }
    this.pids.clear();
  }
}
