/**
 * DOM Differ Utility
 *
 * Compares two HTML strings and identifies structural, textual, and attribute differences
 *
 * Features:
 * - Text content comparison
 * - HTML structure comparison (tag counts)
 * - CSS class changes detection
 * - Visual diff highlighting
 *
 * Performance:
 * - Uses Set for O(1) lookups
 * - Regex compilation for pattern matching
 * - Minimal DOM parsing overhead
 *
 * @module utils/dom-differ
 */

class DomDiffer {
    constructor() {
        // Pre-compile regex patterns for better performance
        this.patterns = {
            scripts: /<script[^>]*>[\s\S]*?<\/script>/gi,
            styles: /<style[^>]*>[\s\S]*?<\/style>/gi,
            tags: /<(\w+)([^>]*)>/g,
            htmlTags: /<[^>]+>/g,
            whitespace: /\s+/g,
            classes: /class=["']([^"']+)["']/g
        };
    }

    /**
     * Compare two HTML strings
     *
     * @param {string} mainHtml - The main (old/reference) HTML
     * @param {string} sectionHtml - The section (new/test) HTML
     * @returns {Array<Object>} Array of change objects with type, message, and values
     */
    compare(mainHtml, sectionHtml) {
        const changes = [];

        // Handle null/empty cases
        if (!mainHtml && !sectionHtml) {
            return changes;
        }

        if (!mainHtml) {
            changes.push({ type: 'added', message: 'New content added' });
            return changes;
        }

        if (!sectionHtml) {
            changes.push({ type: 'removed', message: 'Content removed' });
            return changes;
        }

        // Parse HTML into comparable structures
        const mainNodes = this.parseHtml(mainHtml);
        const sectionNodes = this.parseHtml(sectionHtml);

        // Extract and compare text content
        const mainText = this.extractText(mainHtml);
        const sectionText = this.extractText(sectionHtml);

        if (mainText !== sectionText) {
            const textChanges = this.compareText(mainText, sectionText);
            changes.push(...textChanges);
        }

        // Compare HTML structure
        const structureChanges = this.compareNodes(mainNodes, sectionNodes);
        changes.push(...structureChanges);

        // Compare CSS attributes
        const attrChanges = this.compareAttributes(mainHtml, sectionHtml);
        changes.push(...attrChanges);

        return changes;
    }

    /**
     * Parse HTML string into simplified node structure
     *
     * Extracts tag names and attributes for structure comparison
     *
     * @param {string} html - HTML string to parse
     * @returns {Array<Object>} Array of node objects { tag, attributes, position }
     * @private
     */
    parseHtml(html) {
        const nodes = [];
        let match;

        // Reset regex state
        this.patterns.tags.lastIndex = 0;

        while ((match = this.patterns.tags.exec(html)) !== null) {
            nodes.push({
                tag: match[1].toLowerCase(),
                attributes: match[2].trim(),
                position: match.index
            });
        }

        return nodes;
    }

    /**
     * Extract visible text content from HTML
     *
     * Removes scripts, styles, and HTML tags, normalizes whitespace
     *
     * @param {string} html - HTML string
     * @returns {string} Extracted text content
     * @private
     */
    extractText(html) {
        // Remove script and style content
        let text = html.replace(this.patterns.scripts, '');
        text = text.replace(this.patterns.styles, '');

        // Remove HTML tags
        text = text.replace(this.patterns.htmlTags, ' ');

        // Normalize whitespace
        text = text.replace(this.patterns.whitespace, ' ').trim();

        return text;
    }

    /**
     * Compare text content and identify word-level changes
     *
     * Uses Set-based difference algorithm for efficiency
     *
     * @param {string} mainText - Main text content
     * @param {string} sectionText - Section text content
     * @returns {Array<Object>} Array of text change objects
     * @private
     */
    compareText(mainText, sectionText) {
        const changes = [];

        const mainWords = mainText.split(/\s+/).filter(Boolean);
        const sectionWords = sectionText.split(/\s+/).filter(Boolean);

        // Use Sets for O(1) lookup performance
        const mainSet = new Set(mainWords);
        const sectionSet = new Set(sectionWords);

        // Find removed and added words
        const removed = mainWords.filter(w => !sectionSet.has(w));
        const added = sectionWords.filter(w => !mainSet.has(w));

        if (removed.length > 0) {
            changes.push({
                type: 'text',
                subType: 'removed',
                mainValue: removed.slice(0, 10).join(' ') + (removed.length > 10 ? '...' : ''),
                message: `Text removed: ${removed.length} words`
            });
        }

        if (added.length > 0) {
            changes.push({
                type: 'text',
                subType: 'added',
                sectionValue: added.slice(0, 10).join(' ') + (added.length > 10 ? '...' : ''),
                message: `Text added: ${added.length} words`
            });
        }

        return changes;
    }

    /**
     * Compare node structures (tag counts)
     *
     * Detects changes in HTML element counts
     *
     * @param {Array} mainNodes - Main HTML nodes
     * @param {Array} sectionNodes - Section HTML nodes
     * @returns {Array<Object>} Array of structure change objects
     * @private
     */
    compareNodes(mainNodes, sectionNodes) {
        const changes = [];

        // Count tags in each version
        const mainTags = this.countTags(mainNodes);
        const sectionTags = this.countTags(sectionNodes);

        // Check for tag count changes
        for (const [tag, count] of Object.entries(mainTags)) {
            const sectionCount = sectionTags[tag] || 0;
            if (sectionCount !== count) {
                changes.push({
                    type: 'structure',
                    tag: tag,
                    mainCount: count,
                    sectionCount: sectionCount,
                    message: `<${tag}> count changed: ${count} → ${sectionCount}`
                });
            }
        }

        // Check for new tags in section
        for (const [tag, count] of Object.entries(sectionTags)) {
            if (!mainTags[tag]) {
                changes.push({
                    type: 'structure',
                    tag: tag,
                    mainCount: 0,
                    sectionCount: count,
                    message: `New <${tag}> elements added: ${count}`
                });
            }
        }

        return changes;
    }

    /**
     * Count tag occurrences
     *
     * @param {Array} nodes - Array of node objects
     * @returns {Object} Map of tag -> count
     * @private
     */
    countTags(nodes) {
        const counts = {};
        for (const node of nodes) {
            counts[node.tag] = (counts[node.tag] || 0) + 1;
        }
        return counts;
    }

    /**
     * Compare CSS class attributes
     *
     * Detects added and removed CSS classes
     *
     * @param {string} mainHtml - Main HTML
     * @param {string} sectionHtml - Section HTML
     * @returns {Array<Object>} Array of attribute change objects
     * @private
     */
    compareAttributes(mainHtml, sectionHtml) {
        const changes = [];

        // Extract class names
        const mainClasses = this.extractClasses(mainHtml);
        const sectionClasses = this.extractClasses(sectionHtml);

        const removedClasses = [...mainClasses].filter(c => !sectionClasses.has(c));
        const addedClasses = [...sectionClasses].filter(c => !mainClasses.has(c));

        if (removedClasses.length > 0) {
            changes.push({
                type: 'attribute',
                subType: 'class_removed',
                classes: removedClasses.slice(0, 5),
                message: `CSS classes removed: ${removedClasses.length}`
            });
        }

        if (addedClasses.length > 0) {
            changes.push({
                type: 'attribute',
                subType: 'class_added',
                classes: addedClasses.slice(0, 5),
                message: `CSS classes added: ${addedClasses.length}`
            });
        }

        return changes;
    }

    /**
     * Extract class names from HTML
     *
     * @param {string} html - HTML string
     * @returns {Set<string>} Set of unique class names
     * @private
     */
    extractClasses(html) {
        const classes = new Set();
        let match;

        // Reset regex state
        this.patterns.classes.lastIndex = 0;

        while ((match = this.patterns.classes.exec(html)) !== null) {
            match[1].split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
        }

        return classes;
    }

    /**
     * Generate visual diff representation
     *
     * Creates highlighted HTML with changes marked
     *
     * @param {string} mainHtml - Main HTML
     * @param {string} sectionHtml - Section HTML
     * @param {Array} changes - Array of change objects
     * @returns {Object} Object with highlighted main, section, and summary
     */
    generateVisualDiff(mainHtml, sectionHtml, changes) {
        return {
            main: this.highlightInHtml(mainHtml, changes, 'main'),
            section: this.highlightInHtml(sectionHtml, changes, 'section'),
            summary: changes.map(c => c.message)
        };
    }

    /**
     * Highlight changes in HTML
     *
     * Wraps changed content in <mark> tags with color coding
     * - Red (#ff6b6b): Removed content (main)
     * - Green (#51cf66): Added content (section)
     *
     * @param {string} html - HTML string
     * @param {Array} changes - Array of change objects
     * @param {string} type - 'main' or 'section'
     * @returns {string} HTML with highlighted changes
     * @private
     */
    highlightInHtml(html, changes, type) {
        let result = html;

        for (const change of changes) {
            if (change.type === 'text') {
                const value = change[type + 'Value'];
                if (value) {
                    const color = type === 'main' ? '#ff6b6b' : '#51cf66';
                    // Escape special regex characters
                    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    result = result.replace(
                        new RegExp(escaped, 'g'),
                        `<mark style="background:${color}40;border:1px solid ${color}">${value}</mark>`
                    );
                }
            }
        }

        return result;
    }
}

// Export singleton instance
module.exports = new DomDiffer();
