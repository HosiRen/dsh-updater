/**
 * Pure decisions of the update pipeline, shared by the parent process and the
 * update subprocess: the build steps one build scope runs, the classification
 * of a refused fast-forward, bounded output tails, run ids, and validation of
 * the subprocess configuration. Nothing here touches the filesystem, starts a
 * process, or reaches the network.
 *
 * @module @local/dsh-updater/pipeline
 */
import type { GitResult } from './git.ts';
import type { UpdaterPaths } from './state.ts';
import type { BuildScope, UpdatePhase } from './types.ts';
/** One build step the pipeline runs after a successful merge. */
export interface BuildStep {
    /** Phase the run reports while this step executes. */
    readonly phase: UpdatePhase;
    /** Command and arguments, executed with the checkout root as cwd. */
    readonly command: readonly string[];
}
/**
 * The ordered build steps for one build scope: dependency installation first,
 * then that scope's build scripts.
 * @param scope Build the pipeline runs after the merge.
 * @param pnpmCommand Package manager executable that runs the scripts.
 * @returns The steps in execution order; the first one is always the install step.
 */
export declare function buildSteps(scope: BuildScope, pnpmCommand: string): readonly BuildStep[];
/**
 * Which failure a merge attempt represents.
 * @param result Result of the `--ff-only` merge attempt.
 * @returns `'not-fast-forward'` only when the command failed with an exit code
 * and git reported that the branch cannot fast-forward; `'internal'` otherwise,
 * including a timeout, a command that never started, a conflict report, and a
 * zero exit code (which is no failure at all).
 */
export declare function classifyMergeFailure(result: GitResult): 'not-fast-forward' | 'internal';
/** Bytes of a running command's standard error kept in memory as failure evidence. */
export declare const OUTPUT_TAIL_BYTES: number;
/** Bytes of a failed command's standard error archived in the durable run record. */
export declare const STDERR_TAIL_BYTES: number;
/**
 * Append a chunk to a bounded tail, dropping the oldest bytes past `limit`.
 * @param current Tail kept so far.
 * @param chunk Newly read output.
 * @param limit Maximum bytes of the result.
 * @returns The tail of `current` and `chunk` together, covering at most `limit`
 * bytes of their UTF-8 encoding. A cut in the middle of a multi-byte character
 * becomes `U+FFFD`.
 */
export declare function appendTail(current: string, chunk: string, limit: number): string;
/**
 * Render one pipeline step's log header.
 * @param phase Phase the step runs in.
 * @param command Command and arguments, rendered verbatim in written order.
 * @returns A single log line naming the phase and the command.
 */
export declare function formatStepHeader(phase: UpdatePhase, command: readonly string[]): string;
/**
 * The first non-empty line of command output, trimmed.
 * @param text Command output.
 * @returns The first line with content, or an empty string when there is none.
 */
export declare function firstLine(text: string): string;
/**
 * Build a run id from the instant the run started and a random suffix. Colons
 * and the millisecond separator become dashes, so the id is a valid file name
 * on every supported platform.
 * @param at Instant the run started.
 * @param suffix Short random suffix that separates runs started in the same millisecond.
 * @returns The run id, also usable as a log file's base name.
 */
export declare function newRunId(at: Date, suffix: string): string;
/**
 * One-line description of a caught value, for failure messages and log lines.
 * @param error Value caught from a rejected promise or a thrown statement.
 * @returns The error's message, or the value's string form.
 */
export declare function describeError(error: unknown): string;
/**
 * Full description of a caught value, preferring a stack when it carries one.
 * @param error Value caught from a rejected promise or a thrown statement.
 * @returns The error's stack or message, or the value's string form.
 */
export declare function describeErrorDetail(error: unknown): string;
/**
 * Wall-clock limit for one pipeline command when the configuration carries
 * none. A cold dependency install and a full build both outlast any shorter
 * bound, so the default is twenty minutes.
 */
export declare const DEFAULT_COMMAND_TIMEOUT_MS: number;
/**
 * What one subprocess invocation does with the checkout. An `update` run
 * fetches, fast-forwards, reinstalls, and rebuilds, rolling back when a step
 * fails; a `rollback` run returns to the recorded `beforeSha` and reinstalls
 * the dependencies that revision needs, without contacting the remote.
 */
export type RunnerMode = 'update' | 'rollback';
/**
 * The JSON configuration a parent passes as the update subprocess's single
 * argument.
 */
export interface RunnerConfig {
    /** Identifier of the run being performed; also the log file's base name. */
    readonly runId: string;
    /** Checkout root the pipeline operates on. */
    readonly root: string;
    /** Persistent state paths the run reads and writes. */
    readonly paths: UpdaterPaths;
    /** `HEAD` recorded before the merge; the rollback target. */
    readonly beforeSha: string;
    /** Git remote the update reads. */
    readonly remote: string;
    /** Branch the update fast-forwards to. */
    readonly branch: string;
    /** Build the pipeline runs after installing. */
    readonly build: BuildScope;
    /** Package manager executable the pipeline runs. */
    readonly pnpmCommand: string;
    /** Work the invocation performs; absent means `'update'`. */
    readonly mode?: RunnerMode;
    /** Wall-clock limit for one command; absent means {@link DEFAULT_COMMAND_TIMEOUT_MS}. */
    readonly timeoutMs?: number;
}
/**
 * Parse and validate the JSON configuration that crosses into the update
 * subprocess. That argument is a process boundary, so every field is checked
 * here instead of being trusted.
 * @param raw JSON text of the run configuration.
 * @returns The validated configuration, with absent optional fields left absent.
 * @throws When the text is not JSON, is not an object, or carries a missing or malformed field.
 */
export declare function parseRunnerConfig(raw: string): RunnerConfig;
