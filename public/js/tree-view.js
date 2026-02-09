/**
 * Tree View Component
 * Renders hierarchical data as an expandable tree
 */

const TreeView = {
    // Inline SVG icons — render everywhere, no emoji issues
    icons: {
        folder: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l.622.62a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 5v7.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z" stroke="currentColor" stroke-width="1.2"/></svg>',
        page: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
        modal: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 6h13" stroke="currentColor" stroke-width="1"/><circle cx="3.5" cy="4.8" r="0.6" fill="currentColor"/><circle cx="5.3" cy="4.8" r="0.6" fill="currentColor"/></svg>',
        api: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5.5 8.5l5-5M5 5.5H3.5a2.5 2.5 0 000 5H5m6-5h1.5a2.5 2.5 0 010 5H11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        file: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.5L13 5v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 14V3A1.5 1.5 0 014 1.5z" stroke="currentColor" stroke-width="1.2"/><path d="M9 1.5V5h3.5" stroke="currentColor" stroke-width="1"/></svg>',
        trash: '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M11 3.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V3.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
    },

    /**
     * Create a tree view from data
     * @param {Array} data - Tree data
     * @param {Object} options - Configuration options
     * @returns {HTMLElement} Tree container element
     */
    create(data, options = {}) {
        const container = document.createElement('div');
        container.className = 'tree-view';

        this.renderNodes(container, data, options);

        // Root drop zone — drop here to move to top level
        if (options.onMove && data && data.length > 0) {
            this._addRootDropZone(container, data, options);
        }

        return container;
    },

    /**
     * Render tree nodes recursively
     */
    renderNodes(container, nodes, options, level = 0) {
        nodes.forEach(node => {
            const item = this.createNode(node, options, level);
            container.appendChild(item);
        });
    },

    /**
     * Create a single tree node
     */
    createNode(node, options, level) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.style.paddingLeft = options.compact ? `${level * 12}px` : `${level * 8}px`;

        // Edge label data is preserved on the node for tooltips but not rendered as a separate line

        const content = document.createElement('div');
        content.className = 'tree-item-content';

        // Toggle button for folders with children
        if (node.children && node.children.length > 0) {
            const toggle = document.createElement('span');
            toggle.className = 'tree-toggle';
            toggle.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8"><path d="M2 1l4 3-4 3z" fill="currentColor"/></svg>';
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNode(item, toggle);
            });
            content.appendChild(toggle);
        }

        // Icon (inline SVG)
        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.innerHTML = this.getIcon(node);
        content.appendChild(icon);

        // Label
        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = node.name || node.urlPath;
        label.title = node.urlPath || node.path || node.name;
        content.appendChild(label);

        // Badge (size or type)
        if (node.sizeFormatted) {
            const badge = document.createElement('span');
            badge.className = 'tree-badge';
            badge.textContent = node.sizeFormatted;
            content.appendChild(badge);
        }

        // Delete button (SVG icon)
        if (options.onDelete && (node.type === 'ui' || node.type === 'api' || node.type === 'folder' || node.type === 'screen')) {
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'tree-delete-btn';
            deleteBtn.innerHTML = this.icons.trash;
            deleteBtn.title = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                options.onDelete(node);
            });
            content.appendChild(deleteBtn);
        }

        // Click handler
        if (node.type === 'ui' || node.type === 'api' || node.type === 'screen') {
            content.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.tree-item-content.selected').forEach(el => {
                    el.classList.remove('selected');
                });
                content.classList.add('selected');

                if (options.onSelect) {
                    options.onSelect(node);
                }
            });

            content.addEventListener('dblclick', () => {
                if (options.onDblSelect) {
                    options.onDblSelect(node);
                }
            });
        }

        // Drag & Drop — simple reparent: drag A to B → A becomes child of B
        if (options.onMove) {
            content.draggable = true;

            content.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                e.dataTransfer.setData('application/json', JSON.stringify(node));
                e.dataTransfer.effectAllowed = 'move';
                requestAnimationFrame(() => content.classList.add('dragging'));
            });

            content.addEventListener('dragend', () => {
                content.classList.remove('dragging');
                document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
            });

            // Every node is a valid drop target
            content.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                content.classList.add('drop-target');
            });

            content.addEventListener('dragleave', (e) => {
                if (!content.contains(e.relatedTarget)) {
                    content.classList.remove('drop-target');
                }
            });

            content.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                content.classList.remove('drop-target');

                try {
                    const sourceNode = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (sourceNode.path !== node.path && sourceNode.id !== node.id) {
                        options.onMove(sourceNode, node);
                    }
                } catch (err) {
                    console.error('Drop error:', err);
                }
            });
        }

        item.appendChild(content);

        // Children container
        if (node.children && node.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';

            // Auto-expand first 3 levels (level 0, 1, 2)
            const shouldExpand = level < 3;
            childrenContainer.style.display = shouldExpand ? 'block' : 'none';

            // Update toggle arrow state if auto-expanded
            if (shouldExpand) {
                const toggle = content.querySelector('.tree-toggle');
                if (toggle) {
                    toggle.classList.add('expanded');
                }
            }

            this.renderNodes(childrenContainer, node.children, options, level + 1);

            item.appendChild(childrenContainer);
        }

        return item;
    },

    /**
     * Toggle node expansion
     */
    toggleNode(item, toggle) {
        const children = item.querySelector('.tree-children');
        if (!children) return;

        const isExpanded = toggle.classList.contains('expanded');

        if (isExpanded) {
            children.style.display = 'none';
            toggle.classList.remove('expanded');
        } else {
            children.style.display = 'block';
            toggle.classList.add('expanded');
        }
    },

    /**
     * Get SVG icon for node type
     */
    getIcon(node) {
        const nt = node.nodeType || '';
        if (nt === 'modal') return this.icons.modal;
        if (nt === 'start') return this.icons.folder;

        switch (node.type) {
            case 'folder': return this.icons.folder;
            case 'ui': return this.icons.page;
            case 'api': return this.icons.api;
            case 'screen': return this.icons.page; // NEW: unified capture screen
            default: return this.icons.file;
        }
    },

    /**
     * Expand all nodes
     */
    expandAll(container) {
        container.querySelectorAll('.tree-toggle').forEach(toggle => {
            const item = toggle.closest('.tree-item');
            const children = item.querySelector('.tree-children');
            if (children) {
                children.style.display = 'block';
                toggle.classList.add('expanded');
            }
        });
    },

    /**
     * Expand nodes up to N levels (0-indexed)
     * @param {HTMLElement} container - Tree container
     * @param {number} maxLevel - Maximum level to expand (0 = root level)
     */
    expandLevels(container, maxLevel = 2) {
        const expandNodesByLevel = (parentElement, currentLevel) => {
            const items = Array.from(parentElement.children).filter(el => el.classList.contains('tree-item'));

            items.forEach(item => {
                const children = item.querySelector('.tree-children');
                const toggle = item.querySelector('.tree-toggle');

                if (children && toggle) {
                    if (currentLevel < maxLevel) {
                        // Expand this level
                        children.style.display = 'block';
                        toggle.classList.add('expanded');

                        // Recursively expand children
                        expandNodesByLevel(children, currentLevel + 1);
                    } else {
                        // Collapse this level
                        children.style.display = 'none';
                        toggle.classList.remove('expanded');
                    }
                }
            });
        };

        // Start from root level (level 0)
        expandNodesByLevel(container, 0);
    },

    /**
     * Collapse all nodes
     */
    collapseAll(container) {
        container.querySelectorAll('.tree-toggle').forEach(toggle => {
            const item = toggle.closest('.tree-item');
            const children = item.querySelector('.tree-children');
            if (children) {
                children.style.display = 'none';
                toggle.classList.remove('expanded');
            }
        });
    },

    /**
     * Find and select a node by path
     */
    selectByPath(container, path) {
        const normalize = (p) => p ? p.replace(/\\/g, '/') : '';
        const normPath = normalize(path);

        const items = container.querySelectorAll('.tree-item-content');
        items.forEach(item => {
            const label = item.querySelector('.tree-label');
            if (label && normalize(label.title) === normPath) {
                // Remove existing selections in this container
                container.querySelectorAll('.tree-item-content.selected').forEach(el => {
                    el.classList.remove('selected');
                });

                item.classList.add('selected');

                // Expand parent nodes
                let parent = item.closest('.tree-children');
                while (parent) {
                    parent.style.display = 'block';
                    const toggle = parent.previousElementSibling?.querySelector('.tree-toggle');
                    if (toggle) {
                        toggle.classList.add('expanded');
                    }
                    parent = parent.parentElement?.closest('.tree-children');
                }

                // Scroll into view
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    },

    /**
     * Create tree with progressive rendering (non-blocking)
     * Renders first batch synchronously for instant feedback,
     * then renders remaining nodes asynchronously via RAF
     * @param {Array} data - Tree data
     * @param {Object} options - Configuration options
     * @param {number} batchSize - Nodes per batch (default 15)
     * @returns {HTMLElement} Tree container element
     */
    createProgressive(data, options = {}, batchSize = 15) {
        const container = document.createElement('div');
        container.className = 'tree-view';

        if (!data || data.length === 0) return container;

        // Render first batch synchronously (instant feedback)
        const firstBatch = data.slice(0, batchSize);
        const remaining = data.slice(batchSize);

        firstBatch.forEach(node => {
            const item = this.createNode(node, options, 0);
            container.appendChild(item);
        });

        // Render remaining batches asynchronously
        if (remaining.length > 0) {
            this._renderBatchAsync(container, remaining, options, 0, batchSize);
        }

        // Root drop zone — drop here to move to top level
        if (options.onMove && data && data.length > 0) {
            this._addRootDropZone(container, data, options);
        }

        return container;
    },

    /**
     * Render nodes in batches using RAF for non-blocking UI
     */
    _renderBatchAsync(container, nodes, options, startIdx, batchSize) {
        requestAnimationFrame(() => {
            const fragment = document.createDocumentFragment();
            const end = Math.min(startIdx + batchSize, nodes.length);

            for (let i = startIdx; i < end; i++) {
                const item = this.createNode(nodes[i], options, 0);
                fragment.appendChild(item);
            }

            container.appendChild(fragment);

            // Continue with next batch
            if (end < nodes.length) {
                this._renderBatchAsync(container, nodes, options, end, batchSize);
            }
        });
    },

    /**
     * Add a root-level drop zone at the bottom of the tree
     * Dropping here moves a node to the top level
     */
    _addRootDropZone(container, data, options) {
        const dropZone = document.createElement('div');
        dropZone.className = 'tree-root-dropzone';
        dropZone.innerHTML = '<span class="tree-root-dropzone-text">⬆ Kéo vào đây để đưa lên cấp cao nhất</span>';

        // Derive root path from first node's parent
        const firstNodePath = data[0]?.path;
        if (!firstNodePath) return;

        // Root path = parent directory of any root-level node
        const rootPath = firstNodePath.substring(0, firstNodePath.lastIndexOf('/')) ||
            firstNodePath.substring(0, firstNodePath.lastIndexOf('\\'));

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            dropZone.classList.add('active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('active');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('active');

            try {
                const sourceNode = JSON.parse(e.dataTransfer.getData('application/json'));
                // Create a virtual "root" target node
                const rootTarget = {
                    name: '__ROOT__',
                    path: rootPath,
                    type: 'folder',
                    isRoot: true
                };
                options.onMove(sourceNode, rootTarget);
            } catch (err) {
                console.error('Root drop error:', err);
            }
        });

        container.appendChild(dropZone);
    }
};

// Export for use
window.TreeView = TreeView;
