window.__ModuleLoader__.load({
	id: "@local/dsh-updater",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		/** Browser-relative form of the Host route key `/dsh-updater/status`. */
		const STATUS_ROUTE = "dsh-updater/status";
		/** Browser-relative form of the Host route key `/dsh-updater/check`. */
		const CHECK_ROUTE = "dsh-updater/check";
		/** Browser-relative form of the Host route key `/dsh-updater/update`. */
		const UPDATE_ROUTE = "dsh-updater/update";
		/** Browser-relative form of the Host route key `/dsh-updater/rollback`. */
		const ROLLBACK_ROUTE = "dsh-updater/rollback";
		/** Browser-relative form of the Host route key `/dsh-updater/config`. */
		const CONFIG_ROUTE = "dsh-updater/config";
		/** Every error code the Host contract declares. */
		const ERROR_CODES = [
			"unavailable",
			"busy",
			"dirty",
			"no-run",
			"invalid-request",
			"internal"
		];
		/** Phases a run leaves by itself: the update finished, or the checkout went back. */
		const SETTLED_PHASES = ["done", "rolled-back"];
		/** Phase a run stops in for good when its own rollback is what failed. */
		const STOPPED_FAILURE_PHASE = "rolling-back";
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
		function isRunInFlight(run) {
			if (SETTLED_PHASES.includes(run.phase)) return false;
			return !(run.phase === "failed" && run.failure?.phase === STOPPED_FAILURE_PHASE);
		}
		/** One failed Updater request, carrying the machine-readable cause. */
		var UpdaterRequestError = class extends Error {
			/** Stable cause: a Host error code, or `network` when no answer arrived. */
			code;
			/**
			* @param code - stable cause.
			* @param message - displayable explanation.
			* @param cause - the underlying transport failure, when there is one.
			*/
			constructor(code, message, cause) {
				super(message, cause === void 0 ? void 0 : { cause });
				this.name = "UpdaterRequestError";
				this.code = code;
			}
		};
		/**
		* Whether an arbitrary string is one of the Host's declared error codes.
		* @param value - value read from a refused response.
		* @returns true when `value` is a declared code.
		*/
		function isFailureCode(value) {
			return ERROR_CODES.some((code) => code === value);
		}
		/**
		* Describe a thrown transport value for the page's notice.
		* @param error - the thrown value.
		* @returns its message, or its string form for a non-Error throw.
		*/
		function describe(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* Send one request, normalizing transport and Host refusals into one error type.
		*
		* `no-store` keeps the status read from being answered by a cached response:
		* the page polls this route while an update runs.
		* @param route - document-relative route.
		* @param method - HTTP method.
		* @param body - JSON request body, when the route takes one.
		* @returns the successful response.
		* @throws UpdaterRequestError when the transport fails or the Host refuses.
		*/
		async function send(route, method, body) {
			const init = {
				method,
				cache: "no-store",
				...body === void 0 ? {} : {
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				}
			};
			let response;
			try {
				response = await fetch(route, init);
			} catch (cause) {
				throw new UpdaterRequestError("network", `${route}: ${describe(cause)}`, cause);
			}
			if (!response.ok) throw await refusal(route, response);
			return response;
		}
		/**
		* Turn a non-2xx response into the error the page reports.
		* @param route - the refused route.
		* @param response - the non-2xx response.
		* @returns the error to throw.
		*/
		async function refusal(route, response) {
			const fallback = `${route}: the Host answered ${response.status}`;
			let body;
			try {
				body = await response.json();
			} catch {
				return new UpdaterRequestError("internal", fallback);
			}
			return new UpdaterRequestError(typeof body.code === "string" && isFailureCode(body.code) ? body.code : "internal", typeof body.message === "string" && body.message.length > 0 ? body.message : fallback);
		}
		/**
		* Perform one request and parse the status it answers with.
		* @param route - document-relative route.
		* @param method - HTTP method.
		* @param body - JSON request body, when the route takes one.
		* @returns the parsed status.
		* @throws UpdaterRequestError when the transport fails or the Host refuses.
		*/
		async function requestStatus(route, method, body) {
			return await (await send(route, method, body)).json();
		}
		/**
		* Read the current status, including the log tail of the running or last run.
		* @returns the Host's status projection.
		* @throws UpdaterRequestError when the transport fails or the Host refuses.
		*/
		function fetchStatus() {
			return requestStatus(STATUS_ROUTE, "GET");
		}
		/**
		* Trigger one read-only upstream probe.
		* @returns the status carrying the new check result.
		* @throws UpdaterRequestError when the transport fails or the Host refuses.
		*/
		function runCheck() {
			return requestStatus(CHECK_ROUTE, "POST");
		}
		/**
		* Start an update. The Host refuses with code `busy` while one is already running.
		* @returns the status of the started run.
		* @throws UpdaterRequestError when the transport fails or the Host refuses.
		*/
		function startUpdate() {
			return requestStatus(UPDATE_ROUTE, "POST");
		}
		/**
		* Roll the checkout back to the most recent run's `beforeSha`.
		* @returns the status after the rollback.
		* @throws UpdaterRequestError when the transport fails or the Host refuses.
		*/
		function rollback() {
			return requestStatus(ROLLBACK_ROUTE, "POST");
		}
		/**
		* Write the tunables the page edits.
		* @param patch - fields to replace; an omitted field keeps its current value.
		* @returns the status carrying the effective configuration.
		* @throws UpdaterRequestError when the transport fails or the Host refuses.
		*/
		function patchConfig(patch) {
			return requestStatus(CONFIG_ROUTE, "PUT", patch);
		}
		//#endregion
		//#region \0dsh-updater-css:/home/hosiren/projects/git/deepseek-harness/user-plugin/.dsh-updater-dev/src/client/UpdaterSection.module.css.mjs
		const css = ".Z3lH9a_updaterSection{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex}.Z3lH9a_updaterHeading{margin:0;font-size:18px;font-weight:600}.Z3lH9a_updaterIntro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:20px}.Z3lH9a_updaterMuted{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.Z3lH9a_updaterBannerWarn,.Z3lH9a_updaterBannerSuccess,.Z3lH9a_updaterBannerInfo{border-radius:var(--dsw-radius-lg);flex-direction:column;gap:4px;padding:10px 14px;display:flex}.Z3lH9a_updaterBannerWarn{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}.Z3lH9a_updaterBannerSuccess{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}.Z3lH9a_updaterBannerInfo{border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-settings-card-fill);color:var(--dsw-alias-label-primary)}.Z3lH9a_updaterBannerTitle{margin:0;font-size:14px;font-weight:600;line-height:22px}.Z3lH9a_updaterBannerBody{color:var(--dsw-alias-label-primary);margin:0;font-size:13px;line-height:20px}.Z3lH9a_updaterNotice{color:var(--dsw-alias-state-error-primary);flex-wrap:wrap;align-items:baseline;gap:6px;margin:0;font-size:12px;line-height:18px;display:flex}.Z3lH9a_updaterNoticeCause{font-weight:600}.Z3lH9a_updaterNoticeDetail{min-width:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.Z3lH9a_updaterActions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.Z3lH9a_updaterButton,.Z3lH9a_updaterPrimary{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;padding:6px 14px;font-size:13px;line-height:20px}.Z3lH9a_updaterButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.Z3lH9a_updaterPrimary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:#0000}.Z3lH9a_updaterPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.Z3lH9a_updaterButton:disabled,.Z3lH9a_updaterPrimary:disabled{cursor:not-allowed}.Z3lH9a_updaterButton:disabled{color:var(--dsw-alias-label-dimmed)}.Z3lH9a_updaterPrimary:disabled{background:var(--dsw-alias-button-primary-dimmed)}.Z3lH9a_updaterPhase{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.Z3lH9a_updaterButton:focus-visible,.Z3lH9a_updaterPrimary:focus-visible,.Z3lH9a_updaterLink:focus-visible,.Z3lH9a_updaterSelect:focus-visible,.Z3lH9a_updaterLog:focus-visible,.Z3lH9a_updaterOutput:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.Z3lH9a_updaterCard,.Z3lH9a_updaterFailureCard{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);flex-direction:column;gap:10px;padding:12px 16px;display:flex}.Z3lH9a_updaterCardHeader{justify-content:space-between;align-items:center;gap:12px;display:flex}.Z3lH9a_updaterCardTitle{margin:0;font-size:14px;font-weight:600;line-height:22px}.Z3lH9a_updaterTools{align-items:center;gap:12px;display:flex}.Z3lH9a_updaterFacts{grid-template-columns:minmax(84px,max-content) 1fr;gap:4px 12px;margin:0;font-size:13px;line-height:20px;display:grid}.Z3lH9a_updaterTerm{color:var(--dsw-alias-label-tertiary)}.Z3lH9a_updaterValue{flex-wrap:wrap;align-items:baseline;gap:8px;min-width:0;margin:0;display:flex}.Z3lH9a_updaterCode{font-family:var(--dsw-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);overflow-wrap:anywhere;font-size:12px}.Z3lH9a_updaterDirty{flex-direction:column;gap:6px;display:flex}.Z3lH9a_updaterFileList{flex-direction:column;gap:2px;margin:0;padding:0;list-style:none;display:flex}.Z3lH9a_updaterLink{color:var(--dsw-alias-link);font:inherit;cursor:pointer;background:0 0;border:0;align-self:flex-start;padding:0;font-size:12px;line-height:18px}.Z3lH9a_updaterLink:hover:not(:disabled){text-decoration:underline}.Z3lH9a_updaterLink:disabled{color:var(--dsw-alias-label-dimmed);cursor:not-allowed}.Z3lH9a_updaterField{justify-content:space-between;align-items:center;gap:12px;display:flex}.Z3lH9a_updaterLabel{font-size:13px;line-height:20px}.Z3lH9a_updaterSelect{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);min-width:180px;height:36px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;padding:0 12px;font-size:13px;line-height:20px}.Z3lH9a_updaterSelect:disabled{color:var(--dsw-alias-label-dimmed);cursor:not-allowed}.Z3lH9a_updaterFailureCard{border-color:var(--dsw-alias-state-error-primary)}.Z3lH9a_updaterFailureTitle{color:var(--dsw-alias-state-error-primary);margin:0;font-size:14px;font-weight:600;line-height:22px}.Z3lH9a_updaterFailureMessage{margin:0;font-size:13px;line-height:20px}.Z3lH9a_updaterFailureCard>.Z3lH9a_updaterPrimary{align-self:flex-start}.Z3lH9a_updaterBlockLabel{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.Z3lH9a_updaterLogPath{flex-wrap:wrap;align-items:baseline;gap:8px;margin:0;font-size:12px;line-height:18px;display:flex}.Z3lH9a_updaterOutput,.Z3lH9a_updaterLog{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);max-height:220px;color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);white-space:pre-wrap;overflow-wrap:anywhere;margin:0;padding:10px 12px;font-size:12px;line-height:18px;overflow:auto}.Z3lH9a_updaterLog{max-height:320px}";
		const tagId = "@local/dsh-updater//home/hosiren/projects/git/deepseek-harness/user-plugin/.dsh-updater-dev/src/client/UpdaterSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"@local/dsh-updater//home/hosiren/projects/git/deepseek-harness/user-plugin/.dsh-updater-dev/src/client/UpdaterSection.module.css\"]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-updater";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var UpdaterSection_module_css_default = {
			"updaterHeading": "Z3lH9a_updaterHeading",
			"updaterActions": "Z3lH9a_updaterActions",
			"updaterIntro": "Z3lH9a_updaterIntro",
			"updaterValue": "Z3lH9a_updaterValue",
			"updaterBannerBody": "Z3lH9a_updaterBannerBody",
			"updaterBannerSuccess": "Z3lH9a_updaterBannerSuccess",
			"updaterField": "Z3lH9a_updaterField",
			"updaterFailureTitle": "Z3lH9a_updaterFailureTitle",
			"updaterLog": "Z3lH9a_updaterLog",
			"updaterBlockLabel": "Z3lH9a_updaterBlockLabel",
			"updaterLabel": "Z3lH9a_updaterLabel",
			"updaterOutput": "Z3lH9a_updaterOutput",
			"updaterPhase": "Z3lH9a_updaterPhase",
			"updaterBannerTitle": "Z3lH9a_updaterBannerTitle",
			"updaterNoticeDetail": "Z3lH9a_updaterNoticeDetail",
			"updaterButton": "Z3lH9a_updaterButton",
			"updaterSection": "Z3lH9a_updaterSection",
			"updaterBannerInfo": "Z3lH9a_updaterBannerInfo",
			"updaterDirty": "Z3lH9a_updaterDirty",
			"updaterLogPath": "Z3lH9a_updaterLogPath",
			"updaterCardTitle": "Z3lH9a_updaterCardTitle",
			"updaterCode": "Z3lH9a_updaterCode",
			"updaterCardHeader": "Z3lH9a_updaterCardHeader",
			"updaterFailureCard": "Z3lH9a_updaterFailureCard",
			"updaterFileList": "Z3lH9a_updaterFileList",
			"updaterSelect": "Z3lH9a_updaterSelect",
			"updaterFailureMessage": "Z3lH9a_updaterFailureMessage",
			"updaterPrimary": "Z3lH9a_updaterPrimary",
			"updaterFacts": "Z3lH9a_updaterFacts",
			"updaterNoticeCause": "Z3lH9a_updaterNoticeCause",
			"updaterLink": "Z3lH9a_updaterLink",
			"updaterNotice": "Z3lH9a_updaterNotice",
			"updaterCard": "Z3lH9a_updaterCard",
			"updaterTools": "Z3lH9a_updaterTools",
			"updaterBannerWarn": "Z3lH9a_updaterBannerWarn",
			"updaterTerm": "Z3lH9a_updaterTerm",
			"updaterMuted": "Z3lH9a_updaterMuted"
		};
		//#endregion
		//#region src/client/UpdaterSection.tsx
		/**
		* The Update settings page: the version comparison, the update actions, the
		* pipeline tunables, the run log, and the failure record.
		*
		* The component is presentational. Every fact arrives through the inject face
		* the registration provides — `useUpdater` for the published state and one
		* callback per action — and the only state kept here is what only this page
		* knows: whether the dirty-path list and the log panel are expanded.
		*/
		/** How many dirty paths the version card lists before offering the rest. */
		const DIRTY_PREVIEW = 5;
		/** Auto-check cadences, in the order the page offers them. */
		const AUTO_CHECK_ORDER = [
			"startup",
			"daily",
			"weekly",
			"monthly",
			"never"
		];
		/** Build scopes, in the order the page offers them. */
		const BUILD_ORDER = ["full", "lib-web"];
		/** Remote transports, in the order the page offers them: the repository's own remote first. */
		const TRANSPORT_ORDER = [
			"origin",
			"https",
			"ssh"
		];
		/** Locale key naming one pipeline phase. */
		const PHASE_KEYS = {
			preflight: "phasePreflight",
			fetching: "phaseFetching",
			merging: "phaseMerging",
			installing: "phaseInstalling",
			building: "phaseBuilding",
			done: "phaseDone",
			failed: "phaseFailed",
			"rolling-back": "phaseRollingBack",
			"rolled-back": "phaseRolledBack"
		};
		/** Locale key naming the cause of one refused request. */
		const FAILURE_KEYS = {
			unavailable: "failureUnavailable",
			busy: "failureBusy",
			dirty: "failureDirty",
			"no-run": "failureNoRun",
			"invalid-request": "failureInvalidRequest",
			internal: "failureInternal",
			network: "failureNetwork"
		};
		/** Locale key naming one auto-check cadence. */
		const AUTO_CHECK_KEYS = {
			startup: "autoCheckStartup",
			daily: "autoCheckDaily",
			weekly: "autoCheckWeekly",
			monthly: "autoCheckMonthly",
			never: "autoCheckNever"
		};
		/** Locale key naming one build scope. */
		const BUILD_KEYS = {
			full: "buildFull",
			"lib-web": "buildLibWeb"
		};
		/** Locale key naming one remote transport. */
		const TRANSPORT_KEYS = {
			origin: "transportOrigin",
			https: "transportHttps",
			ssh: "transportSsh"
		};
		/**
		* Whether a select value is one of the offered cadences.
		* @param value - the select's new value.
		* @returns true when the value is a declared cadence.
		*/
		function isAutoCheck(value) {
			return AUTO_CHECK_ORDER.some((option) => option === value);
		}
		/**
		* Whether a select value is one of the offered build scopes.
		* @param value - the select's new value.
		* @returns true when the value is a declared build scope.
		*/
		function isBuildScope(value) {
			return BUILD_ORDER.some((option) => option === value);
		}
		/**
		* Whether a select value is one of the offered remote transports.
		* @param value - the select's new value.
		* @returns true when the value is a declared transport.
		*/
		function isTransport(value) {
			return TRANSPORT_ORDER.some((option) => option === value);
		}
		/**
		* Format an ISO-8601 instant for the viewer.
		* @param iso - the instant as the Host reported it.
		* @returns the viewer's local rendering, or the raw value when it cannot be parsed.
		*/
		function formatInstant(iso) {
			const at = new Date(iso);
			return Number.isNaN(at.getTime()) ? iso : at.toLocaleString();
		}
		/**
		* The seven-character commit form the version card shows.
		* @param sha - a full SHA.
		* @returns its first seven characters.
		*/
		function shortSha(sha) {
			return sha.slice(0, 7);
		}
		/** One failure: its localized cause, then the Host's or transport's own words. */
		function FailureNotice({ notice, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: UpdaterSection_module_css_default.updaterNotice,
				role: "alert",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
					className: UpdaterSection_module_css_default.updaterNoticeCause,
					children: t(FAILURE_KEYS[notice.code])
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: UpdaterSection_module_css_default.updaterNoticeDetail,
					children: notice.message
				})]
			});
		}
		/** Version comparison: local HEAD, upstream tip, sync state, worktree, last check. */
		function VersionCard({ status, t }) {
			const [showAll, setShowAll] = (0, react.useState)(false);
			const repo = status.repo;
			if (repo === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: UpdaterSection_module_css_default.updaterMuted,
				children: t("versionMissing")
			});
			const check = status.check;
			const remote = status.config.remote;
			const upstreamLabel = remote.length > 0 ? `${remote}/${status.config.branch}` : status.config.branch;
			const shown = showAll ? repo.dirtyFiles : repo.dirtyFiles.slice(0, DIRTY_PREVIEW);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: UpdaterSection_module_css_default.updaterCard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: UpdaterSection_module_css_default.updaterCardTitle,
						children: t("versionTitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
						className: UpdaterSection_module_css_default.updaterFacts,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: UpdaterSection_module_css_default.updaterTerm,
								children: t("localHead")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", {
								className: UpdaterSection_module_css_default.updaterValue,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									className: UpdaterSection_module_css_default.updaterCode,
									children: shortSha(repo.head)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: UpdaterSection_module_css_default.updaterMuted,
									children: repo.branch
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: UpdaterSection_module_css_default.updaterTerm,
								children: t("upstreamHead")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: UpdaterSection_module_css_default.updaterValue,
								children: check === void 0 ? t("neverChecked") : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									className: UpdaterSection_module_css_default.updaterCode,
									children: shortSha(check.upstreamSha)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: UpdaterSection_module_css_default.updaterMuted,
									children: upstreamLabel
								})] })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: UpdaterSection_module_css_default.updaterTerm,
								children: t("syncState")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: UpdaterSection_module_css_default.updaterValue,
								children: check === void 0 ? t("neverChecked") : check.updateAvailable ? t("behind") : t("inSync")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: UpdaterSection_module_css_default.updaterTerm,
								children: t("worktree")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: UpdaterSection_module_css_default.updaterValue,
								children: repo.dirty ? t("dirtyCount", { count: repo.dirtyFiles.length }) : t("worktreeClean")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: UpdaterSection_module_css_default.updaterTerm,
								children: t("lastCheck")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: UpdaterSection_module_css_default.updaterValue,
								children: check === void 0 ? t("neverChecked") : formatInstant(check.checkedAt)
							})
						]
					}),
					repo.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: UpdaterSection_module_css_default.updaterDirty,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: UpdaterSection_module_css_default.updaterFileList,
								children: shown.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									className: UpdaterSection_module_css_default.updaterCode,
									children: file
								}) }, file))
							}),
							repo.dirtyFiles.length > DIRTY_PREVIEW ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: UpdaterSection_module_css_default.updaterLink,
								onClick: () => {
									setShowAll((open) => !open);
								},
								children: showAll ? t("collapse") : t("expandRemaining", { count: repo.dirtyFiles.length - DIRTY_PREVIEW })
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: UpdaterSection_module_css_default.updaterMuted,
								children: t("dirtyHint")
							})
						]
					}) : null,
					check?.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: UpdaterSection_module_css_default.updaterNotice,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
							className: UpdaterSection_module_css_default.updaterNoticeCause,
							children: t("checkError")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: UpdaterSection_module_css_default.updaterNoticeDetail,
							children: check.error
						})]
					})
				]
			});
		}
		/** The two tunables the page owns, written one field at a time. */
		function ConfigCard({ status, state, save, t }) {
			const ids = (0, react.useId)();
			const saving = state.pending === "config";
			const disabled = !status.available || saving;
			const autoCheckId = `${ids}-auto-check`;
			const buildId = `${ids}-build`;
			const transportId = `${ids}-transport`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: UpdaterSection_module_css_default.updaterCard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: UpdaterSection_module_css_default.updaterCardTitle,
						children: t("settingsTitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: UpdaterSection_module_css_default.updaterField,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: UpdaterSection_module_css_default.updaterLabel,
								htmlFor: transportId,
								children: t("transportLabel")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								id: transportId,
								className: UpdaterSection_module_css_default.updaterSelect,
								value: status.config.remoteTransport,
								disabled,
								onChange: (event) => {
									const next = event.target.value;
									if (isTransport(next)) save({ remoteTransport: next });
								},
								children: TRANSPORT_ORDER.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: option,
									children: t(TRANSPORT_KEYS[option])
								}, option))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: UpdaterSection_module_css_default.updaterMuted,
								children: status.config.resolvedUrl === void 0 ? t("transportUnresolved") : t("transportResolved", { url: status.config.resolvedUrl })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: UpdaterSection_module_css_default.updaterField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: UpdaterSection_module_css_default.updaterLabel,
							htmlFor: autoCheckId,
							children: t("autoCheckLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							id: autoCheckId,
							className: UpdaterSection_module_css_default.updaterSelect,
							value: status.config.autoCheck,
							disabled,
							onChange: (event) => {
								const next = event.target.value;
								if (isAutoCheck(next)) save({ autoCheck: next });
							},
							children: AUTO_CHECK_ORDER.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: option,
								children: t(AUTO_CHECK_KEYS[option])
							}, option))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: UpdaterSection_module_css_default.updaterField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: UpdaterSection_module_css_default.updaterLabel,
							htmlFor: buildId,
							children: t("buildLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							id: buildId,
							className: UpdaterSection_module_css_default.updaterSelect,
							value: status.config.build,
							disabled,
							onChange: (event) => {
								const next = event.target.value;
								if (isBuildScope(next)) save({ build: next });
							},
							children: BUILD_ORDER.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: option,
								children: t(BUILD_KEYS[option])
							}, option))
						})]
					}),
					saving ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterSection_module_css_default.updaterMuted,
						role: "status",
						children: t("saving")
					}) : null,
					state.configError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FailureNotice, {
						notice: state.configError,
						t
					})
				]
			});
		}
		/** What the failed run left behind: its phase, exit code, stderr tail, and log path. */
		function FailureCard({ status, busy, retry, t }) {
			const failure = status.run?.failure;
			if (failure === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: UpdaterSection_module_css_default.updaterFailureCard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: UpdaterSection_module_css_default.updaterFailureTitle,
						children: t("failureTitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
						className: UpdaterSection_module_css_default.updaterFacts,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: UpdaterSection_module_css_default.updaterTerm,
								children: t("failurePhase")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: UpdaterSection_module_css_default.updaterValue,
								children: t(PHASE_KEYS[failure.phase])
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
								className: UpdaterSection_module_css_default.updaterTerm,
								children: t("failureExitCode")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
								className: UpdaterSection_module_css_default.updaterValue,
								children: failure.exitCode === null ? t("failureNoExit") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									className: UpdaterSection_module_css_default.updaterCode,
									children: failure.exitCode
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterSection_module_css_default.updaterFailureMessage,
						children: failure.message
					}),
					failure.errorSummary === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterSection_module_css_default.updaterBlockLabel,
						children: t("failureDiagnostic")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: UpdaterSection_module_css_default.updaterOutput,
						tabIndex: 0,
						children: failure.errorSummary
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterSection_module_css_default.updaterBlockLabel,
						children: t("failureStderr")
					}),
					failure.stderrTail.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: UpdaterSection_module_css_default.updaterOutput,
						tabIndex: 0,
						children: failure.stderrTail
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterSection_module_css_default.updaterMuted,
						children: t("failureEmptyOutput")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: UpdaterSection_module_css_default.updaterLogPath,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: UpdaterSection_module_css_default.updaterMuted,
							children: t("failureLogPath")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: UpdaterSection_module_css_default.updaterCode,
							children: failure.logPath
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: UpdaterSection_module_css_default.updaterPrimary,
						disabled: busy || !status.available,
						onClick: retry,
						children: t("retry")
					})
				]
			});
		}
		/** The run log: the tail the status carries, scrollable and collapsible. */
		function LogPanel({ status, t }) {
			const [open, setOpen] = (0, react.useState)(true);
			const tail = status.logTail;
			if (tail === void 0 || tail.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: UpdaterSection_module_css_default.updaterCard,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: UpdaterSection_module_css_default.updaterCardHeader,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: UpdaterSection_module_css_default.updaterCardTitle,
						children: t("logTail")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: UpdaterSection_module_css_default.updaterTools,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: UpdaterSection_module_css_default.updaterLink,
							"aria-expanded": open,
							onClick: () => {
								setOpen((value) => !value);
							},
							children: open ? t("logCollapse") : t("logExpand")
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: UpdaterSection_module_css_default.updaterLog,
					tabIndex: 0,
					children: tail
				}) : null]
			});
		}
		/**
		* Render the Update settings page.
		* @param props - the registration's callbacks, the page-state hook, and the page's copy.
		* @returns the settings page body.
		*/
		function UpdaterSection({ useUpdater, check, update, rollback, saveConfig, t }) {
			const state = useUpdater((value) => value);
			const status = state.status;
			if (status === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: UpdaterSection_module_css_default.updaterSection,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: UpdaterSection_module_css_default.updaterHeading,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterSection_module_css_default.updaterIntro,
						children: t("intro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterSection_module_css_default.updaterMuted,
						role: "status",
						children: t("loading")
					}),
					state.notice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FailureNotice, {
						notice: state.notice,
						t
					})
				]
			});
			const run = status.run;
			const activePhase = run !== void 0 && isRunInFlight(run) ? run.phase : void 0;
			const busy = activePhase !== void 0 || state.pending !== void 0;
			const canRollback = run !== void 0 && run.beforeSha.length > 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: UpdaterSection_module_css_default.updaterSection,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: UpdaterSection_module_css_default.updaterHeading,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterSection_module_css_default.updaterIntro,
						children: t("intro")
					}),
					status.available ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: UpdaterSection_module_css_default.updaterBannerWarn,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: UpdaterSection_module_css_default.updaterBannerTitle,
							children: t("unavailableTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: UpdaterSection_module_css_default.updaterBannerBody,
							children: status.unavailableReason ?? t("unavailableUnknown")
						})]
					}),
					status.restartPending === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: UpdaterSection_module_css_default.updaterBannerSuccess,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: UpdaterSection_module_css_default.updaterBannerTitle,
							children: t("restartTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: UpdaterSection_module_css_default.updaterBannerBody,
							children: t("restartBody")
						})]
					}) : null,
					run?.phase === "rolled-back" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: UpdaterSection_module_css_default.updaterBannerInfo,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: UpdaterSection_module_css_default.updaterBannerTitle,
							children: t("rolledBackTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: UpdaterSection_module_css_default.updaterBannerBody,
							children: t("rolledBackBody")
						})]
					}) : null,
					state.notice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FailureNotice, {
						notice: state.notice,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: UpdaterSection_module_css_default.updaterActions,
						role: "group",
						"aria-label": t("actionsLabel"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: UpdaterSection_module_css_default.updaterButton,
								disabled: busy || !status.available,
								onClick: check,
								children: t("check")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: UpdaterSection_module_css_default.updaterPrimary,
								disabled: busy || !status.available,
								onClick: update,
								children: t("update")
							}),
							canRollback ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: UpdaterSection_module_css_default.updaterButton,
								disabled: busy || !status.available,
								onClick: rollback,
								children: t("rollback")
							}) : null,
							activePhase === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: UpdaterSection_module_css_default.updaterPhase,
								role: "status",
								children: t("runningPhase", { phase: t(PHASE_KEYS[activePhase]) })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(VersionCard, {
						status,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfigCard, {
						status,
						state,
						save: saveConfig,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FailureCard, {
						status,
						busy,
						retry: update,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LogPanel, {
						status,
						t
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Update settings page copy, owned by the updater feature. */
		/** English dictionary. */
		const en = {
			nav: "Update",
			title: "Updater",
			intro: "Sync this DeepSeek Harness checkout with its upstream repository, reinstall dependencies, and rebuild it.",
			loading: "Reading status…",
			unavailableTitle: "Updates are unavailable",
			unavailableUnknown: "The Host reported no reason.",
			restartTitle: "Restart required",
			restartBody: "The new version takes effect after DSH restarts.",
			rolledBackTitle: "Rolled back",
			rolledBackBody: "The checkout is back at the commit it had before the update.",
			versionTitle: "Version",
			versionMissing: "The Host reported no repository facts.",
			localHead: "Local HEAD",
			upstreamHead: "Upstream",
			syncState: "Sync",
			inSync: "In sync with upstream",
			behind: "Behind upstream",
			worktree: "Working tree",
			worktreeClean: "Clean",
			dirtyCount: "{count} uncommitted changes",
			dirtyHint: "Updating requires a clean working tree.",
			expandRemaining: "Show {count} more",
			collapse: "Show less",
			lastCheck: "Last checked",
			neverChecked: "Never checked",
			checkError: "Upstream probe failed:",
			actionsLabel: "Update actions",
			check: "Check for updates",
			update: "Update now",
			rollback: "Roll back",
			retry: "Retry",
			runningPhase: "Current phase: {phase}",
			settingsTitle: "Update settings",
			transportLabel: "Update transport",
			transportOrigin: "Repository remote",
			transportHttps: "HTTPS",
			transportSsh: "SSH",
			transportResolved: "Fetches from {url}",
			transportUnresolved: "The remote URL could not be read; fetching the remote by name instead.",
			autoCheckLabel: "Auto-check",
			buildLabel: "Build",
			saving: "Saving…",
			autoCheckStartup: "Every start",
			autoCheckDaily: "Daily",
			autoCheckWeekly: "Weekly",
			autoCheckMonthly: "Monthly",
			autoCheckNever: "Never",
			buildFull: "Full build",
			buildLibWeb: "lib and Web only",
			failureTitle: "Update failed",
			failurePhase: "Phase",
			failureExitCode: "Exit code",
			failureNoExit: "Command never started",
			failureDiagnostic: "First error in the log",
			failureStderr: "Standard error",
			failureEmptyOutput: "No output",
			failureLogPath: "Log file",
			logTail: "Run log (tail)",
			logCollapse: "Hide log",
			logExpand: "Show log",
			phasePreflight: "Preflight",
			phaseFetching: "Fetching",
			phaseMerging: "Merging",
			phaseInstalling: "Installing",
			phaseBuilding: "Building",
			phaseDone: "Done",
			phaseFailed: "Failed",
			phaseRollingBack: "Rolling back",
			phaseRolledBack: "Rolled back",
			failureUnavailable: "Updates are unavailable",
			failureBusy: "An update is already running",
			failureDirty: "The working tree has uncommitted changes",
			failureNoRun: "No run to roll back",
			failureInvalidRequest: "The request is invalid",
			failureInternal: "The Host failed",
			failureNetwork: "The Host did not answer"
		};
		/** Simplified Chinese dictionary. */
		const zh = {
			nav: "更新",
			title: "更新",
			intro: "与上游仓库同步当前检出，重装依赖并重新构建。",
			loading: "正在读取状态…",
			unavailableTitle: "无法更新",
			unavailableUnknown: "服务端未说明原因。",
			restartTitle: "需要重启",
			restartBody: "新版本需重启 DSH 后生效。",
			rolledBackTitle: "已回滚",
			rolledBackBody: "已恢复到更新前的提交。",
			versionTitle: "版本对照",
			versionMissing: "服务端未提供仓库信息。",
			localHead: "本地 HEAD",
			upstreamHead: "上游",
			syncState: "同步状态",
			inSync: "与上游一致",
			behind: "落后上游",
			worktree: "工作区",
			worktreeClean: "干净",
			dirtyCount: "有 {count} 个未提交改动",
			dirtyHint: "更新要求干净的工作区。",
			expandRemaining: "展开其余 {count} 项",
			collapse: "收起",
			lastCheck: "最近检查",
			neverChecked: "尚未检查",
			checkError: "上游探测失败：",
			actionsLabel: "更新操作",
			check: "检查更新",
			update: "立即更新",
			rollback: "回滚到更新前",
			retry: "重试",
			runningPhase: "当前阶段：{phase}",
			settingsTitle: "更新设置",
			transportLabel: "更新方式",
			transportOrigin: "跟随仓库 remote",
			transportHttps: "HTTPS",
			transportSsh: "SSH",
			transportResolved: "将从 {url} 拉取",
			transportUnresolved: "无法读取 remote 地址，将改为按 remote 名称拉取。",
			autoCheckLabel: "自动检查频率",
			buildLabel: "构建范围",
			saving: "保存中…",
			autoCheckStartup: "每次启动",
			autoCheckDaily: "每天",
			autoCheckWeekly: "每周",
			autoCheckMonthly: "每月",
			autoCheckNever: "从不",
			buildFull: "完整构建",
			buildLibWeb: "仅 lib 与 Web",
			failureTitle: "更新失败",
			failurePhase: "失败阶段",
			failureExitCode: "退出码",
			failureNoExit: "命令未启动",
			failureDiagnostic: "日志中的首个错误",
			failureStderr: "错误输出",
			failureEmptyOutput: "无输出",
			failureLogPath: "日志文件",
			logTail: "运行日志（尾部）",
			logCollapse: "收起日志",
			logExpand: "展开日志",
			phasePreflight: "预检",
			phaseFetching: "获取上游",
			phaseMerging: "合并",
			phaseInstalling: "安装依赖",
			phaseBuilding: "构建",
			phaseDone: "已完成",
			phaseFailed: "已失败",
			phaseRollingBack: "回滚中",
			phaseRolledBack: "已回滚",
			failureUnavailable: "更新不可用",
			failureBusy: "已有更新在运行",
			failureDirty: "工作区有未提交改动",
			failureNoRun: "没有可回滚的运行",
			failureInvalidRequest: "请求不合法",
			failureInternal: "服务端错误",
			failureNetwork: "无法连接服务端"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.updater";
		/** Poll period while the Host may still move the run. */
		const POLL_PERIOD_MS = 1e3;
		/** Required services (cordis fiber inject). */
		const inject = ["slots", "locale"];
		/**
		* Project one thrown value into the notice the page shows.
		* @param error - the thrown value.
		* @returns the notice, carrying a code the dictionary can name.
		*/
		function toNotice(error) {
			if (error instanceof UpdaterRequestError) return {
				code: error.code,
				message: error.message
			};
			return {
				code: "internal",
				message: error instanceof Error ? error.message : String(error)
			};
		}
		/**
		* Owns the page's conversation with the Host: one cached status, one poll
		* timer, and the actions the page fires.
		*
		* Reading is tied to rendering — the first subscriber starts the read and the
		* last one stops the timer — so a closed Settings panel holds no interval.
		* Published snapshots keep their identity until a fact moves, the currency the
		* renderer's hook binding requires.
		*/
		var UpdaterController = class {
			/** State the page renders; a new object exactly when some fact moved. */
			snapshot = {
				status: void 0,
				pending: void 0,
				notice: void 0,
				configError: void 0
			};
			listeners = /* @__PURE__ */ new Set();
			timer;
			disposed = false;
			/** Snapshot source the renderer binds as the `useUpdater` prop. */
			source = {
				getSnapshot: () => this.snapshot,
				subscribe: (listener) => {
					this.listeners.add(listener);
					if (this.listeners.size === 1) this.attach();
					return () => {
						this.listeners.delete(listener);
						if (this.listeners.size === 0) this.stopPoll();
					};
				}
			};
			/**
			* Build the face the page's slot registration injects.
			* @returns the page's state source and its actions.
			*/
			inject() {
				return {
					hooks: { updater: this.source },
					check: () => {
						this.act("check", runCheck, "notice");
					},
					update: () => {
						this.act("update", startUpdate, "notice");
					},
					rollback: () => {
						this.act("rollback", rollback, "notice");
					},
					saveConfig: (patch) => {
						this.act("config", () => patchConfig(patch), "config");
					}
				};
			}
			/** Release the poll and stop publishing; the plugin fiber owns this call. */
			dispose() {
				this.disposed = true;
				this.stopPoll();
				this.listeners.clear();
			}
			/** Start reading: one status read, then the poll while the run is still moving. */
			attach() {
				if (this.disposed) return;
				this.read();
			}
			/**
			* Read the status once and publish it.
			*
			* The poll and the actions share this read: an action's own answer is a full
			* status, but only the Host knows whether the next phase is still to come, so
			* the read after it is what decides whether the poll keeps running.
			*/
			async read() {
				try {
					const status = await fetchStatus();
					this.publish({
						...this.snapshot,
						status,
						notice: void 0
					});
				} catch (error) {
					this.publish({
						...this.snapshot,
						notice: toNotice(error)
					});
				} finally {
					this.syncPoll();
				}
			}
			/**
			* Perform one action and publish the status it answers with.
			* @param action - the action the page started.
			* @param run - the request that performs it.
			* @param channel - which failure slot an error fills.
			*/
			async act(action, run, channel) {
				if (this.snapshot.pending !== void 0 || this.disposed) return;
				this.publish({
					...this.snapshot,
					pending: action
				});
				try {
					const status = await run();
					this.publish(channel === "config" ? {
						...this.snapshot,
						status,
						pending: void 0,
						configError: void 0
					} : {
						...this.snapshot,
						status,
						pending: void 0,
						notice: void 0
					});
				} catch (error) {
					const notice = toNotice(error);
					this.publish(channel === "config" ? {
						...this.snapshot,
						pending: void 0,
						configError: notice
					} : {
						...this.snapshot,
						pending: void 0,
						notice
					});
				} finally {
					this.syncPoll();
				}
			}
			/** Keep the one-second poll running exactly while the Host may still move the run. */
			syncPoll() {
				const run = this.snapshot.status?.run;
				if (this.disposed || this.listeners.size === 0 || run === void 0 || !isRunInFlight(run)) {
					this.stopPoll();
					return;
				}
				if (this.timer !== void 0) return;
				this.timer = setInterval(() => {
					this.read();
				}, POLL_PERIOD_MS);
			}
			/** Stop the poll, if one is running. */
			stopPoll() {
				if (this.timer === void 0) return;
				clearInterval(this.timer);
				this.timer = void 0;
			}
			/**
			* Publish the next snapshot to every subscriber.
			* @param next - the state to publish.
			*/
			publish(next) {
				if (this.disposed) return;
				this.snapshot = next;
				for (const listener of [...this.listeners]) listener();
			}
		};
		/**
		* Register the Update page and its dictionary.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-updater: settings page dictionaries");
			const controller = new UpdaterController();
			ctx.effect(() => () => {
				controller.dispose();
			}, "dsh-updater: status polling");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "updater",
				order: 20,
				label: () => t("nav"),
				locale: NS,
				inject: () => controller.inject()
			}, UpdaterSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
