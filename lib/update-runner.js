import { C as parseRunnerConfig, O as resetHard, T as mergeFastForward, _ as classifyMergeFailure, b as firstLine, c as readRun, d as writeRun, g as buildSteps, h as appendTail, i as newRunLogPath, k as runGit, l as releaseRunLock, m as STDERR_TAIL_BYTES, n as appendLog, p as OUTPUT_TAIL_BYTES, r as isRunActive, v as describeError, w as fetchRemote, x as formatStepHeader, y as describeErrorDetail } from "./state-I0bd_gXn.js";
import { spawn } from "node:child_process";
//#region src/update-runner.ts
/**
* Subprocess entry of the update pipeline. One invocation performs exactly one
* run — `update` fetches, fast-forwards, reinstalls, and rebuilds, returning
* the checkout to the recorded `beforeSha` when a step fails; `rollback` goes
* straight back to `beforeSha` and reinstalls. The parent starts this entry
* detached, with the run log as its standard output and standard error, so the
* durable run record is the only thing callers read: this process exits with
* code 0 even when the run fails.
*
* @module @local/dsh-updater/update-runner
*/
/**
* Create the log writer for one run.
* @param logPath Absolute path of the run log, as recorded in the failure.
* @returns The writer the pipeline streams command output into.
*/
function createRunLog(logPath) {
	let chain = Promise.resolve();
	let firstFailure;
	return {
		append(chunk) {
			chain = chain.then(async () => {
				try {
					await appendLog(logPath, chunk);
				} catch (error) {
					firstFailure ??= error;
				}
			});
		},
		async flush() {
			await chain;
			if (firstFailure === void 0) return;
			console.error(`dsh-updater: could not write the run log: ${describeError(firstFailure)}`);
		}
	};
}
/**
* Run one command with the checkout root as its working directory, appending
* both output streams to the run log as they arrive.
* @param root Checkout root to run in.
* @param command Command and arguments.
* @param log Run log receiving the output.
* @param timeoutMs Wall-clock limit after which the command is killed.
* @returns The exit code, whether the limit was hit, and the standard-error tail.
*/
async function runCommand(root, command, log, timeoutMs) {
	const [file, ...args] = command;
	if (file === void 0) return {
		exitCode: null,
		timedOut: false,
		stderrTail: "the pipeline produced an empty command"
	};
	return await new Promise((resolve) => {
		const child = spawn(file, args, {
			cwd: root,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			windowsHide: true
		});
		let stderrTail = "";
		let timedOut = false;
		let settled = false;
		let timer;
		const finish = (exitCode) => {
			if (settled) return;
			settled = true;
			if (timer !== void 0) clearTimeout(timer);
			resolve({
				exitCode,
				timedOut,
				stderrTail
			});
		};
		timer = setTimeout(() => {
			timedOut = true;
			log.append(`\n[timeout] killed after ${timeoutMs} ms\n`);
			child.kill("SIGKILL");
		}, timeoutMs);
		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", (chunk) => {
			log.append(chunk);
		});
		child.stderr?.on("data", (chunk) => {
			stderrTail = appendTail(stderrTail, chunk, OUTPUT_TAIL_BYTES);
			log.append(chunk);
		});
		child.on("error", (error) => {
			const detail = `failed to start ${file}: ${error.message}\n`;
			stderrTail = appendTail(stderrTail, detail, OUTPUT_TAIL_BYTES);
			log.append(detail);
			finish(null);
		});
		child.on("close", (code) => {
			finish(code);
		});
	});
}
/**
* Persist one phase transition and keep it as the context's current record.
* @param context Run state.
* @param phase Phase the run now reports.
*/
async function advancePhase(context, phase) {
	const next = {
		...context.run,
		phase
	};
	await writeRun(context.config.paths, next);
	context.run = next;
}
/**
* Persist the `'failed'` phase with the evidence a reader needs to act on. The
* cause recorded first is never replaced: a failure inside a rollback only
* appends to the run log.
* @param context Run state.
* @param cause Failure that ended the run.
* @returns The failed record, or the record already carrying a failure.
*/
async function recordFailure(context, cause) {
	const failure = {
		phase: cause.phase,
		message: cause.message,
		exitCode: cause.exitCode,
		stderrTail: appendTail("", cause.stderrTail, STDERR_TAIL_BYTES),
		logPath: context.logPath
	};
	context.log.append(`[failed] ${cause.phase}: ${failure.message}\n`);
	if (context.run.failure !== void 0) {
		context.log.append("[failed] the run could not finish its rollback; the recorded cause above still stands\n");
		return context.run;
	}
	const failed = {
		...context.run,
		phase: "failed",
		failure
	};
	await writeRun(context.config.paths, failed);
	context.run = failed;
	return failed;
}
/** Whether a git operation failed, including one that never started. */
function gitFailed(result) {
	return result.timedOut || result.exitCode !== 0;
}
/**
* One-line cause for a failed git operation, preferring git's own message.
* @param operation Description of the attempted operation.
* @param result Result the operation returned.
* @returns A message naming the operation and its cause.
*/
function gitFailureMessage(operation, result) {
	if (result.timedOut) return `${operation} timed out`;
	const stderr = firstLine(result.stderr);
	const reported = stderr !== "" ? stderr : firstLine(result.stdout);
	return reported === "" ? `${operation} failed with exit code ${result.exitCode ?? "unknown"}` : `${operation} failed: ${reported}`;
}
/**
* Append a git operation's captured output to the run log.
* @param log Run log receiving the output.
* @param result Result whose streams are written.
*/
function appendGitOutput(log, result) {
	for (const stream of [result.stdout, result.stderr]) {
		if (stream === "") continue;
		log.append(stream.endsWith("\n") ? stream : `${stream}\n`);
	}
}
/**
* One-line cause for a failed pipeline command.
* @param command Command and arguments that failed.
* @param outcome What running it left behind.
* @returns A message naming the command and its cause.
*/
function describeCommandFailure(command, outcome) {
	const rendered = command.join(" ");
	if (outcome.timedOut) return `${rendered} timed out`;
	const reported = firstLine(outcome.stderrTail);
	return reported === "" ? `${rendered} failed with exit code ${outcome.exitCode ?? "unknown"}` : `${rendered} failed: ${reported}`;
}
/**
* Run one build step, streaming its output into the run log.
* @param context Run state.
* @param step Step to run.
* @returns `undefined` on success, otherwise the evidence of its failure.
*/
async function runStep(context, step) {
	context.log.append(`${formatStepHeader(step.phase, step.command)}\n`);
	const outcome = await runCommand(context.config.root, step.command, context.log, context.timeoutMs);
	if (outcome.exitCode === 0 && !outcome.timedOut) return void 0;
	return {
		message: describeCommandFailure(step.command, outcome),
		exitCode: outcome.exitCode,
		stderrTail: outcome.stderrTail
	};
}
/**
* Fetch the remote, fast-forward the checkout, install dependencies, and run
* the build steps of the configured scope.
* @param context Run state of an `update` run.
* @returns The `'done'` record, or the rolled-back record of a failed run.
*/
async function performUpdate(context) {
	const { config, log } = context;
	const target = `${config.remote}/${config.branch}`;
	await advancePhase(context, "fetching");
	log.append(`${formatStepHeader("fetching", [
		"git",
		"fetch",
		config.remote
	])}\n`);
	const fetched = await fetchRemote(config.root, config.remote, { timeoutMs: context.timeoutMs });
	appendGitOutput(log, fetched);
	if (gitFailed(fetched)) return await failRun(context, {
		phase: "fetching",
		message: gitFailureMessage(`git fetch ${config.remote}`, fetched),
		exitCode: fetched.exitCode,
		stderrTail: fetched.stderr
	});
	await advancePhase(context, "merging");
	log.append(`${formatStepHeader("merging", [
		"git",
		"merge",
		"--ff-only",
		target
	])}\n`);
	const merged = await mergeFastForward(config.root, target, { timeoutMs: context.timeoutMs });
	appendGitOutput(log, merged);
	if (gitFailed(merged)) return await failRun(context, {
		phase: "merging",
		message: classifyMergeFailure(merged) === "not-fast-forward" ? `cannot fast-forward to ${target}: the local branch has diverged from it` : gitFailureMessage(`git merge --ff-only ${target}`, merged),
		exitCode: merged.exitCode,
		stderrTail: merged.stderr
	});
	const [installStep, ...scriptSteps] = buildSteps(config.build, config.pnpmCommand);
	if (installStep === void 0) throw new Error("the build pipeline produced no install step");
	await advancePhase(context, "installing");
	const installCause = await runStep(context, installStep);
	if (installCause !== void 0) return await failRun(context, {
		phase: installStep.phase,
		...installCause
	});
	if (scriptSteps.length > 0) await advancePhase(context, "building");
	for (const step of scriptSteps) {
		const cause = await runStep(context, step);
		if (cause !== void 0) return await failRun(context, {
			phase: step.phase,
			...cause
		});
	}
	const head = await runGit(config.root, ["rev-parse", "HEAD"], { timeoutMs: context.timeoutMs });
	const afterSha = head.exitCode === 0 ? head.stdout.trim() : "";
	if (afterSha === "") log.append(`[done] HEAD could not be read after the update (exit code ${head.exitCode ?? "unknown"})\n`);
	const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
	const done = afterSha === "" ? {
		...context.run,
		phase: "done",
		finishedAt
	} : {
		...context.run,
		phase: "done",
		afterSha,
		finishedAt
	};
	await writeRun(config.paths, done);
	context.run = done;
	log.append(`[done]${afterSha === "" ? "" : ` HEAD is now ${afterSha}`}\n`);
	return done;
}
/**
* Run the rollback steps: `git reset --hard beforeSha`, then the install step
* so dependencies match the target revision's lockfile.
* @param context Run state.
* @param onFailure Whether a failing step ends the run as failed, or only the log records it.
* @returns The cause to record as the failure under the `'record'` policy, otherwise `undefined`.
*/
async function runRollbackSteps(context, onFailure) {
	const { config, log } = context;
	log.append(`${formatStepHeader("rolling-back", [
		"git",
		"reset",
		"--hard",
		config.beforeSha
	])}\n`);
	const reset = await resetHard(config.root, config.beforeSha, { timeoutMs: context.timeoutMs });
	appendGitOutput(log, reset);
	if (gitFailed(reset)) {
		const cause = {
			message: gitFailureMessage(`git reset --hard ${config.beforeSha}`, reset),
			exitCode: reset.exitCode,
			stderrTail: reset.stderr
		};
		if (onFailure === "record") return cause;
		log.append(`[rolling-back] the checkout may still be at the failed revision: ${cause.message}\n`);
		return;
	}
	const installStep = buildSteps(config.build, config.pnpmCommand).at(0);
	if (installStep === void 0) return void 0;
	const cause = await runStep(context, installStep);
	if (cause === void 0) return void 0;
	if (onFailure === "record") return cause;
	log.append(`[rolling-back] dependencies may still be installed for the failed revision: ${cause.message}\n`);
}
/**
* Write the terminal `'rolled-back'` phase.
* @param context Run state.
* @returns The rolled-back record.
*/
async function finishRollback(context) {
	const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
	const rolledBack = {
		...context.run,
		phase: "rolled-back",
		finishedAt
	};
	await writeRun(context.config.paths, rolledBack);
	context.run = rolledBack;
	context.log.append(`[rolled-back] ${context.config.beforeSha}\n`);
	return rolledBack;
}
/**
* Automatic rollback after a failed update run. Its own failures are reported
* in the log only, so the cause recorded first stays the run's failure.
* @param context Run state of a failed `update` run.
* @returns The rolled-back record.
*/
async function rollbackAfterFailure(context) {
	await advancePhase(context, "rolling-back");
	await runRollbackSteps(context, "report");
	return await finishRollback(context);
}
/**
* A manual rollback run: back to `beforeSha` and reinstalled, without
* contacting the remote. A failing step records the run as failed and stops —
* there is nothing left to roll back to, and a second attempt would only
* obscure what the operator is looking at.
*
* The success record carries no `afterSha`: that field documents the revision a
* successful merge produced, and this run observes no merge. `beforeSha` stays
* the revision the run returned to, and the log records the reset's own report.
* @param context Run state of a `rollback` run.
* @returns The rolled-back record, or the failed record when a step failed.
*/
async function performRollback(context) {
	await advancePhase(context, "rolling-back");
	const cause = await runRollbackSteps(context, "record");
	if (cause === void 0) return await finishRollback(context);
	const failed = await recordFailure(context, {
		phase: "rolling-back",
		...cause
	});
	context.log.append("[failed] the rollback did not complete; the checkout is left as it stands for inspection\n");
	const stopped = {
		...failed,
		finishedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	await writeRun(context.config.paths, stopped);
	return stopped;
}
/**
* Record a step failure and, for an `update` run, return the checkout to
* `beforeSha`. A `rollback` run never rolls back again.
* @param context Run state.
* @param cause Failure that ended the run.
* @returns The final record of the failed run.
*/
async function failRun(context, cause) {
	const failed = await recordFailure(context, cause);
	if (context.mode === "rollback") {
		context.log.append("[failed] the rollback did not complete; the checkout is left as it stands for inspection\n");
		const stopped = {
			...failed,
			finishedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		await writeRun(context.config.paths, stopped);
		return stopped;
	}
	return await rollbackAfterFailure(context);
}
/**
* First log line of a run: what this invocation is about to do.
* @param config Configuration of the run.
* @param mode Work the run performs.
* @returns The preflight line.
*/
function describeRunStart(config, mode) {
	return mode === "rollback" ? `run ${config.runId}: roll the ${config.build} build back to ${config.beforeSha}` : `run ${config.runId}: ${config.beforeSha} -> ${config.remote}/${config.branch} (${config.build} build)`;
}
/**
* Perform one update run and return its final record.
*
* The run first confirms that the durable lock and the run record belong to it;
* when they do not — another run owns them, or the state was lost — nothing is
* written and nothing is released, because dropping a foreign lock would let
* two runs drive the same checkout at once. Otherwise every phase transition is
* written to the durable record and appended to the run log, a failure leaves
* the checkout at `beforeSha`, and the lock is released on every path out.
*
* @param config Configuration this invocation was started with.
* @returns The final record: `'done'`, `'rolled-back'`, or `'failed'` for a rollback run.
*/
async function runUpdate(config) {
	const logPath = await newRunLogPath(config.paths, config.runId);
	const log = createRunLog(logPath);
	const mode = config.mode ?? "update";
	const startedAt = (/* @__PURE__ */ new Date()).toISOString();
	const recorded = await readRun(config.paths);
	const own = recorded !== void 0 && recorded.runId === config.runId ? recorded : void 0;
	const lockHeld = await isRunActive(config.paths);
	if (own === void 0 || !lockHeld) {
		const reason = own === void 0 ? "no run record matches this run id" : "the run lock is not held";
		log.append(`[preflight] refusing to run ${config.runId}: ${reason}\n`);
		await log.flush();
		return {
			runId: config.runId,
			phase: "failed",
			startedAt: own?.startedAt ?? startedAt,
			finishedAt: startedAt,
			beforeSha: own?.beforeSha ?? config.beforeSha,
			failure: {
				phase: "preflight",
				message: `refusing to run: ${reason}`,
				exitCode: null,
				stderrTail: "",
				logPath
			}
		};
	}
	const context = {
		config,
		log,
		logPath,
		timeoutMs: config.timeoutMs ?? 12e5,
		mode,
		run: own
	};
	log.append(`[preflight] ${describeRunStart(config, mode)}\n`);
	try {
		return mode === "rollback" ? await performRollback(context) : await performUpdate(context);
	} catch (error) {
		const failed = await recordFailure(context, {
			phase: context.run.phase,
			message: `the run ended abnormally: ${describeError(error)}`,
			exitCode: null,
			stderrTail: describeErrorDetail(error)
		});
		if (mode === "rollback") {
			log.append("[failed] the rollback did not complete; the checkout is left as it stands for inspection\n");
			return failed;
		}
		return await rollbackAfterFailure(context);
	} finally {
		await log.flush();
		try {
			await releaseRunLock(config.paths);
		} catch (error) {
			console.error(`dsh-updater: could not release the run lock: ${describeError(error)}`);
		}
	}
}
/**
* Read the configuration argument and perform one run. Every failure is
* reported through the durable record and the run log, and the process still
* exits 0, because the parent judges the run by that record alone.
*/
async function main() {
	const raw = process.argv[2];
	if (raw === void 0) {
		console.error("dsh-updater: update-runner requires the JSON run configuration as its only argument");
		return;
	}
	let config;
	try {
		config = parseRunnerConfig(raw);
	} catch (error) {
		console.error(`dsh-updater: invalid run configuration: ${describeError(error)}`);
		return;
	}
	try {
		await runUpdate(config);
	} catch (error) {
		console.error(`dsh-updater: run ${config.runId} ended abnormally: ${describeErrorDetail(error)}`);
	}
}
/**
* Whether this module is the process entry point rather than an import. The
* built artifact is `update-runner.js`; the source name keeps a `tsx` launch
* working the same way.
* @param entry Path Node reports as the entry module.
* @returns Whether this file was started as the program.
*/
function isRunnerEntry(entry) {
	return entry !== void 0 && (entry.endsWith("update-runner.js") || entry.endsWith("update-runner.ts"));
}
if (isRunnerEntry(process.argv[1])) {
	await main();
	process.exit(0);
}
//#endregion
export { runUpdate };
