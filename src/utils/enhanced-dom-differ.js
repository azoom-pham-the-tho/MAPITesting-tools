/**
 * Enhanced DOM Differ
 * Kết hợp tất cả các thuật toán cao cấp để so sánh DOM chính xác tuyệt đối
 */

const advancedTextDiffer = require('./advanced-text-differ');
const colorParser = require('./color-parser');

class EnhancedDomDiffer {
    constructor() {
        this.config = {
            // Position tolerance (1px precision)
            positionTolerance: 1,

            // Color difference threshold
            colorThreshold: 5,

            // Text comparison
            textDiffMode: 'myers', // 'myers' | 'word' | 'char'

            // Performance
            enableCaching: true,
            maxCacheSize: 100
        };

        this.cache = new Map();
    }

    /**
     * Compare two HTML documents với độ chính xác cao
     */
    compare(html1, html2, options = {}) {
        const config = { ...this.config, ...options };

        // Quick check
        if (html1 === html2) {
            return {
                hasChanges: false,
                identical: true,
                summary: 'Hoàn toàn giống nhau'
            };
        }

        // Extract structured elements
        const elements1 = this.extractElements(html1);
        const elements2 = this.extractElements(html2);

        // Build element maps
        const map1 = this.buildElementMap(elements1);
        const map2 = this.buildElementMap(elements2);

        // Perform detailed comparison
        const result = this.compareElements(map1, map2, elements1, elements2, config);

        // Generate summary
        result.summary = this.generateSummary(result);

        return result;
    }

    /**
     * Extract tất cả elements với metadata đầy đủ
     */
    extractElements(html) {
        const elements = [];
        let elementId = 0;

        // Parse HTML and extract elements with full context
        // Match opening tags with all attributes and content
        const tagRegex = /<(\w+)([^>]*)>([^<]*)/g;
        let match;

        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1].toLowerCase();
            const attributes = match[2];
            const textContent = match[3].trim();

            // Skip non-visual tags
            if (this.isNonVisualTag(tagName)) {
                continue;
            }

            // Parse attributes
            const attrs = this.parseAttributes(attributes);

            // Extract position and style
            const style = attrs.style || '';
            const position = this.extractPosition(style);
            const colors = this.extractColors(style);
            const computedStyle = this.parseStyle(style);

            // Create element signature for matching
            const signature = this.createSignature(tagName, attrs);

            elements.push({
                id: elementId++,
                tag: tagName,
                attributes: attrs,
                text: textContent,
                normalizedText: this.normalizeText(textContent),
                position,
                colors,
                style: computedStyle,
                signature,
                // Additional metadata
                className: attrs.class || '',
                id: attrs.id || '',
                dataTestId: attrs['data-testid'] || attrs['data-test-id'] || '',
                // Content classification
                contentType: this.classifyContent(textContent)
            });
        }

        return elements;
    }

    /**
     * Parse attributes từ attribute string
     */
    parseAttributes(attrString) {
        const attrs = {};
        const attrRegex = /(\w+(?:-\w+)*)=["']([^"']*)["']/g;
        let match;

        while ((match = attrRegex.exec(attrString)) !== null) {
            attrs[match[1]] = match[2];
        }

        return attrs;
    }

    /**
     * Extract position với độ chính xác cao
     */
    extractPosition(styleString) {
        if (!styleString) return null;

        const position = {};

        // Extract all position-related properties
        const properties = [
            'top', 'left', 'right', 'bottom',
            'width', 'height',
            'margin-top', 'margin-left', 'margin-right', 'margin-bottom',
            'padding-top', 'padding-left', 'padding-right', 'padding-bottom'
        ];

        for (const prop of properties) {
            const regex = new RegExp(`${prop}:\\s*([\\d.]+)(px|em|rem|%|vh|vw)?`, 'i');
            const match = styleString.match(regex);

            if (match) {
                position[prop] = {
                    value: parseFloat(match[1]),
                    unit: match[2] || 'px'
                };
            }
        }

        return Object.keys(position).length > 0 ? position : null;
    }

    /**
     * Extract all colors từ style string
     */
    extractColors(styleString) {
        if (!styleString) return {};

        const colors = {};

        // Color properties to extract
        const colorProps = [
            'color',
            'background-color',
            'background',
            'border-color',
            'border-top-color',
            'border-right-color',
            'border-bottom-color',
            'border-left-color',
            'outline-color',
            'text-decoration-color'
        ];

        for (const prop of colorProps) {
            const regex = new RegExp(`${prop}:\\s*([^;]+)`, 'i');
            const match = styleString.match(regex);

            if (match) {
                const colorValue = match[1].trim();
                const parsed = colorParser.parse(colorValue);

                if (parsed) {
                    colors[prop] = {
                        original: colorValue,
                        rgba: parsed,
                        hex: colorParser.toHex(parsed)
                    };
                }
            }
        }

        return colors;
    }

    /**
     * Parse toàn bộ style thành object
     */
    parseStyle(styleString) {
        if (!styleString) return {};

        const style = {};
        const declarations = styleString.split(';');

        for (const decl of declarations) {
            const [prop, value] = decl.split(':').map(s => s?.trim());
            if (prop && value) {
                style[prop] = value;
            }
        }

        return style;
    }

    /**
     * Create unique signature for element matching
     */
    createSignature(tag, attrs) {
        const parts = [tag];

        // Prioritize stable identifiers
        if (attrs.id) {
            parts.push(`#${attrs.id}`);
        }

        if (attrs['data-testid']) {
            parts.push(`[testid="${attrs['data-testid']}"]`);
        }

        if (attrs.class) {
            // Use first 3 classes, sorted
            const classes = attrs.class.split(/\s+/)
                .filter(c => c.length > 0)
                .sort()
                .slice(0, 3);

            if (classes.length > 0) {
                parts.push(`.${classes.join('.')}`);
            }
        }

        return parts.join('');
    }

    /**
     * Build element map for fast lookup
     */
    buildElementMap(elements) {
        const map = new Map();

        for (const el of elements) {
            // Use signature + normalized text as key
            const key = el.normalizedText ?
                `${el.signature}::${el.normalizedText}` :
                el.signature;

            if (!map.has(key)) {
                map.set(key, []);
            }

            map.get(key).push(el);
        }

        return map;
    }

    /**
     * Compare elements từ hai DOM trees
     */
    compareElements(map1, map2, elements1, elements2, config) {
        const changes = {
            added: [],
            removed: [],
            modified: [],
            positionChanged: [],
            colorChanged: [],
            styleChanged: []
        };

        const stats = {
            total1: elements1.length,
            total2: elements2.length,
            unchanged: 0,
            changed: 0
        };

        const matched = new Set();

        // Find removed and modified elements
        for (const [key, els1] of map1) {
            const els2 = map2.get(key);

            if (!els2) {
                // Element removed
                for (const el of els1) {
                    changes.removed.push({
                        element: el,
                        type: 'removed',
                        content: el.text,
                        signature: el.signature
                    });
                }
            } else {
                // Element exists - check for modifications
                for (let i = 0; i < els1.length; i++) {
                    const el1 = els1[i];
                    const el2 = els2[i] || els2[els2.length - 1];

                    matched.add(key);

                    // Check text changes
                    if (el1.text !== el2.text) {
                        const textDiff = advancedTextDiffer.charDiff(el1.text, el2.text);

                        changes.modified.push({
                            type: 'text',
                            element1: el1,
                            element2: el2,
                            textDiff,
                            old: el1.text,
                            new: el2.text
                        });
                    }

                    // Check position changes (1px precision)
                    if (el1.position && el2.position) {
                        const posDiff = this.comparePositions(
                            el1.position,
                            el2.position,
                            config.positionTolerance
                        );

                        if (posDiff.length > 0) {
                            changes.positionChanged.push({
                                type: 'position',
                                element1: el1,
                                element2: el2,
                                changes: posDiff
                            });
                        }
                    }

                    // Check color changes (exact comparison)
                    if (Object.keys(el1.colors).length > 0 || Object.keys(el2.colors).length > 0) {
                        const colorDiff = this.compareColors(
                            el1.colors,
                            el2.colors,
                            config.colorThreshold
                        );

                        if (colorDiff.length > 0) {
                            changes.colorChanged.push({
                                type: 'color',
                                element1: el1,
                                element2: el2,
                                changes: colorDiff
                            });
                        }
                    }

                    // Check other style changes
                    const styleDiff = this.compareStyles(el1.style, el2.style);
                    if (styleDiff.length > 0) {
                        changes.styleChanged.push({
                            type: 'style',
                            element1: el1,
                            element2: el2,
                            changes: styleDiff
                        });
                    }
                }
            }
        }

        // Find added elements
        for (const [key, els2] of map2) {
            if (!map1.has(key)) {
                for (const el of els2) {
                    changes.added.push({
                        element: el,
                        type: 'added',
                        content: el.text,
                        signature: el.signature
                    });
                }
            }
        }

        // Calculate stats
        stats.changed = changes.modified.length +
            changes.positionChanged.length +
            changes.colorChanged.length +
            changes.styleChanged.length +
            changes.added.length +
            changes.removed.length;

        stats.unchanged = Math.max(0, Math.min(stats.total1, stats.total2) - stats.changed);

        return {
            hasChanges: stats.changed > 0,
            changes,
            stats,
            highlights: this.extractHighlights(changes)
        };
    }

    /**
     * Compare positions với tolerance tùy chỉnh
     */
    comparePositions(pos1, pos2, tolerance = 1) {
        const diffs = [];

        const allProps = new Set([
            ...Object.keys(pos1),
            ...Object.keys(pos2)
        ]);

        for (const prop of allProps) {
            const val1 = pos1[prop];
            const val2 = pos2[prop];

            if (!val1 || !val2) {
                if (val1) {
                    diffs.push({
                        property: prop,
                        type: 'removed',
                        old: `${val1.value}${val1.unit}`
                    });
                } else if (val2) {
                    diffs.push({
                        property: prop,
                        type: 'added',
                        new: `${val2.value}${val2.unit}`
                    });
                }
                continue;
            }

            // Compare values (convert to same unit if possible)
            if (val1.unit === val2.unit) {
                const diff = Math.abs(val1.value - val2.value);

                if (diff > tolerance) {
                    diffs.push({
                        property: prop,
                        type: 'changed',
                        old: `${val1.value}${val1.unit}`,
                        new: `${val2.value}${val2.unit}`,
                        diff: `${diff.toFixed(2)}${val1.unit}`
                    });
                }
            } else {
                // Different units - report as change
                diffs.push({
                    property: prop,
                    type: 'unit_changed',
                    old: `${val1.value}${val1.unit}`,
                    new: `${val2.value}${val2.unit}`
                });
            }
        }

        return diffs;
    }

    /**
     * Compare colors với độ chính xác cao
     */
    compareColors(colors1, colors2, threshold = 5) {
        const diffs = [];

        const allProps = new Set([
            ...Object.keys(colors1),
            ...Object.keys(colors2)
        ]);

        for (const prop of allProps) {
            const c1 = colors1[prop];
            const c2 = colors2[prop];

            if (!c1 || !c2) {
                if (c1) {
                    diffs.push({
                        property: prop,
                        type: 'removed',
                        old: c1.original,
                        oldHex: c1.hex
                    });
                } else if (c2) {
                    diffs.push({
                        property: prop,
                        type: 'added',
                        new: c2.original,
                        newHex: c2.hex
                    });
                }
                continue;
            }

            // Compare using perceptual difference
            const comparison = colorParser.compare(c1.original, c2.original);

            if (!comparison.equal) {
                diffs.push({
                    property: prop,
                    type: 'changed',
                    old: c1.original,
                    new: c2.original,
                    oldHex: c1.hex,
                    newHex: c2.hex,
                    diff: comparison.diff
                });
            }
        }

        return diffs;
    }

    /**
     * Compare other style properties
     */
    compareStyles(style1, style2) {
        const diffs = [];

        // Important properties to compare (excluding colors and positions)
        const importantProps = [
            'font-family', 'font-size', 'font-weight', 'font-style',
            'text-align', 'text-decoration', 'text-transform',
            'display', 'visibility', 'opacity',
            'z-index', 'overflow', 'cursor',
            'border-width', 'border-style', 'border-radius',
            'box-shadow', 'transform'
        ];

        for (const prop of importantProps) {
            const val1 = style1[prop];
            const val2 = style2[prop];

            if (val1 !== val2) {
                if (val1 && val2) {
                    diffs.push({
                        property: prop,
                        type: 'changed',
                        old: val1,
                        new: val2
                    });
                } else if (val1) {
                    diffs.push({
                        property: prop,
                        type: 'removed',
                        old: val1
                    });
                } else if (val2) {
                    diffs.push({
                        property: prop,
                        type: 'added',
                        new: val2
                    });
                }
            }
        }

        return diffs;
    }

    /**
     * Extract highlights for summary
     */
    extractHighlights(changes) {
        const highlights = [];

        // Text changes
        if (changes.modified.length > 0) {
            highlights.push({
                type: 'text',
                icon: '📝',
                count: changes.modified.length,
                label: `${changes.modified.length} thay đổi nội dung`,
                samples: changes.modified.slice(0, 3)
            });
        }

        // Position changes
        if (changes.positionChanged.length > 0) {
            highlights.push({
                type: 'position',
                icon: '📐',
                count: changes.positionChanged.length,
                label: `${changes.positionChanged.length} thay đổi vị trí`,
                samples: changes.positionChanged.slice(0, 3)
            });
        }

        // Color changes
        if (changes.colorChanged.length > 0) {
            highlights.push({
                type: 'color',
                icon: '🎨',
                count: changes.colorChanged.length,
                label: `${changes.colorChanged.length} thay đổi màu sắc`,
                samples: changes.colorChanged.slice(0, 3)
            });
        }

        // Style changes
        if (changes.styleChanged.length > 0) {
            highlights.push({
                type: 'style',
                icon: '✨',
                count: changes.styleChanged.length,
                label: `${changes.styleChanged.length} thay đổi style`,
                samples: changes.styleChanged.slice(0, 3)
            });
        }

        // Added elements
        if (changes.added.length > 0) {
            highlights.push({
                type: 'added',
                icon: '➕',
                count: changes.added.length,
                label: `${changes.added.length} phần tử mới`,
                samples: changes.added.slice(0, 3)
            });
        }

        // Removed elements
        if (changes.removed.length > 0) {
            highlights.push({
                type: 'removed',
                icon: '➖',
                count: changes.removed.length,
                label: `${changes.removed.length} phần tử đã xóa`,
                samples: changes.removed.slice(0, 3)
            });
        }

        return highlights;
    }

    /**
     * Generate human-readable summary
     */
    generateSummary(result) {
        if (!result.hasChanges) {
            return 'Không có thay đổi';
        }

        const parts = [];
        const c = result.changes;

        if (c.added.length > 0) parts.push(`+${c.added.length}`);
        if (c.removed.length > 0) parts.push(`-${c.removed.length}`);
        if (c.modified.length > 0) parts.push(`~${c.modified.length} text`);
        if (c.positionChanged.length > 0) parts.push(`📐${c.positionChanged.length}`);
        if (c.colorChanged.length > 0) parts.push(`🎨${c.colorChanged.length}`);
        if (c.styleChanged.length > 0) parts.push(`✨${c.styleChanged.length}`);

        return parts.join(', ');
    }

    /**
     * Helper methods
     */
    isNonVisualTag(tag) {
        return ['script', 'style', 'meta', 'link', 'noscript', 'template'].includes(tag);
    }

    normalizeText(text) {
        return text.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    classifyContent(text) {
        if (!text || text.length === 0) return null;

        // Reuse classification from compare.service.js
        if (/^[\d,.\s]+[円¥$€₫]?$/.test(text)) return 'number';
        if (/^\d{4}[-\/年]\d{1,2}/.test(text)) return 'date';
        if (/^\d{1,2}:\d{2}/.test(text)) return 'time';
        if (text.length <= 20 && !/\s/.test(text)) return 'label';

        return 'text';
    }
}

module.exports = new EnhancedDomDiffer();
