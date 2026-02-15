/**
 * Diff Worker - Runs heavy diff operations in a Worker Thread
 * 
 * This file is loaded by worker_threads and processes diff tasks
 * off the main thread to prevent event loop blocking.
 * 
 * Supported tasks:
 * - json_diff: Deep JSON object comparison
 * - dom_diff: HTML structural comparison
 * - css_diff: CSS style tree walk comparison
 */

const { parentPort, workerData } = require('worker_threads');

// ═══════════════════════════════════════════════════
// JSON DIFF (from json-differ.js logic)
// ═══════════════════════════════════════════════════

function deepCompare(main, section, path, maskedFields, changes) {
    if (shouldMask(path, maskedFields)) return;

    const mainType = getType(main);
    const sectionType = getType(section);

    if (mainType !== sectionType) {
        changes.push({ path, type: 'type_changed', oldType: mainType, newType: sectionType, oldValue: summarizeValue(main), newValue: summarizeValue(section) });
        return;
    }

    switch (mainType) {
        case 'object':
            compareObjects(main, section, path, maskedFields, changes);
            break;
        case 'array':
            compareArrays(main, section, path, maskedFields, changes);
            break;
        default:
            if (main !== section) {
                changes.push({ path, type: 'value_changed', oldValue: main, newValue: section });
            }
    }
}

function compareObjects(main, section, path, maskedFields, changes) {
    const allKeys = new Set([...Object.keys(main), ...Object.keys(section)]);
    for (const key of allKeys) {
        const keyPath = `${path}.${key}`;
        if (shouldMask(keyPath, maskedFields)) continue;
        if (!(key in main)) {
            changes.push({ path: keyPath, type: 'added', newValue: summarizeValue(section[key]) });
        } else if (!(key in section)) {
            changes.push({ path: keyPath, type: 'removed', oldValue: summarizeValue(main[key]) });
        } else {
            deepCompare(main[key], section[key], keyPath, maskedFields, changes);
        }
    }
}

function compareArrays(main, section, path, maskedFields, changes) {
    const maxLen = Math.max(main.length, section.length);
    if (main.length !== section.length) {
        changes.push({ path: `${path}.length`, type: 'value_changed', oldValue: main.length, newValue: section.length });
    }
    for (let i = 0; i < maxLen; i++) {
        const itemPath = `${path}[${i}]`;
        if (i >= main.length) {
            changes.push({ path: itemPath, type: 'added', newValue: summarizeValue(section[i]) });
        } else if (i >= section.length) {
            changes.push({ path: itemPath, type: 'removed', oldValue: summarizeValue(main[i]) });
        } else {
            deepCompare(main[i], section[i], itemPath, maskedFields, changes);
        }
    }
}

function shouldMask(path, maskedFields) {
    const pathParts = path.split('.');
    const lastPart = pathParts[pathParts.length - 1];
    for (const mask of maskedFields) {
        if (lastPart === mask) return true;
        if (mask.startsWith('*') && lastPart.endsWith(mask.substring(1))) return true;
        if (mask.endsWith('*') && lastPart.startsWith(mask.slice(0, -1))) return true;
        // Regex mask (starts with /)
        if (mask.startsWith('/') && mask.endsWith('/')) {
            try {
                if (new RegExp(mask.slice(1, -1)).test(lastPart)) return true;
            } catch { }
        }
        const cleanPart = lastPart.replace(/\[\d+\]$/, '');
        if (cleanPart === mask) return true;
    }
    return false;
}

function getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function summarizeValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    const type = getType(value);
    switch (type) {
        case 'object': {
            const keys = Object.keys(value);
            return keys.length <= 3 ? `{${keys.join(', ')}}` : `{${keys.slice(0, 3).join(', ')}... +${keys.length - 3} more}`;
        }
        case 'array':
            return `[${value.length} items]`;
        case 'string':
            return value.length > 50 ? `"${value.substring(0, 50)}..."` : `"${value}"`;
        default:
            return String(value);
    }
}

// ═══════════════════════════════════════════════════
// RESPONSE BODY DIFF (from compare.service.js logic)
// ═══════════════════════════════════════════════════

function diffObjects(obj1, obj2, prefix, depth) {
    if (depth > 5) return [];
    const diffs = [];
    const keys1 = Object.keys(obj1 || {});
    const keys2 = Object.keys(obj2 || {});
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
        const path = prefix ? `${prefix}.${key}` : key;
        const normalizedPath = path.replace(/\.\d+\./g, '.*.').replace(/\.\d+$/, '.*');
        if (diffs.some(d => d.normalizedPath === normalizedPath)) continue;

        const v1 = obj1?.[key];
        const v2 = obj2?.[key];

        if (v1 === undefined && v2 !== undefined) {
            diffs.push({ path, normalizedPath, type: 'THÊM', value: summarizeValue(v2) });
        } else if (v1 !== undefined && v2 === undefined) {
            diffs.push({ path, normalizedPath, type: 'XOÁ', value: summarizeValue(v1) });
        } else if (typeof v1 === 'object' && typeof v2 === 'object' && v1 !== null && v2 !== null) {
            if (Array.isArray(v1) && Array.isArray(v2)) {
                if (v1.length !== v2.length) {
                    diffs.push({ path, normalizedPath, type: 'SỬA', detail: `Array: ${v1.length} → ${v2.length} items` });
                } else {
                    for (let i = 0; i < Math.min(v1.length, 3); i++) {
                        diffs.push(...diffObjects(v1[i], v2[i], `${path}.${i}`, depth + 1));
                    }
                }
            } else {
                diffs.push(...diffObjects(v1, v2, path, depth + 1));
            }
        } else if (v1 !== v2) {
            diffs.push({ path, normalizedPath, type: 'SỬA', old: summarizeValue(v1), new: summarizeValue(v2) });
        }
    }
    return diffs;
}

function compareResponseBodies(body1, body2) {
    if (body1 === body2) return null;
    if (body1 === null && body2 === null) return null;
    if (body1 === null || body2 === null) {
        return { detail: body1 === null ? 'Response body added' : 'Response body removed' };
    }
    if (typeof body1 === 'object' && typeof body2 === 'object') {
        const diffs = diffObjects(body1, body2, '', 0);
        if (diffs.length === 0) return null;
        return { detail: `${diffs.length} field(s) changed`, fields: diffs.slice(0, 20) };
    }
    const str1 = String(body1);
    const str2 = String(body2);
    if (str1 === str2) return null;
    if (str1.length !== str2.length) {
        return { detail: `Body size: ${str1.length} → ${str2.length} chars` };
    }
    return { detail: 'Body content changed' };
}

// ═══════════════════════════════════════════════════
// TASK HANDLER
// ═══════════════════════════════════════════════════

parentPort.on('message', (task) => {
    try {
        let result;
        switch (task.type) {
            case 'json_diff': {
                const changes = [];
                deepCompare(task.main, task.section, '$', task.maskedFields || [], changes);
                result = { hasChanges: changes.length > 0, changes };
                break;
            }
            case 'response_body_diff': {
                result = compareResponseBodies(task.body1, task.body2);
                break;
            }
            case 'endpoint_apis_diff': {
                const changes = [];
                const { apis1, apis2, endpoint } = task;
                const maxLen = Math.max(apis1.length, apis2.length);
                for (let i = 0; i < maxLen; i++) {
                    const api1 = apis1[i];
                    const api2 = apis2[i];
                    if (!api1 || !api2) {
                        changes.push({ type: !api1 ? 'added_call' : 'removed_call', detail: `API call ${!api1 ? 'thêm' : 'xoá'} tại index ${i}` });
                        continue;
                    }
                    if (api1.status !== api2.status) {
                        changes.push({ type: 'status_changed', old: api1.status, new: api2.status, detail: `Status: ${api1.status} → ${api2.status}` });
                    }
                    const bodyDiff = compareResponseBodies(api1.responseBody, api2.responseBody);
                    if (bodyDiff) changes.push({ type: 'response_changed', ...bodyDiff });
                    const reqDiff = compareResponseBodies(api1.requestBody, api2.requestBody);
                    if (reqDiff) changes.push({ type: 'request_changed', ...reqDiff });
                }
                result = changes;
                break;
            }
            default:
                result = { error: `Unknown task type: ${task.type}` };
        }
        parentPort.postMessage({ id: task.id, result });
    } catch (error) {
        parentPort.postMessage({ id: task.id, error: error.message });
    }
});
