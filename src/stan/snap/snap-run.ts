/* src/stan/snap/snap-run.ts
 * Snapshot capture operation with optional stash.
 */
import { writeArchiveSnapshot } from '../diff';
import { utcStamp } from '../util/time';
import { captureSnapshotAndArchives } from './capture';
import { runGit } from './git';
import { ensureDirs } from './shared';
import { resolveContext } from './context';

export const handleSnap = async (opts?: { stash?: boolean }): Promise<void> => {
  const { cwd, stanPath, maxUndos } = await resolveContext(process.cwd());
  const wantStash = Boolean(opts?.stash);
  let attemptPop = false;

  if (wantStash) {
    const res = await runGit(cwd, ['stash', '-u']);
    if (res.code === 0 && !/No local changes to save/i.test(res.stdout)) {
      attemptPop = true;
    } else if (res.code !== 0) {
      console.error(
        'stan: git stash -u failed; snapshot aborted (no changes made)',
      );
      return;
    }
  }

  try {
    await writeArchiveSnapshot({
      cwd,
      stanPath,
      includes: [],
      excludes: [],
    });
  } catch (e) {
    console.error('stan: snapshot write failed', e);
    if (wantStash && attemptPop) {
      const pop = await runGit(cwd, ['stash', 'pop']);
      if (pop.code !== 0) {
        console.error('stan: git stash pop failed');
      }
    }
    return;
  }

  const ts = utcStamp();
  await ensureDirs([]); // guard
  await captureSnapshotAndArchives({
    cwd,
    stanPath,
    ts,
    maxUndos,
  });

  if (wantStash && attemptPop) {
    const pop = await runGit(cwd, ['stash', 'pop']);
    if (pop.code !== 0) {
      console.error('stan: git stash pop failed');
    }
  }

  console.log('stan: snapshot updated');
};
