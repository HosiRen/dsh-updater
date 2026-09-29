# dsh-updater

English | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that syncs the running DeepSeek Harness checkout with its upstream repository, from the Settings page.

## Install

Install it as a profile bundle, from this repository or from a local copy:

```
plugin_manager { action: "install_bundle", target: "github:<owner>/dsh-updater" }
```

Refresh the page and open **Settings → Update**.

## What it does

- **Check** probes the configured branch with `git ls-remote`. Read-only: it writes nothing to `.git` and touches no working-tree file.
- **Update** runs `git fetch` → `git merge --ff-only` → `pnpm install` → `pnpm build` in a detached subprocess, so refreshing the page or restarting Harness does not interrupt it.
- **Roll back** returns the checkout to the commit recorded before the last run and reinstalls dependencies.

Three hard rules:

- A dirty checkout is refused, and the uncommitted files are listed.
- Fast-forward merges only. A diverged branch stops the run; history is never rewritten.
- Any failed step rolls the checkout back to the commit it started from, keeping the failing phase, the exit code, and the complete log.

An update takes effect only after Harness is restarted manually.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `remote` | `origin` | Git remote the update reads |
| `branch` | `master` | Branch the update fast-forwards to |
| `build` | `full` | `full` runs `pnpm run build`; `lib-web` skips the native addon |
| `autoCheck` | `startup` | `startup`, `daily`, `weekly`, `monthly`, or `never` |
| `pnpmCommand` | `pnpm` | Package manager executable for install and build |
| `repoRoot` | resolved at run time | Explicit checkout root; by default it is derived from the running profile, so one copy works from any path |

Each field is an ordinary Cordis `Config` field of the `dsh-updater` row, so a profile patch overrides it without editing this package. The frequency selector on the page writes back through the configuration editor.

## Requirements

- A **git checkout** of DeepSeek Harness. An npm-installed harness has no `.git` and no tracked branch, so the page reports it as unavailable.
- `git`, `pnpm`, and whatever toolchain the build needs, on `PATH`.

## Documentation

- [CONTRACT.md](CONTRACT.md) — implementation details, on-disk state, failure and rollback semantics

## License

MIT

Other open-source code involved is disclosed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
