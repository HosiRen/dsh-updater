/**
 * The diagnostic a failed command actually printed.
 *
 * A pipeline command's captured output is kept as a bounded tail, and a
 * build's tail is usually progress noise: the line that names the failure sits
 * thousands of lines earlier. This reads the complete run log and returns the
 * first real diagnostic it contains, so a recorded failure says what went wrong
 * instead of what the tool happened to print last.
 *
 * @module @local/dsh-updater/error-summary
 */
/**
 * Read the first diagnostic out of a run log.
 *
 * The result is diagnostic garnish: a log that cannot be read, or that holds no
 * known marker, yields `undefined` rather than an error, because a failure to
 * describe the failure must never replace it.
 * @param logPath - Absolute path of the run log.
 * @param maxBytes - Byte cap on the returned summary.
 * @returns The diagnostic block with ANSI colour removed, or `undefined`.
 */
export declare function extractErrorSummary(logPath: string, maxBytes?: number): Promise<string | undefined>;
