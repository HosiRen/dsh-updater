/**
 * Fetch-target resolution: turn the configured transport into the exact
 * `git fetch` source and remote-tracking ref one run uses, plus the URL the
 * Settings page reports the choice currently amounts to.
 *
 * Keeping this in its own module is what lets the update subprocess, the probe,
 * and the status projection agree on one answer without either of them
 * importing the other.
 *
 * @module @local/dsh-updater/fetch-target
 */
import type { GitOptions } from './git.ts';
import type { RemoteTransport } from './transport.ts';
/** One resolved fetch: what to fetch from, and which ref the merge reads. */
export interface FetchTarget {
    /**
     * Argument to `git fetch` and `git ls-remote`: the remote name, or an
     * explicit URL when the transport rewrote it.
     */
    readonly source: string;
    /** Remote-tracking ref the fast-forward reads, such as `refs/remotes/origin/master`. */
    readonly trackingRef: string;
    /**
     * The URL this target amounts to. Absent when the remote configures no URL,
     * or when its URL has no host to rewrite; both cases fall back to fetching
     * the remote by name, and the absence is what tells the caller to say so.
     */
    readonly resolvedUrl?: string;
}
/**
 * Resolve the transport choice against the repository's own remote.
 *
 * An `origin` transport keeps git's own behaviour and fetches the remote by
 * name. The other two rewrite the remote's URL, which is the whole point: a
 * checkout whose remote names a protocol this host cannot reach is still
 * updatable over the other, and the repository's configuration is never
 * touched. When the URL cannot be rewritten the result falls back to the
 * remote name with `resolvedUrl` absent, so the caller reports the fallback
 * instead of silently fetching over an unintended protocol.
 * @param root - Checkout root.
 * @param remote - Remote name, such as `origin`.
 * @param branch - Branch name without the `refs/heads/` prefix.
 * @param transport - Configured protocol choice.
 * @param options - Timeout, output cap, and abort signal for the URL read.
 * @returns The fetch source, the tracking ref the merge reads, and the resolved URL when one exists.
 */
export declare function resolveFetchTarget(root: string, remote: string, branch: string, transport: RemoteTransport, options?: GitOptions): Promise<FetchTarget>;
