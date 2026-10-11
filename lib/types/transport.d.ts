/**
 * Remote transport selection. The updater reaches the upstream repository over
 * one of the protocols a git remote can name, so a checkout whose configured
 * remote is unreachable over one protocol can still be updated over the other
 * without editing the repository's own remote configuration.
 *
 * @module @local/dsh-updater/transport
 */
/** Protocol the updater uses to reach the upstream repository. */
export type RemoteTransport = 'origin' | 'https' | 'ssh';
/** Host and repository path extracted from a git remote URL. */
export interface RemoteLocation {
    /** Host name, such as `github.com`. */
    readonly host: string;
    /** Repository path without the `.git` suffix, such as `deepseek-ai/deepseek-harness`. */
    readonly path: string;
}
/**
 * Split a git remote URL into the host and repository path shared by every
 * protocol, so one URL can be rewritten to another.
 *
 * The path is returned without a trailing `.git`, which the writers re-add.
 * A local filesystem path has no host to rewrite and returns `undefined`.
 * @param url - URL exactly as `git remote get-url` reports it.
 * @returns The host and repository path, or `undefined` when the URL names no remote host.
 */
export declare function parseRemoteUrl(url: string): RemoteLocation | undefined;
/**
 * Rewrite a remote URL to one protocol, keeping its host and repository path.
 * @param url - URL exactly as `git remote get-url` reports it.
 * @param transport - Protocol to express the same repository in.
 * @returns The rewritten URL, or `undefined` when `url` names no remote host.
 */
export declare function transportUrl(url: string, transport: 'https' | 'ssh'): string | undefined;
