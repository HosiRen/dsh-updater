/**
 * The plugin's deployment tunables. Every value a deployment may reasonably
 * change is a validated Config field, so a profile patch overrides it without
 * editing this package.
 *
 * @module @local/dsh-updater/config
 */
import z from '@deepseek-ai/schemastery';
import type { AutoCheckFrequency, BuildScope, UpdaterConfigView } from './types.ts';
/** Resolved plugin configuration. */
export interface Config {
    /**
     * Explicit checkout root. Absent (the default), the root is derived from the
     * running profile's install anchor, so one installation of this package
     * works from any checkout path.
     */
    repoRoot?: string;
    /** Git remote the update reads. */
    remote: string;
    /** Branch the update fast-forwards to. */
    branch: string;
    /** Which build the pipeline runs after a successful merge. */
    build: BuildScope;
    /** Unattended probe cadence; `startup` probes once per process start. */
    autoCheck: AutoCheckFrequency;
    /** Package manager executable used for install and build steps. */
    pnpmCommand: string;
    /** Bound on one pipeline command, in milliseconds. Builds are long. */
    timeoutMs: number;
    /** Bytes of run log returned to the Settings page. */
    logTailBytes: number;
    /** Working-tree paths reported when the checkout is dirty. */
    maxDirtyFiles: number;
}
export declare const Config: z<Config>;
/**
 * Project the effective configuration onto the fields the Settings page shows.
 * @param config - Resolved plugin configuration.
 * @returns The browser-visible subset.
 */
export declare function configView(config: Config): UpdaterConfigView;
/**
 * Decide whether an unattended probe is due now.
 *
 * A `startup` cadence is due once per process start, which the caller tracks
 * by passing whether this process already probed; every other cadence is due
 * when the recorded instant is older than its interval.
 * @param frequency - Configured cadence.
 * @param lastCheckedAt - ISO-8601 instant of the last recorded probe, when one exists.
 * @param alreadyProbedThisProcess - Whether this process already ran an unattended probe.
 * @param now - Current instant, injectable for tests.
 * @returns Whether the caller should probe.
 */
export declare function isCheckDue(frequency: AutoCheckFrequency, lastCheckedAt: string | undefined, alreadyProbedThisProcess: boolean, now?: number): boolean;
