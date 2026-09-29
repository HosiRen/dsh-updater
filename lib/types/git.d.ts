/**
 * Git command wrappers for the Updater's Host half. Every command runs through
 * `execFile` with an explicit argument vector (never a shell), a bounded
 * timeout, and a retained-output cap, so a pathological repository cannot hang
 * the Host or exhaust memory. Read helpers interpret their commands and fail
 * loud; write helpers return the raw {@link GitResult} so the caller decides
 * which exit codes are acceptable.
 * @module @local/dsh-updater/git
 */
import type { RepoFacts } from './types.ts';
/** Outcome of one git command: what it printed, how it ended, and whether it was cut short. */
export interface GitResult {
    /** Process exit code, or `null` when the command never started or was killed. */
    readonly exitCode: number | null;
    /** Standard output, capped to its tail by {@link GitOptions.maxBytes}. */
    readonly stdout: string;
    /** Standard error, capped to its tail by {@link GitOptions.maxBytes}. */
    readonly stderr: string;
    /** Whether the timeout, not the command, ended the process. */
    readonly timedOut: boolean;
}
/** Per-call bounds for one git command. */
export interface GitOptions {
    /** Bound on the command; defaults to 120_000, fetch gets its own longer default. */
    readonly timeoutMs?: number;
    /** Retained output cap per stream; defaults to 1 MiB, older bytes are dropped. */
    readonly maxBytes?: number;
    readonly signal?: AbortSignal;
}
/**
 * Run one git command in a checkout.
 *
 * The environment disables interactive credential prompts and optional index
 * locking, so an unattended run fails instead of waiting, and pins the C locale
 * so git's diagnostic text does not depend on the operator's environment. A
 * command that never starts or is killed by the timeout reports
 * `exitCode: null` with the cause appended to `stderr`; output beyond
 * `maxBytes` keeps its tail, which is where the diagnostic detail is.
 * @param root - Directory the command runs in; also the repository it acts on.
 * @param args - Argument vector passed to git verbatim.
 * @param options - Timeout, output cap, and abort signal.
 * @returns The command's exit code, retained output, and timeout verdict.
 */
export declare function runGit(root: string, args: readonly string[], options?: GitOptions): Promise<GitResult>;
/**
 * Read the local repository facts the Settings page shows.
 *
 * Runs three commands: `rev-parse HEAD`, `rev-parse --abbrev-ref HEAD`, and
 * `status --porcelain`. A detached or unreadable branch is reported as `HEAD`;
 * every other command failure throws, because facts that silently read as
 * "clean checkout" would let the update pipeline run against unknown state.
 * @param root - Checkout root.
 * @param options - Timeout, output cap, and abort signal.
 * @returns The current SHA, branch, and working-tree verdict.
 * @throws When a required git command fails or the timeout expires.
 */
export declare function repoFacts(root: string, options?: GitOptions): Promise<RepoFacts>;
/**
 * Read the tip of one branch on a remote without changing the local repository.
 * @param root - Checkout root.
 * @param remote - Remote name, such as `origin`.
 * @param branch - Branch name without the `refs/heads/` prefix.
 * @param options - Timeout, output cap, and abort signal.
 * @returns The remote tip SHA, or `undefined` when the remote has no such branch.
 * @throws When `git ls-remote` itself fails, so an unreachable remote is never reported as "no update".
 */
export declare function remoteHead(root: string, remote: string, branch: string, options?: GitOptions): Promise<string | undefined>;
/**
 * Fetch one remote, updating its remote-tracking refs.
 * @param root - Checkout root.
 * @param remote - Remote name, such as `origin`.
 * @param options - Timeout, output cap, and abort signal; the timeout defaults to ten minutes.
 * @returns The raw result; the caller decides which exit codes are acceptable.
 */
export declare function fetchRemote(root: string, remote: string, options?: GitOptions): Promise<GitResult>;
/**
 * Fast-forward the checked-out branch onto `target`.
 * @param root - Checkout root.
 * @param target - Commit or ref to merge, such as `origin/main`.
 * @param options - Timeout, output cap, and abort signal.
 * @returns The raw result; a non-zero exit code means the merge was not a fast-forward.
 */
export declare function mergeFastForward(root: string, target: string, options?: GitOptions): Promise<GitResult>;
/**
 * Move the checked-out branch to `sha`, discarding working-tree changes.
 * @param root - Checkout root.
 * @param sha - Commit to reset to, typically the pre-merge `HEAD`.
 * @param options - Timeout, output cap, and abort signal.
 * @returns The raw result; the caller verifies the reset by re-reading the facts.
 */
export declare function resetHard(root: string, sha: string, options?: GitOptions): Promise<GitResult>;
