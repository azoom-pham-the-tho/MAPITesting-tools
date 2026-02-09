/**
 * JSON Differ - Deep comparison of JSON objects with field masking
 */
class JsonDiffer {
    /**
     * Compare two JSON objects with masking support
     * @param {Object} main - The main (old) object
     * @param {Object} section - The section (new) object
     * @param {Array<string>} maskedFields - Fields to ignore during comparison
     * @returns {Object} Comparison result with changes
     */
    compare(main, section, maskedFields = []) {
        const result = {
            hasChanges: false,
            changes: []
        };

        // Handle null/undefined cases
        if (main === null && section === null) {
            return result;
        }

        if (main === null || main === undefined) {
            result.hasChanges = true;
            result.changes.push({
                path: '$',
                type: 'added',
                newValue: this.summarizeValue(section)
            });
            return result;
        }

        if (section === null || section === undefined) {
            result.hasChanges = true;
            result.changes.push({
                path: '$',
                type: 'removed',
                oldValue: this.summarizeValue(main)
            });
            return result;
        }

        // Deep compare
        this.deepCompare(main, section, '$', maskedFields, result.changes);
        result.hasChanges = result.changes.length > 0;

        return result;
    }

    /**
     * Deep recursive comparison
     */
    deepCompare(main, section, path, maskedFields, changes) {
        // Check if current path should be masked
        if (this.shouldMask(path, maskedFields)) {
            return;
        }

        const mainType = this.getType(main);
        const sectionType = this.getType(section);

        // Type mismatch
        if (mainType !== sectionType) {
            changes.push({
                path,
                type: 'type_changed',
                oldType: mainType,
                newType: sectionType,
                oldValue: this.summarizeValue(main),
                newValue: this.summarizeValue(section)
            });
            return;
        }

        switch (mainType) {
            case 'object':
                this.compareObjects(main, section, path, maskedFields, changes);
                break;
            case 'array':
                this.compareArrays(main, section, path, maskedFields, changes);
                break;
            default:
                if (main !== section) {
                    changes.push({
                        path,
                        type: 'value_changed',
                        oldValue: main,
                        newValue: section
                    });
                }
        }
    }

    /**
     * Compare two objects
     */
    compareObjects(main, section, path, maskedFields, changes) {
        const mainKeys = Object.keys(main);
        const sectionKeys = Object.keys(section);
        const allKeys = new Set([...mainKeys, ...sectionKeys]);

        for (const key of allKeys) {
            const keyPath = `${path}.${key}`;

            // Skip masked fields
            if (this.shouldMask(keyPath, maskedFields)) {
                continue;
            }

            if (!(key in main)) {
                changes.push({
                    path: keyPath,
                    type: 'added',
                    newValue: this.summarizeValue(section[key])
                });
            } else if (!(key in section)) {
                changes.push({
                    path: keyPath,
                    type: 'removed',
                    oldValue: this.summarizeValue(main[key])
                });
            } else {
                this.deepCompare(main[key], section[key], keyPath, maskedFields, changes);
            }
        }
    }

    /**
     * Compare two arrays
     */
    compareArrays(main, section, path, maskedFields, changes) {
        const maxLen = Math.max(main.length, section.length);

        // Check for length difference
        if (main.length !== section.length) {
            changes.push({
                path: `${path}.length`,
                type: 'value_changed',
                oldValue: main.length,
                newValue: section.length
            });
        }

        // Compare elements
        for (let i = 0; i < maxLen; i++) {
            const itemPath = `${path}[${i}]`;

            if (i >= main.length) {
                changes.push({
                    path: itemPath,
                    type: 'added',
                    newValue: this.summarizeValue(section[i])
                });
            } else if (i >= section.length) {
                changes.push({
                    path: itemPath,
                    type: 'removed',
                    oldValue: this.summarizeValue(main[i])
                });
            } else {
                this.deepCompare(main[i], section[i], itemPath, maskedFields, changes);
            }
        }
    }

    /**
     * Check if a path should be masked
     */
    shouldMask(path, maskedFields) {
        const pathParts = path.split('.');
        const lastPart = pathParts[pathParts.length - 1];

        for (const mask of maskedFields) {
            // Exact match
            if (lastPart === mask) {
                return true;
            }

            // Wildcard match (e.g., *_date matches created_date, updated_date)
            if (mask.startsWith('*')) {
                const suffix = mask.substring(1);
                if (lastPart.endsWith(suffix)) {
                    return true;
                }
            }

            if (mask.endsWith('*')) {
                const prefix = mask.substring(0, mask.length - 1);
                if (lastPart.startsWith(prefix)) {
                    return true;
                }
            }

            // Array index match (handle [n] in path)
            const cleanPart = lastPart.replace(/\[\d+\]$/, '');
            if (cleanPart === mask) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the type of a value
     */
    getType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        return typeof value;
    }

    /**
     * Summarize a value for display
     */
    summarizeValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';

        const type = this.getType(value);

        switch (type) {
            case 'object':
                const keys = Object.keys(value);
                if (keys.length <= 3) {
                    return `{${keys.join(', ')}}`;
                }
                return `{${keys.slice(0, 3).join(', ')}... +${keys.length - 3} more}`;

            case 'array':
                if (value.length === 0) return '[]';
                if (value.length <= 3) {
                    return `[${value.length} items]`;
                }
                return `[${value.length} items]`;

            case 'string':
                if (value.length > 50) {
                    return `"${value.substring(0, 50)}..."`;
                }
                return `"${value}"`;

            default:
                return String(value);
        }
    }

    /**
     * Generate a diff summary for display
     */
    generateSummary(result) {
        if (!result.hasChanges) {
            return 'No changes detected';
        }

        const summary = [];
        const typeGroups = {};

        for (const change of result.changes) {
            if (!typeGroups[change.type]) {
                typeGroups[change.type] = [];
            }
            typeGroups[change.type].push(change);
        }

        if (typeGroups.added) {
            summary.push(`Added: ${typeGroups.added.length} field(s)`);
        }
        if (typeGroups.removed) {
            summary.push(`Removed: ${typeGroups.removed.length} field(s)`);
        }
        if (typeGroups.value_changed) {
            summary.push(`Changed: ${typeGroups.value_changed.length} field(s)`);
        }
        if (typeGroups.type_changed) {
            summary.push(`Type changed: ${typeGroups.type_changed.length} field(s)`);
        }

        return summary.join(', ');
    }

    /**
     * Format changes for display in a table
     */
    formatChangesTable(result) {
        return result.changes.map(change => ({
            path: change.path,
            type: change.type,
            old: change.oldValue || '-',
            new: change.newValue || '-'
        }));
    }
}

module.exports = new JsonDiffer();
