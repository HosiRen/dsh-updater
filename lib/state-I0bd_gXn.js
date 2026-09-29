import path from "node:path";
import { execFile } from "node:child_process";
import { appendFile, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { Buffer as Buffer$1 } from "node:buffer";
//#region src/git.ts
/**
* Git command wrappers for the Updater's Host half. Every command runs through
* `execFile` with an explicit argument vector (never a shell), a bounded
* timeout, and a retained-output cap, so a pathological repository cannot hang
* the Host or exhaust memory. Read helpers interpret their commands and fail
* loud; write helpers return the raw {@link GitResult} so the caller decides
* which exit codes are acceptable.
* @module @local/dsh-updater/git
*/
/** Bound on one ordinary git command when the caller sets none. */
const DEFAULT_TIMEOUT_MS = 12e4;
/** Bound on a network fetch: cloning a busy upstream legitimately outlasts every local command. */
const DEFAULT_FETCH_TIMEOUT_MS = 6e5;
/** Retained bytes per stream when the caller sets no cap; older bytes are dropped. */
const DEFAULT_MAX_BYTES = 1024 * 1024;
/**
* Working-tree paths reported by {@link repoFacts}. The list is a diagnostic
* sample for the Settings page, not an inventory: the clean/dirty verdict comes
* from the command, never from this array.
*/
const MAX_DIRTY_FILES = 50;
/** Prefix announcing that a stream was cut to its tail. */
const TRUNCATION_NOTICE = "[dsh-updater] output truncated; kept the tail\n";
/** Full-SHA pattern; 40 hex digits for SHA-1 repositories, 64 for SHA-256 ones. */
const SHA_RE = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/i;
/**
* Run one git command in a checkout.
*
* The environment disables interactive credential prompts and optional index
* locking, so an unattended run fails instead of waiting, and pins the C locale
* so git's diagnostic text does not depend on the operator's environment. A
* command that never starts or is killed by the timeout reports
* `exitCode: null` with the cause appended to `stderr`; output beyond
* `maxBytes` keeps its tail, which is where the diagnostic detail is.
* @param root - Directory the command runs in; also the repository it acts on.
* @param args - Argument vector passed to git verbatim.
* @param options - Timeout, output cap, and abort signal.
* @returns The command's exit code, retained output, and timeout verdict.
*/
async function runGit(root, args, options = {}) {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxBytes = Math.max(0, options.maxBytes ?? DEFAULT_MAX_BYTES);
	const settlement = await exec([...args], {
		cwd: root,
		env: {
			...process.env,
			GIT_TERMINAL_PROMPT: "0",
			GIT_OPTIONAL_LOCKS: "0",
			LC_ALL: "C",
			LANG: "C"
		},
		timeout: timeoutMs,
		maxBuffer: Math.max(maxBytes * 4, 8 * 1024 * 1024),
		encoding: "utf8",
		windowsHide: true,
		...options.signal === void 0 ? {} : { signal: options.signal }
	});
	if (settlement.started) return {
		exitCode: 0,
		stdout: keepTail(settlement.stdout, maxBytes),
		stderr: keepTail(settlement.stderr, maxBytes),
		timedOut: false
	};
	return failureResult(settlement.error, settlement.stdout, settlement.stderr, maxBytes);
}
/**
* Read the local repository facts the Settings page shows.
*
* Runs three commands: `rev-parse HEAD`, `rev-parse --abbrev-ref HEAD`, and
* `status --porcelain`. A detached or unreadable branch is reported as `HEAD`;
* every other command failure throws, because facts that silently read as
* "clean checkout" would let the update pipeline run against unknown state.
* @param root - Checkout root.
* @param options - Timeout, output cap, and abort signal.
* @returns The current SHA, branch, and working-tree verdict.
* @throws When a required git command fails or the timeout expires.
*/
async function repoFacts(root, options = {}) {
	const head = await requiredOutput(root, ["rev-parse", "HEAD"], options, "read HEAD");
	const branchResult = await runGit(root, [
		"rev-parse",
		"--abbrev-ref",
		"HEAD"
	], options);
	const branchName = branchResult.stdout.trim();
	const branch = branchResult.exitCode === 0 && branchName !== "" ? branchName : "HEAD";
	const statusResult = await runGit(root, ["status", "--porcelain"], options);
	if (statusResult.exitCode !== 0) throw new Error(commandFailure("status --porcelain", root, statusResult));
	const statusLines = splitLines(statusResult.stdout);
	const dirtyFiles = statusLines.slice(0, MAX_DIRTY_FILES).map(statusPath);
	return {
		head,
		branch,
		dirty: statusLines.length > 0,
		dirtyFiles
	};
}
/**
* Read the tip of one branch on a remote without changing the local repository.
* @param root - Checkout root.
* @param remote - Remote name, such as `origin`.
* @param branch - Branch name without the `refs/heads/` prefix.
* @param options - Timeout, output cap, and abort signal.
* @returns The remote tip SHA, or `undefined` when the remote has no such branch.
* @throws When `git ls-remote` itself fails, so an unreachable remote is never reported as "no update".
*/
async function remoteHead(root, remote, branch, options = {}) {
	const result = await runGit(root, [
		"ls-remote",
		remote,
		`refs/heads/${branch}`
	], options);
	if (result.exitCode !== 0) throw new Error(commandFailure(`ls-remote ${remote} refs/heads/${branch}`, root, result));
	for (const line of splitLines(result.stdout)) {
		const sha = line.trim().split(/\s+/)[0];
		if (sha !== void 0 && SHA_RE.test(sha)) return sha;
	}
}
/**
* Fetch one remote, updating its remote-tracking refs.
* @param root - Checkout root.
* @param remote - Remote name, such as `origin`.
* @param options - Timeout, output cap, and abort signal; the timeout defaults to ten minutes.
* @returns The raw result; the caller decides which exit codes are acceptable.
*/
async function fetchRemote(root, remote, options = {}) {
	return runGit(root, ["fetch", remote], withTimeout(options, DEFAULT_FETCH_TIMEOUT_MS));
}
/**
* Fast-forward the checked-out branch onto `target`.
* @param root - Checkout root.
* @param target - Commit or ref to merge, such as `origin/main`.
* @param options - Timeout, output cap, and abort signal.
* @returns The raw result; a non-zero exit code means the merge was not a fast-forward.
*/
async function mergeFastForward(root, target, options = {}) {
	return runGit(root, [
		"merge",
		"--ff-only",
		target
	], options);
}
/**
* Move the checked-out branch to `sha`, discarding working-tree changes.
* @param root - Checkout root.
* @param sha - Commit to reset to, typically the pre-merge `HEAD`.
* @param options - Timeout, output cap, and abort signal.
* @returns The raw result; the caller verifies the reset by re-reading the facts.
*/
async function resetHard(root, sha, options = {}) {
	return runGit(root, [
		"reset",
		"--hard",
		sha
	], options);
}
/**
* Run one git command that must succeed for its output to be meaningful.
* @param root - Checkout root.
* @param args - Argument vector passed to git verbatim.
* @param options - Timeout, output cap, and abort signal.
* @param action - Action named in the thrown message, such as `read HEAD`.
* @returns The trimmed standard output.
* @throws When the command exits non-zero or times out.
*/
async function requiredOutput(root, args, options, action) {
	const result = await runGit(root, args, options);
	if (result.exitCode !== 0) throw new Error(commandFailure(`${action} (git ${args.join(" ")})`, root, result));
	return result.stdout.trim();
}
/**
* Render one failed command as a thrown message.
* @param command - Command description for the message.
* @param root - Directory the command ran in.
* @param result - The failed result.
* @returns The message, including the timeout verdict and the stderr tail.
*/
function commandFailure(command, root, result) {
	const exit = result.exitCode === null ? "no exit code" : `exit code ${String(result.exitCode)}`;
	const timeout = result.timedOut ? ", timed out" : "";
	const detail = result.stderr.trim();
	return `git ${command} failed in ${root} (${exit}${timeout})${detail === "" ? "" : `: ${detail}`}`;
}
/**
* Merge one caller timeout over a command's own default.
* @param options - Caller options.
* @param fallback - Timeout used when the caller set none.
* @returns Options with an explicit timeout, absent fields staying absent.
*/
function withTimeout(options, fallback) {
	return {
		timeoutMs: options.timeoutMs ?? fallback,
		...options.maxBytes === void 0 ? {} : { maxBytes: options.maxBytes },
		...options.signal === void 0 ? {} : { signal: options.signal }
	};
}
/**
* Run one git command with `execFile`, resolving instead of rejecting so partial output survives a failure.
* @param args - Argument vector passed to git verbatim.
* @param options - Command options, including the encoding that types the output as `string`.
* @returns How the command settled, with whatever output it produced.
*/
function exec(args, options) {
	return new Promise((resolve) => {
		execFile("git", [...args], options, (error, stdout, stderr) => {
			resolve(error === null ? {
				started: true,
				stdout,
				stderr
			} : {
				started: false,
				error,
				stdout,
				stderr
			});
		});
	});
}
/**
* Translate one failed `execFile` call into a {@link GitResult}.
* @param error - Rejection value of unknown type.
* @param fallbackOut - Standard output the callback reported.
* @param fallbackErr - Standard error the callback reported.
* @param maxBytes - Retained output cap per stream.
* @returns The result, with the cause appended to stderr when the command never produced an exit code.
*/
function failureResult(error, fallbackOut, fallbackErr, maxBytes) {
	let exitCode = null;
	let timedOut = false;
	let stdout = fallbackOut;
	let stderr = fallbackErr;
	let cause;
	if (typeof error === "object" && error !== null) {
		if ("code" in error && typeof error.code === "number") exitCode = error.code;
		if ("killed" in error && error.killed === true) timedOut = true;
		if ("stdout" in error && typeof error.stdout === "string") stdout = error.stdout;
		if ("stderr" in error && typeof error.stderr === "string") stderr = error.stderr;
		if ("message" in error && typeof error.message === "string") cause = error.message;
	} else cause = String(error);
	if (exitCode === null && cause !== void 0 && !stderr.includes(cause)) stderr = stderr === "" ? cause : `${stderr}\n${cause}`;
	return {
		exitCode,
		stdout: keepTail(stdout, maxBytes),
		stderr: keepTail(stderr, maxBytes),
		timedOut
	};
}
/**
* Cut one stream to its last `maxBytes` bytes, dropping a leading partial UTF-8 character.
* @param text - Decoded stream content.
* @param maxBytes - Retained byte budget.
* @returns The content unchanged when it fits, otherwise a truncation notice followed by the tail.
*/
function keepTail(text, maxBytes) {
	if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
	const bytes = Buffer.from(text, "utf8");
	let start = Math.max(0, bytes.length - maxBytes);
	for (;;) {
		const byte = bytes.at(start);
		if (byte === void 0 || (byte & 192) !== 128) break;
		start += 1;
	}
	return `${TRUNCATION_NOTICE}${bytes.subarray(start).toString("utf8")}`;
}
/**
* Split command output into non-empty lines.
* @param text - Command output.
* @returns The lines, without a trailing empty entry from the final newline.
*/
function splitLines(text) {
	return text.split("\n").filter((line) => line.trim() !== "");
}
/**
* Strip the two status columns from one `status --porcelain` line.
* @param line - One porcelain line, `XY PATH`.
* @returns The path, with surrounding git quoting removed.
*/
function statusPath(line) {
	const path = line.length > 3 ? line.slice(3).trim() : line.trim();
	return path.length >= 2 && path.startsWith("\"") && path.endsWith("\"") ? path.slice(1, -1) : path;
}
//#endregion
//#region src/pipeline.ts
/**
* Pure decisions of the update pipeline, shared by the parent process and the
* update subprocess: the build steps one build scope runs, the classification
* of a refused fast-forward, bounded output tails, run ids, and validation of
* the subprocess configuration. Nothing here touches the filesystem, starts a
* process, or reaches the network.
*
* @module @local/dsh-updater/pipeline
*/
/**
* Build scripts each scope runs, in order, after dependencies are installed.
* A full build also produces the native-system artifacts; the `lib-web` scope
* rebuilds only the two JavaScript bundles the running Harness loads.
*/
const BUILD_SCRIPTS = {
	full: ["build"],
	"lib-web": ["build:lib", "build:web"]
};
/**
* The ordered build steps for one build scope: dependency installation first,
* then that scope's build scripts.
* @param scope Build the pipeline runs after the merge.
* @param pnpmCommand Package manager executable that runs the scripts.
* @returns The steps in execution order; the first one is always the install step.
*/
function buildSteps(scope, pnpmCommand) {
	return [{
		phase: "installing",
		command: [pnpmCommand, "install"]
	}, ...BUILD_SCRIPTS[scope].map((script) => ({
		phase: "building",
		command: [
			pnpmCommand,
			"run",
			script
		]
	}))];
}
/**
* Git messages that name the refusal itself: the local branch cannot
* fast-forward onto the fetched tip. Matched case-insensitively, because git
* capitalizes the same message differently across commands and versions.
*/
const FAST_FORWARD_REFUSALS = [
	/not possible to fast-forward/i,
	/non-fast-forward/i,
	/\[rejected\]/i,
	/diverg(?:ed|ing)/i,
	/tip of your current branch is behind/i
];
/**
* Merge messages that report a content merge instead. The pipeline merges with
* `--ff-only`, so a conflict report is never the fast-forward refusal this
* classification describes.
*/
const CONTENT_MERGE_REFUSALS = [/CONFLICT/i, /automatic merge failed/i];
/**
* Which failure a merge attempt represents.
* @param result Result of the `--ff-only` merge attempt.
* @returns `'not-fast-forward'` only when the command failed with an exit code
* and git reported that the branch cannot fast-forward; `'internal'` otherwise,
* including a timeout, a command that never started, a conflict report, and a
* zero exit code (which is no failure at all).
*/
function classifyMergeFailure(result) {
	if (result.timedOut || result.exitCode === null || result.exitCode === 0) return "internal";
	const reported = `${result.stderr}\n${result.stdout}`;
	const refusedFastForward = FAST_FORWARD_REFUSALS.some((pattern) => pattern.test(reported));
	const attemptedContentMerge = CONTENT_MERGE_REFUSALS.some((pattern) => pattern.test(reported));
	if (refusedFastForward && !attemptedContentMerge) return "not-fast-forward";
	return "internal";
}
/** Bytes of a running command's standard error kept in memory as failure evidence. */
const OUTPUT_TAIL_BYTES = 64 * 1024;
/** Bytes of a failed command's standard error archived in the durable run record. */
const STDERR_TAIL_BYTES = 8 * 1024;
/**
* Append a chunk to a bounded tail, dropping the oldest bytes past `limit`.
* @param current Tail kept so far.
* @param chunk Newly read output.
* @param limit Maximum bytes of the result.
* @returns The tail of `current` and `chunk` together, covering at most `limit`
* bytes of their UTF-8 encoding. A cut in the middle of a multi-byte character
* becomes `U+FFFD`.
*/
function appendTail(current, chunk, limit) {
	const combined = Buffer$1.concat([Buffer$1.from(current, "utf8"), Buffer$1.from(chunk, "utf8")]);
	if (combined.byteLength <= limit) return combined.toString("utf8");
	return combined.subarray(combined.byteLength - limit).toString("utf8");
}
/**
* Render one pipeline step's log header.
* @param phase Phase the step runs in.
* @param command Command and arguments, rendered verbatim in written order.
* @returns A single log line naming the phase and the command.
*/
function formatStepHeader(phase, command) {
	return `[${phase}] $ ${command.join(" ")}`;
}
/**
* The first non-empty line of command output, trimmed.
* @param text Command output.
* @returns The first line with content, or an empty string when there is none.
*/
function firstLine(text) {
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed !== "") return trimmed;
	}
	return "";
}
/**
* Build a run id from the instant the run started and a random suffix. Colons
* and the millisecond separator become dashes, so the id is a valid file name
* on every supported platform.
* @param at Instant the run started.
* @param suffix Short random suffix that separates runs started in the same millisecond.
* @returns The run id, also usable as a log file's base name.
*/
function newRunId(at, suffix) {
	return `${at.toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${suffix}`;
}
/**
* One-line description of a caught value, for failure messages and log lines.
* @param error Value caught from a rejected promise or a thrown statement.
* @returns The error's message, or the value's string form.
*/
function describeError(error) {
	return error instanceof Error ? error.message : String(error);
}
/**
* Full description of a caught value, preferring a stack when it carries one.
* @param error Value caught from a rejected promise or a thrown statement.
* @returns The error's stack or message, or the value's string form.
*/
function describeErrorDetail(error) {
	return error instanceof Error ? error.stack ?? error.message : String(error);
}
/**
* Wall-clock limit for one pipeline command when the configuration carries
* none. A cold dependency install and a full build both outlast any shorter
* bound, so the default is twenty minutes.
*/
const DEFAULT_COMMAND_TIMEOUT_MS = 20 * 6e4;
/**
* Run-id form, also the accepted log-file base-name form: it must start with
* an alphanumeric character and carry no path separator, so a hostile or
* damaged configuration cannot steer a log write outside the state directory.
*/
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
/**
* Parse and validate the JSON configuration that crosses into the update
* subprocess. That argument is a process boundary, so every field is checked
* here instead of being trusted.
* @param raw JSON text of the run configuration.
* @returns The validated configuration, with absent optional fields left absent.
* @throws When the text is not JSON, is not an object, or carries a missing or malformed field.
*/
function parseRunnerConfig(raw) {
	const parsed = JSON.parse(raw);
	if (!isRecord$1(parsed)) throw new Error("the run configuration must be a JSON object");
	const runId = requireString(parsed, "runId");
	if (!RUN_ID_PATTERN.test(runId)) throw new Error(`the run configuration field "runId" is not usable as a log file name: ${JSON.stringify(runId)}`);
	const paths = requireRecord(parsed, "paths");
	const build = requireString(parsed, "build");
	if (build !== "full" && build !== "lib-web") throw new Error("the run configuration field \"build\" must be \"full\" or \"lib-web\"");
	const mode = parsed["mode"];
	if (mode !== void 0 && mode !== "update" && mode !== "rollback") throw new Error("the run configuration field \"mode\" must be \"update\" or \"rollback\"");
	const timeoutMs = parsed["timeoutMs"];
	if (timeoutMs !== void 0 && (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0)) throw new Error("the run configuration field \"timeoutMs\" must be a positive number of milliseconds");
	const base = {
		runId,
		root: requireString(parsed, "root"),
		paths: {
			dir: requireString(paths, "dir"),
			stateFile: requireString(paths, "stateFile"),
			logDir: requireString(paths, "logDir"),
			lockFile: requireString(paths, "lockFile")
		},
		beforeSha: requireString(parsed, "beforeSha"),
		remote: requireString(parsed, "remote"),
		branch: requireString(parsed, "branch"),
		build,
		pnpmCommand: requireString(parsed, "pnpmCommand")
	};
	const withMode = mode === void 0 ? base : {
		...base,
		mode
	};
	return timeoutMs === void 0 ? withMode : {
		...withMode,
		timeoutMs
	};
}
/** Whether a decoded JSON value is a plain object rather than an array or a primitive. */
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Read a required non-empty string field of a decoded JSON object. */
function requireString(record, key) {
	const value = record[key];
	if (typeof value !== "string" || value === "") throw new Error(`the run configuration field "${key}" must be a non-empty string`);
	return value;
}
/** Read a required object field of a decoded JSON object. */
function requireRecord(record, key) {
	const value = record[key];
	if (!isRecord$1(value)) throw new Error(`the run configuration field "${key}" must be an object`);
	return value;
}
//#endregion
//#region src/state.ts
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
/** Mode for every directory the Updater creates: owner-only. */
const DIR_MODE = 448;
/** Mode for every file the Updater creates: owner-only. */
const FILE_MODE = 384;
/** Base name of the probe record beside the run state. */
const CHECK_FILE_NAME = "check.json";
/**
* Phase names of {@link UpdatePhase}, for validating a stored run at the file
* boundary. Kept in step with the union in `./types.ts`.
*/
const UPDATE_PHASES = [
	"preflight",
	"fetching",
	"merging",
	"installing",
	"building",
	"done",
	"failed",
	"rolling-back",
	"rolled-back"
];
/**
* Derive every Updater path from one Harness home directory.
* @param home - The Harness home, `$DSH_HOME`.
* @returns The directory, run state, log directory, and lock file.
*/
function updaterPaths(home) {
	const dir = path.join(home, "updater");
	return {
		dir,
		stateFile: path.join(dir, "state.json"),
		logDir: path.join(dir, "logs"),
		lockFile: path.join(dir, "run.lock")
	};
}
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
function openCheckRecordStore(paths) {
	const file = path.join(paths.dir, CHECK_FILE_NAME);
	return {
		read: async () => readCheckResult(file),
		write: async (result) => {
			await writeFileAtomic(file, `${JSON.stringify(result, null, 2)}\n`);
		}
	};
}
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
async function readRun(paths) {
	let text;
	try {
		text = await readFile(paths.stateFile, "utf8");
	} catch {
		return;
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		return;
	}
	return isUpdateRun(parsed) ? parsed : void 0;
}
/**
* Replace the current update run.
* @param paths - Updater state paths.
* @param run - The run to persist; the previous record is overwritten.
* @returns Resolution after the record is durable.
*/
async function writeRun(paths, run) {
	await writeFileAtomic(paths.stateFile, `${JSON.stringify(run, null, 2)}\n`);
}
/**
* Report whether a live process holds the run lock.
*
* Same liveness rule as {@link acquireRunLock} without taking the lock, so the
* Settings page can report a running update without racing it.
* @param paths - Updater state paths.
* @returns `true` when the lock exists and its process is alive.
*/
async function isRunActive(paths) {
	const held = await readLockHolder(paths.lockFile);
	return held !== void 0 && isProcessAlive(held.pid);
}
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
async function acquireRunLock(paths) {
	await ensureDir(paths.dir);
	if (await createLockFile(paths.lockFile)) return true;
	const held = await readLockHolder(paths.lockFile);
	if (held !== void 0 && isProcessAlive(held.pid)) return false;
	await rm(paths.lockFile, { force: true });
	return createLockFile(paths.lockFile);
}
/**
* Release the run lock.
*
* Only the process that acquired the lock may call this; the lock is removed
* unconditionally, because verifying ownership at release time would leave a
* lock behind after any crash of the owner.
* @param paths - Updater state paths.
* @returns Resolution after the lock file is gone.
*/
async function releaseRunLock(paths) {
	await rm(paths.lockFile, { force: true });
}
/**
* Allocate the log file for one run.
* @param paths - Updater state paths.
* @param runId - Stable run identifier; characters that could escape the log directory are replaced.
* @returns The absolute log path, with its directory created.
*/
async function newRunLogPath(paths, runId) {
	await ensureDir(paths.logDir);
	return path.join(paths.logDir, `${logBaseName(runId)}.log`);
}
/**
* Append one chunk to a run log.
* @param logPath - Absolute log path, typically from {@link newRunLogPath}.
* @param chunk - Text to append verbatim.
* @returns Resolution after the chunk is written.
*/
async function appendLog(logPath, chunk) {
	await ensureDir(path.dirname(logPath));
	await appendFile(logPath, chunk, {
		encoding: "utf8",
		mode: FILE_MODE
	});
}
/**
* Read the tail of a run log.
*
* The tail is what a status reader needs: the last lines name the failure,
* while the head is long superseded by install and build output.
* @param logPath - Absolute log path.
* @param maxBytes - Retained byte budget; older bytes are dropped.
* @returns The tail, decoded without a leading partial character, or an empty string when the log is absent.
*/
async function readLogTail(logPath, maxBytes) {
	let handle;
	try {
		handle = await open(logPath, "r");
	} catch (error) {
		if (hasErrnoCode(error, "ENOENT")) return "";
		throw error;
	}
	try {
		const size = (await handle.stat()).size;
		const start = Math.max(0, size - Math.max(0, Math.floor(maxBytes)));
		const length = size - start;
		if (length === 0) return "";
		const buffer = Buffer.alloc(length);
		const { bytesRead } = await handle.read(buffer, 0, length, start);
		return decodeTail(buffer.subarray(0, bytesRead));
	} finally {
		await handle.close();
	}
}
/**
* Delete all but the newest run logs.
* @param paths - Updater state paths.
* @param keep - How many logs to keep, newest first by modification time.
* @returns Resolution after the older logs are gone; a missing log directory is a no-op.
*/
async function pruneLogs(paths, keep) {
	let entries;
	try {
		entries = await readdir(paths.logDir, { withFileTypes: true });
	} catch (error) {
		if (hasErrnoCode(error, "ENOENT")) return;
		throw error;
	}
	const logs = [];
	for (const entry of entries) {
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;
		const file = path.join(paths.logDir, entry.name);
		try {
			logs.push({
				file,
				mtimeMs: (await stat(file)).mtimeMs
			});
		} catch (error) {
			if (hasErrnoCode(error, "ENOENT")) continue;
			throw error;
		}
	}
	logs.sort((left, right) => right.mtimeMs - left.mtimeMs || right.file.localeCompare(left.file));
	for (const log of logs.slice(Math.max(0, Math.floor(keep)))) await rm(log.file, { force: true });
}
/**
* Distinguishes this process's concurrent temp files, so two in-flight writes
* of one path cannot replace each other's staging file.
*/
let tempCounter = 0;
/**
* Read the stored probe, tolerating every failure the way {@link readRun} does.
* @param file - Absolute path of the probe record.
* @returns The record, or `undefined` when none can be read or validated.
*/
async function readCheckResult(file) {
	let text;
	try {
		text = await readFile(file, "utf8");
	} catch {
		return;
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		return;
	}
	return isCheckResult(parsed) ? parsed : void 0;
}
/**
* Create the lock file exclusively.
* @param file - Absolute lock path.
* @returns `true` when this call created it, `false` when a lock already exists.
*/
async function createLockFile(file) {
	let handle;
	try {
		handle = await open(file, "wx", FILE_MODE);
	} catch (error) {
		if (hasErrnoCode(error, "EEXIST")) return false;
		throw error;
	}
	try {
		const holder = {
			pid: process.pid,
			startedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		await handle.writeFile(JSON.stringify(holder), "utf8");
	} finally {
		await handle.close();
	}
	return true;
}
/**
* Read the holder recorded in one lock file.
* @param file - Absolute lock path.
* @returns The holder, or `undefined` when the lock is absent or its content is unusable.
*/
async function readLockHolder(file) {
	let text;
	try {
		text = await readFile(file, "utf8");
	} catch {
		return;
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		return;
	}
	if (typeof parsed !== "object" || parsed === null || !("pid" in parsed)) return void 0;
	const pid = parsed.pid;
	if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) return void 0;
	return {
		pid,
		startedAt: "startedAt" in parsed && typeof parsed.startedAt === "string" ? parsed.startedAt : ""
	};
}
/**
* Decide whether a pid belongs to a live process.
* @param pid - Pid recorded in the lock.
* @returns `true` unless the kernel proves the process is gone.
*/
function isProcessAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return !hasErrnoCode(error, "ESRCH");
	}
}
/**
* Write one file by replacing it atomically.
* @param file - Absolute target path.
* @param content - Complete new content.
* @returns Resolution after the replacement is visible.
*/
async function writeFileAtomic(file, content) {
	const dir = path.dirname(file);
	await ensureDir(dir);
	const temp = path.join(dir, `.${path.basename(file)}.${String(process.pid)}.${String(tempCounter++)}.tmp`);
	try {
		await writeFile(temp, content, {
			encoding: "utf8",
			mode: FILE_MODE
		});
		await rename(temp, file);
	} catch (error) {
		await rm(temp, { force: true }).catch(() => void 0);
		throw error;
	}
}
/**
* Create one directory tree with owner-only permissions.
* @param dir - Absolute directory path.
* @returns Resolution after the directory exists.
*/
async function ensureDir(dir) {
	await mkdir(dir, {
		recursive: true,
		mode: DIR_MODE
	});
}
/**
* Build a log base name that cannot leave the log directory.
* @param runId - Stable run identifier.
* @returns The identifier with every other character replaced by `_`, or `run` when nothing survives.
*/
function logBaseName(runId) {
	const safe = runId.replace(/[^A-Za-z0-9._-]+/g, "_");
	return safe === "" ? "run" : safe;
}
/**
* Decode the tail bytes of a log, dropping a leading partial character.
* @param bytes - Bytes read from the end of the file.
* @returns The decoded text.
*/
function decodeTail(bytes) {
	let start = 0;
	for (;;) {
		const byte = bytes.at(start);
		if (byte === void 0 || (byte & 192) !== 128) break;
		start += 1;
	}
	return bytes.subarray(start).toString("utf8");
}
/**
* Validate one parsed value as a stored run.
* @param value - Value produced by `JSON.parse`.
* @returns `true` when every required field is present and typed.
*/
function isUpdateRun(value) {
	if (!isRecord(value)) return false;
	return typeof value.runId === "string" && isUpdatePhase(value.phase) && typeof value.startedAt === "string" && absentOrString(value, "finishedAt") && typeof value.beforeSha === "string" && absentOrString(value, "afterSha") && (value.failure === void 0 || isUpdateFailure(value.failure));
}
/**
* Validate one parsed value as stored failure evidence.
* @param value - Value produced by `JSON.parse`.
* @returns `true` when every field is present and typed.
*/
function isUpdateFailure(value) {
	if (!isRecord(value)) return false;
	return isUpdatePhase(value.phase) && typeof value.message === "string" && (value.exitCode === null || typeof value.exitCode === "number") && typeof value.stderrTail === "string" && typeof value.logPath === "string";
}
/**
* Validate one parsed value as a stored probe.
* @param value - Value produced by `JSON.parse`.
* @returns `true` when the four required fields are present and typed.
*/
function isCheckResult(value) {
	if (!isRecord(value)) return false;
	return typeof value.checkedAt === "string" && typeof value.localSha === "string" && typeof value.upstreamSha === "string" && typeof value.updateAvailable === "boolean" && absentOrString(value, "error");
}
/**
* Test one parsed value for a phase name.
* @param value - Value produced by `JSON.parse`.
* @returns `true` when the value names a known phase.
*/
function isUpdatePhase(value) {
	return typeof value === "string" && UPDATE_PHASES.includes(value);
}
/**
* Test one property for being absent or a string.
* @param record - Parsed object.
* @param key - Property name.
* @returns `true` when the property is absent or holds a string.
*/
function absentOrString(record, key) {
	const value = record[key];
	return value === void 0 || typeof value === "string";
}
/**
* Test one parsed value for being a JSON object.
* @param value - Value produced by `JSON.parse`.
* @returns `true` when the value is a non-null, non-array object.
*/
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Test one caught value for a Node errno code.
* @param error - Caught value of unknown type.
* @param code - Errno code to match, such as `ENOENT`.
* @returns `true` when the value carries that code.
*/
function hasErrnoCode(error, code) {
	if (typeof error !== "object" || error === null || !("code" in error)) return false;
	return error.code === code;
}
//#endregion
export { parseRunnerConfig as C, repoFacts as D, remoteHead as E, resetHard as O, newRunId as S, mergeFastForward as T, classifyMergeFailure as _, openCheckRecordStore as a, firstLine as b, readRun as c, writeRun as d, DEFAULT_COMMAND_TIMEOUT_MS as f, buildSteps as g, appendTail as h, newRunLogPath as i, runGit as k, releaseRunLock as l, STDERR_TAIL_BYTES as m, appendLog as n, pruneLogs as o, OUTPUT_TAIL_BYTES as p, isRunActive as r, readLogTail as s, acquireRunLock as t, updaterPaths as u, describeError as v, fetchRemote as w, formatStepHeader as x, describeErrorDetail as y };
