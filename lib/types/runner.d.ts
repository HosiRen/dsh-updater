/**
 * Parent-process half of the update pipeline: it takes the run lock, records
 * the run, and starts the detached subprocess that performs the merge, the
 * reinstall, the rebuild, and any rollback. The subprocess outlives this
 * process on purpose, so a Harness restart cannot interrupt an update; the
 * durable run record, not the child, is what callers read afterwards.
 *
 * @module @local/dsh-updater/runner
 */
import type { RunnerMode } from './pipeline.ts';
import type { UpdaterPaths } from './state.ts';
import type { BuildScope, UpdateRun } from './types.ts';
/** Everything one update run needs to start. */
export interface StartUpdateOptions {
    /** Checkout root. */
    readonly root: string;
    /** Persistent state paths. */
    readonly paths: UpdaterPaths;
    /** `HEAD` recorded before the merge; the rollback target. */
    readonly beforeSha: string;
    /** Git remote the update reads. */
    readonly remote: string;
    /** Branch the update fast-forwards to. */
    readonly branch: string;
    /** Build the pipeline runs after installing. */
    readonly build: BuildScope;
    /** Package manager executable; defaults to `pnpm`. */
    readonly pnpmCommand: string;
    /** Work the run performs; absent means `'update'`. */
    readonly mode?: RunnerMode;
}
/**
 * Launch one update run in a detached subprocess and return the run record as
 * written before that subprocess started.
 *
 * The lock is taken first, so two runs can never drive the same checkout at
 * once. Once the subprocess exists, this function only reports: progress,
 * failure, and rollback all reach the caller through the durable record.
 *
 * @param options Checkout, state paths, and update parameters of the run.
 * @returns The `'preflight'` record the subprocess continues from.
 * @throws When another run holds the lock, or when the run cannot be recorded
 * or started — in which case the lock is released again.
 */
export declare function startUpdate(options: StartUpdateOptions): Promise<UpdateRun>;
