const path = require('path');
const fs = require('fs-extra');
const storageService = require('./storage.service');

class ValidationService {
    /**
     * Validate a section before replay
     * Returns validation report with issues and recommendations
     */
    async validateSection(projectName, sectionTimestamp) {
        const sectionPath = storageService.getSectionPath(projectName, sectionTimestamp);

        if (!await fs.pathExists(sectionPath)) {
            return {
                valid: false,
                issues: [{
                    severity: 'error',
                    type: 'section_not_found',
                    message: `Section ${sectionTimestamp} không tồn tại`
                }],
                summary: { errors: 1, warnings: 0, total: 1 }
            };
        }

        const issues = [];

        // 1. Check flow completeness
        const flowIssues = await this.validateFlow(projectName, sectionTimestamp);
        issues.push(...flowIssues);

        // 2. Check interactions quality
        const interactionIssues = await this.validateInteractions(projectName, sectionTimestamp);
        issues.push(...interactionIssues);

        // 3. Check navigation consistency
        const navigationIssues = await this.validateNavigation(projectName, sectionTimestamp);
        issues.push(...navigationIssues);

        // 4. Check pages completeness
        const pageIssues = await this.validatePages(projectName, sectionTimestamp);
        issues.push(...pageIssues);

        // 5. Check auth requirements
        const authIssues = await this.validateAuth(projectName, sectionTimestamp);
        issues.push(...authIssues);

        return {
            valid: issues.filter(i => i.severity === 'error').length === 0,
            issues: issues,
            summary: {
                errors: issues.filter(i => i.severity === 'error').length,
                warnings: issues.filter(i => i.severity === 'warning').length,
                total: issues.length
            }
        };
    }

    async validateFlow(projectName, sectionTimestamp) {
        const issues = [];

        try {
            const sectionFlow = await storageService.getSectionFlow(projectName, sectionTimestamp);

            if (!sectionFlow || !sectionFlow.edges || sectionFlow.edges.length === 0) {
                issues.push({
                    severity: 'error',
                    type: 'missing_flow',
                    message: 'Section không có flow data. Không thể replay.',
                    recommendation: 'Capture lại section với interactions tracking'
                });
                return issues;
            }

            // Check if edges have order
            const hasOrder = sectionFlow.edges.every(e => typeof e.order === 'number');
            if (!hasOrder) {
                issues.push({
                    severity: 'warning',
                    type: 'missing_edge_order',
                    message: 'Một số edges không có order, có thể replay sai thứ tự'
                });
            }

        } catch (err) {
            issues.push({
                severity: 'error',
                type: 'flow_read_error',
                message: `Lỗi khi đọc flow: ${err.message}`
            });
        }

        return issues;
    }

    async validateInteractions(projectName, sectionTimestamp) {
        const issues = [];

        try {
            const sectionFlow = await storageService.getSectionFlow(projectName, sectionTimestamp);

            if (!sectionFlow || !sectionFlow.edges) return issues;

            for (let i = 0; i < sectionFlow.edges.length; i++) {
                const edge = sectionFlow.edges[i];
                const edgeName = `${edge.from} → ${edge.to}`;

                if (!edge.interaction) {
                    issues.push({
                        severity: 'warning',
                        type: 'missing_interaction',
                        edge: edgeName,
                        step: i,
                        message: 'Edge không có interaction, sẽ dùng direct navigation'
                    });
                    continue;
                }

                // Check for sequence quality (Task #2)
                const sequence = edge.interaction.sequence || [edge.interaction];
                
                // 1. Check if input sequence is followed by a trigger (Enter or Click)
                const hasInput = sequence.some(s => s.type === 'input' || s.type === 'type');
                const hasTrigger = sequence.some(s => s.type === 'click' || (s.type === 'keypress' && s.key === 'Enter'));
                
                if (hasInput && !hasTrigger) {
                    issues.push({
                        severity: 'warning',
                        type: 'input_without_trigger',
                        edge: edgeName,
                        step: i,
                        message: 'Có typing action nhưng không thấy click hoặc Enter để gửi form',
                        recommendation: 'Kiểm tra xem form có được submit tự động không, nếu không hãy ghi lại bước click button Gửi/Lưu'
                    });
                }

                // 2. Check each interaction in sequence
                for (let j = 0; j < sequence.length; j++) {
                    const stepIssues = this.validateStep(sequence[j], edgeName, i, j);
                    issues.push(...stepIssues);
                }
            }

        } catch (err) {
            issues.push({
                severity: 'error',
                type: 'interaction_validation_error',
                message: `Lỗi khi validate interactions: ${err.message}`
            });
        }

        return issues;
    }

    validateStep(interaction, edgeName, edgeIndex, stepIndex) {
        const issues = [];
        const selector = interaction.selector;

        if (!selector && interaction.type !== 'shortcut') {
            issues.push({
                severity: 'error',
                type: 'missing_selector',
                edge: edgeName,
                edgeIndex,
                stepIndex,
                message: `Interaction "${interaction.type}" không có selector`,
                recommendation: 'Interaction này chắc chắn sẽ fail khi replay'
            });
            return issues;
        }

        if (selector) {
            // Check for unstable patterns (Task #1)
            const unstablePatterns = [
                { pattern: /theme--/i, message: 'Theme class detected (unstable/framework)' },
                { pattern: /v-size--/i, message: 'Size utility class detected (unstable/framework)' },
                { pattern: /font-weight-/i, message: 'Font utility class detected (unstable/framework)' },
                { pattern: /:nth-child/i, message: 'nth-child index detected (very fragile)' },
                { pattern: /> div >/i, message: 'Deep structural nesting detected (fragile)' },
                { pattern: /\\.\\w{5,}/i, message: 'Likely dynamic hash class detected' },
                { pattern: /^div$|^span$/i, message: 'Generic tag selector (too broad)' }
            ];

            for (const { pattern, message } of unstablePatterns) {
                if (pattern.test(selector)) {
                    issues.push({
                        severity: 'warning',
                        type: 'unstable_selector',
                        edge: edgeName,
                        edgeIndex,
                        stepIndex,
                        selector: selector,
                        message: message,
                        recommendation: 'Sử dụng data-testid hoặc thuộc tính aria-label để selector bền vững hơn'
                    });
                }
            }

            // Check if it's a "Stable Selector Object" (as planned in Task #1)
            // If it's just a string, it's a warning for future-proofing
            if (typeof selector === 'string' && selector.length > 100) {
                issues.push({
                    severity: 'info',
                    type: 'long_selector',
                    edge: edgeName,
                    selector: selector.substring(0, 50) + '...',
                    message: 'Selector rất dài, có thể bị break khi UI thay đổi nhẹ'
                });
            }
        }

        return issues;
    }

    async validateNavigation(projectName, sectionTimestamp) {
        const issues = [];
        try {
            const sectionFlow = await storageService.getSectionFlow(projectName, sectionTimestamp);
            if (!sectionFlow || !sectionFlow.edges) return issues;

            for (const edge of sectionFlow.edges) {
                // If edge source and target are different, it's a navigation
                if (edge.from !== edge.to && edge.from !== 'start') {
                    const sequence = edge.interaction?.sequence || (edge.interaction ? [edge.interaction] : []);
                    const hasTrigger = sequence.some(s => 
                        s.type === 'click' || 
                        (s.type === 'keypress' && s.key === 'Enter') ||
                        s.type === 'shortcut'
                    );

                    if (!hasTrigger) {
                        issues.push({
                            severity: 'warning',
                            type: 'jump_navigation',
                            edge: `${edge.from} → ${edge.to}`,
                            message: 'Navigation xảy ra nhưng không tìm thấy hành động kích hoạt (click/Enter)',
                            recommendation: 'Replay sẽ dùng direct navigation (page.goto), điều này có thể bỏ qua các side-effects của UI'
                        });
                    }
                }
            }
        } catch (e) { }
        return issues;
    }

    async validatePages(projectName, sectionTimestamp) {
        const issues = [];

        try {
            const sectionPath = storageService.getSectionPath(projectName, sectionTimestamp);
            const compareService = require('./compare.service');
            const pages = await compareService.getAllPages(sectionPath);

            if (pages.length === 0) {
                issues.push({
                    severity: 'error',
                    type: 'no_pages',
                    message: 'Section không có pages nào được capture',
                    recommendation: 'Nhấn ESC trong khi capture để lưu các trạng thái quan trọng của UI'
                });
                return issues;
            }

            for (const page of pages) {
                const metaPath = path.join(page.fullPath, 'metadata.json');
                const uiPath = path.join(page.fullPath, 'UI', 'snapshot.json');
                const screenshotPath = path.join(page.fullPath, 'UI', 'screenshot.jpg');

                if (!await fs.pathExists(metaPath)) {
                    issues.push({
                        severity: 'error',
                        type: 'missing_metadata',
                        page: page.relativePath,
                        message: 'Page thiếu metadata.json'
                    });
                }

                if (!await fs.pathExists(uiPath)) {
                    issues.push({
                        severity: 'error',
                        type: 'missing_snapshot',
                        page: page.relativePath,
                        message: 'Page thiếu UI snapshot (DOM data)',
                        recommendation: 'Trang này có thể không so sánh được nội dung UI'
                    });
                }

                if (!await fs.pathExists(screenshotPath)) {
                    issues.push({
                        severity: 'warning',
                        type: 'missing_screenshot',
                        page: page.relativePath,
                        message: 'Page thiếu screenshot trực quan'
                    });
                }
            }

        } catch (err) {
            issues.push({
                severity: 'error',
                type: 'page_validation_error',
                message: `Lỗi khi validate pages: ${err.message}`
            });
        }

        return issues;
    }

    async validateAuth(projectName, sectionTimestamp) {
        const issues = [];

        try {
            const sectionPath = storageService.getSectionPath(projectName, sectionTimestamp);
            const compareService = require('./compare.service');
            const pages = await compareService.getAllPages(sectionPath);

            // Check if any page requires auth (not a login page)
            const requiresAuth = pages.some(p => {
                const name = p.relativePath.toLowerCase();
                return !name.includes('login') && !name.includes('signin') && !name.includes('auth');
            });

            if (requiresAuth) {
                const authPath = storageService.getAuthPath(projectName);
                if (!await fs.pathExists(authPath)) {
                    issues.push({
                        severity: 'warning',
                        type: 'missing_auth',
                        message: 'Section cần authentication nhưng không có auth data saved',
                        recommendation: 'Có thể cần manual login khi replay'
                    });
                }
            }

        } catch (err) {
            issues.push({
                severity: 'error',
                type: 'auth_validation_error',
                message: `Lỗi khi validate auth: ${err.message}`
            });
        }

        return issues;
    }
}

module.exports = new ValidationService();
