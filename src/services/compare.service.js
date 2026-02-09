const path = require('path');
const fs = require('fs-extra');
const storageService = require('./storage.service');

// Import advanced comparison algorithms
const enhancedDomDiffer = require('../utils/enhanced-dom-differ');

const advancedTextDiffer = require('../utils/advanced-text-differ');
const colorParser = require('../utils/color-parser');

class CompareService {

    // Compare two sections and return detailed diff
    async compareSections(projectName, section1Timestamp, section2Timestamp) {
        const getPath = (ts) => ts === 'main'
            ? storageService.getMainPath(projectName)
            : storageService.getSectionPath(projectName, ts);

        const section1Path = getPath(section1Timestamp);
        const section2Path = getPath(section2Timestamp);

        if (!await fs.pathExists(section1Path)) {
            throw new Error(`Nguồn 1 không tồn tại: ${section1Timestamp}`);
        }
        if (!await fs.pathExists(section2Path)) {
            throw new Error(`Nguồn 2 không tồn tại: ${section2Timestamp}`);
        }

        // Get all pages from both sections
        const pages1 = await this.getAllPages(section1Path);
        const pages2 = await this.getAllPages(section2Path);

        // Build comparison result
        const result = {
            section1: section1Timestamp,
            section2: section2Timestamp,
            summary: {
                total1: pages1.length,
                total2: pages2.length,
                matched: 0,
                added: 0,
                removed: 0,
                changed: 0,
                unchanged: 0
            },
            items: []
        };

        // Map pages by identity with improved matching
        const map1 = new Map();
        pages1.forEach(p => {
            const id = this.getPageIdentity(p);
            if (!map1.has(id)) {
                map1.set(id, p);
            } else {
                const existing = map1.get(id);
                if (this.hasMoreData(p, existing)) {
                    map1.set(id, p);
                }
            }
        });

        const map2 = new Map();
        pages2.forEach(p => {
            const id = this.getPageIdentity(p);
            if (!map2.has(id)) {
                map2.set(id, p);
            } else {
                const existing = map2.get(id);
                if (this.hasMoreData(p, existing)) {
                    map2.set(id, p);
                }
            }
        });

        // Get all unique identities
        const allIds = Array.from(new Set([...map1.keys(), ...map2.keys()]));

        // Batch processing
        const concurrencyLimit = 5;
        const batches = [];
        for (let i = 0; i < allIds.length; i += concurrencyLimit) {
            batches.push(allIds.slice(i, i + concurrencyLimit));
        }

        for (const batch of batches) {
            await Promise.all(batch.map(async (id) => {
                const page1 = map1.get(id);
                const page2 = map2.get(id);

                if (page1 && page2) {
                    const type1 = page1.metadata?.type || 'unknown';
                    const type2 = page2.metadata?.type || 'unknown';

                    if (this.areIncompatibleTypes(type1, type2)) {
                        result.summary.added++;
                        result.items.push({
                            status: 'added',
                            path: page2.relativePath,
                            name: page2.name,
                            page1: null,
                            page2: page2,
                            identity: id
                        });
                        return;
                    }

                    result.summary.matched++;
                    // SHALLOW COMPARE OPTIMIZATION
                    const diff = await this.comparePage(page1, page2, { shallow: true });

                    if (diff.hasChanges) {
                        result.summary.changed++;
                        result.items.push({
                            status: 'changed',
                            path: page2.relativePath,
                            name: page2.name,
                            page1: page1,
                            page2: page2,
                            diff: diff,
                            identity: id,
                            matchInfo: { type1, type2 }
                        });
                    } else {
                        result.summary.unchanged++;
                        result.items.push({
                            status: 'unchanged',
                            path: page2.relativePath,
                            name: page2.name,
                            page1: page1,
                            page2: page2
                        });
                    }
                } else if (page1 && !page2) {
                    if (section1Timestamp !== 'main') {
                        result.summary.removed++;
                        result.items.push({
                            status: 'removed',
                            path: page1.relativePath,
                            name: page1.name,
                            page1: page1,
                            page2: null
                        });
                    }
                } else if (!page1 && page2) {
                    result.summary.added++;
                    result.items.push({
                        status: 'added',
                        path: page2.relativePath,
                        name: page2.name,
                        page1: null,
                        page2: page2
                    });
                }
            }));
        }

        // Sort: changed first, then added, removed, unchanged
        const statusOrder = { 'changed': 0, 'added': 1, 'removed': 2, 'unchanged': 3 };
        result.items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

        return result;
    }

    // Compare Section against Main
    async compareAgainstMain(projectName, sectionTimestamp) {
        return this.compareSections(projectName, 'main', sectionTimestamp);
    }

    // Get all pages from a section
    async getAllPages(sectionPath, relativePath = '') {
        const pages = [];
        const fullPath = path.join(sectionPath, relativePath);

        if (!await fs.pathExists(fullPath)) return pages;

        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const entryRelPath = path.join(relativePath, entry.name);
                const entryFullPath = path.join(fullPath, entry.name);

                const hasUI = await fs.pathExists(path.join(entryFullPath, 'UI'));
                const hasMetadata = await fs.pathExists(path.join(entryFullPath, 'metadata.json'));

                if (hasUI || hasMetadata) {
                    pages.push(await this.getPageInfo(entryFullPath, entryRelPath, entry.name));
                }

                // Recurse into subdirectories
                pages.push(...(await this.getAllPages(sectionPath, entryRelPath)));
            }
        }

        return pages;
    }

    // Get page info - supports both old format (UI/API folders) and new format (flat files)
    async getPageInfo(pagePath, relativePath, name) {
        const cleanName = name.replace(/_\d{6}$/, '');

        const info = {
            name: cleanName,
            relativePath: relativePath,
            fullPath: pagePath,
            metadata: null,
            hasPreview: false,
            hasUI: false,
            hasAPI: false,
            signatureHash: null,
            format: 'unknown' // 'old' = UI/API folders, 'new' = flat files
        };

        // Check metadata - try both formats
        const oldMetaPath = path.join(pagePath, 'metadata.json');
        const newMetaPath = path.join(pagePath, 'meta.json');

        if (await fs.pathExists(newMetaPath)) {
            info.metadata = await fs.readJson(newMetaPath);
            info.format = 'new';
        } else if (await fs.pathExists(oldMetaPath)) {
            info.metadata = await fs.readJson(oldMetaPath);
            info.format = 'old';
        }

        if (info.metadata?.url) {
            try {
                const url = new URL(info.metadata.url);
                const tab = url.searchParams.get('tab');
                if (tab) info.name = `${cleanName} [Tab: ${tab}]`;
            } catch (e) { }
        }
        info.signatureHash = info.metadata?.signatureHash;

        // Check preview/UI - screen.html or dom.json
        if (await fs.pathExists(path.join(pagePath, 'screen.html'))) {
            info.hasPreview = true;
            info.format = 'new';
        } else if (await fs.pathExists(path.join(pagePath, 'dom.json'))) {
            info.hasPreview = true;
            info.format = 'new';
        } else if (await fs.pathExists(path.join(pagePath, 'UI', 'screenshot.jpg'))) {
            info.hasPreview = true;
            info.format = info.format === 'unknown' ? 'old' : info.format;
        }

        // Check UI data - screen.html is now the primary source for comparison
        if (await fs.pathExists(path.join(pagePath, 'screen.html'))) {
            info.hasUI = true;
        } else if (await fs.pathExists(path.join(pagePath, 'dom.json'))) {
            info.hasUI = true;
        } else if (await fs.pathExists(path.join(pagePath, 'UI', 'snapshot.json'))) {
            info.hasUI = true;
        }

        // Check API data
        if (await fs.pathExists(path.join(pagePath, 'apis.json'))) {
            info.hasAPI = true;
        } else if (await fs.pathExists(path.join(pagePath, 'API', 'requests.json'))) {
            info.hasAPI = true;
        }

        return info;
    }

    // Get unique page identity
    getPageIdentity(page) {
        if (page.metadata?.url) {
            try {
                const urlObj = new URL(page.metadata.url);
                let id = urlObj.pathname.replace(/\/+$/, '').toLowerCase();
                const tab = urlObj.searchParams.get('tab');
                if (tab) id += `?tab=${tab}`;
                return `${id}::${(page.metadata.type || 'page').toLowerCase()}`;
            } catch (e) { }
        }
        return `folder::${page.relativePath.toLowerCase()}`;
    }

    // Check if page1 has more data than page2
    hasMoreData(page1, page2) {
        const score = (p) => (p.hasUI ? 2 : 0) + (p.hasAPI ? 2 : 0) + (p.hasPreview ? 1 : 0);
        return score(page1) > score(page2);
    }

    // Check if two page types are incompatible
    areIncompatibleTypes(type1, type2) {
        type1 = (type1 || '').toLowerCase();
        type2 = (type2 || '').toLowerCase();
        if (type1 === type2) return false;
        const isModal = (t) => t.includes('modal') || t.includes('dialog');
        return isModal(type1) !== isModal(type2);
    }

    // Compare two pages
    async comparePage(page1, page2, options = {}) {
        const isShallow = options.shallow === true;
        const diff = {
            hasChanges: false,
            signatureChanged: false,
            uiChanged: false,
            apiChanged: false,
            uiDiff: null,
            apiDiff: null,
            changeDetails: []
        };

        if (page1.signatureHash && page2.signatureHash && page1.signatureHash !== page2.signatureHash) {
            diff.signatureChanged = true;
            diff.hasChanges = true;
            if (isShallow) return diff;
        }

        if (page1.hasUI && page2.hasUI) {
            if (isShallow) {
                // Try loading from both new format (screen.html) and old format (UI/snapshot.json)
                const loadShallow = async (p) => {
                    const screenPath = path.join(p.fullPath, 'screen.html');
                    if (await fs.pathExists(screenPath)) {
                        const stat = await fs.stat(screenPath);
                        return { size: stat.size, mtime: stat.mtimeMs };
                    }
                    const snapPath = path.join(p.fullPath, 'UI', 'snapshot.json');
                    if (await fs.pathExists(snapPath)) {
                        const stat = await fs.stat(snapPath);
                        return { size: stat.size, mtime: stat.mtimeMs };
                    }
                    return null;
                };
                const s1 = await loadShallow(page1);
                const s2 = await loadShallow(page2);
                if (s1 && s2 && s1.size !== s2.size) {
                    diff.uiChanged = true;
                    diff.hasChanges = true;
                }
            } else {
                const uiDiff = await this.compareUI(page1.fullPath, page2.fullPath);
                if (uiDiff.hasChanges) {
                    diff.uiChanged = true;
                    diff.hasChanges = true;
                    diff.uiDiff = uiDiff;
                    diff.changeDetails.push(`UI: ${uiDiff.summary}`);
                }
            }
        }

        if (page1.hasAPI && page2.hasAPI && !isShallow) {
            const apiDiff = await this.compareAPI(page1.fullPath, page2.fullPath);
            if (apiDiff.hasChanges) {
                diff.apiChanged = true;
                diff.hasChanges = true;
                diff.apiDiff = apiDiff;
                diff.changeDetails.push(`API: ${apiDiff.summary}`);
            }
        }

        return diff;
    }

    // --- CORE LOGIC FUNCTIONS (SUPPORTING BOTH OLD AND NEW FORMATS) ---

    // Load UI snapshot from either format
    async loadUISnapshot(pagePath) {
        // Try new format first (dom.json)
        const domPath = path.join(pagePath, 'dom.json');
        if (await fs.pathExists(domPath)) {
            const dom = await fs.readJson(domPath);
            // Convert DOM to HTML-like string for comparison
            return { html: this.domToHtml(dom), format: 'new' };
        }

        // Try screen.html
        const screenHtmlPath = path.join(pagePath, 'screen.html');
        if (await fs.pathExists(screenHtmlPath)) {
            const html = await fs.readFile(screenHtmlPath, 'utf-8');
            return { html, format: 'new' };
        }

        // Try old format (UI/snapshot.json)
        const snapshotPath = path.join(pagePath, 'UI', 'snapshot.json');
        if (await fs.pathExists(snapshotPath)) {
            const snapshot = await fs.readJson(snapshotPath);
            return { html: snapshot.html || '', format: 'old' };
        }

        return null;
    }

    // Convert DOM tree to simple HTML for comparison
    domToHtml(node, depth = 0) {
        if (!node) return '';
        if (node.t === '#text') return node.v || '';

        const tag = node.t || 'div';
        const attrs = node.a ? Object.entries(node.a).map(([k, v]) => `${k}="${v}"`).join(' ') : '';
        const children = node.c ? node.c.map(c => this.domToHtml(c, depth + 1)).join('') : '';

        return `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`;
    }

    /**
     * Compare UI between two captures — 3 LEVELS of comparison
     * 
     * LEVEL 1: DOM structural diff (element added/removed/modified)
     * LEVEL 2: CSS computed styles diff (color, font, spacing, position changes)
     * Compare UI: DOM structure + CSS styles
     */
    async compareUI(path1, path2) {
        const snapshot1 = await this.loadUISnapshot(path1);
        const snapshot2 = await this.loadUISnapshot(path2);

        if (!snapshot1 || !snapshot2) {
            return { hasChanges: false, summary: 'Không thể so sánh UI' };
        }

        const html1 = snapshot1.html || '';
        const html2 = snapshot2.html || '';

        // ═══════════════════════════════════════
        // LEVEL 1: DOM Elements Comparison
        // ═══════════════════════════════════════
        const elements1 = this.extractDOMElements(html1);
        const elements2 = this.extractDOMElements(html2);
        const map1 = this.buildElementMap(elements1);
        const map2 = this.buildElementMap(elements2);
        const domDiff = this.compareDOMElements(map1, map2, elements1, elements2);

        // LEVEL 1b: Text Similarity
        const similarity = advancedTextDiffer.similarity(html1, html2);

        // ═══════════════════════════════════════
        // LEVEL 2: CSS Computed Styles Comparison
        // ═══════════════════════════════════════
        let cssDiff = null;
        const dom1 = await this.loadDOMTree(path1);
        const dom2 = await this.loadDOMTree(path2);
        if (dom1 && dom2) {
            cssDiff = this.compareCSSStyles(dom1, dom2);
        }

        // ═══════════════════════════════════════
        // AGGREGATE RESULTS (DOM + CSS only, no pixel comparison)
        // ═══════════════════════════════════════
        const hasCSSChanges = cssDiff?.totalChanges > 0;
        const hasDOMChanges = domDiff.totalChanges > 0;
        const hasAnyChanges = hasDOMChanges || hasCSSChanges || similarity < 99.9;

        // Build comprehensive summary
        const summaryParts = [];
        if (hasDOMChanges) summaryParts.push(`DOM: ${this.buildDOMDiffSummary(domDiff)}`);
        if (hasCSSChanges) summaryParts.push(`CSS: ${cssDiff.summary}`);

        return {
            hasChanges: hasAnyChanges,
            summary: summaryParts.length > 0 ? summaryParts.join(' | ') : 'Không thay đổi',
            // Level 1: DOM
            domDiff: {
                ...domDiff,
                summary: this.buildDOMDiffSummary(domDiff)
            },
            categories: domDiff.categories,
            similarity: similarity.toFixed(2),
            // Level 2: CSS
            cssDiff: cssDiff
        };
    }

    /**
     * Load structured DOM tree from dom.json (includes css and rect data)
     */
    async loadDOMTree(pagePath) {
        const domPath = path.join(pagePath, 'dom.json');
        if (await fs.pathExists(domPath)) {
            const data = await fs.readJson(domPath);
            return data.body || data;
        }
        return null;
    }

    /**
     * Compare CSS computed styles between two DOM trees
     * Detects: color changes, font changes, spacing changes, position shifts
     */
    compareCSSStyles(dom1, dom2) {
        const changes = [];
        this.walkAndCompareCSS(dom1, dom2, '', changes, 0);

        // Categorize changes
        const categories = {
            color: [],      // color, backgroundColor changes
            typography: [],  // fontSize, fontWeight, fontFamily, textDecoration changes
            spacing: [],     // padding, margin, gap changes
            position: [],    // position, top, left, width, height, rect shifts
            border: [],      // border, borderRadius, boxShadow changes
            layout: [],      // display, flexDirection, justifyContent, alignItems changes
            other: []        // everything else
        };

        for (const change of changes) {
            const prop = change.property;
            if (['color', 'backgroundColor', 'opacity'].includes(prop)) {
                categories.color.push(change);
            } else if (['fontSize', 'fontWeight', 'fontFamily', 'textDecoration', 'textAlign', 'lineHeight', 'letterSpacing'].includes(prop)) {
                categories.typography.push(change);
            } else if (['padding', 'margin', 'gap'].includes(prop)) {
                categories.spacing.push(change);
            } else if (['position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'maxWidth', 'maxHeight', 'minWidth', 'minHeight', 'x', 'y', 'w', 'h'].includes(prop)) {
                categories.position.push(change);
            } else if (['border', 'borderRadius', 'boxShadow'].includes(prop)) {
                categories.border.push(change);
            } else if (['display', 'flexDirection', 'justifyContent', 'alignItems', 'overflow'].includes(prop)) {
                categories.layout.push(change);
            } else {
                categories.other.push(change);
            }
        }

        const totalChanges = changes.length;
        const summaryParts = [];
        if (categories.color.length > 0) summaryParts.push(`${categories.color.length} màu`);
        if (categories.typography.length > 0) summaryParts.push(`${categories.typography.length} font`);
        if (categories.spacing.length > 0) summaryParts.push(`${categories.spacing.length} spacing`);
        if (categories.position.length > 0) summaryParts.push(`${categories.position.length} vị trí`);
        if (categories.border.length > 0) summaryParts.push(`${categories.border.length} border`);
        if (categories.layout.length > 0) summaryParts.push(`${categories.layout.length} layout`);

        return {
            totalChanges,
            summary: totalChanges > 0 ? summaryParts.join(', ') : 'Không thay đổi CSS',
            changes: changes.slice(0, 50), // Limit output
            categories
        };
    }

    /**
     * Walk two DOM trees in parallel and compare CSS styles + positions
     */
    walkAndCompareCSS(node1, node2, path, changes, depth) {
        if (depth > 20) return;
        if (!node1 || !node2) return;
        if (node1.t === '#text' || node2.t === '#text') return;

        // Build element identifier for readable output
        const id = node1.a?.id || node1.a?.['data-testid'] || '';
        const cls = (node1.a?.class || '').split(' ')[0] || '';
        const elemPath = path + (path ? ' > ' : '') + node1.t + (id ? `#${id}` : cls ? `.${cls}` : '');

        // Compare CSS styles
        if (node1.css || node2.css) {
            const css1 = node1.css || {};
            const css2 = node2.css || {};
            const allProps = new Set([...Object.keys(css1), ...Object.keys(css2)]);

            for (const prop of allProps) {
                const v1 = css1[prop];
                const v2 = css2[prop];

                if (v1 !== v2) {
                    changes.push({
                        element: elemPath,
                        tag: node1.t,
                        property: prop,
                        old: v1 || '(không có)',
                        new: v2 || '(không có)',
                        type: !v1 ? 'THÊM' : !v2 ? 'XOÁ' : 'SỬA'
                    });
                }
            }
        }

        // Compare bounding positions (detect 1px shifts)
        if (node1.rect && node2.rect) {
            for (const dim of ['x', 'y', 'w', 'h']) {
                if (node1.rect[dim] !== node2.rect[dim]) {
                    const labels = { x: 'left', y: 'top', w: 'width', h: 'height' };
                    changes.push({
                        element: elemPath,
                        tag: node1.t,
                        property: labels[dim],
                        old: `${node1.rect[dim]}px`,
                        new: `${node2.rect[dim]}px`,
                        diff: node2.rect[dim] - node1.rect[dim],
                        type: 'SỬA'
                    });
                }
            }
        }

        // Recursively compare children (match by index)
        if (node1.c && node2.c) {
            const maxLen = Math.min(node1.c.length, node2.c.length);
            for (let i = 0; i < maxLen; i++) {
                this.walkAndCompareCSS(node1.c[i], node2.c[i], elemPath, changes, depth + 1);
            }
        }
    }

    extractDOMElements(html) {
        const elements = [];
        let elementIndex = 0;
        const tagRegex = /<(\w+)([^>]*)>([^<]*)/g;
        let match;

        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1].toLowerCase();
            const attributes = match[2];
            const textContent = match[3].trim();
            if (['script', 'style', 'meta', 'link'].includes(tagName)) continue;

            const id = this.extractAttribute(attributes, 'id');
            const className = this.extractAttribute(attributes, 'class');
            const signature = this.createElementSignature(tagName, id, className);

            if (textContent.length > 0 || id || className) {
                elements.push({
                    index: elementIndex++,
                    tag: tagName,
                    text: textContent,
                    normalizedText: textContent.toLowerCase().replace(/\s+/g, ' ').trim(),
                    textType: this.classifyContent(textContent),
                    signature
                });
            }
        }
        return elements;
    }

    extractAttribute(attrString, attrName) {
        const regex = new RegExp(`${attrName}=["']([^"']*)["']`, 'i');
        const match = attrString.match(regex);
        return match ? match[1] : null;
    }

    createElementSignature(tag, id, className) {
        let sig = tag;
        if (id) sig += `#${id}`;
        if (className) sig += `.${className.split(/\s+/)[0]}`;
        return sig;
    }

    buildElementMap(elements) {
        const map = new Map();
        for (const el of elements) {
            const key = el.text ? `${el.signature}::${el.normalizedText}` : el.signature;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(el);
        }
        return map;
    }

    compareDOMElements(map1, map2, elements1, elements2) {
        const added = [], removed = [], modified = [];
        const categories = {
            numbers: { added: 0, removed: 0, changed: 0 },
            dates: { added: 0, removed: 0, changed: 0 },
            text: { added: 0, removed: 0, changed: 0 },
            labels: { added: 0, removed: 0, changed: 0 }
        };

        for (const [key, els1] of map1) {
            if (!map2.has(key)) {
                els1.forEach(el => {
                    removed.push({ type: 'removed', content: el.text });
                    this.incrementCategory(categories, el.textType, 'removed');
                });
            }
        }

        for (const [key, els2] of map2) {
            if (!map1.has(key)) {
                els2.forEach(el => {
                    added.push({ type: 'added', content: el.text });
                    this.incrementCategory(categories, el.textType, 'added');
                });
            }
        }

        const valueChanges = this.detectDOMValueChanges(elements1, elements2);
        valueChanges.forEach(vc => {
            modified.push(vc);
            this.incrementCategory(categories, vc.category, 'changed');
        });

        return {
            totalChanges: added.length + removed.length + modified.length,
            added: added.length, removed: removed.length, modified: modified.length,
            lines: [...removed.slice(0, 20), ...added.slice(0, 20), ...modified.slice(0, 20)],
            categories,
            highlights: []
        };
    }

    detectDOMValueChanges(elements1, elements2) {
        const changes = [];
        const minLen = Math.min(elements1.length, elements2.length);
        for (let i = 0; i < minLen; i++) {
            const e1 = elements1[i], e2 = elements2[i];
            if (e1.signature === e2.signature && e1.text !== e2.text && e1.textType !== 'text') {
                changes.push({ type: 'modified', category: e1.textType, content: `${e1.text} → ${e2.text}` });
            }
        }
        return changes;
    }

    classifyContent(content) {
        if (/^[\d,.\s]+[円¥$€₫]?$/.test(content)) return 'number';
        if (/^\d{4}[-\/年]\d{1,2}/.test(content)) return 'date';
        if (content.length <= 20 && !/\s/.test(content)) return 'label';
        return 'text';
    }

    incrementCategory(categories, type, action) {
        const cat = type === 'number' ? 'numbers' : type === 'date' ? 'dates' : type === 'label' ? 'labels' : 'text';
        if (categories[cat]) categories[cat][action]++;
    }

    buildDOMDiffSummary(diff) {
        return `+${diff.added}, -${diff.removed}, ~${diff.modified}`;
    }

    // Load API data from ANY format and normalize
    async loadAPIData(pagePath) {
        // Try new format (apis.json - supports full format AND old compact format)
        const apisPath = path.join(pagePath, 'apis.json');
        if (await fs.pathExists(apisPath)) {
            const apis = await fs.readJson(apisPath);
            const apisList = Array.isArray(apis) ? apis : (apis.requests || []);
            // Normalize ALL formats to standard
            return apisList.map(a => ({
                method: a.m || a.method,
                url: a.u || a.url,
                status: a.s || a.status,
                statusText: a.statusText || '',
                duration: a.d || a.duration,
                mimeType: a.mimeType || '',
                reqHeaders: a.reqHeaders || a.headers || {},
                requestBody: a.req || a.requestBody || a.body || null,
                resHeaders: a.resHeaders || {},
                responseBody: a.res || a.responseBody || a.response || null,
                originUrl: a.originUrl || '',
                originPath: a.originPath || '',
                error: a.error || null,
                time: a.time || 0
            }));
        }

        // Try old format (API/requests.json)
        const requestsPath = path.join(pagePath, 'API', 'requests.json');
        if (await fs.pathExists(requestsPath)) {
            const data = await fs.readJson(requestsPath);
            return (Array.isArray(data) ? data : []).map(a => ({
                method: a.method || 'GET',
                url: a.url || '',
                status: a.status || 0,
                statusText: '',
                duration: a.duration || 0,
                mimeType: '',
                reqHeaders: a.headers || {},
                requestBody: a.requestBody || a.body || null,
                resHeaders: {},
                responseBody: a.responseBody || a.response || null,
                originUrl: '',
                originPath: '',
                error: null,
                time: a.time || 0
            }));
        }

        return [];
    }

    /**
     * Compare APIs between two captures - DEEP comparison
     * Detects: added/removed endpoints, status changes, response body changes
     */
    async compareAPI(path1, path2) {
        const a1 = await this.loadAPIData(path1);
        const a2 = await this.loadAPIData(path2);

        const getEndpoint = (a) => `${a.method} ${this.extractPathname(a.url)}`;

        // Group by endpoint for detailed per-endpoint comparison
        const groupByEndpoint = (apis) => {
            const map = new Map();
            for (const api of apis) {
                const key = getEndpoint(api);
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(api);
            }
            return map;
        };

        const group1 = groupByEndpoint(a1);
        const group2 = groupByEndpoint(a2);
        const allEndpoints = new Set([...group1.keys(), ...group2.keys()]);

        const added = [];      // Endpoints only in section 2
        const removed = [];    // Endpoints only in section 1
        const modified = [];   // Endpoints with changed response

        for (const endpoint of allEndpoints) {
            const apis1 = group1.get(endpoint) || [];
            const apis2 = group2.get(endpoint) || [];

            if (apis1.length === 0 && apis2.length > 0) {
                added.push({
                    endpoint,
                    count: apis2.length,
                    statuses: apis2.map(a => a.status)
                });
            } else if (apis1.length > 0 && apis2.length === 0) {
                removed.push({
                    endpoint,
                    count: apis1.length,
                    statuses: apis1.map(a => a.status)
                });
            } else {
                // Both have this endpoint — compare deeply
                const changes = this.compareEndpointAPIs(apis1, apis2, endpoint);
                if (changes.length > 0) {
                    modified.push({
                        endpoint,
                        changes
                    });
                }
            }
        }

        const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

        // Build summary
        const parts = [`${a1.length} vs ${a2.length} calls`];
        if (added.length > 0) parts.push(`+${added.length} THÊM`);
        if (removed.length > 0) parts.push(`-${removed.length} XOÁ`);
        if (modified.length > 0) parts.push(`~${modified.length} SỬA`);

        return {
            hasChanges,
            summary: parts.join(', '),
            added,
            removed,
            modified,
            total1: a1.length,
            total2: a2.length
        };
    }

    /**
     * Deep compare API calls for the same endpoint between two sections
     */
    compareEndpointAPIs(apis1, apis2, endpoint) {
        const changes = [];

        // Compare each pair (by index)
        const maxLen = Math.max(apis1.length, apis2.length);
        for (let i = 0; i < maxLen; i++) {
            const api1 = apis1[i];
            const api2 = apis2[i];

            if (!api1 || !api2) {
                changes.push({
                    type: !api1 ? 'added_call' : 'removed_call',
                    detail: `API call ${!api1 ? 'thêm' : 'xoá'} tại index ${i}`
                });
                continue;
            }

            // Status change
            if (api1.status !== api2.status) {
                changes.push({
                    type: 'status_changed',
                    old: api1.status,
                    new: api2.status,
                    detail: `Status: ${api1.status} → ${api2.status}`
                });
            }

            // Response body change (deep compare for JSON)
            const bodyDiff = this.compareResponseBodies(api1.responseBody, api2.responseBody);
            if (bodyDiff) {
                changes.push({
                    type: 'response_changed',
                    ...bodyDiff
                });
            }

            // Request body change
            const reqDiff = this.compareResponseBodies(api1.requestBody, api2.requestBody);
            if (reqDiff) {
                changes.push({
                    type: 'request_changed',
                    ...reqDiff
                });
            }
        }

        return changes;
    }

    /**
     * Compare two response bodies (handles JSON objects, arrays, and strings)
     */
    compareResponseBodies(body1, body2) {
        if (body1 === body2) return null;
        if (body1 === null && body2 === null) return null;
        if (body1 === null || body2 === null) {
            return { detail: body1 === null ? 'Response body added' : 'Response body removed' };
        }

        // Both are objects — do structural comparison
        if (typeof body1 === 'object' && typeof body2 === 'object') {
            const diffs = this.diffObjects(body1, body2, '', 0);
            if (diffs.length === 0) return null;
            return {
                detail: `${diffs.length} field(s) changed`,
                fields: diffs.slice(0, 20) // Limit to 20 most important diffs
            };
        }

        // String comparison
        const str1 = String(body1);
        const str2 = String(body2);
        if (str1 === str2) return null;
        if (str1.length !== str2.length) {
            return { detail: `Body size: ${str1.length} → ${str2.length} chars` };
        }
        return { detail: 'Body content changed' };
    }

    /**
     * Diff two JSON objects recursively (max depth 5)
     */
    diffObjects(obj1, obj2, prefix, depth) {
        if (depth > 5) return [];
        const diffs = [];

        const keys1 = Object.keys(obj1 || {});
        const keys2 = Object.keys(obj2 || {});
        const allKeys = new Set([...keys1, ...keys2]);

        for (const key of allKeys) {
            const path = prefix ? `${prefix}.${key}` : key;
            // Normalize array indices to * for grouping
            const normalizedPath = path.replace(/\.\d+\./g, '.*.').replace(/\.\d+$/, '.*');

            // Skip if already have a diff for this normalized path
            if (diffs.some(d => d.normalizedPath === normalizedPath)) continue;

            const v1 = obj1?.[key];
            const v2 = obj2?.[key];

            if (v1 === undefined && v2 !== undefined) {
                diffs.push({ path, normalizedPath, type: 'THÊM', value: this.summarizeValue(v2) });
            } else if (v1 !== undefined && v2 === undefined) {
                diffs.push({ path, normalizedPath, type: 'XOÁ', value: this.summarizeValue(v1) });
            } else if (typeof v1 === 'object' && typeof v2 === 'object' && v1 !== null && v2 !== null) {
                if (Array.isArray(v1) && Array.isArray(v2)) {
                    if (v1.length !== v2.length) {
                        diffs.push({ path, normalizedPath, type: 'SỬA', detail: `Array: ${v1.length} → ${v2.length} items` });
                    } else {
                        // Compare first few array items
                        for (let i = 0; i < Math.min(v1.length, 3); i++) {
                            diffs.push(...this.diffObjects(v1[i], v2[i], `${path}.${i}`, depth + 1));
                        }
                    }
                } else {
                    diffs.push(...this.diffObjects(v1, v2, path, depth + 1));
                }
            } else if (v1 !== v2) {
                diffs.push({ path, normalizedPath, type: 'SỬA', old: this.summarizeValue(v1), new: this.summarizeValue(v2) });
            }
        }

        return diffs;
    }

    /**
     * Summarize a value for display (truncate long strings)
     */
    summarizeValue(val) {
        if (val === null || val === undefined) return 'null';
        if (typeof val === 'string') return val.length > 100 ? val.substring(0, 100) + '...' : val;
        if (typeof val === 'object') return Array.isArray(val) ? `Array(${val.length})` : `Object(${Object.keys(val).length})`;
        return String(val);
    }

    extractPathname(url) {
        try {
            return new URL(url).pathname;
        } catch {
            return url;
        }
    }

    // Check if page has preview (screen.html or dom.json)
    async hasPreview(pagePath) {
        return await fs.pathExists(path.join(pagePath, 'screen.html')) ||
            await fs.pathExists(path.join(pagePath, 'dom.json')) ||
            await fs.pathExists(path.join(pagePath, 'UI', 'screenshot.jpg'));
    }

    async getPageDiff(projectName, section1, section2, path1, path2) {
        console.log(`[getPageDiff] Project: ${projectName}, S1: ${section1}, S2: ${section2}, P1: ${path1}, P2: ${path2}`);
        try {
            const getBasePath = (ts) => ts === 'main' ? storageService.getMainPath(projectName) : storageService.getSectionPath(projectName, ts);
            const f1 = path1 ? path.join(getBasePath(section1), path1) : null;
            const f2 = path2 ? path.join(getBasePath(section2), path2) : null;

            console.log(`[getPageDiff] F1: ${f1}, F2: ${f2}`);

            const result = { projectName, section1, section2, path1, path2, preview1: null, preview2: null, textDiff: null, apiDiff: null };

            // Check for preview using new format (screen.html, dom.json) or old format (screenshot.jpg)
            if (f1 && await this.hasPreview(f1)) {
                result.preview1 = `/api/capture/preview/${encodeURIComponent(projectName)}/${encodeURIComponent(section1)}/${path1}`;
            }
            if (f2 && await this.hasPreview(f2)) {
                result.preview2 = `/api/capture/preview/${encodeURIComponent(projectName)}/${encodeURIComponent(section2)}/${path2}`;
            }

            if (f1 && f2) {
                console.log('[getPageDiff] Comparing UI...');
                result.uiDiff = await this.compareUI(f1, f2);
                result.textDiff = result.uiDiff;
                console.log('[getPageDiff] Comparing API...');
                result.apiDiff = await this.compareAPI(f1, f2);
            } else {
                result.textDiff = {
                    hasChanges: true,
                    summary: f1 ? 'Deleted' : 'Added',
                    categories: { numbers: { added: 0, removed: 0, changed: 0 }, dates: { added: 0, removed: 0, changed: 0 }, text: { added: 0, removed: 0, changed: 0 }, labels: { added: 0, removed: 0, changed: 0 } },
                    lines: [{ type: f1 ? 'removed' : 'added', content: f1 ? 'Màn hình đã bị xóa' : 'Màn hình mới được thêm' }]
                };
            }
            return result;
        } catch (error) {
            console.error('[getPageDiff] ERROR:', error);
            throw error;
        }
    }
}

module.exports = new CompareService();
