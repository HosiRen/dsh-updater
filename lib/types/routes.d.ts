/**
 * The browser-facing HTTP surface. This module is a pure adapter: it owns
 * routing, request parsing, the browser-trust fence, and response encoding,
 * and delegates every domain decision to {@link UpdaterApi}.
 *
 * @module @local/dsh-updater/routes
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { UpdaterConfigPatch, UpdaterErrorBody, UpdaterStatus } from './types.ts';
/** Path prefix every updater route hangs under. */
export declare const UPDATER_ROUTE_PREFIX = "/dsh-updater";
/** The operations the routes expose, implemented by the Host half. */
export interface UpdaterApi {
    /** Read the current projection. */
    status(): Promise<UpdaterStatus>;
    /** Probe the remote without changing the checkout. */
    check(): Promise<UpdaterStatus>;
    /** Start one update run. */
    update(): Promise<UpdaterStatus>;
    /** Roll the checkout back to the last run's pre-update commit. */
    rollback(): Promise<UpdaterStatus>;
    /**
     * Write tunables back to the profile patch.
     * @param patch - Fields to change; omitted fields keep their value.
     */
    patchConfig(patch: UpdaterConfigPatch): Promise<UpdaterStatus>;
}
/** Refusal status a request's headers earn, or `undefined` to proceed. */
export type RefuseRequest = (headers: IncomingMessage['headers']) => 401 | 403 | undefined;
/** What the handler needs from its owner. */
export interface RouteDependencies {
    readonly api: UpdaterApi;
    /** Browser-trust fence reused from the connection carrier. */
    readonly refuse: RefuseRequest;
}
/** A refusal the browser half renders from its stable code. */
export declare class UpdaterRequestError extends Error {
    readonly code: UpdaterErrorBody['code'];
    /**
     * @param code - Machine-readable cause sent on the wire.
     * @param message - Human-readable explanation, safe to display.
     */
    constructor(code: UpdaterErrorBody['code'], message: string);
}
/**
 * Build the route handler registered on `webServer`.
 *
 * The handler owns its full response lifecycle, never throws, and answers
 * every request with either an {@link UpdaterStatus} document or an
 * {@link UpdaterErrorBody} envelope.
 * @param dependencies - The domain operations plus the trust fence.
 * @returns A node:http handler bound to {@link UPDATER_ROUTE_PREFIX}.
 */
export declare function createUpdaterHandler(dependencies: RouteDependencies): (request: IncomingMessage, response: ServerResponse) => Promise<void>;
