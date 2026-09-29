/**
 * Subprocess entry of the update pipeline. One invocation performs exactly one
 * run — `update` fetches, fast-forwards, reinstalls, and rebuilds, returning
 * the checkout to the recorded `beforeSha` when a step fails; `rollback` goes
 * straight back to `beforeSha` and reinstalls. The parent starts this entry
 * detached, with the run log as its standard output and standard error, so the
 * durable run record is the only thing callers read: this process exits with
 * code 0 even when the run fails.
 *
 * @module @local/dsh-updater/update-runner
 */
import type { RunnerConfig } from './pipeline.ts';
import type { UpdateRun } from './types.ts';
/**
 * Perform one update run and return its final record.
 *
 * The run first confirms that the durable lock and the run record belong to it;
 * when they do not — another run owns them, or the state was lost — nothing is
 * written and nothing is released, because dropping a foreign lock would let
 * two runs drive the same checkout at once. Otherwise every phase transition is
 * written to the durable record and appended to the run log, a failure leaves
 * the checkout at `beforeSha`, and the lock is released on every path out.
 *
 * @param config Configuration this invocation was started with.
 * @returns The final record: `'done'`, `'rolled-back'`, or `'failed'` for a rollback run.
 */
export declare function runUpdate(config: RunnerConfig): Promise<UpdateRun>;
