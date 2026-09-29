/**
 * Resolves which DeepSeek Harness source checkout this process runs from, so
 * the Updater works from any installation path. The plugin's configured root
 * wins; otherwise the profile's install anchor is walked upward to the root.
 * A candidate is accepted only when it proves itself a DSH checkout:
 * `<root>/package.json` names `@deepseek-ai/dsh-root` and `<root>/.git` exists.
 * @module @local/dsh-updater/resolve-install
 */
import type { InstallLocation } from './types.ts';
/**
 * Outcome of resolving the running checkout.
 *
 * A failed resolution carries a display-safe `reason`: it names the path that
 * was inspected and the fact that failed, so the Settings page can show it
 * verbatim without further interpretation.
 */
export type InstallResolution = {
    readonly ok: true;
    readonly location: InstallLocation;
} | {
    readonly ok: false;
    readonly reason: string;
};
/** Inputs for {@link resolveInstallLocation}; both are optional and ordered. */
export interface ResolveInstallOptions {
    /** Explicit checkout root from the plugin Config; highest priority. */
    readonly configuredRoot?: string | undefined;
    /** `profileContext.installAnchor`: absolute path of the dsh app manifest inside the installation. */
    readonly installAnchor?: string | undefined;
}
/**
 * Resolve the checkout the running Harness belongs to.
 *
 * Accepted candidates must carry a `@deepseek-ai/dsh-root` manifest and a
 * `.git` entry, so a directory that merely resembles a checkout is refused
 * with the concrete failing fact rather than updated by mistake.
 * @param options - Configured root and profile install anchor, in priority order.
 * @returns The resolved location, or a display-safe reason no checkout was found.
 */
export declare function resolveInstallLocation(options: ResolveInstallOptions): Promise<InstallResolution>;
