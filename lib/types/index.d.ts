/**
 * Host half of the Updater. It resolves the running checkout, exposes the
 * update operations over an HTTP surface the Settings page calls, and probes
 * the remote on the configured cadence. Every actual update runs in a
 * detached subprocess, so an in-flight update survives a Host reload or
 * restart and this plugin owns only launch, observation, and reporting.
 *
 * @module @local/dsh-updater
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config as ConfigSchema } from './config.ts';
import type { Config as UpdaterConfig } from './config.ts';
import type { UpdateRun } from './types.ts';
/** Cordis plugin name. */
export declare const name = "dsh-updater";
/** Services that must exist for the plugin to activate at all. */
export declare const inject: string[];
/** Validated configuration schema, exported as the plugin's Cordis `Config`. */
export declare const Config: import("@deepseek-ai/schemastery").default<ConfigSchema>;
/**
 * Whether a completed update is still waiting for a Host restart.
 *
 * A successful run is recorded permanently, so its phase cannot answer this on
 * its own — reporting every recorded `done` as pending would keep asking for a
 * restart that has already happened and would change nothing. The comparison is
 * therefore against this process's own start: a run that finished before it is
 * already the code being served.
 * @param run - Recorded run, when the checkout has one.
 * @param processStartedAt - Epoch milliseconds the current process started.
 * @returns true only while a finished update has not been picked up yet.
 */
export declare function isRestartPending(run: UpdateRun | undefined, processStartedAt?: number): boolean;
/**
 * Mount the updater: one HTTP surface, one memoized checkout resolution, and
 * one unattended probe per activation when the cadence calls for it.
 * @param ctx - Host plugin context.
 * @param config - Validated plugin configuration.
 */
export declare function apply(ctx: Context, config: UpdaterConfig): void;
