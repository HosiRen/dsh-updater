---
description: "Sync the running DeepSeek Harness checkout with its upstream repository, then reinstall and rebuild it, from the Settings page."
kind: "package-reference"
---

# @local/dsh-updater

[English](CONTRACT.md) | [中文](CONTRACT.zh.md)

For installation and a short overview, see [README.md](README.md).

## Summary

The plugin adds a dedicated page under Settings that keeps the running DeepSeek Harness checkout in step with its upstream repository: it reports the local and upstream revisions, probes the remote on the configured cadence, and runs a full update — fast-forward the checkout, reinstall dependencies, rebuild the Host libraries and the Web frontend — while keeping the complete output on disk.

An update is long and disruptive, so the plugin holds three rules: a dirty checkout is refused with its uncommitted files listed; only `git merge --ff-only` is used, and a diverged branch stops the run; any failed step rolls the checkout back to the commit it started from, keeping the failing phase, the exit code, and the full log.

The update itself runs in a detached subprocess, so closing the page, reloading the Host, or restarting Harness does not interrupt it. The page reads the run's state file to show progress.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## Use this package

Install the directory as a profile bundle. It is a dual-face package, so one row mounts both halves.

```
plugin_manager { action: "install_bundle", target: "/abs/path/to/user-plugin/dsh-updater" }
```

The row inserted by `cordis.patch.yml` has the id `dsh-updater`. Its browser half registers a `settings.section` entry with the nav label **Update**, ordered after the built-in sections.

### What the page does

- **Check** probes the configured branch with `git ls-remote`. Read-only: it writes nothing to `.git` and touches no working-tree file.
- **Update** refuses a dirty checkout, records the current commit, then runs `git fetch` → `git merge --ff-only` → `pnpm install` → the configured build in a detached subprocess.
- **Roll back** returns the checkout to the commit recorded before the last run and reinstalls dependencies. It is offered whenever a run is recorded.
- **Transport** is chosen by `remoteTransport`. `origin` fetches the remote by name, which is git's own behaviour; `https` and `ssh` derive the URL of that protocol from the remote's own address and fetch it with an explicit refspec.
- The frequency selector writes `autoCheck` back to the profile patch through the configuration editor.

### Configuration

Every field is a validated Config field of the `dsh-updater` row, so a profile patch overrides it without editing this package.

| Field | Default | Meaning |
|---|---|---|
| `repoRoot` | resolved at run time | Explicit checkout root. Absent, it is derived from the running profile's install anchor, which is what lets one copy work from any checkout path. |
| `remote` | `origin` | Git remote the update reads. |
| `branch` | `master` | Branch the update fast-forwards to. |
| `remoteTransport` | `origin` | Fetch protocol. `origin` fetches the remote by name; `https` and `ssh` rewrite the remote's URL and fetch that instead, while the remote-tracking ref stays `<remote>/<branch>`, so the fast-forward that follows is unaffected. |
| `build` | `full` | `full` runs `pnpm run build` (Host libraries, browser bundles, Web frontend, native system binaries). `lib-web` runs `build:lib` then `build:web`, skipping the native addon. |
| `autoCheck` | `startup` | `startup`, `daily`, `weekly`, `monthly`, or `never`. |
| `pnpmCommand` | `pnpm` | Package manager for the install and build steps. |
| `timeoutMs` | `1200000` | Bound on one pipeline command. |
| `probeTimeoutMs` | `60000` | Bound on one remote probe. A link that reaches the remote slowly needs a larger value. |
| `logTailBytes` | `65536` | Run-log bytes returned to the page. |
| `maxDirtyFiles` | `50` | Working-tree paths reported when the checkout is dirty. |

### Installing it elsewhere

This directory is the publishable form of the package: `lib/`, `locale/`, `icon.svg`, `cordis.patch.yml`, and the documentation. Nothing here needs building, and the package declares no `prepare` script, so a git install uses the committed `lib/` as-is.

Push this directory as a repository of its own and install it by spec:

```
plugin_manager { action: "install_bundle", target: "github:<owner>/<repo>" }
```

An absolute path to a local copy works the same way. The plugin deliberately does not belong to the Harness repository's workspace and is not tracked by that repository's git; `user-plugin/` is listed in its `.git/info/exclude`, which is what lets an upstream fast-forward stay clean while the plugin lives inside the checkout it updates.

The source tree — `src/`, `tests/`, and the tsdown, vitest, and tsconfig files — is kept outside this directory. Development happens there: `pnpm exec tsdown && pnpm exec tsc -p tsconfig.build.json` republishes `lib/`, and the result is synced back here.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

**Checkout resolution.** `resolve-install.ts` starts from `profileContext.installAnchor` (the `dsh` app manifest inside the installation) and walks up to the nearest ancestor whose `package.json` names `@deepseek-ai/dsh-root`, then requires `<root>/.git` to exist. Walking rather than counting levels covers both layouts: a source checkout anchors at `<root>/apps/cli/package.json` and a packaged install at `<root>/runtime/package.json`. `Config.repoRoot` overrides the whole derivation. A failed resolution is surfaced as an unavailable page with its exact reason; the plugin never guesses.

**State.** `$DSH_HOME/updater/` holds `state.json` (the current run), `check.json` (the last probe), `logs/<runId>.log`, and `run.lock`. The probe history lives in a file rather than a storage domain because the record has to stay readable by the detached subprocess and across Host generations, and this package sits outside the pnpm workspace, so it cannot resolve the Harness storage services or `zod` from a checkout's top-level `node_modules`. Nothing else in the plugin imports a first-party package at run time.

**Probing.** `git ls-remote <source> refs/heads/<branch>` is the only network operation the Host performs on its own schedule. `<source>` comes from `fetch-target.ts`, which resolves `remoteTransport` against the remote's own address: `origin` yields the remote name, `https` and `ssh` yield the rewritten URL. The result is stored as a `CheckResult` in `check.json` beside the run state, and supplies the `lastCheckedAt` that the daily, weekly, and monthly cadences compare against.

**Transport.** `transport.ts` parses a remote URL in any of its three written forms (`https://`, `ssh://`, `git@host:path`) into a host and repository path, then reassembles it under the requested protocol. A local filesystem path has no host to rewrite and yields `undefined`, in which case `resolveFetchTarget` falls back to fetching the remote by name and leaves `resolvedUrl` absent for the page to report as a fallback. Rewriting only changes this fetch's arguments: the repository's own `remote.origin.url` is never touched, and the explicit refspec `+refs/heads/<branch>:refs/remotes/<remote>/<branch>` updates the remote-tracking ref the fast-forward reads, not just `FETCH_HEAD`.

**Running an update.** `runner.ts` acquires a lock file, records the starting commit and a `preflight` run state, and launches `lib/update-runner.js` detached, with the run log as its stdio target. The child advances the state file phase by phase (`fetching`, `merging`, `installing`, `building`), then reaches `done` or `failed`. The state file is the single source of truth and the parent only reads it, so restarting the Host mid-run loses nothing.

**Failure and rollback.** On any failure the child records the failing phase, the exit code, and a bounded tail of stderr, then runs `git reset --hard <beforeSha>` and reinstalls dependencies, finally recording `rolled-back`. The original failure survives the rollback: rollback steps append to the log rather than replacing the cause.

**Ownership.** Both the HTTP surface and the unattended probe are registered inside `ctx.effect`, so disabling the row removes the routes and aborts an in-flight probe.

**Browser transport.** The two halves speak over `/dsh-updater/*`, whose handler reuses the connection carrier's browser-trust fence. The browser half requests document-relative routes (`dsh-updater/status`) while the Host registers the absolute route key, following [the document-relative app-route decision](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-09-14-web-document-relative-app-routes.md).

</details>

## Further Exploration

- [Adding a workspace package](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md) — the repository's own package checklist; this package follows its structure and prose rules without joining the workspace.
- [Configuration editor](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/config-editor/README.md) — how the frequency selector's write reaches the profile patch.
- [HMR](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/hmr/README.md) — the file watching that reloads browser bundles while a build rewrites them.

## Model Experience

None. The plugin only provides a Settings page and Host HTTP routes; it contributes no system-prompt text, tool schema, or Session event.

#### KV Cache effect

Zero. The plugin never constructs a model request or appends to a Session log, so it cannot invalidate a reusable prefix.

## Known Limitations and Deferred Work

- **Only git checkouts are updatable.** An npm-installed harness has no `.git` and no tracked branch, so the page reports it as unavailable rather than attempting a download-based fallback.
- **Applying an update needs a restart.** Host-side code loads at boot, so the page says so and offers no automatic restart; the Web frontend reloads on its own because the webserver stat-polls the bundles it serves.
- **A run is not resumable at a step boundary.** If the detached child is killed outright, the next run starts from the current commit; the lock records a dead pid and is reclaimed automatically.
- **`lib-web` skips the native addon.** Choose `full` after an upstream change that touches `native/`; otherwise the previously built addon stays in place.
- **Repository gates do not cover this package.** Because it is not a workspace member, `pnpm run typecheck`, `lint`, and `test:coverage` skip it; run its own checks with `pnpm exec vitest run --config user-plugin/dsh-updater/vitest.config.ts` and `pnpm exec tsc --noEmit -p user-plugin/dsh-updater/tsconfig.json`.
