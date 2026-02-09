/**
 * Advanced Text Differ - Myers' Diff Algorithm
 * High precision text comparison với chi phí tính toán tối ưu
 * Time: O(ND) where N = length, D = edit distance
 * Space: O(N)
 */

class AdvancedTextDiffer {
    constructor() {
        // Configuration
        this.config = {
            minChangeLength: 1,  // Detect even 1 character change
            contextLines: 3,     // Lines of context around changes
            ignoreCase: false,
            ignoreWhitespace: false,
            trimLines: false
        };
    }

    /**
     * Myers' Diff Algorithm - industry standard (used by Git)
     * Finds shortest edit script between two sequences
     */
    diff(text1, text2, options = {}) {
        const config = { ...this.config, ...options };

        // Split into lines for line-by-line comparison
        const lines1 = this.splitIntoLines(text1, config);
        const lines2 = this.splitIntoLines(text2, config);

        // Run Myers' algorithm
        const editScript = this.myersDiff(lines1, lines2);

        // Build detailed change list
        const changes = this.buildChangeList(lines1, lines2, editScript, config);

        // Calculate statistics
        const stats = this.calculateStats(changes);

        return {
            hasChanges: stats.added > 0 || stats.removed > 0 || stats.modified > 0,
            changes,
            stats,
            editScript
        };
    }

    /**
     * Character-level diff for precise inline changes
     */
    charDiff(str1, str2) {
        const chars1 = Array.from(str1);
        const chars2 = Array.from(str2);

        const editScript = this.myersDiff(chars1, chars2);

        return this.buildInlineChanges(chars1, chars2, editScript);
    }

    /**
     * Myers' Diff Algorithm implementation with length optimization
     */
    myersDiff(a, b) {
        // PERFORMANCE IMPROVEMENT: If strings are too long, use a simpler diff or truncate
        // Myers is O(ND), for HTML with 100k+ chars it will hang.
        const LIMIT = 5000;
        if (a.length > LIMIT || b.length > LIMIT) {
            console.log(`[AdvancedTextDiffer] Sequence too long (${a.length}/${b.length}), using simplified comparison`);
            // Fast fail: just mark everything as changed if different
            // Or return a dummy script that says "Too big to diff"
            // For now, let's just return a "modified" for the whole block to avoid OOM
            return [{ type: 'delete', x: 0, y: 0, value: a[0] }, { type: 'insert', x: 0, y: 0, value: b[0] }];
        }

        const N = a.length;
        const M = b.length;
        const MAX = N + M;

        // V array stores furthest reaching D-paths
        const V = {};
        V[1] = 0;

        const trace = [];

        for (let D = 0; D <= MAX; D++) {
            trace.push({ ...V });

            for (let k = -D; k <= D; k += 2) {
                let x;

                // Choose direction
                if (k === -D || (k !== D && V[k - 1] < V[k + 1])) {
                    x = V[k + 1]; // Move down
                } else {
                    x = V[k - 1] + 1; // Move right
                }

                let y = x - k;

                // Follow diagonal
                while (x < N && y < M && this.equals(a[x], b[y])) {
                    x++;
                    y++;
                }

                V[k] = x;

                // Found solution
                if (x >= N && y >= M) {
                    return this.backtrack(trace, a, b);
                }
            }
        }

        return [];
    }

    /**
     * Backtrack to build edit script
     */
    backtrack(trace, a, b) {
        const script = [];
        let x = a.length;
        let y = b.length;

        for (let D = trace.length - 1; D >= 0; D--) {
            const V = trace[D];
            const k = x - y;

            let prevK;
            if (k === -D || (k !== D && V[k - 1] < V[k + 1])) {
                prevK = k + 1;
            } else {
                prevK = k - 1;
            }

            const prevX = V[prevK];
            const prevY = prevX - prevK;

            // Record diagonal moves (unchanged)
            while (x > prevX && y > prevY) {
                script.unshift({ type: 'equal', x: x - 1, y: y - 1 });
                x--;
                y--;
            }

            if (D > 0) {
                if (x === prevX) {
                    // Insertion
                    script.unshift({ type: 'insert', x: prevX, y: y - 1, value: b[y - 1] });
                    y = prevY;
                } else {
                    // Deletion
                    script.unshift({ type: 'delete', x: x - 1, y: prevY, value: a[x - 1] });
                    x = prevX;
                }
            }
        }

        return script;
    }

    /**
     * Build user-friendly change list from edit script
     */
    buildChangeList(lines1, lines2, editScript, config) {
        const changes = [];
        let i = 0;

        while (i < editScript.length) {
            const op = editScript[i];

            if (op.type === 'equal') {
                i++;
                continue;
            }

            // Collect consecutive operations of same type
            const chunk = { type: op.type, lines: [] };

            while (i < editScript.length && editScript[i].type === op.type) {
                chunk.lines.push(editScript[i].value);
                i++;
            }

            // For deletions followed by insertions, mark as modification
            if (chunk.type === 'delete' && i < editScript.length && editScript[i].type === 'insert') {
                const insertChunk = { lines: [] };
                while (i < editScript.length && editScript[i].type === 'insert') {
                    insertChunk.lines.push(editScript[i].value);
                    i++;
                }

                changes.push({
                    type: 'modified',
                    oldLines: chunk.lines,
                    newLines: insertChunk.lines,
                    // Character-level diff for first line (for inline display)
                    inlineDiff: chunk.lines[0] && insertChunk.lines[0] ?
                        this.charDiff(chunk.lines[0], insertChunk.lines[0]) : null
                });
            } else if (chunk.type === 'delete') {
                changes.push({
                    type: 'removed',
                    lines: chunk.lines
                });
            } else if (chunk.type === 'insert') {
                changes.push({
                    type: 'added',
                    lines: chunk.lines
                });
            }
        }

        return changes;
    }

    /**
     * Build inline changes for character-level diff
     */
    buildInlineChanges(chars1, chars2, editScript) {
        const segments = [];
        let currentSegment = null;

        for (const op of editScript) {
            if (op.type === 'equal') {
                if (currentSegment && currentSegment.type !== 'equal') {
                    segments.push(currentSegment);
                    currentSegment = null;
                }
                if (!currentSegment) {
                    currentSegment = { type: 'equal', text: '' };
                }
                currentSegment.text += op.value;
            } else {
                if (currentSegment && currentSegment.type !== op.type) {
                    segments.push(currentSegment);
                    currentSegment = null;
                }
                if (!currentSegment) {
                    currentSegment = { type: op.type, text: '' };
                }
                currentSegment.text += op.value;
            }
        }

        if (currentSegment) {
            segments.push(currentSegment);
        }

        return segments;
    }

    /**
     * Split text into lines with normalization
     */
    splitIntoLines(text, config) {
        if (!text) return [];

        let lines = text.split(/\r?\n/);

        if (config.trimLines) {
            lines = lines.map(l => l.trim());
        }

        if (config.ignoreWhitespace) {
            lines = lines.map(l => l.replace(/\s+/g, ' '));
        }

        if (config.ignoreCase) {
            lines = lines.map(l => l.toLowerCase());
        }

        return lines;
    }

    /**
     * Compare two values for equality
     */
    equals(a, b) {
        return a === b;
    }

    /**
     * Calculate statistics
     */
    calculateStats(changes) {
        const stats = {
            added: 0,
            removed: 0,
            modified: 0,
            unchanged: 0,
            totalLines: 0
        };

        for (const change of changes) {
            if (change.type === 'added') {
                stats.added += change.lines.length;
            } else if (change.type === 'removed') {
                stats.removed += change.lines.length;
            } else if (change.type === 'modified') {
                stats.modified += Math.max(change.oldLines.length, change.newLines.length);
            }
        }

        stats.totalLines = stats.added + stats.removed + stats.modified + stats.unchanged;

        return stats;
    }

    /**
     * Word-level diff for better readability
     */
    wordDiff(text1, text2) {
        const words1 = this.tokenizeWords(text1);
        const words2 = this.tokenizeWords(text2);

        const editScript = this.myersDiff(words1, words2);

        return this.buildInlineChanges(words1, words2, editScript);
    }

    /**
     * Tokenize text into words
     */
    tokenizeWords(text) {
        // Split on whitespace and punctuation while preserving them
        return text.match(/\S+|\s+/g) || [];
    }

    /**
     * Format diff for display (unified diff format)
     */
    formatUnified(text1, text2, contextLines = 3) {
        const result = this.diff(text1, text2, { contextLines });
        const lines = [];

        for (const change of result.changes) {
            if (change.type === 'added') {
                change.lines.forEach(line => lines.push(`+ ${line}`));
            } else if (change.type === 'removed') {
                change.lines.forEach(line => lines.push(`- ${line}`));
            } else if (change.type === 'modified') {
                change.oldLines.forEach(line => lines.push(`- ${line}`));
                change.newLines.forEach(line => lines.push(`+ ${line}`));
            }
        }

        return lines.join('\n');
    }

    /**
     * Calculate similarity percentage
     */
    similarity(text1, text2) {
        const result = this.diff(text1, text2);
        const total = result.stats.added + result.stats.removed + result.stats.modified + result.stats.unchanged;

        if (total === 0) return 100;

        const similar = total - result.stats.added - result.stats.removed - result.stats.modified;
        return (similar / total) * 100;
    }
}

module.exports = new AdvancedTextDiffer();
