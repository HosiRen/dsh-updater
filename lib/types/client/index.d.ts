/**
 * Update settings page, browser half: registers the Settings navigation entry
 * and owns everything that talks to the Host — the status cache, the
 * one-second poll that runs only while a run may still move, and the actions
 * the page fires. The page component (`./UpdaterSection.tsx`) is
 * presentational: it renders this controller's published state and calls back
 * through the same inject face.
 *
 * No Harness Client package is imported as a value — the page carries its own
 * snapshot source, and the slot registry and locale service arrive as cordis
 * services. The `settings.section` slot belongs to the settings shell, so this
 * plugin contributes through `slots.inject` and never depends on the shell's
 * activation order.
 *
 * @module @local/dsh-updater/client
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { UpdaterConfigPatch, UpdaterStatus } from '../types.ts';
import { type UpdaterFailureCode } from './api.ts';
import { type UpdaterLocaleKey } from './locales.ts';
/** Required services (cordis fiber inject). */
export declare const inject: string[];
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Update settings page copy. */
        'settings.updater': UpdaterLocaleKey;
    }
}
/** One action the page can start. */
type UpdaterAction = 'check' | 'update' | 'rollback' | 'config';
/** A failure the page reports in place, with the code that explains it. */
export interface UpdaterNotice {
    /** Stable cause: a Host error code, or `network` when no answer arrived. */
    readonly code: UpdaterFailureCode;
    /** Explanation from the Host or the transport, shown verbatim. */
    readonly message: string;
}
/** Everything the Update page renders, republished on every change. */
export interface UpdaterSectionState {
    /** Latest status; undefined until the first read settles. */
    readonly status: UpdaterStatus | undefined;
    /** Action in flight, or undefined while the page is idle. */
    readonly pending: UpdaterAction | undefined;
    /** Failure of the most recent read or action, or undefined. */
    readonly notice: UpdaterNotice | undefined;
    /** Failure of the most recent configuration write, or undefined. */
    readonly configError: UpdaterNotice | undefined;
}
/** Registration-side face for the Update page: plain state plus plain callbacks. */
export interface UpdaterSectionInjected {
    hooks: {
        /** Page state; the renderer binds it as the `useUpdater` prop. */
        updater: HostObservable<UpdaterSectionState>;
    };
    /** Trigger one read-only upstream probe. */
    check: () => void;
    /** Start an update; the Host refuses while another one runs. */
    update: () => void;
    /** Roll the checkout back to the most recent run's `beforeSha`. */
    rollback: () => void;
    /** Write the tunables the page edits. */
    saveConfig: (patch: UpdaterConfigPatch) => void;
}
/**
 * Register the Update page and its dictionary.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
export {};
