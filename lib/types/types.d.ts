/**
 * Value contracts shared by the Updater's Host half, its update subprocess,
 * and its browser half. Every type here crosses a durable or wire boundary,
 * so fields stay JSON-compatible and carry no class identity.
 *
 * @module @local/dsh-updater/types
 */
/**
 * The DeepSeek Harness source checkout this process runs from, resolved at
 * run time so the plugin works from any installation path.
 */
export interface InstallLocation {
    /** Absolute path of the checkout root. */
    readonly root: string;
    /** Absolute path of the manifest the location was resolved from. */
    readonly anchor: string;
}
/** Local repository facts, read fresh from the checkout. */
export interface RepoFacts {
    /** Full SHA at `HEAD`. */
    readonly head: string;
    /** Current branch name, or `HEAD` when detached. */
    readonly branch: string;
    /** Working tree or index differs from `HEAD`, including untracked files a merge would leave in place. */
    readonly dirty: boolean;
    /** Working-tree paths reported by `git status --porcelain`, capped by the reader. */
    readonly dirtyFiles: readonly string[];
}
/**
 * One update run's phase. The pipeline advances monotonically except on
 * failure, which records `failed` and then the rollback phases.
 */
export type UpdatePhase = 'preflight' | 'fetching' | 'merging' | 'installing' | 'building' | 'done' | 'failed' | 'rolling-back' | 'rolled-back';
/** Why one run stopped, with the evidence a reader needs to act. */
export interface UpdateFailure {
    /** Phase the run stopped in. */
    readonly phase: UpdatePhase;
    /** One-line human-readable cause. */
    readonly message: string;
    /** Exit code of the failing command, or `null` when it never started. */
    readonly exitCode: number | null;
    /** Tail of the failing command's standard error, bounded by configuration. */
    readonly stderrTail: string;
    /**
     * First real diagnostic found in the run log, with the lines that follow it.
     * A build's captured tail is usually progress noise, so this is what actually
     * names the failure; absent when the log held no known marker.
     */
    readonly errorSummary?: string;
    /** Absolute path of the run log holding the complete output. */
    readonly logPath: string;
}
/** Durable facts about one update run. */
export interface UpdateRun {
    /** Stable identifier, also the log file's base name. */
    readonly runId: string;
    /** Current phase. */
    readonly phase: UpdatePhase;
    /** ISO-8601 instant the run started. */
    readonly startedAt: string;
    /** ISO-8601 instant the run reached a terminal phase. */
    readonly finishedAt?: string;
    /** `HEAD` recorded before the merge, the rollback target. */
    readonly beforeSha: string;
    /** `HEAD` observed after a successful merge. */
    readonly afterSha?: string;
    /** Failure evidence; present once the run failed. */
    readonly failure?: UpdateFailure;
}
/** Outcome of one read-only upstream probe. */
export interface CheckResult {
    /** ISO-8601 instant of the probe. */
    readonly checkedAt: string;
    /** Local `HEAD` the probe compared against. */
    readonly localSha: string;
    /** Upstream branch tip, or the local SHA when the probe could not reach the remote. */
    readonly upstreamSha: string;
    /** Whether the two SHAs differ. */
    readonly updateAvailable: boolean;
    /** Why the probe could not answer; absent on success. */
    readonly error?: string;
}
/** How often the Host probes the remote without being asked. */
export type AutoCheckFrequency = 'startup' | 'daily' | 'weekly' | 'monthly' | 'never';
/** Which build the update pipeline runs after merging. */
export type BuildScope = 'full' | 'lib-web';
/** The tunables the Settings page shows and writes back to the profile patch. */
export interface UpdaterConfigView {
    /** Git remote the update reads. */
    readonly remote: string;
    /** Branch the update fast-forwards to. */
    readonly branch: string;
    /** Build the pipeline runs. */
    readonly build: BuildScope;
    /** Unattended probe cadence. */
    readonly autoCheck: AutoCheckFrequency;
}
/**
 * Everything the browser half renders, produced by the Host on each read.
 * Callers read `available` first: when it is false, `unavailableReason`
 * explains why no update can run and every write is refused.
 */
export interface UpdaterStatus {
    /** Whether an updatable git checkout was resolved. */
    readonly available: boolean;
    /** Why the plugin cannot update; present exactly when `available` is false. */
    readonly unavailableReason?: string;
    /** Resolved checkout, when available. */
    readonly location?: InstallLocation;
    /** Local repository facts, when available. */
    readonly repo?: RepoFacts;
    /** Most recent probe, from storage. */
    readonly check?: CheckResult;
    /** Most recent update run, read from its durable state. */
    readonly run?: UpdateRun;
    /**
     * Whether a completed update is still waiting for a Host restart. A finished
     * run stays on disk permanently, so its phase alone cannot answer this: the
     * Host compares the run's finish instant against its own start, because a run
     * recorded before this process started is already the code being served.
     * Absent from a Host that predates the field, which readers treat as false.
     */
    readonly restartPending?: boolean;
    /** Tail of the running or last run's log. */
    readonly logTail?: string;
    /** Effective tunables. */
    readonly config: UpdaterConfigView;
}
/** Partial tunable update; omitted fields keep their current value. */
export interface UpdaterConfigPatch {
    readonly remote?: string;
    readonly branch?: string;
    readonly build?: BuildScope;
    readonly autoCheck?: AutoCheckFrequency;
}
/** Uniform failure envelope for the plugin's HTTP routes. */
export interface UpdaterErrorBody {
    /** Stable machine-readable cause. */
    readonly code: 'unavailable' | 'busy' | 'dirty' | 'no-run' | 'invalid-request' | 'internal';
    /** Human-readable explanation, safe to display. */
    readonly message: string;
}
