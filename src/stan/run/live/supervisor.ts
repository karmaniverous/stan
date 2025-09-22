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

  cancelAll(): void {
    const graceMs =
      (typeof this.behavior.hangKillGrace === 'number'
        ? this.behavior.hangKillGrace
        : 8) * 1000;
    const current = Array.from(this.pids.entries());
    for (const [, pid] of current) {
      try {
        if (Number.isFinite(pid)) process.kill(pid, 'SIGTERM');
      } catch {
        // ignore
      }
    }
    setTimeout(
      () => {
        for (const [, pid] of current) {
          try {
            if (Number.isFinite(pid)) treeKill(pid, 'SIGKILL');
          } catch {
            // ignore
          }
        }
      },
      Math.max(0, graceMs),
    );
    this.pids.clear();
  }
}
