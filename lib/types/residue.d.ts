/**
 * Build output that outlived its package.
 *
 * A fast-forward merge deletes tracked files only. A package's `lib/` and
 * `node_modules/` are ignored build output, so a merge that removes a package
 * leaves them on disk, and the next build reads them as though the package
 * still existed. That is how an upstream deletion becomes a missing-export
 * failure whose source can no longer be found anywhere in the checkout.
 *
 * @module @local/dsh-updater/residue
 */
/**
 * Remove the build output of packages the checkout no longer contains.
 *
 * A directory is treated as orphaned when it holds ignored build output but no
 * `package.json`, which is exactly what a merge that deletes a package leaves
 * behind. Only those two entries are removed; anything else in the directory
 * belongs to the operator and is left alone.
 * @param root - Checkout root.
 * @returns Absolute paths removed, in the order they were found, for the run log.
 */
export declare function pruneDeletedPackageResidue(root: string): Promise<readonly string[]>;
/**
 * Drop the incremental caches that would otherwise hide a pruned `lib/`.
 *
 * `tsc -b` decides what to rebuild from `.tsbuildinfo`, not from the filesystem:
 * a project whose cache says "up to date" is never emitted again, even after its
 * output directory is gone. Removing a package's `lib/` while leaving the
 * solution-level caches in place therefore turns the loss permanent — the next
 * build reports success for a project with no output, and a later bundler step
 * fails on an entry that no longer exists.
 *
 * Only the caches beside the checkout root are listed. Each project keeps its
 * own cache inside the `lib/` that the pruning above already removed, so those
 * go with it. Deleting these costs one full rebuild; keeping them costs a
 * checkout that can no longer build at all.
 * @param root - Checkout root.
 * @returns Absolute paths removed, for the run log.
 */
export declare function invalidateBuildCaches(root: string): Promise<readonly string[]>;
