/**
 * Durable Updater state under `$DSH_HOME/updater`: the current or last run,
 * the most recent probe, the single-run lock, and per-run logs. Every write
 * replaces its file atomically (temp file plus rename) and every created
 * directory or file is owner-only, so a reader never observes a half-written
 * record and no other account can read the update history.
 *
 * The plugin owns this directory end to end; it is the one place a Host
 * generation, the detached update subprocess, and a later Host generation can
 * all observe the same facts.
 * @module @local/dsh-updater/state
 */
import type { CheckResult, UpdateRun } from './types.ts';
/** Locations the Updater reads and writes under one `$DSH_HOME`. */
export interface UpdaterPaths {
    /** `$DSH_HOME/updater`. */
    readonly dir: string;
    /** `state.json` holding the current/last run. */
    readonly stateFile: string;
    /** `logs/`. */
    readonly logDir: string;
    /** `run.lock`. */
    readonly lockFile: string;
}
/** The most recent probe, read and written as one record. */
export interface CheckRecordStore {
    /**
     * Read the stored probe.
     * @returns The record, or `undefined` when none is stored or the file cannot be read as one.
     */
    read(): Promise<CheckResult | undefined>;
    /**
     * Replace the stored probe.
     * @param result - The probe to persist; the previous record is overwritten.
     * @returns Resolution after the record is durable.
     */
    write(result: CheckResult): Promise<void>;
}
/**
 * Derive every Updater path from one Harness home directory.
 * @param home - The Harness home, `$DSH_HOME`.
 * @returns The directory, run state, log directory, and lock file.
 */
export declare function updaterPaths(home: string): UpdaterPaths;
/**
 * Open the file-backed probe history.
 *
 * The record lives beside the run state because it must stay readable by a
 * later Host generation and by the detached update subprocess, and because
 * this package is not a workspace member and therefore cannot resolve the
 * Harness storage services.
 * @param paths - Updater state paths.
 * @returns The store; reads and writes are the only operations.
 */
export declare function openCheckRecordStore(paths: UpdaterPaths): CheckRecordStore;
/**
 * Read the current or last update run.
 *
 * A missing, unreadable, unparsable, or structurally invalid file yields
 * `undefined` rather than an exception: this record is diagnostic history, and
 * refusing it must never stop the plugin from loading. The strict reading of
 * the same fact happens on the write side, where the Updater controls content.
 * @param paths - Updater state paths.
 * @returns The stored run, or `undefined` when none can be read.
 */
export declare function readRun(paths: UpdaterPaths): Promise<UpdateRun | undefined>;
/**
 * Replace the current update run.
 * @param paths - Updater state paths.
 * @param run - The run to persist; the previous record is overwritten.
 * @returns Resolution after the record is durable.
 */
export declare function writeRun(paths: UpdaterPaths, run: UpdateRun): Promise<void>;
/**
 * Report whether a live process holds the run lock.
 *
 * Same liveness rule as {@link acquireRunLock} without taking the lock, so the
 * Settings page can report a running update without racing it.
 * @param paths - Updater state paths.
 * @returns `true` when the lock exists and its process is alive.
 */
export declare function isRunActive(paths: UpdaterPaths): Promise<boolean>;
/**
 * Take the single-run lock.
 *
 * The lock is an exclusive `wx` creation holding the owner pid and start
 * instant. A lock whose process is gone (or whose content is unreadable) is
 * stale and is recycled, so a killed update never blocks every later one; any
 * other holder refuses the acquisition.
 * @param paths - Updater state paths.
 * @returns `true` when this process now holds the lock, `false` when another live run does.
 */
export declare function acquireRunLock(paths: UpdaterPaths): Promise<boolean>;
/**
 * Release the run lock.
 *
 * Only the process that acquired the lock may call this; the lock is removed
 * unconditionally, because verifying ownership at release time would leave a
 * lock behind after any crash of the owner.
 * @param paths - Updater state paths.
 * @returns Resolution after the lock file is gone.
 */
export declare function releaseRunLock(paths: UpdaterPaths): Promise<void>;
/**
 * Allocate the log file for one run.
 * @param paths - Updater state paths.
 * @param runId - Stable run identifier; characters that could escape the log directory are replaced.
 * @returns The absolute log path, with its directory created.
 */
export declare function newRunLogPath(paths: UpdaterPaths, runId: string): Promise<string>;
/**
 * Append one chunk to a run log.
 * @param logPath - Absolute log path, typically from {@link newRunLogPath}.
 * @param chunk - Text to append verbatim.
 * @returns Resolution after the chunk is written.
 */
export declare function appendLog(logPath: string, chunk: string): Promise<void>;
/**
 * Read the tail of a run log.
 *
 * The tail is what a status reader needs: the last lines name the failure,
 * while the head is long superseded by install and build output.
 * @param logPath - Absolute log path.
 * @param maxBytes - Retained byte budget; older bytes are dropped.
 * @returns The tail, decoded without a leading partial character, or an empty string when the log is absent.
 */
export declare function readLogTail(logPath: string, maxBytes: number): Promise<string>;
/**
 * Delete all but the newest run logs.
 * @param paths - Updater state paths.
 * @param keep - How many logs to keep, newest first by modification time.
 * @returns Resolution after the older logs are gone; a missing log directory is a no-op.
 */
export declare function pruneLogs(paths: UpdaterPaths, keep: number): Promise<void>;
