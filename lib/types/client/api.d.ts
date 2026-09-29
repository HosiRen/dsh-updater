/**
 * Browser-side transport for the Updater's Host routes: one thin fetch layer
 * that turns a request into a parsed payload or one typed error. The status
 * cache, the poll, and the action bookkeeping live with the controller in
 * `./index.ts`; this module owns no state and schedules nothing.
 *
 * Routes are document-relative (`dsh-updater/status`), like every other
 * browser reference this app makes: the served document owns the mount prefix
 * while the Host registers the same route key as the absolute
 * `/dsh-updater/status`. See
 * .agents/notes/implemented/architecture/2026-09-14-web-document-relative-app-routes.md.
 *
 * @module @local/dsh-updater/client/api
 */
import type { UpdateRun, UpdaterConfigPatch, UpdaterErrorBody, UpdaterStatus } from '../types.ts';
/**
 * Why one request failed: a Host error code, or the transport never answered.
 * The page turns this code into localized copy; the message rides verbatim.
 */
export type UpdaterFailureCode = UpdaterErrorBody['code'] | 'network';
/**
 * Whether a run may still move without another request.
 *
 * `failed` normally stays in flight: an update that fails rolls itself back, so
 * the page keeps polling until the run reports `rolled-back`. The exception is a
 * failure inside the rollback itself — the run stops there, with nothing left
 * to return to — and treating it as in flight would leave the page polling a
 * finished run while disabling every action.
 * @param run - the run the Host reports.
 * @returns true while the page keeps polling and keeps the update action disabled.
 */
export declare function isRunInFlight(run: UpdateRun): boolean;
/** One failed Updater request, carrying the machine-readable cause. */
export declare class UpdaterRequestError extends Error {
    /** Stable cause: a Host error code, or `network` when no answer arrived. */
    readonly code: UpdaterFailureCode;
    /**
     * @param code - stable cause.
     * @param message - displayable explanation.
     * @param cause - the underlying transport failure, when there is one.
     */
    constructor(code: UpdaterFailureCode, message: string, cause?: unknown);
}
/**
 * Read the current status, including the log tail of the running or last run.
 * @returns the Host's status projection.
 * @throws UpdaterRequestError when the transport fails or the Host refuses.
 */
export declare function fetchStatus(): Promise<UpdaterStatus>;
/**
 * Trigger one read-only upstream probe.
 * @returns the status carrying the new check result.
 * @throws UpdaterRequestError when the transport fails or the Host refuses.
 */
export declare function runCheck(): Promise<UpdaterStatus>;
/**
 * Start an update. The Host refuses with code `busy` while one is already running.
 * @returns the status of the started run.
 * @throws UpdaterRequestError when the transport fails or the Host refuses.
 */
export declare function startUpdate(): Promise<UpdaterStatus>;
/**
 * Roll the checkout back to the most recent run's `beforeSha`.
 * @returns the status after the rollback.
 * @throws UpdaterRequestError when the transport fails or the Host refuses.
 */
export declare function rollback(): Promise<UpdaterStatus>;
/**
 * Write the tunables the page edits.
 * @param patch - fields to replace; an omitted field keeps its current value.
 * @returns the status carrying the effective configuration.
 * @throws UpdaterRequestError when the transport fails or the Host refuses.
 */
export declare function patchConfig(patch: UpdaterConfigPatch): Promise<UpdaterStatus>;
