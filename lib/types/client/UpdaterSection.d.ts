/**
 * The Update settings page: the version comparison, the update actions, the
 * pipeline tunables, the run log, and the failure record.
 *
 * The component is presentational. Every fact arrives through the inject face
 * the registration provides — `useUpdater` for the published state and one
 * callback per action — and the only state kept here is what only this page
 * knows: whether the dirty-path list and the log panel are expanded.
 */
import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { UpdaterSectionInjected } from './index.ts';
/** Props the settings renderer binds for the Update page. */
export type UpdaterSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.updater'> & InjectFace<UpdaterSectionInjected>;
/**
 * Render the Update settings page.
 * @param props - the registration's callbacks, the page-state hook, and the page's copy.
 * @returns the settings page body.
 */
export declare function UpdaterSection({ useUpdater, check, update, rollback, saveConfig, t, }: UpdaterSectionProps): ReactNode;
