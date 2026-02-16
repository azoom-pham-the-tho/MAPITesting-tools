// Compare View - GitHub-style diff viewer
const CompareView = {
    currentResult: null,

    // Initialize compare view
    init() {
        this.bindEvents();
    },

    bindEvents() {
        // UI Section selector change events
        document.getElementById('compareSection1')?.addEventListener('change', () => this.onSectionChange('ui'));
        document.getElementById('compareSection2')?.addEventListener('change', () => this.onSectionChange('ui'));

        // API Section selector change events
        document.getElementById('apiSection1')?.addEventListener('change', () => this.onSectionChange('api'));
        document.getElementById('apiSection2')?.addEventListener('change', () => this.onSectionChange('api'));

        // Global event delegation for compare results
        ['compareResults', 'apiResults'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', (e) => {
                const itemEl = e.target.closest('.compare-item');
                if (!itemEl) return;

                const type = id === 'compareResults' ? 'ui' : 'api';

                // Handle delete button
                if (e.target.closest('.btn-delete-node')) {
                    e.stopPropagation();
                    const path = itemEl.dataset.path1 || itemEl.dataset.path2;
                    const item = this.currentResult?.items.find(i => (i.page1?.relativePath === path || i.page2?.relativePath === path));
                    if (item) this.deleteItem(item);
                    return;
                }

                // Handle View Diff or Row click
                const path1 = itemEl.dataset.path1;
                const path2 = itemEl.dataset.path2;

                // Visual feedback
                const btn = itemEl.querySelector('.btn-view-diff');
                if (btn) btn.innerHTML = '<div class="spinner-tiny"></div>';
                itemEl.classList.add('loading-diff');

                this.showPageDiff(path1, path2, type).finally(() => {
                    if (btn) btn.innerHTML = '👁️';
                    itemEl.classList.remove('loading-diff');
                });
            });
        });
    },


    // Populate section selectors
    populateSections(sections) {
        if (!sections) return;

        const DEVICE_ICONS = { desktop: '🖥', tablet: '⬛', mobile: '📱', custom: '⚙' };
        const mainOption = '<option value="main">Main (Gốc)</option>';
        const options = sections.map(function (s) {
            var tag = '';
            if (s.deviceProfile && s.deviceProfile !== 'desktop') {
                var icon = DEVICE_ICONS[s.deviceProfile] || '';
                tag = ' ' + icon + ' ' + (s.deviceProfile.charAt(0).toUpperCase() + s.deviceProfile.slice(1));
            }
            return '<option value="' + s.timestamp + '">' + CompareView.formatTimestamp(s.timestamp) + tag + '</option>';
        }).join('');

        // UI Selectors
        const uiSelect1 = document.getElementById('compareSection1');
        const uiSelect2 = document.getElementById('compareSection2');
        if (uiSelect1 && uiSelect2) {
            // Preserve current values if possible
            const val1 = uiSelect1.value;
            const val2 = uiSelect2.value;

            uiSelect1.innerHTML = '<option value="">-- Chọn Section 1 --</option>' + mainOption + options;
            uiSelect2.innerHTML = '<option value="">-- Chọn Section 2 --</option>' + mainOption + options;

            if (val1) uiSelect1.value = val1;
            if (val2) uiSelect2.value = val2;
        }

        // API Selectors
        const apiSelect1 = document.getElementById('apiSection1');
        const apiSelect2 = document.getElementById('apiSection2');
        if (apiSelect1 && apiSelect2) {
            const val1 = apiSelect1.value;
            const val2 = apiSelect2.value;

            apiSelect1.innerHTML = '<option value="">-- Chọn Section 1 --</option>' + mainOption + options;
            apiSelect2.innerHTML = '<option value="">-- Chọn Section 2 --</option>' + mainOption + options;

            if (val1) apiSelect1.value = val1;
            if (val2) apiSelect2.value = val2;
        }
    },

    formatTimestamp(ts) {
        // Check if it looks like our generated timestamp (YYYY-MM-DDTHH-mm-ss...)
        const timestampRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)(.*)?$/;
        const match = ts.match(timestampRegex);

        if (!match) {
            return ts; // It's a custom name, return as is
        }

        const datePart = match[1];
        const suffix = match[2] || ''; // e.g., "_replay", "_backup_123456"

        try {
            // Reconstruct ISO string from folder name (which has dashes instead of colons)
            const isoString = datePart.replace(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2}).*/, '$1T$2:$3:$4Z');
            const date = new Date(isoString);

            if (isNaN(date.getTime())) return ts;

            let formatted = date.toLocaleString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            // Add suffix label if present
            if (suffix) {
                // Convert _replay_replay to (replay x2), _backup_xxx to (backup)
                const replayCount = (suffix.match(/_replay/g) || []).length;
                const isBackup = suffix.includes('_backup');

                if (isBackup) {
                    formatted += ' 📦';
                } else if (replayCount > 0) {
                    formatted += replayCount === 1 ? ' 🔄' : ` 🔄x${replayCount}`;
                }
            }

            return formatted;
        } catch {
            return ts;
        }
    },

    async onSectionChange(type = 'ui') {
        const prefix = type === 'ui' ? 'compare' : 'api';
        const section1 = document.getElementById(`${prefix}Section1`)?.value;
        const section2 = document.getElementById(`${prefix}Section2`)?.value;

        if (section1 && section2 && section1 !== section2) {
            await this.compare(section1, section2, type);
        }
    },

    // Compare two sections
    async compare(section1, section2, type = 'ui') {
        const projectName = window.state?.currentProject;
        if (!projectName) return;

        try {
            this.showLoading(type);

            const response = await fetch('/api/compare/sections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName, section1, section2 })
            });

            const data = await response.json();

            if (data.success) {
                this.currentResult = data.result;
                this.renderResult(data.result, type);
            } else {
                this.showError(data.error, type);
            }
        } catch (error) {
            this.showError(error.message, type);
        }
    },

    showLoading(type) {
        const containerId = type === 'ui' ? 'compareResults' : 'apiResults';
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Đang so sánh ${type.toUpperCase()}...</p>
                </div>
            `;
        }
    },

    showError(message, type) {
        const containerId = type === 'ui' ? 'compareResults' : 'apiResults';
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">❌</span>
                    <p>${message}</p>
                </div>
            `;
        }
    },

    // Render comparison result (progressively for large lists)
    renderResult(result, type = 'ui') {
        const containerId = type === 'ui' ? 'compareResults' : 'apiResults';
        const container = document.getElementById(containerId);
        if (!container) return;

        // Filter items based on type - NOW INCLUDING UNCHANGED
        let filteredItems = result.items;
        if (type === 'ui') {
            filteredItems = result.items.filter(i => {
                if (i.status === 'added' || i.status === 'removed' || i.status === 'unchanged') return true;
                return i.diff && (i.diff.hasChanges || i.diff.uiChanged);
            });
        } else if (type === 'api') {
            filteredItems = result.items.filter(i => {
                if (i.status === 'changed') {
                    return i.diff?.apiChanged || i.diff?.apiDiff?.hasChanges;
                }
                return false;
            });
        }

        // Recalculate summary for filtered view
        const summary = {
            changed: filteredItems.filter(i => i.status === 'changed').length,
            added: filteredItems.filter(i => i.status === 'added').length,
            removed: filteredItems.filter(i => i.status === 'removed').length,
            unchanged: filteredItems.filter(i => i.status === 'unchanged').length
        };

        // Calculate enhanced statistics
        const enhancedStats = this.calculateEnhancedStats(filteredItems);

        // Render summary header immediately
        var deviceWarningHtml = '';
        if (result.deviceWarning) {
            deviceWarningHtml = '<div class="device-warning" style="background: var(--warning-bg, #fff3cd); color: var(--warning-text, #856404); padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; border: 1px solid var(--warning-border, #ffc107);">' + result.deviceWarning + '</div>';
        }

        container.innerHTML = `
        ${deviceWarningHtml}
        <div class="compare-summary">
            <div class="summary-header">
                <h3>📊 Kết quả so sánh ${type.toUpperCase()}</h3>
                <div class="summary-stats">
                    <span class="stat changed"><span class="count">${summary.changed}</span> Thay đổi</span>
                    <span class="stat added" style="display:${type === 'api' ? 'none' : 'inline-flex'}"><span class="count">${summary.added}</span> Thêm mới</span>
                    <span class="stat removed" style="display:${type === 'api' ? 'none' : 'inline-flex'}"><span class="count">${summary.removed}</span> Đã xóa</span>
                    <span class="stat unchanged" style="display:${type === 'api' ? 'none' : 'inline-flex'}"><span class="count">${summary.unchanged}</span> Không đổi</span>
                </div>
                ${enhancedStats.hasData ? this.renderEnhancedStats(enhancedStats, type) : ''}
            </div>
        </div>
        <div class="compare-items" id="${containerId}-items"></div>
    `;

        const itemsContainer = document.getElementById(`${containerId}-items`);

        if (filteredItems.length === 0) {
            itemsContainer.innerHTML = `<div class="empty-state"><p>Không tìm thấy thay đổi nào về ${type.toUpperCase()}</p></div>`;
            return;
        }

        // Use ProgressiveRenderer for large lists (>30 items), inline for small lists
        if (filteredItems.length > 30 && window.ProgressiveRenderer) {
            const renderer = new ProgressiveRenderer({
                chunkSize: 50,
                priorityChunkSize: 15
            });
            renderer.render(filteredItems, itemsContainer, (item) => {
                const div = document.createElement('div');
                div.innerHTML = this.renderCompareItem(item, type);
                return div.firstElementChild;
            });
        } else {
            let html = '';
            for (const item of filteredItems) {
                html += this.renderCompareItem(item, type);
            }
            itemsContainer.innerHTML = html;
        }

        // Note: Event delegation is now handled in init -> bindEvents
    },


    renderCompareItem(item, type) {
        const statusIcons = {
            'changed': '🔄',
            'added': '➕',
            'removed': '➖',
            'unchanged': '✅'
        };

        const statusLabels = {
            'changed': 'Thay đổi',
            'added': 'Thêm mới',
            'removed': 'Đã xóa',
            'unchanged': 'Không đổi'
        };

        let changeDetails = '';

        if (type === 'api') {
            // For API view, summarize API changes
            if (item.diff && item.diff.apiDiff && item.diff.apiDiff.changes) {
                changeDetails = item.diff.apiDiff.changes.map(c => `[API] ${c.key}`).join(', ');
            }
        } else {
            changeDetails = item.diff?.changeDetails?.join(', ') || '';
        }

        return `
            <div class="compare-item status-${item.status}"
                 data-path1="${item.page1?.relativePath || ''}"
                 data-path2="${item.page2?.relativePath || ''}">
                <div class="item-status">
                    <span class="status-icon">${statusIcons[item.status]}</span>
                    <span class="status-label">${statusLabels[item.status]}</span>
                </div>
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-path">${item.path}</div>
                    ${changeDetails ? `<div class="item-changes">${changeDetails}</div>` : ''}
                </div>
                <div class="item-action">
                    ${item.status !== 'unchanged' ? '<button class="btn-view-diff" title="Xem chi tiết">👁️</button>' : ''}
                    <button class="btn-delete-node" title="Xóa màn hình">🗑️</button>
                </div>
            </div>
        `;
    },

    // Calculate enhanced statistics from comparison items
    calculateEnhancedStats(items) {
        const stats = {
            hasData: false,
            totalEvents: 0,
            totalAPICalls: 0,
            correlatedAPIs: 0,
            selfHealed: 0,
            compressionSavings: 0
        };

        for (const item of items) {
            // Count events (from enhanced capture)
            if (item.page1?.metadata?.eventCount) {
                stats.totalEvents += item.page1.metadata.eventCount;
                stats.hasData = true;
            }
            if (item.page2?.metadata?.eventCount) {
                stats.totalEvents += item.page2.metadata.eventCount;
                stats.hasData = true;
            }

            // Count API calls
            if (item.page1?.metadata?.apiCount) {
                stats.totalAPICalls += item.page1.metadata.apiCount;
                stats.hasData = true;
            }
            if (item.page2?.metadata?.apiCount) {
                stats.totalAPICalls += item.page2.metadata.apiCount;
                stats.hasData = true;
            }

            // Count correlated APIs (from API timeline)
            if (item.page1?.apiTimeline?.correlations) {
                stats.correlatedAPIs += item.page1.apiTimeline.correlations.filter(c => c.confidence >= 0.9).length;
                stats.hasData = true;
            }
            if (item.page2?.apiTimeline?.correlations) {
                stats.correlatedAPIs += item.page2.apiTimeline.correlations.filter(c => c.confidence >= 0.9).length;
                stats.hasData = true;
            }

            // Count self-healed selectors (from replay results)
            if (item.replayResults?.healedActions) {
                stats.selfHealed += item.replayResults.healedActions;
                stats.hasData = true;
            }

            // Calculate compression savings
            if (item.page1?.metadata?.compressionStats) {
                stats.compressionSavings += item.page1.metadata.compressionStats.savings || 0;
                stats.hasData = true;
            }
            if (item.page2?.metadata?.compressionStats) {
                stats.compressionSavings += item.page2.metadata.compressionStats.savings || 0;
                stats.hasData = true;
            }
        }

        return stats;
    },

    // Render enhanced statistics UI
    renderEnhancedStats(stats, type) {
        return `
            <div class="enhanced-stats">
                <div class="enhanced-stats-title">📈 Enhanced Capture Stats</div>
                <div class="enhanced-stats-grid">
                    ${stats.totalEvents > 0 ? `
                        <div class="enhanced-stat">
                            <div class="stat-icon">⚡</div>
                            <div class="stat-info">
                                <div class="stat-value">${stats.totalEvents.toLocaleString()}</div>
                                <div class="stat-label">UI Events</div>
                            </div>
                        </div>
                    ` : ''}
                    ${stats.totalAPICalls > 0 ? `
                        <div class="enhanced-stat">
                            <div class="stat-icon">🔗</div>
                            <div class="stat-info">
                                <div class="stat-value">${stats.totalAPICalls}</div>
                                <div class="stat-label">API Calls</div>
                            </div>
                        </div>
                    ` : ''}
                    ${stats.correlatedAPIs > 0 ? `
                        <div class="enhanced-stat">
                            <div class="stat-icon">🎯</div>
                            <div class="stat-info">
                                <div class="stat-value">${stats.correlatedAPIs}</div>
                                <div class="stat-label">Correlated (95%+)</div>
                            </div>
                        </div>
                    ` : ''}
                    ${stats.selfHealed > 0 ? `
                        <div class="enhanced-stat">
                            <div class="stat-icon">🔧</div>
                            <div class="stat-info">
                                <div class="stat-value">${stats.selfHealed}</div>
                                <div class="stat-label">Self-Healed</div>
                            </div>
                        </div>
                    ` : ''}
                    ${stats.compressionSavings > 0 ? `
                        <div class="enhanced-stat">
                            <div class="stat-icon">💾</div>
                            <div class="stat-info">
                                <div class="stat-value">${this.formatBytes(stats.compressionSavings)}</div>
                                <div class="stat-label">Saved</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>

            <style>
                .enhanced-stats {
                    margin-top: 16px;
                    padding: 16px;
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
                    border-radius: 8px;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                }
                .enhanced-stats-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .enhanced-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 12px;
                }
                .enhanced-stat {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 6px;
                    transition: transform 0.2s;
                }
                .enhanced-stat:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }
                .enhanced-stat .stat-icon {
                    font-size: 24px;
                }
                .enhanced-stat .stat-info {
                    flex: 1;
                }
                .enhanced-stat .stat-value {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--primary-color);
                    line-height: 1.2;
                }
                .enhanced-stat .stat-label {
                    font-size: 11px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
            </style>
        `;
    },

    // Format bytes to human readable
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    },

    // Handle delete item
    async deleteItem(item) {
        const projectName = window.state?.currentProject;
        if (!projectName) return;

        let targetPath = null;
        let confirmMsg = '';

        if (item.status === 'added') {
            targetPath = item.page2.fullPath;
            confirmMsg = `Xóa màn hình mới "${item.name}" khỏi Section hiện tại?`;
        } else if (item.status === 'removed') {
            targetPath = item.page1.fullPath;
            confirmMsg = `Xóa màn hình cũ "${item.name}" khỏi Section nguồn/Main?`;
        } else {
            // Changed: Default to deleting the "new" version
            targetPath = item.page2.fullPath;
            confirmMsg = `Xóa màn hình "${item.name}"?`;
        }

        if (confirm(confirmMsg)) {
            try {
                // Use app's api helper if available, or fetch directly
                // We can use window.api if it was exposed? No.
                // We'll fetch directly.
                const response = await fetch(`/api/projects/${projectName}/node`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: targetPath })
                });

                const data = await response.json();
                if (data.success) {
                    // Refresh comparison
                    this.onSectionChange();
                } else {
                    alert('Lỗi: ' + data.error);
                }
            } catch (e) {
                alert('Lỗi: ' + e.message);
            }
        }
    },

    // Show detailed page diff
    async showPageDiff(path1, path2, type = 'ui') {
        // Use stored sections from current result if available (more reliable)
        let section1 = this.currentResult?.section1;
        let section2 = this.currentResult?.section2;

        // Fallback to DOM if not found (e.g. direct access)
        if (!section1 || !section2) {
            const prefix = type === 'ui' ? 'compare' : 'api';
            section1 = document.getElementById(`${prefix}Section1`)?.value;
            section2 = document.getElementById(`${prefix}Section2`)?.value;
        }

        const projectName = window.state?.currentProject;

        if (!section1 || !section2 || !projectName) {
            console.error('Missing comparison context:', { section1, section2, projectName });
            return;
        }

        try {
            // Show loading state on the button/row is handled by caller

            const response = await fetch('/api/compare/page-diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName, section1, section2, path1, path2 })
            });

            const data = await response.json();

            if (data.success) {
                this.showDiffModal(data.result, path2 || path1, type);
            } else {
                alert('Lỗi tải diff: ' + data.error);
            }
        } catch (error) {
            console.error('Get diff error:', error);
            alert('Lỗi kết nối: ' + error.message);
        }
    },

    // Show diff modal with DOM preview and text changes
    showDiffModal(diff, pagePath, type = 'ui') {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'diff-modal';

        const hasPreviews = diff.preview1 || diff.preview2;

        modal.innerHTML = `
            <div class="diff-modal-content">
                <div class="diff-modal-header">
                    <h2>📋 Chi tiết thay đổi ${type === 'api' ? '(API Focus)' : ''}</h2>
                    <div class="diff-path">${pagePath}</div>
                    <button class="close-modal">✕</button>
                </div>
                
                <div class="diff-modal-body">
                    <!-- DOM Preview comparison -->
                    <div class="diff-section" style="${type === 'api' ? 'order: 3;' : ''}">
                        <h3>📄 So sánh giao diện</h3>
                        
                        <!-- Side by side view (default) -->
                        <div class="screenshot-view screenshot-side-by-side active">
                            <div class="screenshot-compare-large">
                                <div class="screenshot-panel-large">
                                    <div class="screenshot-label before-label">🔴 Section 1 (Trước)</div>
                                    ${diff.preview1
                ? `<iframe src="${diff.preview1}" class="preview-iframe" sandbox="allow-same-origin" style="width: 100%; height: 400px; border: none; background: #1a1a2e;"></iframe>`
                : '<div class="no-screenshot">📄 Không có preview</div>'}
                                </div>
                                <div class="screenshot-panel-large">
                                    <div class="screenshot-label after-label">🟢 Section 2 (Sau)</div>
                                    ${diff.preview2
                ? `<iframe src="${diff.preview2}" class="preview-iframe" sandbox="allow-same-origin" style="width: 100%; height: 400px; border: none; background: #1a1a2e;"></iframe>`
                : '<div class="no-screenshot">📄 Không có preview</div>'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Text diff -->
                    <div style="${type === 'api' ? 'order: 2;' : ''}">
                         ${diff.textDiff ? this.renderTextDiff(diff.textDiff) : ''}
                    </div>

                    <!-- API diff -->
                    <div id="apiDiffSection" style="${type === 'api' ? 'order: 1;' : ''}">
                        ${diff.apiDiff ? this.renderApiDiff(diff.apiDiff) : (type === 'api' ? '<div class="diff-section"><h3>🔗 API Diff</h3><p>Không có thay đổi API nào cho màn hình này.</p></div>' : '')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Auto scroll to API section if type is api
        if (type === 'api') {
            setTimeout(() => {
                const apiSection = modal.querySelector('#apiDiffSection');
                if (apiSection) apiSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }

        // Note: Slider functionality removed as it's not being used in the current modal
    },

    // Placeholder for future slider implementation
    _initSlider() {
        // Mouse events with optimized handling
        const handle = null; // TODO: define handle element
        if (!handle) return;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            e.preventDefault();
            e.stopPropagation();

            // Add cursor style to body during drag
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });

        // Use document for mousemove to track even outside container
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            // Throttle: Only update if moved more than 2px
            if (lastX !== null && Math.abs(e.clientX - lastX) < 2) return;
            lastX = e.clientX;

            updateSlider(e.clientX);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });

        // Click to jump (with debounce)
        let clickTimeout = null;
        sliderContainer.addEventListener('click', (e) => {
            if (isDragging) return;

            // Debounce rapid clicks
            if (clickTimeout) clearTimeout(clickTimeout);
            clickTimeout = setTimeout(() => {
                updateSlider(e.clientX);
            }, 50);
        });

        // Touch events for mobile - optimized
        handle.addEventListener('touchstart', (e) => {
            isDragging = true;
            e.preventDefault();
        }, { passive: false });

        sliderContainer.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length > 0) {
                updateSlider(e.touches[0].clientX);
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            isDragging = false;
        });

        // Initial position at 50% - delayed to ensure layout is ready
        requestAnimationFrame(() => {
            const rect = sliderContainer.getBoundingClientRect();
            updateSlider(rect.left + rect.width / 2);
        });
    },

    // Generate image diff using canvas
    async generateImageDiff(modal, diff) {
        const canvas = modal.querySelector('#diffCanvas');
        const loading = modal.querySelector('.diff-loading');

        if (!canvas || !diff.screenshot1 || !diff.screenshot2) return;

        const ctx = canvas.getContext('2d');

        if (loading) loading.style.display = 'flex';

        try {
            // Load images
            const img1 = await this.loadImage(diff.screenshot1);
            const img2 = await this.loadImage(diff.screenshot2);

            // Set canvas size
            const maxWidth = Math.max(img1.width, img2.width);
            const maxHeight = Math.max(img1.height, img2.height);
            canvas.width = maxWidth;
            canvas.height = maxHeight;

            // Draw base image (before)
            ctx.drawImage(img1, 0, 0);
            const imageData1 = ctx.getImageData(0, 0, maxWidth, maxHeight);

            // Draw after image
            ctx.clearRect(0, 0, maxWidth, maxHeight);
            ctx.drawImage(img2, 0, 0);
            const imageData2 = ctx.getImageData(0, 0, maxWidth, maxHeight);

            // Create diff image
            const diffData = ctx.createImageData(maxWidth, maxHeight);
            const threshold = 30; // Color difference threshold

            for (let i = 0; i < imageData1.data.length; i += 4) {
                const r1 = imageData1.data[i];
                const g1 = imageData1.data[i + 1];
                const b1 = imageData1.data[i + 2];

                const r2 = imageData2.data[i];
                const g2 = imageData2.data[i + 1];
                const b2 = imageData2.data[i + 2];

                const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);

                if (diff > threshold) {
                    // Highlight difference with color
                    if (r2 > r1 || g2 > g1 || b2 > b1) {
                        // Added content - green overlay
                        diffData.data[i] = 0;
                        diffData.data[i + 1] = 255;
                        diffData.data[i + 2] = 100;
                        diffData.data[i + 3] = 180;
                    } else {
                        // Removed content - red overlay
                        diffData.data[i] = 255;
                        diffData.data[i + 1] = 100;
                        diffData.data[i + 2] = 100;
                        diffData.data[i + 3] = 180;
                    }
                } else {
                    // No change - show grayscale version
                    const gray = (r2 + g2 + b2) / 3;
                    diffData.data[i] = gray;
                    diffData.data[i + 1] = gray;
                    diffData.data[i + 2] = gray;
                    diffData.data[i + 3] = 255;
                }
            }

            ctx.putImageData(diffData, 0, 0);

            // Draw bounding boxes around changed regions
            this.drawChangedRegions(ctx, imageData1, imageData2, maxWidth, maxHeight);

        } catch (error) {
            console.error('Error generating diff:', error);
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, canvas.width || 400, canvas.height || 200);
            ctx.fillStyle = '#fff';
            ctx.font = '14px sans-serif';
            ctx.fillText('Không thể tạo diff ảnh', 20, 100);
        } finally {
            loading.style.display = 'none';
        }
    },

    // Draw bounding boxes around changed regions
    drawChangedRegions(ctx, imageData1, imageData2, width, height) {
        const threshold = 30;
        const gridSize = 20;
        const changedCells = [];

        // Find changed grid cells
        for (let y = 0; y < height; y += gridSize) {
            for (let x = 0; x < width; x += gridSize) {
                let hasDiff = false;

                for (let dy = 0; dy < gridSize && !hasDiff; dy++) {
                    for (let dx = 0; dx < gridSize && !hasDiff; dx++) {
                        const px = x + dx;
                        const py = y + dy;
                        if (px >= width || py >= height) continue;

                        const i = (py * width + px) * 4;
                        const diff = Math.abs(imageData1.data[i] - imageData2.data[i]) +
                            Math.abs(imageData1.data[i + 1] - imageData2.data[i + 1]) +
                            Math.abs(imageData1.data[i + 2] - imageData2.data[i + 2]);

                        if (diff > threshold) hasDiff = true;
                    }
                }

                if (hasDiff) changedCells.push({ x, y });
            }
        }

        // Draw rectangles around changed regions
        if (changedCells.length > 0) {
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            // Group nearby cells into regions
            const regions = this.groupChangedCells(changedCells, gridSize);

            for (const region of regions) {
                ctx.strokeRect(region.x - 5, region.y - 5, region.width + 10, region.height + 10);
            }
        }
    },

    // Group nearby changed cells into regions
    groupChangedCells(cells, gridSize) {
        if (cells.length === 0) return [];

        const regions = [];
        const visited = new Set();

        for (const cell of cells) {
            const key = `${cell.x},${cell.y}`;
            if (visited.has(key)) continue;

            // Find connected cells
            const region = { x: cell.x, y: cell.y, width: gridSize, height: gridSize };
            const queue = [cell];

            while (queue.length > 0) {
                const current = queue.shift();
                const currentKey = `${current.x},${current.y}`;
                if (visited.has(currentKey)) continue;
                visited.add(currentKey);

                // Expand region
                region.x = Math.min(region.x, current.x);
                region.y = Math.min(region.y, current.y);
                region.width = Math.max(region.width, current.x + gridSize - region.x);
                region.height = Math.max(region.height, current.y + gridSize - region.y);

                // Add neighbors
                for (const neighbor of cells) {
                    const neighborKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(neighborKey)) {
                        const dx = Math.abs(neighbor.x - current.x);
                        const dy = Math.abs(neighbor.y - current.y);
                        if (dx <= gridSize && dy <= gridSize) {
                            queue.push(neighbor);
                        }
                    }
                }
            }

            regions.push(region);
        }

        return regions;
    },

    // Load image as promise
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    renderTextDiff(textDiff) {
        if (!textDiff || !textDiff.hasChanges) {
            return '<div class="diff-section"><h3>📝 Nội dung text</h3><p>Không có thay đổi đáng kể</p></div>';
        }

        // Render highlights section with safety checks
        let highlightsHtml = '';
        const highlights = (textDiff.textDiff?.highlights || textDiff.highlights || []);
        if (highlights.length > 0) {
            highlightsHtml = `
                <div class="diff-highlights">
                    <div class="highlights-title">🔍 Phát hiện thay đổi quan trọng:</div>
                    <div class="highlights-grid">
                        ${highlights.map(h => `
                            <div class="highlight-card highlight-${h.type || 'unknown'}">
                                <div class="highlight-icon">${h.icon || '📝'}</div>
                                <div class="highlight-content">
                                    <div class="highlight-label">${h.label || ''}</div>
                                    <div class="highlight-items">
                                        ${(h.items || []).slice(0, 3).map(item => `
                                            <span class="highlight-item ${item.type || 'text'}">${this.escapeHtml(item.content || (item.oldValue + ' → ' + item.newValue) || '')}</span>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Render categories summary with safety checks
        let categoriesHtml = '';
        const categories = textDiff.categories || textDiff.textDiff?.categories;
        if (categories) {
            const getCatStats = (cat) => {
                const c = categories[cat] || { added: 0, removed: 0, changed: 0 };
                return (c.added || 0) + (c.removed || 0) + (c.changed || 0);
            };

            categoriesHtml = `
                <div class="diff-categories">
                    <div class="category-badges">
                        ${getCatStats('numbers') > 0 ? `<span class="category-badge cat-numbers">📊 Số liệu: ${categories.numbers.added || 0}+, ${categories.numbers.removed || 0}-, ${categories.numbers.changed || 0}~</span>` : ''}
                        ${getCatStats('dates') > 0 ? `<span class="category-badge cat-dates">📅 Ngày: ${categories.dates.added || 0}+, ${categories.dates.removed || 0}-</span>` : ''}
                        ${getCatStats('labels') > 0 ? `<span class="category-badge cat-labels">🏷️ Nhãn: ${categories.labels.added || 0}+, ${categories.labels.removed || 0}-</span>` : ''}
                        ${(categories.position?.changed || 0) > 0 ? `<span class="category-badge cat-position">📐 Vị trí: ~${categories.position.changed}</span>` : ''}
                        ${(categories.style?.changed || 0) > 0 ? `<span class="category-badge cat-style">🎨 Style: ~${categories.style.changed}</span>` : ''}
                    </div>
                </div>
            `;
        }


        // Render diff lines with category styling and enhanced display
        let linesHtml = '';
        const lines = textDiff.textDiff?.lines || [];
        for (const line of lines) {
            const lineType = line.type;
            const category = line.category || 'text';

            // Handle different line types
            if (lineType === 'position') {
                // Position change line
                linesHtml += `
                    <div class="diff-line-position category-position">
                        <span class="diff-prefix">📐</span>
                        <span class="diff-category-icon">📐</span>
                        <span class="diff-content">${this.escapeHtml(line.content)}</span>
                        ${line.diff ? `<span class="diff-detail">${line.diff.map(d => `${d.prop}: ${d.old}→${d.new}`).join(', ')}</span>` : ''}
                    </div>
                `;
            } else if (lineType === 'style') {
                // Style change line
                linesHtml += `
                    <div class="diff-line-style category-style">
                        <span class="diff-prefix">🎨</span>
                        <span class="diff-category-icon">🎨</span>
                        <span class="diff-content">${this.escapeHtml(line.content)}</span>
                        ${line.changes ? `<span class="diff-detail">${line.changes.map(c => `${c.property}: ${c.old}→${c.new}`).join(', ')}</span>` : ''}
                    </div>
                `;
            } else {
                // Normal text changes
                let lineClass = lineType === 'added' ? 'diff-line-added' :
                    lineType === 'removed' ? 'diff-line-removed' :
                        'diff-line-modified';
                let prefix = lineType === 'added' ? '+' : lineType === 'removed' ? '-' : '~';
                let categoryIcon = this.getCategoryIcon(category);

                linesHtml += `
                    <div class="${lineClass} category-${category}">
                        <span class="diff-prefix">${prefix}</span>
                        <span class="diff-category-icon">${categoryIcon}</span>
                        <span class="diff-content">${this.escapeHtml(line.content)}</span>
                    </div>
                `;
            }
        }

        return `
            <div class="diff-section">
                <h3>📝 Thay đổi nội dung (${textDiff.summary})</h3>
                ${highlightsHtml}
                ${categoriesHtml}
                <div class="text-diff-container">
                    ${linesHtml || '<p>Không có thay đổi chi tiết</p>'}
                </div>
            </div>
        `;
    },

    // Get icon for content category
    getCategoryIcon(category) {
        const icons = {
            'number': '📊',
            'percentage': '📈',
            'date': '📅',
            'time': '🕐',
            'phone': '📞',
            'email': '📧',
            'label': '🏷️',
            'name': '👤',
            'text': '📝',
            'position': '📐',
            'style': '🎨'
        };
        return icons[category] || '📄';
    },

    renderApiDiff(apiDiff) {
        if (!apiDiff.hasChanges) {
            return '<div class="diff-section"><h3>🔗 API Calls</h3><p>Không có thay đổi</p></div>';
        }

        let html = `
            <div class="diff-section">
                <h3>🔗 API Calls (${apiDiff.summary})</h3>
                <div class="api-diff-container">
        `;

        // Added APIs
        for (const item of apiDiff.added || []) {
            html += `<div class="api-item api-added">➕ ${item.key}</div>`;
        }

        // Removed APIs
        for (const item of apiDiff.removed || []) {
            html += `<div class="api-item api-removed">➖ ${item.key}</div>`;
        }

        // Changed APIs
        for (const item of apiDiff.changed || []) {
            html += this.renderApiChangeItem(item);
        }

        html += '</div></div>';

        // Inject Styles
        html += `
        <style>
            .api-item { padding: 8px; margin-bottom: 4px; border-radius: 4px; background: var(--bg-secondary); }
            .api-added { border-left: 3px solid var(--success); }
            .api-removed { border-left: 3px solid var(--danger); }
            .api-changed-detail { border-left: 3px solid var(--warning); margin-bottom: 12px; }
            .api-changed-header { font-weight: 600; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); }
            .api-diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
            .api-diff-col { background: var(--bg-tertiary); padding: 8px; border-radius: 4px; overflow: hidden; }
            .api-col-title { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; font-weight: 600; text-transform: uppercase; }
            .api-code { font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: var(--text-primary); }
            .diff-label { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--bg-glass); margin-bottom: 4px; }
            .screenshot-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .screenshot-panel img { width: 100%; height: auto; border: 1px solid var(--border-color); border-radius: 4px; }
        </style>
        `;

        return html;
    },

    renderApiChangeItem(item) {
        const details = item.details || [];
        const req1 = item.request1 || {};
        const req2 = item.request2 || {};

        let content = `<div class="api-item api-changed-detail">
            <div class="api-changed-header">🔄 ${item.key} <span class="diff-label">${details.join(', ')}</span></div>`;

        // Request Body Diff
        const body1 = req1.postData || {};
        const body2 = req2.postData || {};

        if (JSON.stringify(body1) !== JSON.stringify(body2)) {
            const bodyDiff = this.computeJsonDiff(body1, body2);
            content += `
                <div class="api-diff-section">
                    <div class="diff-label">📤 Request Body</div>
                    <div class="json-diff-container">
                        ${this.renderJsonDiff(bodyDiff)}
                    </div>
                </div>`;
        }

        // Response Body Diff
        const resp1 = req1.response?.body || {};
        const resp2 = req2.response?.body || {};

        if (JSON.stringify(resp1) !== JSON.stringify(resp2)) {
            const respDiff = this.computeJsonDiff(resp1, resp2);
            content += `
                <div class="api-diff-section" style="margin-top: 16px;">
                    <div class="diff-label">📥 Response Body</div>
                    <div class="json-diff-summary">
                        ${this.renderDiffSummary(respDiff)}
                    </div>
                    <div class="json-diff-container">
                        ${this.renderJsonDiff(respDiff)}
                    </div>
                </div>`;
        }

        content += '</div>';
        return content;
    },

    // Compute JSON diff recursively
    computeJsonDiff(obj1, obj2, path = '') {
        const diffs = [];

        // Handle null/undefined
        if (obj1 === null || obj1 === undefined) obj1 = {};
        if (obj2 === null || obj2 === undefined) obj2 = {};

        // If both are arrays
        if (Array.isArray(obj1) && Array.isArray(obj2)) {
            const maxLen = Math.max(obj1.length, obj2.length);
            for (let i = 0; i < maxLen; i++) {
                const currentPath = path ? `${path}[${i}]` : `[${i}]`;
                if (i >= obj1.length) {
                    diffs.push({ type: 'added', path: currentPath, value: obj2[i] });
                } else if (i >= obj2.length) {
                    diffs.push({ type: 'removed', path: currentPath, value: obj1[i] });
                } else if (typeof obj1[i] === 'object' && typeof obj2[i] === 'object') {
                    diffs.push(...this.computeJsonDiff(obj1[i], obj2[i], currentPath));
                } else if (JSON.stringify(obj1[i]) !== JSON.stringify(obj2[i])) {
                    diffs.push({ type: 'changed', path: currentPath, oldValue: obj1[i], newValue: obj2[i] });
                }
            }
            return diffs;
        }

        // If both are objects
        if (typeof obj1 === 'object' && typeof obj2 === 'object') {
            const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

            for (const key of allKeys) {
                const currentPath = path ? `${path}.${key}` : key;
                const val1 = obj1[key];
                const val2 = obj2[key];

                if (!(key in obj1)) {
                    diffs.push({ type: 'added', path: currentPath, key, value: val2 });
                } else if (!(key in obj2)) {
                    diffs.push({ type: 'removed', path: currentPath, key, value: val1 });
                } else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
                    diffs.push(...this.computeJsonDiff(val1, val2, currentPath));
                } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                    diffs.push({ type: 'changed', path: currentPath, key, oldValue: val1, newValue: val2 });
                }
            }
        }

        return diffs;
    },

    // Render diff summary
    renderDiffSummary(diffs) {
        const added = diffs.filter(d => d.type === 'added').length;
        const removed = diffs.filter(d => d.type === 'removed').length;
        const changed = diffs.filter(d => d.type === 'changed').length;

        if (added === 0 && removed === 0 && changed === 0) {
            return '<span class="diff-summary-unchanged">Không có thay đổi trực tiếp</span>';
        }

        let summary = '<div class="diff-summary-badges">';
        if (added > 0) summary += `<span class="diff-badge diff-badge-added">+${added} thêm</span>`;
        if (removed > 0) summary += `<span class="diff-badge diff-badge-removed">-${removed} xóa</span>`;
        if (changed > 0) summary += `<span class="diff-badge diff-badge-changed">~${changed} sửa</span>`;
        summary += '</div>';

        return summary;
    },

    // Render JSON diff with highlighting
    renderJsonDiff(diffs) {
        if (diffs.length === 0) {
            return '<div class="json-diff-empty">Không có thay đổi chi tiết</div>';
        }

        // Increase limit from 50 to 100
        const maxDisplay = 100;
        let html = '<div class="json-diff-lines">';

        for (const diff of diffs.slice(0, maxDisplay)) {
            const pathDisplay = this.formatJsonPath(diff.path);

            if (diff.type === 'added') {
                html += `
                    <div class="json-diff-line json-diff-added">
                        <span class="diff-indicator">+</span>
                        <span class="diff-path">${pathDisplay}</span>
                        <span class="diff-colon">:</span>
                        <span class="diff-value diff-value-new">${this.formatJsonValue(diff.value)}</span>
                    </div>`;
            } else if (diff.type === 'removed') {
                html += `
                    <div class="json-diff-line json-diff-removed">
                        <span class="diff-indicator">-</span>
                        <span class="diff-path">${pathDisplay}</span>
                        <span class="diff-colon">:</span>
                        <span class="diff-value diff-value-old">${this.formatJsonValue(diff.value)}</span>
                    </div>`;
            } else if (diff.type === 'changed') {
                html += `
                    <div class="json-diff-line json-diff-changed">
                        <span class="diff-indicator">~</span>
                        <span class="diff-path">${pathDisplay}</span>
                        <span class="diff-arrow">:</span>
                        <span class="diff-value-pair">
                            <span class="diff-value diff-value-old">${this.formatJsonValue(diff.oldValue)}</span>
                            <span class="diff-arrow-icon">→</span>
                            <span class="diff-value diff-value-new">${this.formatJsonValue(diff.newValue)}</span>
                        </span>
                    </div>`;
            }
        }

        if (diffs.length > maxDisplay) {
            html += `<div class="json-diff-more">... và ${diffs.length - maxDisplay} thay đổi khác (tổng: ${diffs.length})</div>`;
        }

        html += '</div>';
        return html;
    },

    // Format JSON path for display
    formatJsonPath(path) {
        return this.escapeHtml(path);
    },

    // Format JSON value for display with syntax highlighting
    formatJsonValue(value) {
        if (value === null) return '<span class="json-null">null</span>';
        if (value === undefined) return '<span class="json-undefined">undefined</span>';

        const type = typeof value;

        if (type === 'string') {
            const escaped = this.escapeHtml(value);
            // Increase truncation limit from 100 to 200 for more context
            const truncated = escaped.length > 200 ? escaped.substring(0, 200) + '...' : escaped;
            return `<span class="json-string" title="${escaped}">"${truncated}"</span>`;
        }
        if (type === 'number') {
            return `<span class="json-number">${value}</span>`;
        }
        if (type === 'boolean') {
            return `<span class="json-boolean">${value}</span>`;
        }
        if (Array.isArray(value)) {
            if (value.length === 0) return '<span class="json-array">[]</span>';
            // Show first few items for better context
            if (value.length <= 3) {
                const items = value.map(v => this.formatJsonValueShort(v)).join(', ');
                return `<span class="json-array">[${items}]</span>`;
            }
            return `<span class="json-array">[${value.length} items]</span>`;
        }
        if (type === 'object') {
            const keys = Object.keys(value);
            if (keys.length === 0) return '<span class="json-object">{}</span>';
            // Show first few keys for better context
            if (keys.length <= 3) {
                const preview = keys.slice(0, 3).join(', ');
                return `<span class="json-object">{${preview}}</span>`;
            }
            return `<span class="json-object">{${keys.length} keys}</span>`;
        }

        return this.escapeHtml(String(value));
    },

    // Format short value for array preview
    formatJsonValueShort(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        const type = typeof value;
        if (type === 'string') {
            const short = value.length > 20 ? value.substring(0, 20) + '...' : value;
            return `"${this.escapeHtml(short)}"`;
        }
        if (type === 'number' || type === 'boolean') return String(value);
        if (Array.isArray(value)) return `[${value.length}]`;
        if (type === 'object') return `{${Object.keys(value).length}}`;
        return String(value);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ===== Performance: Cleanup when leaving Compare tab =====
    cleanup() {
        try {
            // Remove any open diff modals
            document.querySelectorAll('.diff-modal').forEach(m => m.remove());

            // Clear compare results DOM
            const uiResults = document.getElementById('compareUIResults');
            if (uiResults) uiResults.innerHTML = '';
            const apiResults = document.getElementById('compareAPIResults');
            if (apiResults) apiResults.innerHTML = '';

            // Clear cached result
            this.currentResult = null;

            console.log('[CompareView] Cleanup completed');
        } catch (e) {
            console.warn('[CompareView] Cleanup error:', e);
        }
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    CompareView.init();
});

// Export for use in app.js
window.CompareView = CompareView;
