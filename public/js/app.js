/**
 * UI & API Reconstruction Testing Tool
 * Main Application JavaScript
 */

// ========================================
// State Management
// ========================================

const state = {
  currentProject: null,
  projects: [],
  mainTree: [],
  sections: [],
  selectedItem: null,
  captureStatus: "idle",
  captureInterval: null,
  activeTab: "dashboard",
};

// Global view state for Sitemap canvas
window.workspaceView = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
};

// Expose state for other scripts
window.state = state;

// ========================================
// API Helpers
// ========================================

const api = {
  async fetch(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      // Handle non-JSON responses (like 404 HTML pages) gracefully
      const contentType = response.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        // If not JSON, probably an HTML error page or plain text
        const text = await response.text();
        if (!response.ok) {
          throw new Error(
            `Server Error (${response.status}): ${response.statusText}`,
          );
        }
        return text;
      }

      if (!response.ok) {
        throw new Error(
          data.error || `Request failed with status ${response.status}`,
        );
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },

  // Projects
  async getProjects() {
    return this.fetch("/api/projects");
  },

  async createProject(name) {
    return this.fetch("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async deleteProject(name) {
    return this.fetch(`/api/projects/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },

  async getProject(name) {
    return this.fetch(`/api/projects/${encodeURIComponent(name)}`);
  },

  async getProjectSize(name) {
    return this.fetch(`/api/projects/${encodeURIComponent(name)}/size`);
  },

  async getMainTree(name) {
    return this.fetch(`/api/projects/${encodeURIComponent(name)}/main`);
  },

  async getSections(name) {
    return this.fetch(`/api/projects/${encodeURIComponent(name)}/sections`);
  },

  async deleteSection(projectName, timestamp) {
    return this.fetch(
      `/api/projects/${encodeURIComponent(projectName)}/sections/${encodeURIComponent(timestamp)}`,
      {
        method: "DELETE",
      },
    );
  },

  async renameSection(projectName, timestamp, newName) {
    return this.fetch(
      `/api/projects/${encodeURIComponent(projectName)}/sections/${encodeURIComponent(timestamp)}/rename`,
      {
        method: "PUT",
        body: JSON.stringify({ newName }),
      },
    );
  },

  async deleteNode(projectName, path) {
    return this.fetch(`/api/projects/${encodeURIComponent(projectName)}/node`, {
      method: "DELETE",
      body: JSON.stringify({ path }),
    });
  },

  async getSnapshot(projectName, path) {
    return this.fetch(
      `/api/projects/${encodeURIComponent(projectName)}/snapshot?path=${encodeURIComponent(path)}`,
    );
  },

  async getAPIRequests(projectName, path) {
    return this.fetch(
      `/api/projects/${encodeURIComponent(projectName)}/api-requests?path=${encodeURIComponent(path)}`,
    );
  },

  // Capture
  async startCapture(projectName, startUrl, deviceProfile) {
    return this.fetch("/api/capture/start", {
      method: "POST",
      body: JSON.stringify({ projectName, startUrl, deviceProfile }),
    });
  },

  async stopCapture() {
    return this.fetch("/api/capture/stop", {
      method: "POST",
    });
  },

  async getCaptureStatus() {
    return this.fetch("/api/capture/status");
  },

  async getHistory(projectName) {
    return this.fetch(
      `/api/capture/history?projectName=${encodeURIComponent(projectName)}`,
    );
  },

  // Compare
  async compare(projectName, urlPath, sectionTimestamp) {
    return this.fetch("/api/compare", {
      method: "POST",
      body: JSON.stringify({ projectName, urlPath, sectionTimestamp }),
    });
  },

  async compareAll(projectName, sectionTimestamp) {
    return this.fetch("/api/compare/all", {
      method: "POST",
      body: JSON.stringify({ projectName, sectionTimestamp }),
    });
  },

  async retestAll(projectName) {
    return this.fetch("/api/compare/retest-all", {
      method: "POST",
      body: JSON.stringify({ projectName }),
    });
  },

  // Merge
  async merge(projectName, sectionTimestamp, folders, deleteAfter) {
    return this.fetch("/api/merge", {
      method: "POST",
      body: JSON.stringify({
        projectName,
        sectionTimestamp,
        folders,
        deleteAfter,
      }),
    });
  },

  async mergeAll(projectName, sectionTimestamp, deleteAfter) {
    return this.fetch("/api/merge/all", {
      method: "POST",
      body: JSON.stringify({ projectName, sectionTimestamp, deleteAfter }),
    });
  },

  async previewMerge(projectName, sectionTimestamp, folders) {
    return this.fetch("/api/merge/preview", {
      method: "POST",
      body: JSON.stringify({ projectName, sectionTimestamp, folders }),
    });
  },

  async getFlow(projectName) {
    return this.fetch(`/api/projects/${encodeURIComponent(projectName)}/flow`);
  },

  async moveNode(projectName, sourcePath, targetPath, sectionTimestamp = null) {
    return this.fetch(
      `/api/projects/${encodeURIComponent(projectName)}/node/move`,
      {
        method: "PUT",
        body: JSON.stringify({ sourcePath, targetPath, sectionTimestamp }),
      },
    );
  },

  async saveFlowPositions(projectName, positions) {
    return this.fetch(
      `/api/projects/${encodeURIComponent(projectName)}/flow/positions`,
      {
        method: "POST",
        body: JSON.stringify({ positions }),
      },
    );
  },

  async resetFlowPositions(projectName) {
    return this.fetch(
      `/api/projects/${encodeURIComponent(projectName)}/flow/positions`,
      {
        method: "DELETE",
      },
    );
  },

  // Auth/Session Management
  async getSessionStatus(projectName) {
    return this.fetch(
      `/api/auth/session/${encodeURIComponent(projectName)}`,
    );
  },

  async deleteSession(projectName) {
    return this.fetch(
      `/api/auth/session/${encodeURIComponent(projectName)}`,
      {
        method: "DELETE",
      },
    );
  },
};

// ========================================
// DOM Elements
// ========================================

const elements = {
  // Header
  projectSelect: document.getElementById("projectSelect"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  deleteProjectBtn: document.getElementById("deleteProjectBtn"),
  projectStats: document.getElementById("projectStats"),
  mainSize: document.getElementById("mainSize"),
  sectionsSize: document.getElementById("sectionsSize"),

  // Panels
  mainTree: document.getElementById("mainTree"),
  sectionsList: document.getElementById("sectionsList"),
  previewContent: document.getElementById("previewContent"),
  apiContent: document.getElementById("apiContent"),

  // Actions
  testAllMainBtn: document.getElementById("testAllMainBtn"),
  newSectionBtn: document.getElementById("newSectionBtn"),

  // Capture Bar
  captureBar: document.getElementById("captureBar"),
  captureUrl: document.getElementById("captureUrl"),
  capturedPages: document.getElementById("capturedPages"),
  capturedRequests: document.getElementById("capturedRequests"),
  stopCaptureBtn: document.getElementById("stopCaptureBtn"),

  // Modals
  newProjectModal: document.getElementById("newProjectModal"),
  newSectionModal: document.getElementById("newSectionModal"),
  compareModal: document.getElementById("compareModal"),
  mergeModal: document.getElementById("mergeModal"),
  shareModal: document.getElementById("shareModal"),
  importModal: document.getElementById("importModal"),

  // Modal Inputs
  projectNameInput: document.getElementById("projectNameInput"),
  startUrlInput: document.getElementById("startUrlInput"),
  createProjectBtn: document.getElementById("createProjectBtn"),
  startCaptureBtn: document.getElementById("startCaptureBtn"),
  compareResults: document.getElementById("compareResults"),
  mergeFolderList: document.getElementById("mergeFolderList"),
  deleteAfterMerge: document.getElementById("deleteAfterMerge"),
  confirmMergeBtn: document.getElementById("confirmMergeBtn"),

  // History
  urlHistoryContainer: document.getElementById("urlHistoryContainer"),
  urlHistoryList: document.getElementById("urlHistoryList"),
  urlHistoryDataList: document.getElementById("urlHistoryDataList"),

  // Workspace Sitemap
  sitemapTab: document.getElementById("sitemapTab"),
  sitemapWorkspace: document.getElementById("sitemapWorkspace"),
  sitemapSearchInput: document.getElementById("sitemapSearchInput"),
  workspaceZoomLayer: document.getElementById("workspaceZoomLayer"),
  workspaceNodesContainer: document.getElementById("workspaceNodesContainer"),
  workspaceEdgesSvg: document.getElementById("workspaceEdgesSvg"),
  resetWorkspaceSitemapBtn: document.getElementById("resetWorkspaceSitemapBtn"),
  zoomInBtn: document.getElementById("zoomInBtn"),
  zoomOutBtn: document.getElementById("zoomOutBtn"),
  zoomFitBtn: document.getElementById("zoomFitBtn"),

  // Tabs
  tabBtns: document.querySelectorAll(".tab-btn"),

  // Toast
  toastContainer: document.getElementById("toastContainer"),
};

// ========================================
// Toast Notifications
// ========================================

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s ease reverse";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ========================================
// Modal Helpers
// ========================================

function openModal(modal) {
  modal.style.display = "flex"; // Hiện modal
  // Use RAF for smooth animation
  requestAnimationFrame(() => {
    modal.classList.add("active");
  });
}

function closeModal(modal) {
  modal.classList.remove("active");
  modal.style.display = "none"; // Đảm bảo ẩn modal
}

function setupModals() {
  // Close on backdrop click
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  // Close buttons
  document.querySelectorAll(".modal-close, .modal-cancel").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      closeModal(modal);
    });
  });

  // ESC key để đóng modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const openModals = document.querySelectorAll(".modal.active, .modal[style*='display: block'], .modal[style*='display:block']");
      openModals.forEach(modal => closeModal(modal));
    }
  });
}

// ========================================
// Tab Cleanup — Release resources when leaving a tab
// ========================================

function _cleanupTab(tabName) {
  try {
    switch (tabName) {
      case 'documents':
        // Revoke blob URLs + clear heavy DOM
        if (window.docCompare && typeof docCompare.cleanup === 'function') {
          docCompare.cleanup();
        }
        break;

      case 'compare':
        // Release canvases + diff images
        if (window.CompareView && typeof CompareView.cleanup === 'function') {
          CompareView.cleanup();
        }
        break;

      case 'testing':
        // Clear large response bodies
        if (window.ApiTester && typeof ApiTester.cleanup === 'function') {
          ApiTester.cleanup();
        }
        break;

      case 'dashboard':
        // Dashboard is lightweight — no cleanup needed
        break;

      case 'sitemap':
        // Sitemap nodes stay cached for fast re-render
        break;
    }
  } catch (err) {
    console.warn('[_cleanupTab] Error cleaning up tab:', tabName, err);
  }
}

// ========================================
// Tab Management
// ========================================

function setupTabs() {
  // Use event delegation on the tab list container for dynamic tab support
  const tabList = document.querySelector(".workspace-tabs");
  if (!tabList) return;

  // Known tab ID mappings (static tabs)
  const tabIdMap = {
    dashboard: "dashboardTab",
    sitemap: "sitemapTab",
    preview: "previewTab",
    compare: "compareTab",
    documents: "documentsTab",
    testing: "testingTab",
  };

  // Known display modes per tab
  const tabDisplayMap = {
    documents: "flex",
  };

  tabList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;

    const tabName = btn.dataset.tab;
    if (!tabName) return;

    // ===== Cleanup previous tab before switching =====
    const prevTab = state.activeTab;
    if (prevTab && prevTab !== tabName) {
      _cleanupTab(prevTab);
    }

    // Update active button (all tab buttons, including dynamically added)
    tabList.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Hide all known tab contents
    Object.values(tabIdMap).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    // Also hide dynamically-added tab contents (legacy support)
    document.querySelectorAll(".tab-content[id]").forEach((el) => {
      el.style.display = "none";
    });

    // Show the selected tab content
    const tabContentId = tabIdMap[tabName] || (tabName + "Tab");
    const tabContent = document.getElementById(tabContentId);
    if (tabContent) {
      tabContent.style.display = tabDisplayMap[tabName] || "block";
    }

    state.activeTab = tabName;
    // Persist active tab for page reload
    try { localStorage.setItem('mapit-active-tab', tabName); } catch (e) { }

    // ===== Lazy load + init per tab =====
    try {
      if (tabName === "dashboard") {
        if (window.DashboardFeatures) {
          DashboardFeatures.analytics.loadDashboard();
          DashboardFeatures.analytics._dashboardNeedsRefresh = false;
        }
      }

      if (tabName === "sitemap" && state.currentProject) {
        loadSitemapWorkspace();
      }

      if (tabName === "documents") {
        await ScriptLoader.loadAll([
          '/js/document-compare.js',
        ]);
        // Load PDF.js only when needed (lazy)
        if (!window.pdfjsLib) {
          await ScriptLoader.load('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
        }
        if (window.docCompare) docCompare.loadDocuments();
      }

      if (tabName === "compare" && state.currentProject) {
        await ScriptLoader.loadAll([
          '/js/utils/progressive-renderer.js',
          '/js/diff-viewer.js',
          '/js/compare-view.js',
        ]);
        if (window.CompareView) {
          CompareView.populateSections(state.sections);
        }
      }

      if (tabName === "testing") {
        await ScriptLoader.loadAll([
          '/js/api-tester.js',
          '/js/test-runner-ui.js',
          '/js/report-ui.js',
        ]);
        if (window.TestRunnerUI) {
          TestRunnerUI.loadHistory();
          TestRunnerUI.loadStatistics();
        }
        if (window.ReportUI) {
          ReportUI.loadReports();
        }
      }
    } catch (err) {
      console.error(`[setupTabs] Error loading scripts for tab "${tabName}":`, err);
    }
  });

  // ---- Inner sub-tab handling (Compare, Testing) ----
  setupInnerSubtabs();
}

// Handle inner sub-tab switching for Compare and Testing tabs
function setupInnerSubtabs() {
  document.querySelectorAll('.inner-subtabs').forEach(container => {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.subtab-btn');
      if (!btn) return;

      const subtab = btn.dataset.subtab;
      if (!subtab) return;

      // Update active button within this container
      container.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle content within the parent tab
      const parentTab = container.closest('.tab-content');
      if (parentTab) {
        parentTab.querySelectorAll('.subtab-content').forEach(c => {
          c.classList.remove('active');
          c.style.display = 'none';
        });

        // Find the matching subtab-content
        const contentMap = {
          // Compare sub-tabs
          'ui': 'compareUIContent',
          'api': 'compareAPIContent',
          // Testing sub-tabs
          'api-tester': 'apiTesterContent',
          'runner': 'testRunnerContent',
          'reports': 'reportsContent',
        };

        const contentId = contentMap[subtab];
        const content = contentId && document.getElementById(contentId);
        if (content) {
          content.classList.add('active');
          content.style.display = 'block';
        }

        // Load data for specific sub-tabs
        if (subtab === 'api-tester' && window.ApiTester && ApiTester._needsRefresh) {
          ApiTester._needsRefresh = false;
          if (typeof ApiTester.populateCapturedApis === 'function') {
            ApiTester.populateCapturedApis();
          }
        }
        if (subtab === 'runner' && window.TestRunnerUI) {
          TestRunnerUI.loadHistory();
          TestRunnerUI.loadStatistics();
        }
        if (subtab === 'reports' && window.ReportUI) {
          ReportUI.loadReports();
        }
      }
    });
  });
}

async function loadCompareSelectors() {
  if (!state.currentProject) return;

  try {
    const { sections } = await api.getSections(state.currentProject);

    var DEVICE_ICONS = { desktop: '🖥', tablet: '⬛', mobile: '📱', custom: '⚙' };

    var select1 = document.getElementById("compareSection1");
    var select2 = document.getElementById("compareSection2");

    if (select1 && select2) {
      var options = sections
        .map(function (s) {
          var tag = '';
          if (s.deviceProfile && s.deviceProfile !== 'desktop') {
            var icon = DEVICE_ICONS[s.deviceProfile] || '';
            tag = ' ' + icon + ' ' + (s.deviceProfile.charAt(0).toUpperCase() + s.deviceProfile.slice(1));
          }
          return '<option value="' + s.timestamp + '">' + formatTimestamp(s.timestamp) + tag + '</option>';
        })
        .join("");

      select1.innerHTML =
        '<option value="">-- Chọn Section 1 --</option>' + options;
      select2.innerHTML =
        '<option value="">-- Chọn Section 2 --</option>' + options;
    }
  } catch (error) {
    console.error("Load compare sections error:", error);
  }
}

// ========================================
// Project Management
// ========================================

async function loadProjects() {
  try {
    const { projects } = await api.getProjects();
    state.projects = projects;

    // Update select
    elements.projectSelect.innerHTML =
      '<option value="">-- Chọn Project --</option>';
    projects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.name;
      option.textContent = `${project.name} (${project.sizeFormatted})`;
      elements.projectSelect.appendChild(option);
    });

    // Restore previous selection
    if (state.currentProject) {
      elements.projectSelect.value = state.currentProject;
    } else if (projects.length === 1) {
      // Auto Select if only 1 project
      const singleProject = projects[0].name;
      elements.projectSelect.value = singleProject;
      selectProject(singleProject);
    }
  } catch (error) {
    showToast("Không thể tải danh sách project", "error");
  }
}

async function loadUrlHistory(projectName) {
  if (!projectName) return;

  try {
    const { history } = await api.getHistory(projectName);

    // Clear existing
    elements.urlHistoryList.innerHTML = "";
    elements.urlHistoryDataList.innerHTML = "";

    if (history && history.length > 0) {
      elements.urlHistoryContainer.style.display = "block";

      // Show most recent 5 items (history is already stored newest first)
      const displayHistory = history.slice(0, 5);

      displayHistory.forEach((url) => {
        // Add to datalist for autocomplete
        const option = document.createElement("option");
        option.value = url;
        elements.urlHistoryDataList.appendChild(option);

        // Add to history list as quick-click items
        const item = document.createElement("div");
        item.className = "url-history-item";
        item.style.cssText = `
                    padding: 6px 10px;
                    border-radius: 6px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    font-size: 13px;
                    color: #475569;
                    cursor: pointer;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    transition: all 0.2s;
                    margin-bottom: 4px;
                `;
        item.textContent = url;
        item.title = url;

        item.onclick = () => {
          elements.startUrlInput.value = url;
        };

        item.onmouseover = () => {
          item.style.background = "#f1f5f9";
          item.style.borderColor = "#cbd5e1";
        };

        item.onmouseout = () => {
          item.style.background = "#f8fafc";
          item.style.borderColor = "#e2e8f0";
        };

        elements.urlHistoryList.appendChild(item);
      });
    } else {
      elements.urlHistoryContainer.style.display = "none";
    }
  } catch (error) {
    console.error("loadUrlHistory error:", error);
  }
}

async function selectProject(projectName) {
  console.log('[selectProject] Called with:', projectName);

  if (!projectName) {
    state.currentProject = null;
    state.mainTree = [];
    state.sections = [];
    elements.projectStats.style.display = "none";
    elements.deleteProjectBtn.style.display = "none";
    document.getElementById("shareProjectBtn").style.display = "none";
    document.getElementById("importProjectBtn").style.display = "none";
    renderMainTree();
    renderSections();
    return;
  }

  try {
    state.currentProject = projectName;

    // Load project data
    console.log('[selectProject] Loading project data...');
    const [{ project }, { size }] = await Promise.all([
      api.getProject(projectName),
      api.getProjectSize(projectName),
    ]);

    console.log('[selectProject] Project data loaded:', { project, size });
    console.log('[selectProject] mainTree:', project.mainTree);
    console.log('[selectProject] sections:', project.sections);

    state.mainTree = project.mainTree;
    state.sections = project.sections;

    // Update UI
    elements.mainSize.textContent = size.main;
    elements.sectionsSize.textContent = size.sections;
    elements.projectStats.style.display = "flex";
    elements.deleteProjectBtn.style.display = "inline-flex";
    document.getElementById("shareProjectBtn").style.display = "inline-flex";
    document.getElementById("importProjectBtn").style.display = "inline-flex";

    console.log('[selectProject] Calling renderMainTree()...');
    renderMainTree();
    renderSections();

    // Update dashboard stats
    if (typeof updateDashboardStats === 'function') {
      updateDashboardStats();
    }

    // Populate comparison selectors
    if (window.CompareView) {
      CompareView.populateSections(state.sections);
    }

    // Defer API Tester loading — only load when user opens API tab
    // (saves network + autoLogin overhead on project selection)
    if (window.ApiTester) {
      ApiTester._needsRefresh = true;
    }

    // Always update dashboard hero immediately (lightweight DOM update)
    const heroTitle = document.getElementById('dashProjectName');
    const heroDesc = document.getElementById('dashProjectDesc');
    if (heroTitle) heroTitle.textContent = '📋 ' + projectName;
    if (heroDesc) {
      const sCount = state.sections ? state.sections.length : 0;
      heroDesc.textContent = sCount + ' phiên bản đã chụp';
    }

    // Full dashboard refresh if currently on dashboard tab
    if (state.activeTab === 'dashboard' && window.DashboardFeatures) {
      DashboardFeatures.analytics.loadDashboard();
    }
  } catch (error) {
    console.error('[selectProject] Error loading project:', error);
    console.error('[selectProject] Error stack:', error.stack);
    showToast(`Không thể tải project: ${error.message}`, "error");
  }
}

async function createProject() {
  const name = elements.projectNameInput.value.trim();

  if (!name) {
    showToast("Vui lòng nhập tên project", "warning");
    return;
  }

  try {
    const result = await api.createProject(name);
    const actualName = result.project.name;

    showToast(`Project "${actualName}" đã được tạo`, "success");
    closeModal(elements.newProjectModal);
    elements.projectNameInput.value = "";

    await loadProjects();
    elements.projectSelect.value = actualName;
    await selectProject(actualName);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteProject() {
  if (!state.currentProject) return;

  if (!confirm(`Bạn có chắc muốn xóa project "${state.currentProject}"?`)) {
    return;
  }

  try {
    await api.deleteProject(state.currentProject);
    showToast(`Project "${state.currentProject}" đã được xóa`, "success");
    state.currentProject = null;
    await loadProjects();
    await selectProject(null);
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ========================================
// Main Tree
// ========================================

function renderMainTree() {

  if (!state.mainTree || state.mainTree.length === 0) {
    elements.mainTree.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
            <rect x="6" y="6" width="36" height="36" rx="4"/>
            <path d="M6 18h36M18 18v24" stroke-dasharray="3 2"/>
            <circle cx="30" cy="30" r="6" stroke="var(--accent-primary)" stroke-width="2"/>
            <path d="M34.5 34.5L39 39" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <p style="margin-bottom: 12px;">Chua co du lieu Main</p>
        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
          <p style="margin-bottom: 8px;">De tao Main Data:</p>
          <ol style="text-align: left; padding-left: 24px; margin: 0;">
            <li>Nhan nut <strong>Capture</strong> o ben phai</li>
            <li>Nhap URL va bat dau capture</li>
            <li>Sau khi xong, chon <strong>Save as Main</strong></li>
          </ol>
        </div>
      </div>`;
    return;
  }

  // Skip the "Start" root folder — show its children directly
  let treeData = state.mainTree;

  if (
    treeData.length === 1 &&
    treeData[0].type === "folder" &&
    treeData[0].name === "Start" &&
    treeData[0].children
  ) {
    treeData = treeData[0].children;
  }

  const tree = TreeView.create(treeData, {
    onSelect: (item) => handleMainTreeSelect(item),
    onDblSelect: (item) => handleMainTreeSelect(item),
    onDelete: (item) => deleteNode(item),
    onMove: (source, target) => handleMoveNode(source, target),
    type: "main",
  });

  elements.mainTree.innerHTML = "";
  elements.mainTree.appendChild(tree);
}

async function handleMoveNode(source, target, sectionTimestamp = null) {
  if (!state.currentProject) return;

  try {
    showToast(`Đang di chuyển: ${source.name}...`, "info");

    await api.moveNode(
      state.currentProject,
      source.path,
      target.path,
      sectionTimestamp,
    );

    showToast("Đã di chuyển thành công", "success");

    // Refresh project data to see new structure
    await selectProject(state.currentProject);

    // If sitemap tab is active, refresh it too
    if (state.activeTab === "sitemap") {
      loadSitemapWorkspace();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteNode(node) {
  if (!state.currentProject) return;

  if (
    !confirm(
      `Bạn có chắc muốn xóa "${node.name}"? Hành động này không thể hoàn tác.`,
    )
  ) {
    return;
  }

  try {
    await api.deleteNode(state.currentProject, node.path);
    showToast("Đã xóa thành công", "success");

    // Refresh project data
    await selectProject(state.currentProject);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function handleMainTreeSelect(item) {
  state.selectedItem = { ...item, source: "main" };
  loadItemPreview(item, "main");

  // Sync sidebar tree selection
  if (window.TreeView) {
    // Clear previous selection in mainTree
    elements.mainTree
      .querySelectorAll(".tree-item-content.selected")
      .forEach((el) => {
        el.classList.remove("selected");
      });
    // Select new one
    TreeView.selectByPath(elements.mainTree, item.path);
  }
}

// ========================================
// Sections
// ========================================

function renderSections() {
  if (!state.sections || state.sections.length === 0) {
    elements.sectionsList.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-icon">' +
      '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--text-muted)" stroke-width="1.5">' +
      '<rect x="4" y="8" width="18" height="14" rx="3"/>' +
      '<rect x="26" y="8" width="18" height="14" rx="3"/>' +
      '<rect x="4" y="26" width="18" height="14" rx="3"/>' +
      '<rect x="26" y="26" width="18" height="14" rx="3" stroke="var(--accent-primary)" stroke-width="2" stroke-dasharray="3 2"/>' +
      '<path d="M33 31v4M31 33h4" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>' +
      '</div>' +
      '<p>Chua co section nao</p>' +
      '<p style="font-size:12px;color:var(--text-muted);margin-top:4px;">Nhan <strong>+ New Section</strong> de bat dau capture</p>' +
      '</div>';
    return;
  }

  elements.sectionsList.innerHTML = "";

  state.sections.forEach((section) => {
    const card = document.createElement("div");
    card.className = "section-card";
    if (section.timestamp.includes("_replay"))
      card.classList.add("replay-section");

    const timestamp = formatTimestamp(section.timestamp);
    const isReplay = section.timestamp.includes("_replay");

    card.innerHTML = `
      <div class="section-header">
        <span class="section-timestamp">${timestamp}</span>
        <span class="section-size">${section.sizeFormatted}</span>
      </div>
      
      <div class="section-tree-wrap" style="margin: 8px 0;">
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; padding: 0 4px;">
          ${section.screenCount || (section.screens ? section.screens.length : 0)} screens · ${section.apiCount || 0} APIs
        </div>
        <div class="section-tree" id="section-tree-${section.timestamp}"></div>
      </div>
      
      <div class="section-actions">
        <button class="section-action-btn compare-btn" data-timestamp="${section.timestamp}" title="So sánh với Main">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5" stroke-linecap="round"/></svg>
          <span>Diff</span>
        </button>


        
        <button class="section-action-btn section-action-merge merge-btn" data-timestamp="${section.timestamp}" title="Merge vào Main">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 13V3M4 7l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Merge</span>
        </button>

        ${section.history && section.history.length > 0
        ? `
        <button class="section-action-btn section-action-info history-toggle-btn" data-timestamp="${section.timestamp}" title="Xem lịch sử Replay">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2.5 1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>${section.history.length}</span>
        </button>`
        : ""
      }

        <button class="section-action-btn section-action-danger delete-btn" data-timestamp="${section.timestamp}" title="Xóa section">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 3.5h10M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M11 3.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V3.5" stroke-linecap="round"/></svg>
        </button>
      </div>
      
      <div class="section-history-list" id="history-list-${section.timestamp}">
        <div class="history-header">
            <span>🕒 Lịch sử Replay</span>
        </div>
        <div class="history-items-container">
            ${section.history
        ?.map((h) => {
          return `
              <div class="history-item">
                <div class="history-info">
                    <span class="history-time">${formatTimestamp(h.timestamp)}</span>
                    <div class="history-meta">
                        <span>📦 ${h.sizeFormatted}</span>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-ghost btn-xs view view-replay-btn" 
                            data-replay="${h.timestamp}" 
                            title="Xem chi tiết replay">👁️</button>
                    <button class="btn btn-ghost btn-xs compare compare-history-btn" 
                            data-root="${section.timestamp}" 
                            data-replay="${h.timestamp}" 
                            title="So sánh với bản gốc">🔍</button>
                    <button class="btn btn-ghost btn-xs delete delete-btn" 
                            data-timestamp="${h.timestamp}" 
                            title="Xóa bản replay này">🗑️</button>
                </div>
              </div>
            `;
        })
        .join("") || ""
      }
        </div>
      </div>
    `;

    elements.sectionsList.appendChild(card);

    // Render tree immediately for better UX
    const treeContainer = document.getElementById(
      `section-tree-${section.timestamp}`,
    );
    if (treeContainer) {
      if (section.screenTree && section.screenTree.length > 0) {
        let sTreeData = section.screenTree;
        if (sTreeData.length === 1 && sTreeData[0].type === 'folder' && sTreeData[0].name === 'Start' && sTreeData[0].children) {
          sTreeData = sTreeData[0].children;
        }
        // Use progressive rendering to avoid blocking UI
        const tree = TreeView.createProgressive(sTreeData, {
          onSelect: (item) => loadScreenPreview(section.timestamp, item.path, item.name),
          onMove: (source, target) =>
            handleMoveNode(source, target, section.timestamp),
          type: "section",
          compact: true,
        });
        treeContainer.appendChild(tree);
      } else if (section.tree && section.tree.length > 0) {
        let secTreeData = section.tree;
        if (secTreeData.length === 1 && secTreeData[0].type === 'folder' && secTreeData[0].name === 'Start' && secTreeData[0].children) {
          secTreeData = secTreeData[0].children;
        }
        // Use progressive rendering to avoid blocking UI
        const tree = TreeView.createProgressive(secTreeData, {
          onSelect: (item) => handleSectionTreeSelect(item, section.timestamp),
          onMove: (source, target) =>
            handleMoveNode(source, target, section.timestamp),
          type: "section",
          compact: true,
        });
        treeContainer.appendChild(tree);
      }
    }
  });

  // Add event listeners
  document.querySelectorAll(".test-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      showReplayOptionsModal(btn.dataset.timestamp),
    );
  });

  document.querySelectorAll(".history-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const historyList = document.getElementById(
        `history-list-${btn.dataset.timestamp}`,
      );
      const isVisible = historyList.style.display === "block";
      historyList.style.display = isVisible ? "none" : "block";
      btn.classList.toggle("active", !isVisible);
    });
  });

  document.querySelectorAll(".compare-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      compareSection(btn.dataset.timestamp);
    });
  });

  document.querySelectorAll(".merge-btn").forEach((btn) => {
    btn.addEventListener("click", () => openMergeModal(btn.dataset.timestamp));
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSection(btn.dataset.timestamp);
    });
  });

  document.querySelectorAll(".compare-history-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rootTs = btn.dataset.root;
      const replayTs = btn.dataset.replay;
      compareHistory(rootTs, replayTs);
    });
  });

  document.querySelectorAll(".view-replay-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      viewReplayDetails(btn.dataset.replay);
    });
  });
}

async function compareHistory(rootTimestamp, replayTimestamp) {
  try {
    showToast("Đang chuẩn bị so sánh...", "info");

    // 1. Chuyển sang Tab so sánh
    const compareTabBtn = document.querySelector(
      '.tab-btn[data-tab="compare"]',
    );
    if (compareTabBtn) compareTabBtn.click();

    // 2. Đợi UI cập nhật và lấy các element selector
    const select1 = document.getElementById("compareSection1");
    const select2 = document.getElementById("compareSection2");

    if (!select1 || !select2) {
      throw new Error("Không tìm thấy giao diện so sánh");
    }

    // 3. Đổ dữ liệu vào select
    if (window.CompareView) {
      window.CompareView.populateSections(state.sections);
    }

    // 4. Gán giá trị: Gốc bên trái, Replay bên phải
    select1.value = rootTimestamp;
    select2.value = replayTimestamp;

    // 5. Kích hoạt so sánh ngay lập tức
    if (window.CompareView) {
      // Trigger thủ công vì gán .value JS không tự bắn sự kiện change
      window.CompareView.compare(rootTimestamp, replayTimestamp);
    }
  } catch (error) {
    console.error("compareHistory error:", error);
    showToast(error.message, "error");
  }
}

async function renameSectionHandler(timestamp) {
  const newName = prompt("Nhập tên mới cho section:", timestamp);
  if (!newName || newName === timestamp) return;

  try {
    await api.renameSection(state.currentProject, timestamp, newName);
    showToast("Đổi tên thành công", "success");
    await selectProject(state.currentProject);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function handleSectionTreeSelect(item, sectionTimestamp) {
  state.selectedItem = { ...item, source: "section", sectionTimestamp };
  loadItemPreview(item, "section", sectionTimestamp);
}

async function deleteSection(timestamp) {
  if (!confirm(`Bạn có chắc muốn xóa section này?`)) {
    return;
  }

  try {
    await api.deleteSection(state.currentProject, timestamp);
    showToast("Section đã được xóa", "success");
    await selectProject(state.currentProject);
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ========================================
// Capture
// ========================================

async function startCapture() {
  var startUrl = elements.startUrlInput.value.trim();

  if (!startUrl) {
    showToast("Vui lòng nhập URL", "warning");
    return;
  }

  try {
    new URL(startUrl);
  } catch {
    showToast("URL không hợp lệ", "warning");
    return;
  }

  // Read device profile from selector
  var deviceProfile = 'desktop';
  var activeBtn = document.querySelector('#deviceProfileBtns .device-profile-btn.active');
  if (activeBtn) {
    deviceProfile = activeBtn.dataset.profile;
  }
  var devicePayload = { name: deviceProfile };
  if (deviceProfile === 'custom') {
    var cw = parseInt(document.getElementById('deviceCaptureW').value) || 1440;
    var ch = parseInt(document.getElementById('deviceCaptureH').value) || 900;
    devicePayload.width = Math.max(280, Math.min(3840, cw));
    devicePayload.height = Math.max(400, Math.min(2560, ch));
  }

  try {
    var result = await api.startCapture(state.currentProject, startUrl, devicePayload);
    showToast("Đã mở trình duyệt. Nhấn ESC để chụp màn hình.", "info");
    closeModal(elements.newSectionModal);
    elements.startUrlInput.value = "";

    // Store current capture session info
    state.captureStatus = "running";
    state.currentCaptureSection = result.sectionTimestamp || result.sectionId || new Date().toISOString().replace(/:/g, '-').replace(/\..+/, 'Z');

    // Update capture info
    var urlEl = document.getElementById('currentCaptureUrl');
    var projectEl = document.getElementById('currentCaptureProject');
    if (urlEl) urlEl.textContent = startUrl;
    if (projectEl) projectEl.textContent = state.currentProject;

    // Show capture tools panel
    showCaptureTools();

    // Start polling status
    state.captureInterval = setInterval(pollCaptureStatus, 2000);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function stopCapture() {
  try {
    const stopBtn = document.getElementById('stopCaptureToolBtn') || elements.stopCaptureBtn;
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.innerHTML = '<span class="pulse">...</span> Stopping';
    }

    const result = await api.stopCapture();

    // Session ended, refresh data
    endCaptureSession();
    showToast(`Đã lưu ${result.captures || 0} trang`, "success");
    await selectProject(state.currentProject);

    // Reset UI to sections view
    showSectionsPanel();
  } catch (error) {
    showToast(error.message, "error");
    const stopBtn = document.getElementById('stopCaptureToolBtn') || elements.stopCaptureBtn;
    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.textContent = "\u25A0 Stop";
    }
  }
}

async function pollCaptureStatus() {
  try {
    const status = await api.getCaptureStatus();

    if (status.status === "idle") {
      endCaptureSession();
      showToast("Session đã được lưu", "success");
      await selectProject(state.currentProject);
      showSectionsPanel();
    } else if (status.status === "closing") {
      const stopBtn = document.getElementById('stopCaptureToolBtn') || elements.stopCaptureBtn;
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.innerHTML = '<span class="pulse">...</span> Closing';
      }
    } else {
      // Sync section timestamp from backend (in case it was set wrong initially)
      if (status.section && status.section !== state.currentCaptureSection) {
        state.currentCaptureSection = status.section;
      }

      // Running - update stats
      const screens = status.capturedPagesCount || 0;
      const apis = status.networkRequestsCount || 0;

      elements.capturedPages.textContent = screens;
      elements.capturedRequests.textContent = apis;

      // Update capture tools panel stats
      updateCaptureStats(screens, status.actionsCount || 0, apis);

      // Update captured screens list in capture tools panel (right sidebar)
      if (status.savedItems && status.savedItems.length > 0) {
        const container = document.getElementById('capturedScreensItems');
        if (container) {
          status.savedItems.forEach(item => {
            if (item.path && !container.querySelector(`[data-screen-id="${item.path}"]`)) {
              addCapturedScreenToList({
                id: item.path,
                name: item.name || item.title || item.path,
                actions: item.actionsCount || 0,
                apis: item.requestsCount || item.apiCount || 0,
                type: item.type || 'page',
                urlPath: item.urlPath || ''
              });
            }
          });
        }
      }
    }
  } catch (error) {
    console.error("Poll status error:", error);
  }
}

// Display real-time saved items in workspace with thumbnails
function updateSavedItemsDisplay(savedItems) {
  let html = '<div class="saved-items-list" style="padding: 16px;">';
  html +=
    '<h3 style="margin-bottom: 16px; color: var(--success); display: flex; align-items: center; gap: 8px;">Capture Real-time <span style="font-size: 12px; background: var(--success); color: white; padding: 2px 8px; border-radius: 12px;">' +
    savedItems.length +
    " items</span></h3>";

  // Reverse to show newest first
  const items = [...savedItems].reverse();

  items.forEach((item, index) => {
    const isError = item.type === "error";
    const typeIcon = isError ? "\u2716" : item.type === "modal" ? "\u25A1" : item.type === "form" ? "\u270E" : item.type === "list" ? "\u2261" : "\u2713";
    const time = item.savedAt ? new Date(item.savedAt).toLocaleTimeString("vi-VN") : "";
    const borderColor = isError
      ? "var(--danger)"
      : item.type === "modal"
        ? "var(--info)"
        : "var(--success)";

    // Build screenshot URL from project/section/path
    const screenshotUrl = state.currentProject && state.currentCaptureSection && item.path
      ? `/storage/${encodeURIComponent(state.currentProject)}/sections/${encodeURIComponent(state.currentCaptureSection)}/${item.path}/screenshot.png`
      : '';

    html += `
            <div class="saved-item" style="display: flex; gap: 12px; padding: 12px; margin-bottom: 12px; background: var(--bg-glass); border-radius: 12px; border-left: 4px solid ${borderColor}; cursor: pointer;" onclick="loadScreenPreview('${state.currentCaptureSection || ''}', '${item.path || ''}', '${(item.name || item.path || '').replace(/'/g, "\\'")}')">
                <!-- Screenshot Thumbnail -->
                <div style="flex-shrink: 0; width: 120px; height: 80px; border-radius: 8px; overflow: hidden; background: var(--bg-tertiary);">
                    ${screenshotUrl
        ? `<img src="${screenshotUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Preview" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:24px\\'>${typeIcon}</div>'">`
        : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 24px;">${typeIcon}</div>`
      }
                </div>

                <!-- Content -->
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <strong style="font-size: 13px; color: var(--text-primary);">${item.name || item.title || item.path || "Page"}</strong>
                        <span style="font-size: 10px; color: var(--text-muted); white-space: nowrap;">${time}</span>
                    </div>

                    <!-- URL Path -->
                        ${item.urlPath ? `<div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; word-break: break-all;">
                        ${item.urlPath}
                    </div>` : ''}

                    <!-- Stats Row -->
                    <div style="display: flex; gap: 12px; font-size: 11px;">
                        ${item.type && item.type !== 'page' ? `<span style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px;">${item.type}</span>` : ""}
                        ${item.actionsCount ? `<span style="color: var(--text-secondary);">${item.actionsCount} actions</span>` : ""}
                        ${item.apiCount || item.requestsCount ? `<span style="color: var(--warning);">${item.apiCount || item.requestsCount} APIs</span>` : ""}
                        ${item.error ? `<span style="color: var(--danger);">${item.error}</span>` : ""}
                    </div>
                </div>
            </div>
        `;
  });

  html += "</div>";
  elements.previewContent.innerHTML = html;
}

function endCaptureSession() {
  state.captureStatus = "idle";
  state.currentCaptureSection = null;

  if (state.captureInterval) {
    clearInterval(state.captureInterval);
    state.captureInterval = null;
  }

  // Reset UI to sections view
  showSectionsPanel();

  // Clear workspace preview if it was showing captured screens
  const workspace = document.getElementById('workspace');
  if (workspace && workspace.innerHTML.includes('Capture Tools')) {
    workspace.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
            <rect x="8" y="4" width="32" height="40" rx="3"/>
            <path d="M14 14h20M14 20h14M14 26h18" stroke-linecap="round" stroke-dasharray="2 2"/>
            <circle cx="36" cy="36" r="8" fill="var(--bg-primary)" stroke="var(--accent-primary)" stroke-width="2"/>
            <path d="M33 36h6M36 33v6" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <p>Chon mot man hinh tu Sections de xem chi tiet</p>
      </div>
    `;
  }
}

// ========================================
// Compare
// ========================================

async function compareSection(sectionTimestamp) {
  try {
    // 1. Switch to Compare tab
    const compareTabBtn = document.querySelector(
      '.tab-btn[data-tab="compare"]',
    );
    if (compareTabBtn) compareTabBtn.click();

    // 2. Ensure selectors exist and are populated
    const select1 = document.getElementById("compareSection1");
    const select2 = document.getElementById("compareSection2");

    if (!select1 || !select2) {
      throw new Error("Không tìm thấy selector so sánh");
    }

    // Re-populate immediately from state
    if (window.CompareView) {
      window.CompareView.populateSections(state.sections);
    }

    // 3. Set values
    select1.value = "main";
    select2.value = sectionTimestamp;

    // 4. Trigger comparison directly
    if (window.CompareView) {
      if (select1.value === "main" && select2.value === sectionTimestamp) {
        window.CompareView.compare("main", sectionTimestamp);
      } else {
        // Fallback attempt
        setTimeout(() => {
          select1.value = "main";
          select2.value = sectionTimestamp;
          window.CompareView.onSectionChange();
        }, 50);
      }
    }
  } catch (error) {
    console.error("compareSection error:", error);
    showToast(error.message, "error");
  }
}

function renderCompareResults(result) {
  const { totalPages, changedPages, results } = result;

  let html = `
    <div class="compare-summary">
      <div class="compare-stat success">
        <div class="compare-stat-value">${totalPages - changedPages}</div>
        <div class="compare-stat-label">Không đổi</div>
      </div>
      <div class="compare-stat ${changedPages > 0 ? "danger" : "success"}">
        <div class="compare-stat-value">${changedPages}</div>
        <div class="compare-stat-label">Có thay đổi</div>
      </div>
    </div>
  `;

  if (results && results.length > 0) {
    html += '<div class="compare-changes">';

    for (const page of results) {
      if (page.hasChanges) {
        html += `
          <div class="change-item modified">
            <div class="change-path">${page.urlPath}</div>
        `;

        // UI changes
        if (page.ui.hasChanges) {
          page.ui.changes.forEach((change) => {
            html += `<div class="change-message">UI: ${change.message}</div>`;
          });
        }

        // API changes
        if (page.api.hasChanges) {
          page.api.changes.forEach((change) => {
            html += `<div class="change-message">API: ${change.message}</div>`;
          });
        }

        html += "</div>";
      }
    }

    html += "</div>";
  }

  elements.compareResults.innerHTML = html;
}

async function testAllMain() {
  if (!state.currentProject) {
    showToast("Vui lòng chọn project", "warning");
    return;
  }

  try {
    showToast("Đang test tất cả URL...", "info");
    const { result } = await api.retestAll(state.currentProject);
    renderCompareResults(result);
    openModal(elements.compareModal);
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ========================================
// Merge
// ========================================

let currentMergeSection = null;

function openMergeModal(sectionTimestamp) {
  currentMergeSection = sectionTimestamp;

  const section = state.sections.find((s) => s.timestamp === sectionTimestamp);
  if (!section) return;

  // Extract screen folders from screenTree or screens array
  const folders = extractScreenFolders(section);

  if (folders.length === 0) {
    // No individual folders found — offer merge all
    elements.mergeFolderList.innerHTML = `
      <div style="text-align: center; padding: 16px; color: var(--text-muted);">
        <div style="font-size: 13px; margin-bottom: 8px;">Không tìm thấy folder riêng lẻ.</div>
        <div style="font-size: 12px;">Bấm <strong>Merge All</strong> để merge toàn bộ section vào Main.</div>
      </div>
    `;
  } else {
    // Build folder checklist with better UI
    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-bottom: 6px;">
        <label style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input type="checkbox" id="merge-select-all" checked style="accent-color: var(--accent-primary);">
          Chọn / bỏ chọn tất cả
        </label>
        <span style="font-size: 11px; color: var(--text-muted);">${folders.length} screens</span>
      </div>
    `;
    folders.forEach((folder, index) => {
      const icon = folder.type === 'modal' ? '🪟' : '📄';
      html += `
        <div class="merge-folder-item">
          <input type="checkbox" id="merge-folder-${index}" value="${folder.id}" checked style="accent-color: var(--accent-primary);">
          <label class="merge-folder-path" for="merge-folder-${index}">
            <span>${icon}</span>
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${folder.name}</span>
            ${folder.apiCount ? `<span style="font-size: 10px; color: var(--text-muted); background: var(--bg-tertiary); padding: 1px 6px; border-radius: 8px;">${folder.apiCount} API</span>` : ''}
          </label>
        </div>
      `;
    });
    elements.mergeFolderList.innerHTML = html;

    // Select all toggle
    const selectAllCb = document.getElementById('merge-select-all');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        elements.mergeFolderList.querySelectorAll('input[type="checkbox"]:not(#merge-select-all)').forEach(cb => {
          cb.checked = e.target.checked;
        });
      });
    }
  }

  elements.deleteAfterMerge.checked = false;
  openModal(elements.mergeModal);
}

function extractScreenFolders(section) {
  const folders = [];
  const seen = new Set();

  // Method 1: Extract from screenTree (preferred — has tree structure info)
  if (section.screenTree && section.screenTree.length > 0) {
    const walk = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'ui' || (node.type !== 'folder' && node.type !== 'start' && node.id !== 'start')) {
          // Use node.id (flow node ID) as primary — merge backend matches by node.id
          // node.path is filesystem relative path (e.g. "start/login") which doesn't match
          const id = node.id || node.name;
          if (id && !seen.has(id)) {
            seen.add(id);
            folders.push({
              id: id,
              name: node.name || id,
              type: node.nodeType || node.type || 'page',
              apiCount: node.edgeApis || 0,
            });
          }
        }
        if (node.children) walk(node.children);
      }
    };
    walk(section.screenTree);
  }

  // Method 2: Fallback to screens array
  if (folders.length === 0 && section.screens && section.screens.length > 0) {
    for (const screen of section.screens) {
      // Use screen.id (flow node ID) as primary — merge backend matches by node.id
      const id = screen.id || screen.name;
      if (id && !seen.has(id)) {
        seen.add(id);
        folders.push({
          id: id,
          name: screen.name || id,
          type: screen.type || 'page',
          apiCount: screen.apiCount || 0,
        });
      }
    }
  }

  return folders;
}

async function confirmMerge() {
  if (!currentMergeSection) return;

  const checkboxes = elements.mergeFolderList.querySelectorAll(
    'input[type="checkbox"]:checked:not(#merge-select-all)',
  );
  const folders = Array.from(checkboxes).map((cb) => cb.value);

  // If no individual checkboxes found (merge-all scenario), use mergeAll API
  if (folders.length === 0) {
    try {
      const result = await api.mergeAll(
        state.currentProject,
        currentMergeSection,
        elements.deleteAfterMerge.checked,
      );

      if (result.result.success) {
        showToast(`Đã merge toàn bộ section vào Main`, "success");
      } else {
        showToast(
          `Merge hoàn tất với ${result.result.errors.length} lỗi`,
          "warning",
        );
      }

      closeModal(elements.mergeModal);
      await selectProject(state.currentProject);
    } catch (error) {
      showToast(error.message, "error");
    }
    return;
  }

  try {
    const result = await api.merge(
      state.currentProject,
      currentMergeSection,
      folders,
      elements.deleteAfterMerge.checked,
    );

    if (result.result.success) {
      showToast(`Đã merge ${result.result.merged.length} screens vào Main`, "success");
    } else {
      showToast(
        `Merge hoàn tất với ${result.result.errors.length} lỗi`,
        "warning",
      );
    }

    closeModal(elements.mergeModal);
    await selectProject(state.currentProject);
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ========================================
// Preview
// ========================================

async function loadItemPreview(item, source, sectionTimestamp = null) {
  console.log('[loadItemPreview] Called with:', { item, source, sectionTimestamp });

  if (item.type !== "ui" && item.type !== "api" && item.type !== "screen") {
    console.log('[loadItemPreview] Skipping - item type not ui/api/screen:', item.type);
    return;
  }

  try {
    if (item.type === "ui" || item.type === "screen") {
      switchTab("preview");

      console.log('[loadItemPreview] Fetching snapshot for path:', item.path);
      const [snapshotRes, flowRes] = await Promise.all([
        api.getSnapshot(state.currentProject, item.path),
        api.getFlow(state.currentProject),
      ]);

      console.log('[loadItemPreview] Snapshot response:', snapshotRes);
      console.log('[loadItemPreview] Flow response:', flowRes);

      const { data } = snapshotRes;
      const { flow } = flowRes;

      // Find transitions from current node
      // The item.path is ScreenName/UI
      const currentNodePath = item.path.replace(/[\\/]UI$/, "");
      const transitions = (flow.edges || []).filter(
        (e) => e.from === currentNodePath,
      );

      Preview.renderUI(elements.previewContent, data, {
        transitions,
        onTransition: (targetNodePath) => {
          const sep = targetNodePath.includes("\\") ? "\\" : "/";
          const targetUIPath = targetNodePath + sep + "UI";

          // We need to find the node name. Let's assume it's the last part.
          const nodeName = targetNodePath.split(sep).pop();

          handleMainTreeSelect({
            name: nodeName,
            path: targetUIPath,
            type: "ui",
          });
        },
      });
      // Show UI container, Hide API container
      elements.previewContent.style.display = "block";
      if (elements.apiContent) elements.apiContent.style.display = "none";
    } else {
      switchTab("preview"); // Switch to preview tab even for API
      const { requests } = await api.getAPIRequests(
        state.currentProject,
        item.path,
      );

      // Check if apiContent exists, if not, try to find it again (might be added dynamically or ref issues)
      let apiContainer = elements.apiContent;
      if (!apiContainer) {
        apiContainer = document.getElementById("apiContent");
      }

      if (apiContainer) {
        apiContainer.style.display = "block";
        elements.previewContent.style.display = "none";
        Preview.renderAPI(apiContainer, requests);
      } else {
        console.error("API Content container not found");
        showToast("Lỗi: Không tìm thấy container hiển thị API", "error");
      }
    }
  } catch (error) {
    console.error("loadItemPreview error:", error);
    showToast("Không thể tải preview", "error");
  }
}

function switchTab(tabName) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.click();
}

// ========================================
// Utilities
// ========================================

function formatTimestamp(timestamp) {
  // Check if it looks like our generated timestamp (YYYY-MM-DDTHH-mm-ss...)
  const timestampRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)(.*)?$/;
  const match = timestamp.match(timestampRegex);

  if (!match) {
    return timestamp; // It's a custom name, return as is
  }

  const datePart = match[1];
  const suffix = match[2] || ""; // e.g., "_replay", "_backup_123456"

  try {
    // Reconstruct ISO string from folder name (which has dashes instead of colons)
    // Ensure we treat it as UTC by appending 'Z'
    const isoString = datePart.replace(
      /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2}).*/,
      "$1T$2:$3:$4Z",
    );
    const date = new Date(isoString);

    if (isNaN(date.getTime())) return timestamp;

    let formatted = date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Add suffix label if present
    if (suffix) {
      // Convert _replay_replay to (replay x2), _backup_xxx to (backup)
      const replayCount = (suffix.match(/_replay/g) || []).length;
      const isBackup = suffix.includes("_backup");

      if (isBackup) {
        formatted += " 📦 backup";
      } else if (replayCount > 0) {
        formatted +=
          replayCount === 1 ? " 🔄 replay" : ` 🔄 replay x${replayCount}`;
      }
    }

    return formatted;
  } catch {
    return timestamp;
  }
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
  // Project
  elements.projectSelect.addEventListener("change", (e) =>
    selectProject(e.target.value),
  );
  elements.newProjectBtn.addEventListener("click", () =>
    openModal(elements.newProjectModal),
  );
  elements.deleteProjectBtn.addEventListener("click", deleteProject);
  elements.createProjectBtn.addEventListener("click", createProject);

  // Section
  elements.newSectionBtn.addEventListener("click", async () => {
    if (!state.currentProject) {
      showToast("Vui lòng chọn project trước", "warning");
      return;
    }
    await loadUrlHistory(state.currentProject);
    openModal(elements.newSectionModal);
  });
  elements.startCaptureBtn.addEventListener("click", startCapture);

  // Device profile selector toggle
  var deviceProfileBtns = document.getElementById('deviceProfileBtns');
  var deviceCustomInputs = document.getElementById('deviceCustomInputs');
  if (deviceProfileBtns) {
    deviceProfileBtns.addEventListener('click', function (e) {
      var btn = e.target.closest('.device-profile-btn');
      if (!btn) return;
      deviceProfileBtns.querySelectorAll('.device-profile-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      if (deviceCustomInputs) {
        deviceCustomInputs.style.display = btn.dataset.profile === 'custom' ? 'flex' : 'none';
      }
    });
  }

  // Capture
  elements.stopCaptureBtn.addEventListener("click", stopCapture);

  // Compare & Merge
  elements.testAllMainBtn.addEventListener("click", testAllMain);
  elements.confirmMergeBtn.addEventListener("click", confirmMerge);

  // Share
  document.getElementById("shareProjectBtn").addEventListener("click", openShareModal);
  document.getElementById("createShareBtn").addEventListener("click", createShare);

  // Import
  document.getElementById("importProjectBtn").addEventListener("click", openImportModal);
  document.getElementById("confirmImportBtn").addEventListener("click", confirmImport);
  document.getElementById("scanNetworkBtn").addEventListener("click", scanNetwork);
  document.querySelectorAll(".import-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchImportTab(btn.dataset.tab));
  });

  // Enter key for inputs
  elements.projectNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") createProject();
  });

  elements.startUrlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") startCapture();
  });

  if (elements.previewSitemapBtn) {
    elements.previewSitemapBtn.addEventListener("click", () => {
      switchTab("sitemap");
      loadSitemapWorkspace();
    });
  }

  if (elements.resetWorkspaceSitemapBtn) {
    elements.resetWorkspaceSitemapBtn.addEventListener("click", () =>
      resetSitemapLayout(),
    );
  }

  // Sitemap Device Selector
  var sitemapDeviceSelector = document.getElementById('sitemapDeviceSelector');
  if (sitemapDeviceSelector) {
    sitemapDeviceSelector.addEventListener('click', function (e) {
      var btn = e.target.closest('.sitemap-device-btn');
      if (!btn) return;
      applySitemapDeviceView(btn.dataset.device);
    });
  }
}

// ========================================
// Initialization
// ========================================

async function init() {
  // Read saved tab EARLY to prevent dashboard flash
  const savedTab = localStorage.getItem('mapit-active-tab');
  if (savedTab && savedTab !== 'dashboard') {
    state.activeTab = savedTab;
    // Hide dashboard content immediately (it's visible by default in HTML)
    const dashEl = document.getElementById('dashboardTab');
    if (dashEl) dashEl.style.display = 'none';
  }

  setupModals();
  setupTabs();
  setupEventListeners();

  // Now switch to saved tab (triggers lazy loading for that tab)
  if (savedTab && savedTab !== 'dashboard') {
    switchTab(savedTab);
  }

  await loadProjects();

  // Check URL param for project
  const urlParams = new URLSearchParams(window.location.search);
  const urlProject = urlParams.get("project");
  if (urlProject) {
    elements.projectSelect.value = urlProject;
    selectProject(urlProject);
  }

  // Check for running capture session
  try {
    const status = await api.getCaptureStatus();
    if (status.status === "running") {
      state.captureStatus = "running";
      elements.captureBar.style.display = "flex";
      elements.captureUrl.textContent = status.startUrl;
      state.captureInterval = setInterval(pollCaptureStatus, 2000);
    }
  } catch (error) {
    // Ignore
  }
}

function setupResizers() {
  const resizerLeft = document.getElementById("resizerLeft");
  const resizerRight = document.getElementById("resizerRight");
  const panelLeft = document.querySelector(".panel-left");
  const panelRight = document.querySelector(".panel-right");

  const initResize = (resizer, panel, isLeft) => {
    let startX, startWidth;

    if (!resizer || !panel) return;

    resizer.addEventListener("mousedown", (e) => {
      // Prevent text selection/dragging defaults
      e.preventDefault();

      startX = e.clientX;
      startWidth = parseInt(
        document.defaultView.getComputedStyle(panel).width,
        10,
      );

      resizer.classList.add("resizing");
      document.body.classList.add("is-resizing"); // Add utility class for cursor/select

      // Create a transparent overlay to capture all mouse events smoothly
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.zIndex = "99999";
      overlay.style.cursor = "col-resize";
      document.body.appendChild(overlay);

      const onMouseMove = (moveEvent) => {
        moveEvent.preventDefault();
        const dx = moveEvent.clientX - startX;
        const newWidth = isLeft ? startWidth + dx : startWidth - dx;
        // Constraints
        if (newWidth > 200 && newWidth < 800) {
          panel.style.width = `${newWidth}px`;
          panel.style.minWidth = `${newWidth}px`;
        }
      };

      const onMouseUp = () => {
        resizer.classList.remove("resizing");
        document.body.classList.remove("is-resizing");
        document.body.removeChild(overlay);

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  };
  initResize(resizerLeft, panelLeft, true);
  initResize(resizerRight, panelRight, false);
}

// Start app
document.addEventListener("DOMContentLoaded", () => {
  init();
  setupResizers();
  setupPanelToggles();
  setupSidebarTabs();
  setupCaptureUI();

  // ===== Prefetch tab scripts during idle time =====
  // After core init, queue all lazy-load scripts to prefetch in background.
  // They load one-by-one during requestIdleCallback windows → zero jank.
  // If user clicks a tab before prefetch finishes, ScriptLoader.load() handles it.
  if (window.ScriptLoader) {
    ScriptLoader.prefetchWhenIdle([
      '/js/utils/progressive-renderer.js',
      '/js/diff-viewer.js',
      '/js/compare-view.js',
      '/js/document-compare.js',
      '/js/api-tester.js',
      '/js/test-runner-ui.js',
      '/js/report-ui.js',
    ]);
  }
});

// ========================================
// Panel Toggles & UI Controls
// ========================================

function setupPanelToggles() {
  const leftPanel = document.getElementById('leftPanel');
  const collapseBtn = document.getElementById('toggleLeftPanelBtn');
  const expandBtn = document.getElementById('expandLeftPanelBtn');
  let savedWidth = null;

  if (collapseBtn && leftPanel) {
    collapseBtn.addEventListener('click', () => {
      // Save current width before collapsing (in case user resized)
      savedWidth = leftPanel.style.width || null;
      // Clear inline width/minWidth set by drag-resize so CSS .collapsed can work
      leftPanel.style.width = '';
      leftPanel.style.minWidth = '';
      leftPanel.classList.add('collapsed');
    });
  }

  if (expandBtn && leftPanel) {
    expandBtn.addEventListener('click', () => {
      leftPanel.classList.remove('collapsed');
      // Restore previously saved width from drag-resize
      if (savedWidth) {
        leftPanel.style.width = savedWidth;
        leftPanel.style.minWidth = savedWidth;
      }
    });
  }
}

function setupSidebarTabs() {
  const tabs = document.querySelectorAll('.sidebar-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-sidebar-tab');
      // Update tab active state
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      // Update content visibility
      document.querySelectorAll('.sidebar-tab-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
      });
      const target = document.getElementById(targetId === 'mainData' ? 'sidebarMainData' : 'sidebarSections');
      if (target) {
        target.classList.add('active');
        target.style.display = 'flex';
      }
    });
  });
}

function setupCaptureUI() {
  const stopCaptureToolBtn = document.getElementById('stopCaptureToolBtn');
  const manualCaptureBtn = document.getElementById('manualCaptureBtn');

  if (stopCaptureToolBtn) {
    stopCaptureToolBtn.addEventListener('click', async () => {
      await stopCapture();
    });
  }

  if (manualCaptureBtn) {
    manualCaptureBtn.addEventListener('click', async () => {
      await triggerManualCapture();
    });
  }
}

// Trigger manual capture by simulating ESC key in browser
async function triggerManualCapture() {
  try {
    showToast('Đang chụp màn hình...', 'info');

    // Call capture endpoint to trigger screenshot in browser
    const response = await fetch('/api/capture/trigger-screenshot', {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Không thể chụp màn hình');
    }

    showToast('✅ Đã trigger chụp màn hình', 'success');
  } catch (error) {
    console.error('Manual capture error:', error);
    showToast('Lỗi: ' + error.message, 'error');
  }
}

// Switch to Capture Tools view
function showCaptureTools() {
  const rightPanel = document.getElementById('rightPanel');
  const resizerRight = document.getElementById('resizerRight');

  if (rightPanel) {
    rightPanel.style.display = 'flex';
    rightPanel.classList.add('capture-active');
  }
  if (resizerRight) resizerRight.style.display = '';

  // Reset capture stats
  updateCaptureStats(0, 0, 0);
  clearCapturedScreensList();
}

// Hide Capture Tools (switch back to normal view)
function showSectionsPanel() {
  const rightPanel = document.getElementById('rightPanel');
  const resizerRight = document.getElementById('resizerRight');

  if (rightPanel) {
    rightPanel.style.display = 'none';
    rightPanel.classList.remove('capture-active');
  }
  if (resizerRight) resizerRight.style.display = 'none';
}

// Update capture statistics
function updateCaptureStats(screens, actions, apis) {
  const screensEl = document.getElementById('captureScreensCount');
  const actionsEl = document.getElementById('captureActionsCount');
  const apisEl = document.getElementById('captureApisCount');

  if (screensEl) screensEl.textContent = screens;
  if (actionsEl) actionsEl.textContent = actions;
  if (apisEl) apisEl.textContent = apis;
}

// Add captured screen to the list
function addCapturedScreenToList(screen) {
  const container = document.getElementById('capturedScreensItems');
  if (!container) return;

  const item = document.createElement('div');
  item.className = 'screen-item-captured latest';
  item.dataset.screenId = screen.id;

  const screenshotUrl = state.currentProject && state.currentCaptureSection
    ? `/storage/${encodeURIComponent(state.currentProject)}/sections/${encodeURIComponent(state.currentCaptureSection)}/${screen.id}/screenshot.png`
    : '';

  item.innerHTML = `
    <div class="thumbnail">
      ${screenshotUrl
      ? `<img src="${screenshotUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);color:var(--text-muted);font-size:16px\\'>&#9633;</div>'">`
      : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--bg-tertiary); color: var(--text-muted); font-size: 16px;">&#9633;</div>`
    }
    </div>
    <div class="info">
      <div class="name">${screen.name}</div>
      ${screen.urlPath ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${screen.urlPath}</div>` : ''}
      <div class="meta">
        <span>${screen.actions || 0} actions</span>
        <span>${screen.apis || 0} APIs</span>
      </div>
    </div>
  `;

  // Click to preview
  item.addEventListener('click', () => {
    loadScreenPreview(state.currentCaptureSection, screen.id, screen.name);
  });

  // Remove latest class from others
  container.querySelectorAll('.screen-item-captured').forEach(el => {
    el.classList.remove('latest');
  });

  // Add to top
  container.insertBefore(item, container.firstChild);

  // Auto-preview latest screen
  loadScreenPreview(state.currentCaptureSection, screen.id, screen.name);
}

// Clear captured screens list
function clearCapturedScreensList() {
  const container = document.getElementById('capturedScreensItems');
  if (container) container.innerHTML = '';
}

// Fuzzy match helper for finding nodes
const isMatch = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const normA = a.replace(/\\/g, "/");
  const normB = b.replace(/\\/g, "/");
  return normA.endsWith("/" + normB) || normB.endsWith("/" + normA);
};

// ========================================
// Sitemap / Design View
// ========================================

let sitemapFlowData = null;
let sitemapNodePositions = new Map(); // Module-level for reuse during drag

// Sitemap Device View Presets
// iframeW/iframeH = viewport size the iframe renders at (for responsive content)
// nodeW = visual node width on sitemap canvas
var SITEMAP_DEVICE_PRESETS = {
  desktop: { nodeW: 280, thumbH: 180, spacingX: 420, spacingY: 300, iframeW: 1400, iframeH: 800 },
  tablet: { nodeW: 200, thumbH: 260, spacingX: 330, spacingY: 360, iframeW: 768, iframeH: 1024 },
  mobile: { nodeW: 140, thumbH: 280, spacingX: 270, spacingY: 400, iframeW: 375, iframeH: 812 }
};
var currentSitemapDevice = 'desktop';

function applySitemapDeviceView(device) {
  var preset = SITEMAP_DEVICE_PRESETS[device] || SITEMAP_DEVICE_PRESETS.desktop;
  currentSitemapDevice = device;
  var workspace = elements.sitemapWorkspace;
  if (!workspace) return;
  workspace.style.setProperty('--sitemap-node-w', preset.nodeW + 'px');
  workspace.style.setProperty('--sitemap-thumb-h', preset.thumbH + 'px');

  // Update active button
  var selector = document.getElementById('sitemapDeviceSelector');
  if (selector) {
    selector.querySelectorAll('.sitemap-device-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.device === device);
    });
  }

  // Re-render layout with new spacings
  if (sitemapFlowData && elements.workspaceNodesContainer && elements.workspaceEdgesSvg) {
    requestAnimationFrame(function () {
      renderSitemapVisual(
        sitemapFlowData,
        elements.workspaceNodesContainer,
        elements.workspaceEdgesSvg,
        preset
      );
    });
  }
}

async function loadSitemapWorkspace() {
  if (!state.currentProject) return;

  if (elements.resetWorkspaceSitemapBtn)
    elements.resetWorkspaceSitemapBtn.style.display = "flex";

  try {
    const { flow } = await api.getFlow(state.currentProject);
    sitemapFlowData = flow;

    // Set default device view from captured profile
    var capturedDevice = (flow && flow.deviceProfile) || 'desktop';
    var preset = SITEMAP_DEVICE_PRESETS[capturedDevice] || SITEMAP_DEVICE_PRESETS.desktop;
    currentSitemapDevice = capturedDevice;

    // Update CSS vars + active button (without triggering re-render)
    var workspace = elements.sitemapWorkspace;
    if (workspace) {
      workspace.style.setProperty('--sitemap-node-w', preset.nodeW + 'px');
      workspace.style.setProperty('--sitemap-thumb-h', preset.thumbH + 'px');
    }
    var selector = document.getElementById('sitemapDeviceSelector');
    if (selector) {
      selector.querySelectorAll('.sitemap-device-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.device === capturedDevice);
      });
    }

    renderSitemapVisual(
      flow,
      elements.workspaceNodesContainer,
      elements.workspaceEdgesSvg,
      preset
    );
    setupSitemapPanning(
      elements.sitemapWorkspace,
      elements.workspaceNodesContainer,
    );
    setupSitemapSearch();
  } catch (error) {
    console.error("Sitemap Workspace error:", error);
  }
}

function centerSitemapOnStart(isReset = false) {
  const zoomLayer = elements.workspaceZoomLayer;
  const workspace = elements.sitemapWorkspace;
  if (!zoomLayer || !workspace) return;

  const rect = workspace.getBoundingClientRect();
  if (rect.width === 0) {
    // Tab might not be visible yet, retry once
    setTimeout(() => centerSitemapOnStart(isReset), 50);
    return;
  }

  const startNode =
    elements.workspaceNodesContainer.querySelector(".start-node") ||
    elements.workspaceNodesContainer.querySelector(".sitemap-node-visual");

  if (startNode) {
    const x = parseFloat(startNode.style.left);
    const y = parseFloat(startNode.style.top);

    workspaceView.scale = isReset ? 1 : workspaceView.scale;
    // Calculation to place the node center at the viewport center
    // Node width 280 -> half 140. Height ~220 -> half 110.
    workspaceView.translateX =
      rect.width / 2 - x * workspaceView.scale - 140 * workspaceView.scale;
    workspaceView.translateY =
      rect.height / 2 - y * workspaceView.scale - 110 * workspaceView.scale;
  } else {
    // Fallback to absolute center of the large workspace
    workspaceView.scale = isReset ? 1 : workspaceView.scale;
    workspaceView.translateX = rect.width / 2 - 10000 * workspaceView.scale;
    workspaceView.translateY = rect.height / 2 - 2000 * workspaceView.scale;
  }

  zoomLayer.style.transition = "transform 0.5s cubic-bezier(0.2, 0, 0.2, 1)";
  zoomLayer.style.transform = `translate(${workspaceView.translateX}px, ${workspaceView.translateY}px) scale(${workspaceView.scale})`;
}

function resetSitemapView() {
  const container = elements.workspaceNodesContainer;
  const svg = elements.workspaceEdgesSvg;

  if (!container || !svg) return;

  container.querySelectorAll(".sitemap-node-visual").forEach((node) => {
    node.classList.remove("selected", "faded");
  });

  svg.querySelectorAll(".sitemap-edge-path").forEach((edge) => {
    edge.classList.remove("highlighted-path", "faded");
  });

  container.querySelectorAll(".sitemap-edge-label").forEach((label) => {
    label.classList.remove("faded");
  });

  if (elements.resetWorkspaceSitemapBtn)
    elements.resetWorkspaceSitemapBtn.style.display = "none";
}

function getScreenNodesFromTree(nodes, parentPath = "", level = 0) {
  let screenNodes = [];
  nodes.forEach((node) => {
    // Direct UI node (tab, modal, or standalone page)
    // OR a Folder that is implicitly a screen because it has a 'UI' child
    // Check 1: Is this node itself a UI/Tab/Modal?
    // Note: mainTree stores real type in 'nodeType' (page/modal/tab), while 'type' is always 'ui'
    const realType = node.nodeType || node.type || "page";
    const isDirectUI =
      node.type === "ui" || node.type === "tab" || node.type === "modal" ||
      realType === "page" || realType === "modal" || realType === "tab";

    // Check 2: Is this a folder that acts as a screen container? (Has a literal 'UI' file child)
    // Note: Only check for name === "UI" (a literal file), NOT type === "ui" (which means page/screen)
    const hasUiChild =
      !isDirectUI &&
      node.children &&
      node.children.some((c) => c.name === "UI");

    if (isDirectUI) {
      screenNodes.push({
        path: node.path || node.urlPath || node.name,
        name: node.name,
        type: realType, // Use real type (page/modal/tab) instead of generic 'ui'
        level: level,
      });
    } else if (hasUiChild) {
      // It's a folder-screen
      // We use the folder's path
      const path = node.path || node.urlPath || node.name;
      screenNodes.push({
        path: path,
        name: node.name,
        type: "page", // Implicit page
        level: level,
      });
    }

    if (node.children && node.children.length > 0) {
      screenNodes = screenNodes.concat(
        getScreenNodesFromTree(node.children, node.path, level + 1),
      );
    }
  });

  // Deduplicate by path to be safe
  const seen = new Set();
  return screenNodes.filter((n) => {
    if (!n.path) return false;
    // Normalize path for dedupe
    const p = n.path.replace(/\\/g, "/");
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

function createVisualNode(node, x, y, container, flow, startNodePath, svg) {
  const normalize = (p) =>
    p ? p.replace(/\\/g, "/").replace(/_\d{6}$/, "") : "";

  // Explicit Type Extraction
  let type = node.type || "page";
  if (node.name.startsWith("tab_")) type = "tab";
  if (node.name.startsWith("modal_")) type = "modal";

  // Clean Name Logic
  let cleanName = node.name;
  if (type === "tab")
    cleanName = cleanName.replace(/^tab_/, "").replace(/_/g, " ");
  else if (type === "modal")
    cleanName = cleanName.replace(/^modal_/, "").replace(/_/g, " ");
  else cleanName = cleanName.replace(/_/g, " "); // General cleanup

  const typeLabel =
    type === "tab" ? "🏷️ TAB" : type === "modal" ? "🗔 MODAL" : "📄 PAGE";
  const normPath = normalize(node.path);

  const div = document.createElement("div");
  // Ensure we use the detected type for styling
  div.className = `sitemap-node-visual type-${type}`;
  if (normPath === normalize(startNodePath)) div.classList.add("start-node");
  div.dataset.path = normPath;
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;

  // Safe URL construction: Extract relative path from 'main' folder if present
  let relativePath = normPath;
  if (normPath.includes("/main/")) {
    relativePath = normPath.split("/main/")[1];
  }

  // Remove 'start/' prefix if present (start is a virtual node, not a real folder)
  if (relativePath.startsWith("start/")) {
    relativePath = relativePath.substring(6); // Remove "start/"
  }

  // Split relative path by / and encode each segment to handle spaces/special chars
  const safePath = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  // Use lightweight thumbnail preview for sitemap (strips scripts, icon fonts, animations)
  const previewUrl = `/api/capture/preview/${encodeURIComponent(state.currentProject)}/main/${safePath}?mode=thumbnail`;

  // Store preview URL for lazy loading — don't create iframe yet
  div.dataset.previewUrl = previewUrl;

  div.innerHTML = `
        <div class="node-thumbnail">
            <div class="node-type-badge">${typeLabel}</div>
            ${normPath === normalize(startNodePath) ? '<div class="start-badge">START</div>' : ""}
            <div class="node-preview-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:24px;background:#f1f5f9;">
              ⏳
            </div>
            <div class="node-overlay" style="position:absolute;inset:0;z-index:5;cursor:pointer;"></div>
        </div>
        <div class="node-info">
            <div class="node-title">${cleanName}</div>
        </div>
    `;
  div.title = normPath;

  div.addEventListener("click", (e) => {
    e.stopPropagation();
    highlightPathTo(normPath, flow, container, svg, startNodePath);
  });

  div.addEventListener("dblclick", () => {
    // Robust strategy: Find the exact node in the main tree
    const targetPathNormalized = normPath;

    let targetNode = null;

    // Helper to find node in tree
    const findNode = (nodes) => {
      for (const n of nodes) {
        // Check if this node is the folder we are looking for
        const nPathNorm = (n.path || "").replace(/\\/g, "/");

        // Match by checking if the node path ends with the sitemap node path
        // This handles absolute vs relative path differences
        if (
          nPathNorm.endsWith(targetPathNormalized) ||
          nPathNorm === targetPathNormalized
        ) {
          // Found the folder, now find the UI child
          if (n.children) {
            const uiNode = n.children.find(
              (c) => c.name === "UI" || c.type === "ui",
            );
            if (uiNode) return uiNode;
          }
        }

        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };

    targetNode = findNode(state.mainTree);

    if (targetNode) {
      switchTab("preview");
      handleMainTreeSelect(targetNode);
    } else {
      // Fallback if not found (e.g. legacy path construction)
      const uiPath = normPath + "/UI";
      switchTab("preview");
      handleMainTreeSelect({ name: node.name, path: uiPath, type: "ui" });
    }
  });

  // Draggable Logic
  let isNodeDragging = false;
  let dragStartX, dragStartY;
  let initialLeft, initialTop;

  div.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault(); // Prevent text selection / native drag
    e.stopPropagation(); // Prevent workspace panning

    isNodeDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialLeft = parseFloat(div.style.left);
    initialTop = parseFloat(div.style.top);

    div.style.zIndex = 1000;
    div.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none"; // Prevent text selection globally
    // Disable iframes from stealing mouse events during drag
    document.querySelectorAll(".node-thumbnail iframe").forEach(f => f.style.pointerEvents = "none");

    const onNodeMouseMove = (me) => {
      if (!isNodeDragging) return;
      me.stopPropagation();
      me.preventDefault();

      const scale = workspaceView.scale;
      const dx = (me.clientX - dragStartX) / scale;
      const dy = (me.clientY - dragStartY) / scale;

      const newX = initialLeft + dx;
      const newY = initialTop + dy;
      div.style.left = `${newX}px`;
      div.style.top = `${newY}px`;

      // Realtime edge update: update position and redraw edges
      sitemapNodePositions.set(normPath, { x: newX, y: newY });
      redrawEdgesOnly();
    };

    const onNodeMouseUp = async (me) => {
      if (!isNodeDragging) return;
      isNodeDragging = false;
      div.style.zIndex = "";
      div.style.cursor = "";
      document.body.style.cursor = "";
      document.body.style.userSelect = ""; // Re-enable text selection
      // Re-enable iframe pointer events
      document.querySelectorAll(".node-thumbnail iframe").forEach(f => f.style.pointerEvents = "");

      document.removeEventListener("mousemove", onNodeMouseMove);
      document.removeEventListener("mouseup", onNodeMouseUp);

      // Save if moved significantly
      const finalLeft = parseFloat(div.style.left);
      const finalTop = parseFloat(div.style.top);

      if (
        Math.abs(finalLeft - initialLeft) > 2 ||
        Math.abs(finalTop - initialTop) > 2
      ) {
        const newPos = { x: finalLeft, y: finalTop };

        // Optimistic update of local flow data
        if (!flow.positions) flow.positions = {};
        flow.positions[normPath] = newPos;

        try {
          await api.saveFlowPositions(state.currentProject, {
            [normPath]: newPos,
          });
          // Lightweight: only redraw edges, don't rebuild nodes
          sitemapNodePositions.set(normPath, newPos);
          redrawEdgesOnly();
        } catch (err) {
          console.error("Failed to save node position", err);
          showToast("Lỗi lưu vị trí node", "error");
        }
      }
    };

    document.addEventListener("mousemove", onNodeMouseMove);
    document.addEventListener("mouseup", onNodeMouseUp);
  });

  return div;
}

function renderSitemapVisual(flow, container, svg, devicePreset) {
  if (!container || !svg) return;

  container.innerHTML = "";
  svg.innerHTML = "";

  const screenNodes = getScreenNodesFromTree(state.mainTree || []);
  if (screenNodes.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Chưa có dữ liệu Sitemap. Vui lòng thực hiện Capture & Merge để tạo các màn hình.</div>';
    return;
  }

  const normalize = (p) => {
    if (!p) return "";
    if (p === "home") return "home";
    return p.replace(/\\/g, "/").replace(/_\d{6}$/, "");
  };

  // Optimize: Batch DOM updates with Fragment
  const fragment = document.createDocumentFragment();

  // Determine start node from flow (Short Name)
  let startNodeShortName = "login";
  if (flow && flow.edges && flow.edges.length > 0) {
    const firstEdge = flow.edges.find((e) => e.from === "start");
    if (firstEdge) {
      startNodeShortName = normalize(firstEdge.to);
    } else {
      startNodeShortName = normalize(flow.edges[0].from);
    }
  }

  // Resolve Start Node Short Name to Absolute Match
  let startNodePath = null;
  // Helper to check match
  const isMatch = (fullPath, shortName) => {
    if (!fullPath || !shortName) return false;
    const normFull = normalize(fullPath);
    const normShort = normalize(shortName);
    if (normFull === normShort) return true;
    // Check if full path ends with short name (preceded by slash or start)
    if (normFull.endsWith("/" + normShort)) return true;
    // Handle "tabs/modals" which might be sub-paths
    return false;
  };

  const startNodeCandidate = screenNodes.find((n) =>
    isMatch(n.path, startNodeShortName),
  );
  if (startNodeCandidate) {
    startNodePath = normalize(startNodeCandidate.path);
  } else {
    // Fallback: Try to find 'home' or just use first node
    const homeNode = screenNodes.find((n) => n.name.toLowerCase() === "home");
    startNodePath = homeNode
      ? normalize(homeNode.path)
      : screenNodes[0]
        ? normalize(screenNodes[0].path)
        : "";
  }

  // 1. Group nodes by their parent folder path
  const nodeMap = new Map();
  const columns = {}; // col -> [nodes]
  const groups = new Map(); // groupPath -> [nodes]

  screenNodes.forEach((node) => {
    const path = normalize(node.path);
    const folderParts = path.split("/").filter((p) => p && p !== "home");
    const parentPath = folderParts.slice(0, -1).join("/") || "root";
    const type = node.name.startsWith("tab_")
      ? "tab"
      : node.name.startsWith("modal_")
        ? "modal"
        : "page";

    // Logic: Tree-based columns with type-based offsets to ensure clarity
    // depth 0 (Start) -> Col 0
    // depth 1 (Main Pages) -> Col 1
    // Tabs/Modals start after their parent's depth.
    let col = path === startNodePath ? 0 : node.level + 1;

    // Ensure Tabs/Modals are shifted slightly if they are at the same level as pages
    if (type === "tab") col += 0.5;
    if (type === "modal") col += 1;

    const nodeData = {
      ...node,
      path,
      type,
      col, // col can now be a float for spacing, will be sorted
      parentPath,
    };
    nodeMap.set(path, nodeData);

    if (!columns[col]) columns[col] = [];
    columns[col].push(nodeData);

    if (!groups.has(parentPath)) groups.set(parentPath, []);
    groups.get(parentPath).push(nodeData);
  });

  // 2. Add 'start' virtual node ONLY if no 'home' or 'start' exists in the actual scanned nodes
  const hasHome = Array.from(nodeMap.values()).some(
    (n) =>
      n.name.toLowerCase() === "home" ||
      n.path.endsWith("/home") ||
      n.path.endsWith("\\home"),
  );

  if (!hasHome && !nodeMap.has("start")) {
    const virtualRoot = {
      path: "home",
      name: "Home",
      type: "page",
      col: 0,
      parentPath: "root",
    };
    nodeMap.set("home", virtualRoot);
    if (!columns[0]) columns[0] = [];
    columns[0].unshift(virtualRoot);
    // explicit update startNodePath only if we created a virtual one and had nothing else?
    // But we already calculated startNodePath earlier.
    // If startNodePath was 'home' but no home existed, this fills it.
    // If startNodePath was 'login', we don't care about home.
  }

  // 3. Advanced Tree Layout (Linearization to prevent overlap)
  // We will traverse the state.mainTree to linearize the nodes in a "Directory Tree" order.
  // This ensures that:
  // 1. Folders keep their children together vertically.
  // 2. Every node gets a unique Y slot, so overlap is impossible.
  // 3. X is determined by depth.

  const nodePositions = new Map();
  // Large canvas origin
  const startX = 10000;
  const startY = 10000;
  const spacingX = (devicePreset && devicePreset.spacingX) || 420;
  const spacingY = (devicePreset && devicePreset.spacingY) || 300;

  // Helper to find a UI node in screenNodes array by path
  // We need this because state.mainTree has structure, screenNodes has flattened UI data.
  const findScreenNode = (path) => {
    // Normalize both sides to ensure matching despite timestamps or separators
    return screenNodes.find((n) => normalize(n.path) === path);
  };

  // We'll build a display list of { node, level, type }
  const displayList = [];

  // Recursive traversal logic
  // We want to traverse mainTree, but if a folder has children, process them.
  // Recursive traversal logic
  const traverse = (nodes, level = 0) => {
    // Sort: Folders/Screens first (alphabetical), then others?
    // Or alphabetical by name for consistency.
    const sortedNodes = [...nodes].sort((a, b) => a.name.localeCompare(b.name));

    sortedNodes.forEach((treeNode) => {
      // Check if this treeNode generates a screen
      // Logic must match getScreenNodesFromTree:
      // 1. Is direct UI?
      // 2. Is Folder with UI child?

      let matchPath = null;
      const isDirectUI =
        treeNode.type === "ui" ||
        treeNode.type === "tab" ||
        treeNode.type === "modal";
      const hasUiChild =
        !isDirectUI &&
        treeNode.children &&
        treeNode.children.some((c) => c.name === "UI");

      if (isDirectUI) {
        matchPath = treeNode.path || treeNode.urlPath;
      } else if (hasUiChild) {
        matchPath = treeNode.path || treeNode.urlPath;
      }

      if (matchPath) {
        const normPath = normalize(matchPath);
        const screenNode = findScreenNode(normPath);

        // Only add if not already in displayList (traverse might visit duplicates if tree has issues, though unlikely)
        if (
          screenNode &&
          !displayList.some((d) => d.path === screenNode.path)
        ) {
          displayList.push({ ...screenNode, level, isVirtual: false });
        }
      }

      // Recurse
      // If it's a folder, traverse children
      // WARNING: If it's a Folder-Screen, we still might have children (Modals inside?)
      // We should traverse children BUT exclude the 'UI' file itself so we don't double count?
      // getScreenNodesFromTree adds 'UI' files if they are direct.
      // But if we treated the Folder as the screen, do we also treat 'UI' child as a screen?
      // In getScreenNodesFromTree:
      // if (isDirectUI) -> adds it.
      // else if (hasUiChild) -> adds folder.
      //
      // If we have Folder 'Login' with child 'UI'.
      // - Folder 'Login' -> hasUiChild = true -> Added as Screen 'Login'.
      // - Child 'UI' -> isDirectUI = true -> Added as Screen 'Login/UI'??
      // We need to avoid double adding.
      // Generally 'UI' inside a folder IS the folder's screen. We shouldn't show it separately.

      if (treeNode.children && treeNode.children.length > 0) {
        // If this folder WAS a screen (hasUiChild), we skip only the literal 'UI' file child
        // to avoid double-counting. Don't filter by type since real page children also have type "ui".
        let childrenToProcess = treeNode.children;
        if (hasUiChild) {
          childrenToProcess = treeNode.children.filter(
            (c) => c.name !== "UI",
          );
        }

        // If valid children remain, recurse
        if (childrenToProcess.length > 0) {
          traverse(childrenToProcess, level + 1);
        }
      }
    });
  };

  // Start traversal from root
  traverse(state.mainTree || []);
  // If 'home' was virtual and not in tree, add it
  if (startNodePath === "home" && !displayList.find((n) => n.path === "home")) {
    displayList.unshift({ ...nodeMap.get("home"), level: 0 });
  }

  // Now assign coordinates based on the display list
  // Y is purely monotonic increasing -> Zero Overlap.
  // X is based on level + type offset.

  // 4. Compute Flow-Based Rankings (BFS) for X-Position
  // We want X to be determined by "Interaction Depth" from StartNode, not just Folder Depth.
  const flowRanks = new Map();
  const adjacency = new Map();

  // Build Graph
  if (flow && flow.edges) {
    flow.edges.forEach((edge) => {
      if (edge.from === "start") return;
      const s = normalize(edge.from);
      const t = normalize(edge.to);

      // Try to resolve absolute paths using isMatch or exact match
      // We need to map "Short Name" -> "Absolute Path"
      // We can iterate screenNodes to build this look up map first?
      // Better: just use permissive matching during adjacency build?
      // Actually, let's map normalized paths if possible.
      // But edges might use short names.

      // Helper to resolve edge end to absolute path
      const resolvePath = (shortName) => {
        const node = screenNodes.find((n) => isMatch(n.path, shortName));
        return node ? normalize(node.path) : null;
      };

      const absS = resolvePath(edge.from);
      const absT = resolvePath(edge.to);

      if (absS && absT && absS !== absT) {
        if (!adjacency.has(absS)) adjacency.set(absS, []);
        adjacency.get(absS).push(absT);
      }
    });
  }

  // BFS
  if (startNodePath) {
    const queue = [{ path: startNodePath, rank: 0 }];
    flowRanks.set(startNodePath, 0);

    while (queue.length > 0) {
      const { path, rank } = queue.shift();

      if (adjacency.has(path)) {
        adjacency.get(path).forEach((neighbor) => {
          if (!flowRanks.has(neighbor)) {
            flowRanks.set(neighbor, rank + 1);
            queue.push({ path: neighbor, rank: rank + 1 });
          }
        });
      }
    }
  }

  // ---------------------------------------------------------
  // SWIMLANE LAYOUT (Columnar)
  // ---------------------------------------------------------

  // 1. Assign Ranks
  displayList.forEach((item) => {
    const normItemPath = normalize(item.path);
    let rank = flowRanks.get(normItemPath);
    if (rank === undefined) {
      if (normItemPath === startNodePath) {
        rank = 0;
      } else {
        const maxRank = Math.max(0, ...flowRanks.values());
        rank = maxRank + 1 + (item.level || 0);
      }
    }
    item._tempRank = rank;
  });

  // 2. Sort: Rank ASC, then Path ASC
  displayList.sort((a, b) => {
    if (a._tempRank !== b._tempRank) return a._tempRank - b._tempRank;
    return a.path.localeCompare(b.path);
  });

  // 3. Track Y per Column
  const rankYTracker = new Map();
  // Start slightly higher to center
  const universalStartY = startY - (displayList.length * spacingY) / 4;

  displayList.forEach((item) => {
    let x, y;
    const normItemPath = normalize(item.path);
    const rank = item._tempRank;

    x = startX + rank * spacingX;
    if (item.type === "tab") x += 60;
    if (item.type === "modal") x += 120;

    let colY = rankYTracker.get(rank);
    if (colY === undefined) colY = universalStartY;

    y = colY;
    rankYTracker.set(rank, colY + spacingY);

    // OVERRIDE: If user has moved this node, use saved position
    // BUT skip if we are rendering for a non-desktop device (force fresh layout)
    var useDesktopLayout = !devicePreset || devicePreset.nodeW === 280;
    if (useDesktopLayout && flow && flow.positions && flow.positions[normItemPath]) {
      x = flow.positions[normItemPath].x;
      y = flow.positions[normItemPath].y;
    }

    nodePositions.set(normItemPath, { x, y });
    sitemapNodePositions.set(normItemPath, { x, y }); // Sync module-level
    const div = createVisualNode(
      item,
      x,
      y,
      container,
      flow,
      startNodePath,
      svg,
    );
    if (div) {
      fragment.appendChild(div);
    }
  });

  // Batch Append
  container.appendChild(fragment);

  // 5. Draw Edges
  if (flow && flow.edges) {
    var edgeNodeW = (devicePreset && devicePreset.nodeW) || 280;
    renderEdges(flow.edges, nodePositions, container, svg, edgeNodeW);
  }

  // 6. Lazy load previews with IntersectionObserver
  const previewObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const nodeDiv = entry.target;
          const previewUrl = nodeDiv.dataset.previewUrl;
          if (!previewUrl) return;

          const thumb = nodeDiv.querySelector(".node-thumbnail");
          const placeholder = nodeDiv.querySelector(".node-preview-placeholder");
          if (!thumb) return;

          // Create lightweight iframe for this node
          const iframe = document.createElement("iframe");
          iframe.src = previewUrl;
          // Render iframe at real device viewport, then scale to fit node
          var iframeW = (devicePreset && devicePreset.iframeW) || 1400;
          var iframeH = (devicePreset && devicePreset.iframeH) || 800;
          var nodeW = (devicePreset && devicePreset.nodeW) || 280;
          var scaleFactor = (nodeW / iframeW).toFixed(4);
          iframe.sandbox = "allow-same-origin allow-scripts";
          iframe.style.cssText = `width:${iframeW}px;height:${iframeH}px;transform:scale(${scaleFactor});transform-origin:0 0;border:none;pointer-events:none;position:absolute;top:0;left:0;opacity:0;transition:opacity 0.3s;`;

          iframe.onload = () => {
            // Fade in
            iframe.style.opacity = "1";
            // Remove placeholder
            if (placeholder) placeholder.remove();
          };

          iframe.onerror = () => {
            // On error, show fallback
            if (placeholder) placeholder.textContent = "📄";
            iframe.remove();
          };

          thumb.appendChild(iframe);

          // Stop observing this node
          nodeDiv.removeAttribute("data-preview-url");
          observer.unobserve(nodeDiv);
        }
      });
    },
    { root: elements.sitemapWorkspace, rootMargin: "300px" }
  );

  // Observe all nodes with preview URLs
  container.querySelectorAll(".sitemap-node-visual[data-preview-url]").forEach(node => {
    previewObserver.observe(node);
  });

  // Single-shot auto center after render
  const view = elements.sitemapWorkspace;
  if (view && !view._firstRenderDone) {
    setTimeout(() => centerSitemapOnStart(true), 300);
    view._firstRenderDone = true;
  }

  setupSitemapPanning(view, container);
}

// Lightweight edge redraw — only clears SVG and labels, redraws edges
// Used during drag to avoid expensive full re-render
let _redrawEdgesRAF = null;
function redrawEdgesOnly() {
  // Throttle with requestAnimationFrame for smooth 60fps
  if (_redrawEdgesRAF) return;
  _redrawEdgesRAF = requestAnimationFrame(() => {
    _redrawEdgesRAF = null;

    const container = elements.workspaceNodesContainer;
    const svg = elements.workspaceEdgesSvg;
    if (!container || !svg || !sitemapFlowData) return;

    // Clear SVG edges
    svg.innerHTML = "";

    // Clear edge labels (but NOT nodes!)
    container.querySelectorAll(".sitemap-edge-label").forEach(el => el.remove());

    // Redraw edges using current positions
    if (sitemapFlowData.edges) {
      var edgeW = (SITEMAP_DEVICE_PRESETS[currentSitemapDevice] && SITEMAP_DEVICE_PRESETS[currentSitemapDevice].nodeW) || 280;
      renderEdges(sitemapFlowData.edges, sitemapNodePositions, container, svg, edgeW);
    }
  });
}

function renderEdges(edges, nodePositions, container, svg, nodeW) {
  nodeW = nodeW || 280;
  // Group edges by source -> target to avoid overlapping lines
  const uniqueEdges = new Map();
  const normalize = (p) =>
    p ? p.replace(/\\/g, "/").replace(/_\d{6}$/, "") : "";

  edges.forEach((edge) => {
    if (edge.from === "start") return;

    const s = normalize(edge.from);
    const t = normalize(edge.to);

    // Skip self loops
    if (s === t) return;

    const key = `${s}->${t}`;
    if (
      !uniqueEdges.has(key) ||
      edge.timestamp > uniqueEdges.get(key).timestamp
    ) {
      uniqueEdges.set(key, edge);
    }
  });

  // Helper to find pos by short match
  const getPos = (shortPath) => {
    // 1. Try direct match
    let pos = nodePositions.get(shortPath);
    if (pos) return pos;

    // 2. Search keys via fuzzy match
    for (const [fullPath, p] of nodePositions.entries()) {
      if (isMatch(fullPath, shortPath)) return p;
    }
    return null;
  };

  uniqueEdges.forEach((edge) => {
    const sourcePos = getPos(normalize(edge.from));
    const targetPos = getPos(normalize(edge.to));

    if (sourcePos && targetPos) {
      const x1 = sourcePos.x + nodeW; // Right side of node
      const y1 = sourcePos.y + 80; // ~Middle
      const x2 = targetPos.x;
      const y2 = targetPos.y + 80;

      // Smart Edge "Subtle" Curve
      const dist = Math.abs(x2 - x1);
      const curvature = Math.min(dist * 0.5, 150);

      const cp1x = x1 + curvature;
      const cp1y = y1;
      const cp2x = x2 - curvature;
      const cp2y = y2;

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
      path.setAttribute("d", d);
      path.setAttribute("class", "sitemap-edge-path");
      path.dataset.source = normalize(edge.from);
      path.dataset.target = normalize(edge.to);
      path.setAttribute("stroke", "#cbd5e1");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.setAttribute("marker-end", "url(#arrowhead-modern)");
      svg.appendChild(path);

      // Build label text from edge data
      // Priority: edge.label (flow description) > edge.interaction.text > edge.interaction.selector
      let labelText = "";
      if (edge.label) {
        // Truncate long labels
        labelText = edge.label.length > 40 ? edge.label.substring(0, 37) + "..." : edge.label;
      } else if (edge.interaction && (edge.interaction.text || edge.interaction.selector)) {
        labelText = edge.interaction.text || edge.interaction.selector;
      }

      if (labelText) {
        const label = document.createElement("div");
        label.className = "sitemap-edge-label";
        label.dataset.source = normalize(edge.from);
        label.dataset.target = normalize(edge.to);
        label.textContent = labelText;

        // Position label on the mid-curve
        const t = 0.5;
        const lx =
          Math.pow(1 - t, 3) * x1 +
          3 * Math.pow(1 - t, 2) * t * cp1x +
          3 * (1 - t) * Math.pow(t, 2) * cp2x +
          Math.pow(t, 3) * x2;
        const ly =
          Math.pow(1 - t, 3) * y1 +
          3 * Math.pow(1 - t, 2) * t * cp1y +
          3 * (1 - t) * Math.pow(t, 2) * cp2y +
          Math.pow(t, 3) * y2;

        label.style.left = `${lx}px`;
        label.style.top = `${ly}px`;
        container.appendChild(label);
      }
    }
  });

  if (!svg.querySelector("#arrowhead-modern")) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    // Standard Marker
    const marker = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "marker",
    );
    marker.setAttribute("id", "arrowhead-modern");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "5");
    marker.setAttribute("markerHeight", "5");
    marker.setAttribute("orient", "auto-start-reverse");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // Flat back for better dashed line connection
    path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    path.setAttribute("fill", "#94a3b8");
    marker.appendChild(path);
    defs.appendChild(marker);

    // Highlighted Marker
    const markerH = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "marker",
    );
    markerH.setAttribute("id", "arrowhead-modern-highlighted");
    markerH.setAttribute("viewBox", "0 0 10 10");
    markerH.setAttribute("refX", "10");
    markerH.setAttribute("refY", "5");
    markerH.setAttribute("markerWidth", "6");
    markerH.setAttribute("markerHeight", "6");
    markerH.setAttribute("orient", "auto-start-reverse");
    const pathH = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    // Flat back (solid) to hide dash gaps
    pathH.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    pathH.setAttribute("fill", "#6366f1"); // Match accent-primary
    markerH.appendChild(pathH);
    defs.appendChild(markerH);

    svg.appendChild(defs);
  }
}

function highlightPathTo(targetPath, flow, container, svg, startPath = "home") {
  if (elements.resetWorkspaceSitemapBtn)
    elements.resetWorkspaceSitemapBtn.style.display = "block";

  const normalize = (p) =>
    p ? p.replace(/\\/g, "/").replace(/_\d{6}$/, "") : "";
  const normTarget = normalize(targetPath);
  const normStart = normalize(startPath);

  // 1. Build a robust Graph including both Flow Edges and Implicit Folder Hierarchy
  const graph = new Map(); // key -> [neighbors]

  // Helper to add edge
  const addEdge = (u, v, data) => {
    if (!graph.has(u)) graph.set(u, []);
    graph.get(u).push({ target: v, ...data });
  };

  // A. Add Flow Edges
  if (flow && flow.edges) {
    flow.edges.forEach((edge) => {
      const s = normalize(edge.from);
      const t = normalize(edge.to);
      // Treat 'start' source as potentially coming from normStart
      if (edge.from === "start") {
        addEdge(normStart, t, { type: "explicit", edgeData: edge });
      } else {
        addEdge(s, t, { type: "explicit", edgeData: edge });
      }
    });
  }

  // B. Add Implicit Folder Hierarchy Edges (Parent -> Child)
  const renderedNodes = Array.from(
    container.querySelectorAll(".sitemap-node-visual"),
  ).map((el) => ({
    path: normalize(el.dataset.path),
    el: el,
  }));

  renderedNodes.forEach((node) => {
    const parts = node.path.split("/");
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join("/");
      if (renderedNodes.some((n) => n.path === parentPath)) {
        addEdge(parentPath, node.path, { type: "implicit" });
      }
    }
  });

  // BFS Search
  const queue = [{ node: normStart, pathNodes: [normStart], pathEdges: [] }];
  const visited = new Set([normStart]);
  let foundPath = null;

  let loops = 0;
  while (queue.length > 0 && loops < 5000) {
    loops++;
    const { node, pathNodes, pathEdges } = queue.shift();

    if (isMatch(node, normTarget)) {
      foundPath = { nodes: pathNodes, edges: pathEdges };
      break;
    }

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.target)) {
        visited.add(neighbor.target);
        queue.push({
          node: neighbor.target,
          pathNodes: [...pathNodes, neighbor.target],
          pathEdges: [...pathEdges, neighbor],
        });
      }
    }
  }

  // 3. Visualization apply
  container.querySelectorAll(".sitemap-node-visual").forEach((n) => {
    n.classList.remove("selected", "faded");
    n.style.opacity = "1";
  });
  svg.querySelectorAll(".sitemap-edge-path").forEach((e) => {
    e.classList.remove("highlighted-path", "faded");
    e.setAttribute("stroke", "#cbd5e1");
    e.setAttribute("stroke-width", "2");
    e.style.opacity = "1";
  });

  if (foundPath) {
    // Fade all first
    container
      .querySelectorAll(".sitemap-node-visual")
      .forEach((n) => n.classList.add("faded"));
    svg
      .querySelectorAll(".sitemap-edge-path")
      .forEach((e) => e.classList.add("faded"));

    // Highlight Path Nodes
    foundPath.nodes.forEach((p) => {
      let el = container.querySelector(
        `.sitemap-node-visual[data-path="${p}"]`,
      );
      if (!el) {
        el = Array.from(
          container.querySelectorAll(".sitemap-node-visual"),
        ).find((n) => isMatch(normalize(n.dataset.path), p));
      }
      if (el) {
        el.classList.remove("faded");
        el.classList.add("selected");
        el.style.opacity = "1";
      }
    });

    // Highlight Edges
    foundPath.edges.forEach((e) => {
      if (e.type === "explicit" && e.edgeData) {
        const s = normalize(e.edgeData.from);
        const t = normalize(e.edgeData.to);
        // Find edge path element
        const edgeEl = svg.querySelector(
          `.sitemap-edge-path[data-source="${s}"][data-target="${t}"]`,
        ) || svg.querySelector(
          `.sitemap-edge-path[data-source="${e.edgeData.from}"][data-target="${e.edgeData.to}"]`,
        );
        if (edgeEl) {
          edgeEl.classList.remove("faded");
          edgeEl.classList.add("highlighted-path");
          edgeEl.setAttribute("stroke", "#3b82f6");
          edgeEl.setAttribute("stroke-width", "3");
          edgeEl.style.opacity = "1";
        }

        // Also highlight the edge label
        const labelEl = container.querySelector(
          `.sitemap-edge-label[data-source="${s}"][data-target="${t}"]`,
        );
        if (labelEl) {
          labelEl.classList.remove("faded");
          labelEl.classList.add("highlighted");
          labelEl.style.opacity = "1";
        }
      }
    });
  } else {
    container
      .querySelectorAll(".sitemap-node-visual")
      .forEach((n) => n.classList.add("faded"));
    svg
      .querySelectorAll(".sitemap-edge-path")
      .forEach((e) => e.classList.add("faded"));

    const targetEl = Array.from(
      container.querySelectorAll(".sitemap-node-visual"),
    ).find((n) => isMatch(normalize(n.dataset.path), normTarget));
    if (targetEl) {
      targetEl.classList.remove("faded");
      targetEl.classList.add("selected");
      targetEl.style.opacity = "1";
    }
    showToast("Không tìm thấy đường dẫn liên kết", "info");
  }

  // Handle Edge Labels visibility based on found path
  container.querySelectorAll(".sitemap-edge-label").forEach((label) => {
    let isInPath = false;
    if (foundPath) {
      const uniqueKey = (s, t) => `${normalize(s)}->${normalize(t)}`;
      const pathKeys = new Set(
        foundPath.edges.map((e) => {
          if (e.edgeData)
            return uniqueKey(e.edgeData.from, e.edgeData.to);
          return "";
        }),
      );
      const labelKey = uniqueKey(
        label.dataset.source || "",
        label.dataset.target || "",
      );
      isInPath = pathKeys.has(labelKey);
    }

    label.classList.toggle("faded", !isInPath);
    label.classList.toggle("highlighted", isInPath);

    // Reset label opacity if no path is highlighted (back to normal gentle state)
    if (!foundPath) {
      label.style.opacity = "1";
    }
  });
}

function setupSitemapPanning(workspace, content) {
  if (!workspace || workspace.hasPanning) return;

  const zoomLayer = elements.workspaceZoomLayer;
  if (!zoomLayer) return;

  // Apply initial state
  zoomLayer.style.transform = `translate(${workspaceView.translateX}px, ${workspaceView.translateY}px) scale(${workspaceView.scale})`;

  let hasMoved = false;

  const handleMouseDown = (e) => {
    const isInteractive =
      e.target.closest(".sitemap-node-visual") ||
      e.target.closest(".zoom-controls") ||
      e.target.closest(".btn") ||
      e.target.closest(".modal-content");

    if (isInteractive) return;

    workspaceView.isDragging = true;
    hasMoved = false;
    workspace.style.cursor = "grabbing";

    workspaceView.startX = e.clientX - workspaceView.translateX;
    workspaceView.startY = e.clientY - workspaceView.translateY;

    zoomLayer.style.transition = "none";
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!workspaceView.isDragging) return;

    const dx = Math.abs(
      e.clientX - (workspaceView.startX + workspaceView.translateX),
    );
    const dy = Math.abs(
      e.clientY - (workspaceView.startY + workspaceView.translateY),
    );
    if (dx > 2 || dy > 2) hasMoved = true;

    workspaceView.translateX = e.clientX - workspaceView.startX;
    workspaceView.translateY = e.clientY - workspaceView.startY;

    zoomLayer.style.transform = `translate(${workspaceView.translateX}px, ${workspaceView.translateY}px) scale(${workspaceView.scale})`;
  };

  const handleMouseUp = (e) => {
    if (!workspaceView.isDragging) return;

    workspaceView.isDragging = false;
    workspace.style.cursor = "grab";

    // If it was a clean click on the background (not a drag), reset the view
    if (!hasMoved) {
      const isInteractive =
        e.target.closest(".sitemap-node-visual") ||
        e.target.closest(".zoom-controls") ||
        e.target.closest(".btn");
      if (!isInteractive) {
        resetSitemapView();
      }
    }
  };

  // Unified Zoom Function
  const applyZoom = (newScale, centerX, centerY, speed = "0.1s") => {
    if (newScale === workspaceView.scale) return;

    const ratio = newScale / workspaceView.scale;
    workspaceView.translateX =
      centerX - (centerX - workspaceView.translateX) * ratio;
    workspaceView.translateY =
      centerY - (centerY - workspaceView.translateY) * ratio;
    workspaceView.scale = newScale;

    zoomLayer.style.transition = `transform ${speed} ease-out`;
    zoomLayer.style.transform = `translate(${workspaceView.translateX}px, ${workspaceView.translateY}px) scale(${workspaceView.scale})`;
  };

  // Wheel Zoom (Optimized for Mouse & Trackpad)
  workspace.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();

      const delta = e.ctrlKey ? e.deltaY : e.deltaY;
      const zoomSpeed = e.ctrlKey ? 0.02 : 0.0015;
      const zoomFactor = 1 - delta * zoomSpeed;
      const newScale = Math.min(
        Math.max(0.05, workspaceView.scale * zoomFactor),
        4,
      );

      const rect = workspace.getBoundingClientRect();
      applyZoom(newScale, e.clientX - rect.left, e.clientY - rect.top, "0.05s");
    },
    { passive: false },
  );

  // Floating Buttons
  if (elements.zoomInBtn) {
    elements.zoomInBtn.onclick = (e) => {
      e.stopPropagation();
      const rect = workspace.getBoundingClientRect();
      applyZoom(
        Math.min(workspaceView.scale * 1.5, 4),
        rect.width / 2,
        rect.height / 2,
        "0.2s",
      );
    };
  }
  if (elements.zoomOutBtn) {
    elements.zoomOutBtn.onclick = (e) => {
      e.stopPropagation();
      const rect = workspace.getBoundingClientRect();
      applyZoom(
        Math.max(workspaceView.scale / 1.5, 0.05),
        rect.width / 2,
        rect.height / 2,
        "0.2s",
      );
    };
  }
  if (elements.zoomFitBtn) {
    elements.zoomFitBtn.onclick = (e) => {
      e.stopPropagation();
      centerSitemapOnStart(true);
    };
  }

  workspace.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  workspace.hasPanning = true;
}

function setupSitemapSearch() {
  if (!elements.sitemapSearchInput) return;

  elements.sitemapSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    const container = elements.workspaceNodesContainer;

    // Remove previous search highlights
    container.querySelectorAll(".sitemap-node-visual").forEach((node) => {
      node.classList.remove("search-highlight");
      node.style.opacity = "1";
    });

    if (!query) return;

    // Find matches
    const nodes = Array.from(
      container.querySelectorAll(".sitemap-node-visual"),
    );
    let bestMatch = null;

    // Priority 1: Exact match on title (displayed name)
    bestMatch = nodes.find((node) => {
      const title =
        node.querySelector(".node-title")?.textContent.toLowerCase() || "";
      return title === query;
    });

    // Priority 2: Starts with query
    if (!bestMatch) {
      bestMatch = nodes.find((node) => {
        const title =
          node.querySelector(".node-title")?.textContent.toLowerCase() || "";
        return title.startsWith(query);
      });
    }

    // Priority 3: Contains query in title
    if (!bestMatch) {
      bestMatch = nodes.find((node) => {
        const title =
          node.querySelector(".node-title")?.textContent.toLowerCase() || "";
        return title.includes(query);
      });
    }

    // Priority 4: Contains query in path
    if (!bestMatch) {
      bestMatch = nodes.find((node) => {
        const path = node.dataset.path.toLowerCase();
        return path.includes(query);
      });
    }

    if (bestMatch) {
      // Highlight match
      bestMatch.classList.add("search-highlight");

      // Dim others slightly to make it pop
      nodes.forEach((n) => {
        if (n !== bestMatch) n.style.opacity = "0.5";
      });

      // Pan to match
      const x = parseFloat(bestMatch.style.left);
      const y = parseFloat(bestMatch.style.top);

      // Re-use centering logic but targeted
      const zoomLayer = elements.workspaceZoomLayer;
      const workspace = elements.sitemapWorkspace;
      const rect = workspace.getBoundingClientRect();

      // Keep current scale but animated pan
      // Target center:
      const targetX =
        rect.width / 2 - x * workspaceView.scale - 140 * workspaceView.scale;
      const targetY =
        rect.height / 2 - y * workspaceView.scale - 110 * workspaceView.scale;

      // Animate transition
      const startTx = workspaceView.translateX;
      const startTy = workspaceView.translateY;
      const startTime = performance.now();
      const duration = 500;

      const animate = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t); // easeInOutQuad

        const ratio = ease(progress);

        workspaceView.translateX = startTx + (targetX - startTx) * ratio;
        workspaceView.translateY = startTy + (targetY - startTy) * ratio;

        zoomLayer.style.transform = `translate(${workspaceView.translateX}px, ${workspaceView.translateY}px) scale(${workspaceView.scale})`;

        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }
  });
}

function resetSitemapLayout() {
  if (!state.currentProject) return;

  if (
    !confirm("Bạn có chắc muốn đặt lại toàn bộ vị trí nodes về mặc định không?")
  )
    return;

  api
    .resetFlowPositions(state.currentProject)
    .then(() => {
      showToast("Đã đặt lại vị trí nodes", "success");
      loadSitemapWorkspace();
    })
    .catch((err) => {
      console.error(err);
      showToast("Lỗi đặt lại vị trí", "error");
    });
}

// Run Section Test
// ========================================
// Regression Test — Full replay + capture + compare + report
// ========================================

async function runSectionTest(timestamp, deviceProfile = 'original') {
  if (!state.currentProject) return;

  const deviceLabel = deviceProfile ? ` (${deviceProfile.toUpperCase()})` : '';

  // Show progress overlay
  showTestProgressOverlay(timestamp, deviceLabel);

  try {
    // Call the NEW regression test API
    const result = await api.fetch(
      `/api/replay/regression/${encodeURIComponent(state.currentProject)}/${encodeURIComponent(timestamp)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          deviceProfile: deviceProfile || 'original',
          keepBrowserOpen: false
        })
      }
    );

    // Hide progress overlay
    hideTestProgressOverlay();

    if (result.success) {
      // Show results inline
      showTestResults(result);

      // Refresh sections data
      await selectProject(state.currentProject);
    } else {
      showToast('Test failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    hideTestProgressOverlay();
    console.error('runSectionTest error:', error);
    showToast(`Lỗi: ${error.message}`, 'error');
  }
}

// Progress overlay during long-running test
function showTestProgressOverlay(sectionId, deviceLabel) {
  const existing = document.getElementById('testProgressOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'testProgressOverlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.92);
    z-index: 100000; display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(8px);
  `;
  overlay.innerHTML = `
    <div style="text-align: center; max-width: 500px; padding: 40px;">
      <div style="margin-bottom: 24px;">
        <div class="test-spinner" style="
          width: 64px; height: 64px; margin: 0 auto 16px;
          border: 4px solid rgba(59,130,246,0.2);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: testSpin 0.8s linear infinite;
        "></div>
        <style>@keyframes testSpin { to { transform: rotate(360deg); } }</style>
      </div>
      <h2 style="color: #e2e8f0; font-size: 22px; margin-bottom: 8px;">🧪 Đang chạy Regression Test${deviceLabel}</h2>
      <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;" id="testProgressText">
        Đang khởi tạo browser và load flow...
      </p>
      <div style="
        background: rgba(30,41,59,0.8); border-radius: 12px; padding: 16px;
        border: 1px solid rgba(255,255,255,0.05); text-align: left;
      ">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #94a3b8;">
          <span style="color: #3b82f6;">📋</span>
          Section: <span style="color: #e2e8f0;">${sectionId}</span>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #64748b;">
          Quá trình sẽ tự động: Navigate → Replay Actions → Capture → Compare cho mỗi screen
        </div>
      </div>
      <p style="color: #475569; font-size: 12px; margin-top: 16px;">Vui lòng không đóng tab này...</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideTestProgressOverlay() {
  const overlay = document.getElementById('testProgressOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s';
    setTimeout(() => overlay.remove(), 300);
  }
}

// Show test results in a beautiful modal
function showTestResults(result) {
  const existing = document.getElementById('testResultsModal');
  if (existing) existing.remove();

  const summary = result.summary || {};
  const screens = result.screens || [];
  const overallColor = summary.overallStatus === 'PASSED' ? '#10b981' :
    summary.overallStatus === 'WARNING' ? '#f59e0b' : '#ef4444';
  const overallIcon = summary.overallStatus === 'PASSED' ? '✅' :
    summary.overallStatus === 'WARNING' ? '⚠️' : '❌';

  const statusColors = { passed: '#10b981', failed: '#ef4444', warning: '#f59e0b', error: '#dc2626' };
  const statusIcons = { passed: '✅', failed: '❌', warning: '⚠️', error: '💥' };

  const modal = document.createElement('div');
  modal.id = 'testResultsModal';
  modal.className = 'modal active';
  modal.style.cssText = 'z-index: 100001;';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 85vh; overflow-y: auto; border-radius: 16px;">
      <div class="modal-header" style="border-bottom: 1px solid var(--border-color);">
        <h3 style="display: flex; align-items: center; gap: 8px;">
          ${overallIcon}
          <span>Regression Test — <span style="color: ${overallColor};">${summary.overallStatus}</span></span>
        </h3>
        <button class="modal-close" onclick="document.getElementById('testResultsModal').remove()">&times;</button>
      </div>
      <div class="modal-body" style="padding: 0;">
        <!-- Summary bar -->
        <div style="display: flex; gap: 1px; margin-bottom: 0; background: var(--border-color);">
          <div style="flex: 1; text-align: center; padding: 16px; background: var(--bg-secondary);">
            <div style="font-size: 28px; font-weight: 700;">${summary.total || 0}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Total</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 16px; background: var(--bg-secondary);">
            <div style="font-size: 28px; font-weight: 700; color: #10b981;">${summary.passed || 0}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Passed</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 16px; background: var(--bg-secondary);">
            <div style="font-size: 28px; font-weight: 700; color: #ef4444;">${summary.failed || 0}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Failed</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 16px; background: var(--bg-secondary);">
            <div style="font-size: 28px; font-weight: 700; color: #f59e0b;">${summary.warnings || 0}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Warnings</div>
          </div>
        </div>

        <!-- Meta info -->
        <div style="padding: 12px 16px; background: var(--bg-glass); font-size: 12px; color: var(--text-muted); display: flex; gap: 16px; border-bottom: 1px solid var(--border-color);">
          <span>⏱️ ${result.duration || '—'}</span>
          <span>📦 ${result.projectName || ''}</span>
          <span>🕐 ${result.timestamp ? new Date(result.timestamp).toLocaleString('vi-VN') : ''}</span>
        </div>

        <!-- Screen results -->
        <div style="padding: 16px;">
          ${screens.map(screen => {
    const color = statusColors[screen.status] || '#94a3b8';
    const icon = statusIcons[screen.status] || '❓';
    const ui = screen.comparison?.ui;
    const apiDiff = screen.comparison?.api;
    const css = ui?.cssDiff;
    const pixel = ui?.pixelDiff;

    let detailHtml = '';

    // CSS changes
    if (css && css.totalChanges > 0) {
      detailHtml += `<div style="margin-top: 8px; padding: 8px 12px; background: rgba(245,158,11,0.08); border-radius: 6px; border-left: 3px solid #f59e0b;">
                <div style="font-size: 12px; color: #f59e0b; font-weight: 600; margin-bottom: 4px;">🎨 CSS Changes (${css.totalChanges})</div>
                ${(css.changes || []).slice(0, 5).map(c =>
        `<div style="font-size: 11px; color: var(--text-secondary); padding: 2px 0;">${c.element || ''} → <strong>${c.property}</strong>: ${c.old || ''} → ${c.new || ''}${c.diff !== undefined ? ` (${c.diff > 0 ? '+' : ''}${c.diff}px)` : ''}</div>`
      ).join('')}
                ${css.changes.length > 5 ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">...và ${css.changes.length - 5} thay đổi khác</div>` : ''}
              </div>`;
    }

    // Pixel diff
    if (pixel && pixel.hasChanges && !pixel.disabled) {
      detailHtml += `<div style="margin-top: 8px; padding: 8px 12px; background: rgba(239,68,68,0.08); border-radius: 6px; border-left: 3px solid #ef4444;">
                <div style="font-size: 12px; color: #ef4444; font-weight: 600;">📸 Pixel: ${pixel.stats?.diffPercent || ''}% khác biệt</div>
              </div>`;
    }

    // API changes
    if (apiDiff && apiDiff.hasChanges) {
      detailHtml += `<div style="margin-top: 8px; padding: 8px 12px; background: rgba(59,130,246,0.08); border-radius: 6px; border-left: 3px solid #3b82f6;">
                <div style="font-size: 12px; color: #3b82f6; font-weight: 600;">🔌 API: ${apiDiff.summary || 'Changed'}</div>
              </div>`;
    }

    // Errors
    if (screen.errors && screen.errors.length > 0) {
      detailHtml += `<div style="margin-top: 8px; padding: 8px 12px; background: rgba(220,38,38,0.08); border-radius: 6px; border-left: 3px solid #dc2626;">
                <div style="font-size: 12px; color: #dc2626; font-weight: 600;">💥 ${screen.errors.join(', ')}</div>
              </div>`;
    }

    // Timings
    const timings = screen.timings || {};
    const timingParts = [];
    if (timings.navigation) timingParts.push(`Nav: ${timings.navigation}ms`);
    if (timings.actions) timingParts.push(`Actions: ${timings.actions}ms`);
    if (timings.capture) timingParts.push(`Capture: ${timings.capture}ms`);
    if (timings.compare) timingParts.push(`Compare: ${timings.compare}ms`);

    return `
              <div style="
                border: 1px solid var(--border-color); border-radius: 10px;
                margin-bottom: 10px; overflow: hidden;
                transition: border-color 0.2s;
                ${screen.status !== 'passed' ? 'border-left: 3px solid ' + color + ';' : ''}
              ">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer;"
                     onclick="this.parentElement.classList.toggle('test-screen-open')">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 14px;">${icon}</span>
                    <span style="color: var(--text-muted); font-size: 12px;">#${screen.step}</span>
                    <span style="font-weight: 600; font-size: 14px;">${screen.name || screen.screenId}</span>
                    ${ui?.summary && screen.status !== 'passed' ? `<span style="font-size: 11px; color: var(--text-muted);">${ui.summary}</span>` : ''}
                  </div>
                  <span style="padding: 3px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; background: ${color}15; color: ${color}; text-transform: uppercase;">
                    ${screen.status}
                  </span>
                </div>
                <div class="test-screen-detail" style="display: none; padding: 0 16px 12px;">
                  ${screen.status === 'passed'
        ? '<div style="font-size: 13px; color: var(--text-muted); padding: 4px 0;">Không có thay đổi — UI và API giống nhau</div>'
        : detailHtml || '<div style="font-size: 13px; color: var(--text-muted);">Không có chi tiết</div>'
      }
                  ${timingParts.length > 0 ? `
                    <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted); display: flex; gap: 12px;">
                      ${timingParts.map(t => `<span>⏱️ ${t}</span>`).join('')}
                      ${screen.actionsReplayed !== undefined ? `<span>⌨️ ${screen.actionsReplayed} actions</span>` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
  }).join('')}
        </div>

        <!-- Open full report button -->
        ${result.testRunId ? `
          <div style="padding: 0 16px 16px; display: flex; gap: 8px;">
            <button class="btn btn-primary" onclick="window.open('/storage/${encodeURIComponent(result.projectName || state.currentProject)}/test-runs/${encodeURIComponent(result.testRunId)}/report.html', '_blank')" style="flex: 1;">
              📊 Mở báo cáo HTML đầy đủ
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('testResultsModal').remove()">
              Đóng
            </button>
          </div>
        ` : ''}
      </div>
    </div>
    <style>
      .test-screen-open .test-screen-detail { display: block !important; }
    </style>
  `;

  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Auto-expand failed/warning screens
  modal.querySelectorAll('[data-status="failed"], [data-status="warning"], [data-status="error"]').forEach(el => {
    el.classList.add('test-screen-open');
  });
}

// Replay Options Modal — improved with regression test option
function showReplayOptionsModal(timestamp) {
  const existing = document.getElementById('replayOptionsModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'replayOptionsModal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 440px; border-radius: 16px;">
      <div class="modal-header">
        <h3 style="display: flex; align-items: center; gap: 8px;">🧪 Regression Test</h3>
        <button class="modal-close" id="close-replay-modal">&times;</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
          Tự động replay flow trên trang web thật, capture lại và so sánh DOM/CSS/Screenshot/API với bản gốc.
        </p>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Chon kich thuoc:</div>
        <div style="display: grid; gap: 8px;">
          <button class="btn btn-outline replay-device-btn" data-device="original" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; text-align: left; font-size: 14px; border-radius: 10px; transition: all 0.2s; border-color: var(--primary);">
            <span style="font-size: 20px;">&#9654;</span>
            <div>
              <div style="font-weight: 600;">Mac dinh (Kich thuoc goc)</div>
              <div style="font-size: 11px; color: var(--text-muted);">Chay voi viewport giong luc capture</div>
            </div>
          </button>
          <button class="btn btn-outline replay-device-btn" data-device="desktop" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; text-align: left; font-size: 14px; border-radius: 10px; transition: all 0.2s;">
            <span style="font-size: 20px;">&#128421;</span>
            <div>
              <div style="font-weight: 600;">Desktop</div>
              <div style="font-size: 11px; color: var(--text-muted);">1440 x 900px</div>
            </div>
          </button>
          <button class="btn btn-outline replay-device-btn" data-device="tablet" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; text-align: left; font-size: 14px; border-radius: 10px; transition: all 0.2s;">
            <span style="font-size: 20px;">&#128241;</span>
            <div>
              <div style="font-weight: 600;">Tablet</div>
              <div style="font-size: 11px; color: var(--text-muted);">768 x 1024px</div>
            </div>
          </button>
          <button class="btn btn-outline replay-device-btn" data-device="mobile" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; text-align: left; font-size: 14px; border-radius: 10px; transition: all 0.2s;">
            <span style="font-size: 20px;">&#128242;</span>
            <div>
              <div style="font-weight: 600;">Mobile</div>
              <div style="font-size: 11px; color: var(--text-muted);">375 x 812px</div>
            </div>
          </button>
        </div>
        <div style="margin-top: 16px; padding: 12px; background: var(--bg-glass); border-radius: 8px; font-size: 12px; color: var(--text-muted);">
          💡 Tool sẽ mở Chrome → Navigate đến URL gốc → Replay actions → Capture state → So sánh → Tạo báo cáo
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Bind events
  const close = () => modal.remove();
  modal.querySelector('#close-replay-modal').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelectorAll('.replay-device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      runSectionTest(timestamp, btn.dataset.device);
      close();
    });
  });
}

// Make globally available
window.showReplayOptionsModal = showReplayOptionsModal;
window.runSectionTest = runSectionTest;

async function showReplayHistory(sectionTimestamp) {
  try {
    const response = await fetch(
      `/api/replay/history/${encodeURIComponent(state.currentProject)}/${encodeURIComponent(sectionTimestamp)}`,
    );
    const data = await response.json();

    if (!data.success) {
      showToast("Lỗi: " + data.error, "error");
      return;
    }

    const history = data.history || [];

    if (history.length === 0) {
      showToast("Chưa có lịch sử replay cho section này", "info");
      return;
    }

    // Create modal HTML
    const modalHtml = `
            <div class="modal active" id="historyModal">
                <div class="modal-content" style="max-width: 900px; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h3>📋 Replay History - ${sectionTimestamp}</h3>
                        <button class="close-modal" onclick="document.getElementById('historyModal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 20px;">
                            <strong>Tổng số lần replay:</strong> ${history.length}
                        </div>
                        <table class="history-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                                    <th style="padding: 10px; text-align: left;">Thời gian</th>
                                    <th style="padding: 10px; text-align: left;">Replay Section</th>
                                    <th style="padding: 10px; text-align: center;">Trạng thái</th>
                                    <th style="padding: 10px; text-align: center;">Changed</th>
                                    <th style="padding: 10px; text-align: center;">Added</th>
                                    <th style="padding: 10px; text-align: center;">Removed</th>
                                    <th style="padding: 10px; text-align: center;">Unchanged</th>
                                    <th style="padding: 10px; text-align: center;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history
        .map((entry, index) => {
          const statusIcon =
            entry.status === "passed"
              ? "✅"
              : entry.status === "failed"
                ? "❌"
                : "⚠️";
          const statusColor =
            entry.status === "passed"
              ? "#22c55e"
              : entry.status === "failed"
                ? "#ef4444"
                : "#f59e0b";
          const timeFormatted = new Date(
            entry.timestamp,
          ).toLocaleString("vi-VN");
          const isDeleted = entry.deleted || false;

          return `
                                        <tr style="border-bottom: 1px solid #eee; ${isDeleted ? "opacity: 0.5; text-decoration: line-through;" : ""}">
                                            <td style="padding: 10px;">${timeFormatted}</td>
                                            <td style="padding: 10px; font-family: monospace; font-size: 11px;">${entry.replaySection}</td>
                                            <td style="padding: 10px; text-align: center;">
                                                <span style="color: ${statusColor}; font-weight: bold;">${statusIcon} ${entry.status}</span>
                                            </td>
                                            <td style="padding: 10px; text-align: center;">${entry.comparison?.changed || 0}</td>
                                            <td style="padding: 10px; text-align: center;">${entry.comparison?.added || 0}</td>
                                            <td style="padding: 10px; text-align: center;">${entry.comparison?.removed || 0}</td>
                                            <td style="padding: 10px; text-align: center;">${entry.comparison?.unchanged || 0}</td>
                                            <td style="padding: 10px; text-align: center;">
                                                ${!isDeleted
              ? `
                                                    <button class="btn btn-xs btn-secondary" onclick="compareSection('${entry.replaySection}')">
                                                        🔍 Compare
                                                    </button>
                                                    <button class="btn btn-xs btn-danger" onclick="deleteReplaySection('${sectionTimestamp}', '${entry.replaySection}')">
                                                        🗑️ Delete
                                                    </button>
                                                `
              : '<span style="color: #999;">Deleted</span>'
            }
                                            </td>
                                        </tr>
                                    `;
        })
        .join("")}
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('historyModal').remove()">Đóng</button>
                    </div>
                </div>
            </div>
        `;

    // Remove old modal if exists
    const oldModal = document.getElementById("historyModal");
    if (oldModal) oldModal.remove();

    // Add new modal
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  } catch (error) {
    console.error("Error loading replay history:", error);
    showToast("Có lỗi khi tải lịch sử replay", "error");
  }
}

async function deleteReplaySection(originalSection, replaySection) {
  if (!confirm(`Bạn có chắc muốn xóa replay section "${replaySection}"?`)) {
    return;
  }

  try {
    const response = await fetch(
      `/api/replay/replay/${encodeURIComponent(state.currentProject)}/${encodeURIComponent(originalSection)}/${encodeURIComponent(replaySection)}`,
      {
        method: "DELETE",
      },
    );

    const data = await response.json();

    if (data.success) {
      showToast("Đã xóa replay section", "success");

      // Reload sections list
      if (state.currentProject) {
        selectProject(state.currentProject);
      }

      // Refresh history modal
      document.getElementById("historyModal")?.remove();
      showReplayHistory(originalSection);
    } else {
      showToast("Lỗi: " + data.error, "error");
    }
  } catch (error) {
    console.error("Error deleting replay:", error);
    showToast("Có lỗi khi xóa replay section", "error");
  }
}

// View Replay Details - Show all screens and API of a replay section
async function viewReplayDetails(replayTimestamp) {
  console.log("viewReplayDetails called with:", replayTimestamp);

  if (!state.currentProject) {
    console.error("No current project");
    return;
  }

  try {
    showToast("Đang tải chi tiết replay...", "info");

    // Get section details
    const url = `/api/projects/${encodeURIComponent(state.currentProject)}/sections/${encodeURIComponent(replayTimestamp)}/details`;
    console.log("Fetching from:", url);

    const response = await fetch(url);
    const data = await response.json();

    console.log("Response data:", data);

    if (!data.success) {
      showToast("Không thể tải chi tiết: " + data.error, "error");
      return;
    }

    const details = data.details;

    console.log("Creating modal with details:", details);
    console.log("Number of screens:", details.screens?.length);

    // Create modal HTML
    const modalHtml = `
            <div class="modal-overlay" id="replayDetailsModal" style="display: flex !important; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000;">
                <div class="modal-content replay-details-modal" style="max-width: 1200px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; background: var(--bg-secondary); border-radius: 12px; width: 90%;">
                    <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border-color); position: relative;">
                        <h3 style="margin: 0;">📋 Chi tiết Replay - ${formatTimestamp(replayTimestamp)}</h3>
                        <button class="close-modal" onclick="document.getElementById('replayDetailsModal').remove()" style="position: absolute; right: 20px; top: 20px; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">×</button>
                    </div>
                    <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
                        <div class="replay-summary" style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                            <div class="summary-card" style="background: var(--bg-glass); padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
                                <div style="font-size: 24px; font-weight: bold; color: var(--primary);">${details.screens?.length || 0}</div>
                                <div style="color: var(--text-muted);">📸 Màn hình</div>
                            </div>
                            <div class="summary-card" style="background: var(--bg-glass); padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
                                <div style="font-size: 24px; font-weight: bold; color: var(--success);">${details.totalApiRequests || 0}</div>
                                <div style="color: var(--text-muted);">🔌 API Requests</div>
                            </div>
                            <div class="summary-card" style="background: var(--bg-glass); padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
                                <div style="font-size: 24px; font-weight: bold; color: var(--warning);">${details.sizeFormatted || "N/A"}</div>
                                <div style="color: var(--text-muted);">💾 Dung lượng</div>
                            </div>
                        </div>
                        
                        <div class="screens-list" style="display: flex; flex-direction: column; gap: 15px;">
                            <h4 style="margin: 0; color: var(--text-primary);">📸 Danh sách màn hình</h4>
                            ${details.screens
        ?.map(
          (screen, idx) => `
                                <div class="screen-item" style="background: var(--bg-glass); border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                                    <div class="screen-header" style="padding: 12px 16px; background: var(--bg-tertiary); display: flex; justify-content: space-between; align-items: center; cursor: pointer;" 
                                         onclick="this.parentElement.querySelector('.screen-content').classList.toggle('expanded')">
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="font-weight: 500;">#${idx + 1} ${screen.name}</span>
                                            <span style="color: var(--text-muted); font-size: 12px;">${screen.type || "page"}</span>
                                        </div>
                                        <div style="display: flex; gap: 8px; align-items: center;">
                                            <span style="color: var(--text-muted); font-size: 12px;">🔌 ${screen.apiCount || 0} APIs</span>
                                            <span style="font-size: 12px;">▼</span>
                                        </div>
                                    </div>
                                    <div class="screen-content" style="display: none; padding: 16px;">
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                            <div class="screenshot-container" style="background: #1a1a2e; border-radius: 8px; overflow: hidden;">
                                                ${screen.hasPreview
              ? `<iframe src="/storage/${encodeURIComponent(state.currentProject)}/sections/${encodeURIComponent(replayTimestamp)}/${encodeURIComponent(screen.path)}/screen.html"
                                                          style="width: 100%; height: 300px; border: none;"
                                                          sandbox="allow-same-origin"></iframe>`
              : '<div style="padding: 40px; text-align: center; color: var(--text-muted);">📄 Không có preview</div>'
            }
                                            </div>
                                            <div class="api-list" style="max-height: 300px; overflow-y: auto;">
                                                <h5 style="margin: 0 0 10px 0; color: var(--text-secondary);">🔌 API Requests</h5>
                                                ${screen.apis?.length > 0
              ? screen.apis
                .map(
                  (api) => `
                                                    <div class="api-item" style="padding: 8px 12px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 6px; font-family: monospace; font-size: 12px;">
                                                        <span style="color: ${api.method === "GET" ? "var(--success)" : api.method === "POST" ? "var(--warning)" : "var(--primary)"}; font-weight: bold;">${api.method}</span>
                                                        <span style="color: var(--text-primary); margin-left: 8px;">${api.path}</span>
                                                        <span style="color: ${api.status >= 200 && api.status < 300 ? "var(--success)" : "var(--danger)"}; margin-left: auto; float: right;">${api.status}</span>
                                                    </div>
                                                `,
                )
                .join("")
              : '<div style="color: var(--text-muted); padding: 10px;">Không có API requests</div>'
            }
                                            </div>
                                        </div>
                                        <div style="margin-top: 12px; color: var(--text-muted); font-size: 12px;">
                                            📂 ${screen.path}
                                        </div>
                                    </div>
                                </div>
                            `,
        )
        .join("") ||
      '<div style="color: var(--text-muted); text-align: center; padding: 40px;">Không có màn hình nào</div>'
      }
                        </div>
                    </div>
                </div>
            </div>
        `;

    // Remove existing modal if any
    document.getElementById("replayDetailsModal")?.remove();

    console.log("Adding modal to body, HTML length:", modalHtml.length);

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    console.log(
      "Modal added, checking if exists:",
      !!document.getElementById("replayDetailsModal"),
    );

    // Add CSS for expanded state
    const style = document.createElement("style");
    style.id = "replay-details-style";
    style.textContent = `
            .screen-content.expanded { display: block !important; }
            .replay-details-modal .screen-item:hover { border-color: var(--primary); }
        `;
    if (!document.getElementById("replay-details-style")) {
      document.head.appendChild(style);
    }

    showToast("✅ Modal đã được tạo", "success");
  } catch (error) {
    console.error("viewReplayDetails error:", error);
    showToast("Có lỗi khi tải chi tiết replay", "error");
  }
}

// View Screen Details - Show details for a single screen
async function viewScreenDetails(sectionTimestamp, screenId) {
  if (!state.currentProject) {
    console.error("No current project");
    return;
  }

  try {
    // Load screen data
    const screenPath = `/storage/${encodeURIComponent(state.currentProject)}/sections/${encodeURIComponent(sectionTimestamp)}/${encodeURIComponent(screenId)}`;

    // Load meta.json (capture saves as meta.json, not screen.json)
    const screenJsonResponse = await fetch(`${screenPath}/meta.json`);
    if (!screenJsonResponse.ok) throw new Error('meta.json not found');
    const screenData = await screenJsonResponse.json();

    // Load apis.json
    let apis = [];
    try {
      const apisResponse = await fetch(`${screenPath}/apis.json`);
      if (apisResponse.ok) {
        const data = await apisResponse.json();
        // Handle both flat array format and nested {requests: []} format
        apis = Array.isArray(data) ? data : (data.requests || []);
      }
    } catch (e) {
      console.log("No APIs for this screen");
    }

    // Load actions.json
    let actions = [];
    try {
      const actionsResponse = await fetch(`${screenPath}/actions.json`);
      if (actionsResponse.ok) {
        const data = await actionsResponse.json();
        // Handle both flat array format and nested {actions: []} format
        actions = Array.isArray(data) ? data : (data.actions || []);
      }
    } catch (e) {
      console.log("No actions for this screen");
    }

    // Create modal
    const modalHtml = `
            <div class="modal-overlay" id="screenDetailsModal" style="display: flex !important; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000;">
                <div class="modal-content" style="max-width: 1400px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; background: var(--bg-secondary); border-radius: 12px; width: 90%;">
                    <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border-color); position: relative;">
                        <h3 style="margin: 0;">📱 ${screenData.name || screenId}</h3>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${screenData.url || ""}</div>
                        <button class="close-modal" onclick="document.getElementById('screenDetailsModal').remove()" style="position: absolute; right: 20px; top: 20px; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">×</button>
                    </div>
                    <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="screen-preview">
                            <h4 style="margin: 0 0 12px 0;">� Preview</h4>
                            <div style="background: #1a1a2e; border-radius: 8px; overflow: hidden;">
                                <iframe src="${screenPath}/screen.html"
                                     style="width: 100%; height: 400px; border: none;"
                                     sandbox="allow-same-origin"
                                     onerror="this.parentElement.innerHTML='<div style=\\'padding: 60px; text-align: center; color: var(--text-muted);\\'>📄 Không có preview</div>'"
                                ></iframe>
                            </div>
                        </div>
                        <div class="screen-data">
                            <div style="margin-bottom: 20px;">
                                <h4 style="margin: 0 0 12px 0;">🎯 Hành động (${actions.length})</h4>
                                <div style="max-height: 250px; overflow-y: auto; background: var(--bg-tertiary); border-radius: 8px; padding: 12px;">
                                    ${actions.length > 0
        ? actions
          .map(
            (action, idx) => `
                                        <div style="padding: 8px; background: var(--bg-glass); border-radius: 4px; margin-bottom: 6px; font-size: 12px;">
                                            <div style="color: var(--primary); font-weight: bold;">#${idx + 1} ${action.type}</div>
                                            ${action.selector ? `<div style="color: var(--text-muted); font-family: monospace;">${action.selector}</div>` : ""}
                                            ${action.value ? `<div style="color: var(--text-secondary);">→ "${action.value}"</div>` : ""}
                                        </div>
                                    `,
          )
          .join("")
        : '<div style="color: var(--text-muted); padding: 20px; text-align: center;">Không có hành động</div>'
      }
                                </div>
                            </div>
                            <div>
                                <h4 style="margin: 0 0 12px 0;">🔌 API Requests (${apis.length})</h4>
                                <div style="max-height: 300px; overflow-y: auto; background: var(--bg-tertiary); border-radius: 8px; padding: 12px;">
                                    ${apis.length > 0
        ? apis
          .map(
            (api) => `
                                        <div style="padding: 8px; background: var(--bg-glass); border-radius: 4px; margin-bottom: 6px; font-size: 12px; font-family: monospace;">
                                            <div>
                                                <span style="color: ${api.method === "GET" ? "var(--success)" : api.method === "POST" ? "var(--warning)" : "var(--primary)"}; font-weight: bold;">${api.method}</span>
                                                <span style="color: var(--text-primary); margin-left: 8px;">${api.url}</span>
                                                <span style="color: ${api.status >= 200 && api.status < 300 ? "var(--success)" : "var(--danger)"}; margin-left: auto; float: right;">${api.status}</span>
                                            </div>
                                        </div>
                                    `,
          )
          .join("")
        : '<div style="color: var(--text-muted); padding: 20px; text-align: center;">Không có API requests</div>'
      }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    // Remove existing modal if any
    document.getElementById("screenDetailsModal")?.remove();

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  } catch (error) {
    console.error("viewScreenDetails error:", error);
    showToast("Có lỗi khi tải chi tiết màn hình", "error");
  }
}

// Load Screen Preview in Workspace
function loadScreenPreview(sectionTimestamp, screenId, screenName) {
  if (!state.currentProject) return;

  const screenPath = `/storage/${encodeURIComponent(state.currentProject)}/sections/${encodeURIComponent(sectionTimestamp)}/${encodeURIComponent(screenId)}`;

  // Switch to Preview tab
  switchTab("preview");

  // Render into previewContent (inside previewTab)
  const previewContent = document.getElementById('previewContent');
  previewContent.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; background: var(--bg-secondary);">
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 16px; font-weight: 500;">📱 ${screenName}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${sectionTimestamp}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="viewScreenDetails('${sectionTimestamp}', '${screenId}')" class="btn btn-sm btn-secondary">
                        📊 Chi tiết
                    </button>
                    <button onclick="window.open('${screenPath}/screen.html', '_blank')" class="btn btn-sm btn-secondary">
                        🌐 Mở tab mới
                    </button>
                </div>
            </div>
            <div style="flex: 1; position: relative; background: #1a1a2e;">
                <iframe 
                    src="${screenPath}/screen.html" 
                    style="width: 100%; height: 100%; border: none;"
                    sandbox="allow-same-origin"
                ></iframe>
            </div>
        </div>
    `;
}

// Expose functions to window for inline onclick handlers
window.runSectionTest = runSectionTest;
window.showReplayOptionsModal = showReplayOptionsModal;
// ========================================
// Share
// ========================================

let shareNetworkInfo = null;

async function openShareModal() {
  if (!state.currentProject) {
    showToast("Vui long chon project truoc", "warning");
    return;
  }

  // Load network info
  const wifiEl = document.getElementById("shareWifiName");
  const ipEl = document.getElementById("shareIpList");

  try {
    if (!shareNetworkInfo) {
      const resp = await api.fetch("/api/share/network");
      shareNetworkInfo = resp;
    }
    wifiEl.textContent = shareNetworkInfo.ssid || "Khong xac dinh";
    if (shareNetworkInfo.addresses && shareNetworkInfo.addresses.length > 0) {
      ipEl.textContent = shareNetworkInfo.addresses[0].ip + ":" + shareNetworkInfo.port;
    } else {
      ipEl.textContent = "--";
    }
  } catch (e) {
    wifiEl.textContent = "--";
    ipEl.textContent = "--";
  }

  // Build checkbox list: Main + all sections
  const listEl = document.getElementById("shareItemList");
  let html = "";

  // Main item
  html += `<label style="display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: pointer; gap: 10px;">
    <input type="checkbox" class="share-item-cb" value="main" style="width: 16px; height: 16px;">
    <div style="flex: 1;">
      <div style="font-weight: 600; font-size: 13px;">Main Data</div>
      <div style="font-size: 11px; color: var(--text-muted);">Du lieu chinh cua project</div>
    </div>
  </label>`;

  // Sections
  if (state.sections && state.sections.length > 0) {
    state.sections.forEach((s) => {
      const screenCount = s.screenCount || 0;
      const apiCount = s.apiCount || 0;
      html += `<label style="display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: pointer; gap: 10px;">
        <input type="checkbox" class="share-item-cb" value="section:${s.timestamp}" style="width: 16px; height: 16px;">
        <div style="flex: 1;">
          <div style="font-size: 13px;">${s.timestamp}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${screenCount} screens, ${apiCount} APIs</div>
        </div>
      </label>`;
    });
  }

  listEl.innerHTML = html || '<div style="padding: 12px; color: var(--text-muted);">Khong co du lieu</div>';

  // Reset links area
  document.getElementById("shareLinkArea").style.display = "none";
  document.getElementById("shareLinksContainer").innerHTML = "";

  openModal(elements.shareModal);
}

async function createShare() {
  const checkboxes = document.querySelectorAll(".share-item-cb:checked");
  if (checkboxes.length === 0) {
    showToast("Vui long chon it nhat 1 muc de share", "warning");
    return;
  }

  const linksContainer = document.getElementById("shareLinksContainer");
  linksContainer.innerHTML = "";
  let linksHtml = "";

  try {
    for (const cb of checkboxes) {
      const val = cb.value;
      let type = "main";
      let sectionId = null;
      let label = "Main Data";

      if (val.startsWith("section:")) {
        type = "section";
        sectionId = val.replace("section:", "");
        label = sectionId;
      }

      const result = await api.fetch("/api/share/create", {
        method: "POST",
        body: JSON.stringify({
          projectName: state.currentProject,
          type,
          sectionId,
        }),
      });

      if (result.token && shareNetworkInfo) {
        const ip = shareNetworkInfo.addresses && shareNetworkInfo.addresses.length > 0
          ? shareNetworkInfo.addresses[0].ip
          : "localhost";
        const url = `http://${ip}:${shareNetworkInfo.port}/share/${result.token}`;

        linksHtml += `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <input type="text" value="${url}" readonly class="text-input" style="flex: 1; font-size: 12px; padding: 4px 8px;">
          <button class="btn btn-secondary btn-xs" onclick="navigator.clipboard.writeText('${url}'); showToast('Da copy!', 'success');">Copy</button>
          <span style="font-size: 11px; color: var(--text-muted); min-width: 60px;">${label.length > 15 ? label.substring(0, 15) + '...' : label}</span>
        </div>`;
      }
    }

    linksContainer.innerHTML = linksHtml;
    document.getElementById("shareLinkArea").style.display = "block";
    showToast(`Da share ${checkboxes.length} muc`, "success");
  } catch (e) {
    showToast("Loi tao share: " + e.message, "error");
  }
}

// ========================================
// Import
// ========================================

let currentImportTab = "link";

function openImportModal() {
  if (!state.currentProject) {
    showToast("Vui long chon project truoc", "warning");
    return;
  }
  document.getElementById("importProgress").style.display = "none";
  document.getElementById("importShareUrl").value = "";
  document.getElementById("importFileInput").value = "";
  document.getElementById("scanResults").innerHTML = "";
  switchImportTab("link");
  openModal(elements.importModal);
}

function switchImportTab(tab) {
  currentImportTab = tab;
  document.querySelectorAll(".import-tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("active", isActive);
    btn.style.color = isActive ? "var(--text)" : "var(--text-muted)";
    btn.style.borderBottomColor = isActive ? "var(--primary)" : "transparent";
  });
  document.getElementById("importTabLink").style.display = tab === "link" ? "block" : "none";
  document.getElementById("importTabFile").style.display = tab === "file" ? "block" : "none";
  document.getElementById("importTabScan").style.display = tab === "scan" ? "block" : "none";
  document.getElementById("importTabGdrive").style.display = tab === "gdrive" ? "block" : "none";

  // Hide import button for scan and gdrive tabs (they have their own buttons)
  document.getElementById("confirmImportBtn").style.display = (tab === "scan" || tab === "gdrive") ? "none" : "inline-flex";

  // Load Drive status when switching to gdrive tab
  if (tab === "gdrive") {
    checkGDriveStatus();
  }
}

async function confirmImport() {
  const progressEl = document.getElementById("importProgress");
  const progressText = document.getElementById("importProgressText");
  progressEl.style.display = "block";

  try {
    if (currentImportTab === "link") {
      const url = document.getElementById("importShareUrl").value.trim();
      const targetType = document.getElementById("importTargetType").value;
      if (!url) {
        showToast("Vui long nhap share URL", "warning");
        progressEl.style.display = "none";
        return;
      }
      progressText.textContent = "Dang download va import tu may khac...";
      await api.fetch("/api/share/import/link", {
        method: "POST",
        body: JSON.stringify({
          projectName: state.currentProject,
          targetType,
          shareUrl: url,
        }),
      });
      progressText.textContent = "Import thanh cong!";
      showToast("Import thanh cong!", "success");
    } else if (currentImportTab === "file") {
      const fileInput = document.getElementById("importFileInput");
      const targetType = document.getElementById("importFileTargetType").value;
      if (!fileInput.files || fileInput.files.length === 0) {
        showToast("Vui long chon file ZIP", "warning");
        progressEl.style.display = "none";
        return;
      }
      progressText.textContent = "Dang upload va import...";
      const file = fileInput.files[0];
      const resp = await fetch(
        `/api/share/import/upload?projectName=${encodeURIComponent(state.currentProject)}&targetType=${encodeURIComponent(targetType)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        }
      );
      const result = await resp.json();
      if (!result.success) throw new Error(result.error || "Import failed");
      progressText.textContent = "Import thanh cong!";
      showToast("Import thanh cong!", "success");
    }

    // Refresh project data
    setTimeout(() => {
      closeModal(elements.importModal);
      selectProject(state.currentProject);
    }, 1000);
  } catch (e) {
    progressText.textContent = "Loi: " + e.message;
    showToast("Import loi: " + e.message, "error");
  }
}

async function scanNetwork() {
  const resultsEl = document.getElementById("scanResults");
  const btn = document.getElementById("scanNetworkBtn");
  btn.disabled = true;
  btn.textContent = "Dang tim kiem...";
  resultsEl.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">Dang quet mang noi bo, vui long doi...</div>';

  try {
    const resp = await api.fetch("/api/share/scan");
    btn.disabled = false;
    btn.textContent = "Tim kiem may trong mang...";

    if (!resp.instances || resp.instances.length === 0) {
      resultsEl.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; padding: 12px;">Khong tim thay may MAPIT nao trong mang.</div>';
      return;
    }

    let html = "";
    for (const inst of resp.instances) {
      html += `<div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border);">
        <div>
          <div style="font-weight: 500;">${inst.ip}:${inst.port}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${inst.ssid || ''}</div>
        </div>
        <button class="btn btn-primary btn-xs" onclick="browseRemoteShares('${inst.ip}', ${inst.port})">Xem shares</button>
      </div>`;
    }
    resultsEl.innerHTML = html;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Tim kiem may trong mang...";
    resultsEl.innerHTML = '<div style="color: var(--danger); font-size: 13px;">Loi: ' + e.message + '</div>';
  }
}

async function browseRemoteShares(ip, port) {
  const resultsEl = document.getElementById("scanResults");
  try {
    const resp = await api.fetch(`/api/share/remote-shares?host=${ip}:${port}`);
    if (!resp.shares || resp.shares.length === 0) {
      resultsEl.innerHTML = `<div style="padding: 12px;">
        <div style="margin-bottom: 8px;"><a href="#" onclick="scanNetwork(); return false;" style="color: var(--primary);">&#8592; Quay lai</a></div>
        <div style="color: var(--text-muted); font-size: 13px;">May ${ip} chua share du lieu nao.</div>
      </div>`;
      return;
    }

    let html = `<div style="padding: 8px 12px; border-bottom: 1px solid var(--border);">
      <a href="#" onclick="scanNetwork(); return false;" style="color: var(--primary); font-size: 12px;">&#8592; Quay lai</a>
      <span style="margin-left: 8px; font-size: 12px; color: var(--text-muted);">${ip}:${port}</span>
    </div>`;

    for (const share of resp.shares) {
      const shareUrl = `http://${ip}:${port}/share/${share.token}`;
      const label = share.type === "main" ? "Main" : share.sectionId || "Section";
      html += `<div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border);">
        <div>
          <div style="font-weight: 500;">${share.projectName} / ${label}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${share.type}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-primary btn-xs" onclick="importRemoteShare('${shareUrl}', 'section')">Import Section</button>
          <button class="btn btn-warning btn-xs" onclick="importRemoteShare('${shareUrl}', 'main')">Import Main</button>
        </div>
      </div>`;
    }
    resultsEl.innerHTML = html;
  } catch (e) {
    resultsEl.innerHTML = `<div style="padding: 12px; color: var(--danger);">Loi ket noi: ${e.message}</div>`;
  }
}

async function importRemoteShare(shareUrl, targetType) {
  if (!state.currentProject) {
    showToast("Vui long chon project truoc", "warning");
    return;
  }
  const progressEl = document.getElementById("importProgress");
  const progressText = document.getElementById("importProgressText");
  progressEl.style.display = "block";
  progressText.textContent = "Dang dong bo tu may khac...";

  try {
    await api.fetch("/api/share/import/link", {
      method: "POST",
      body: JSON.stringify({
        projectName: state.currentProject,
        targetType,
        shareUrl,
      }),
    });
    progressText.textContent = "Import thanh cong!";
    showToast("Dong bo thanh cong!", "success");
    setTimeout(() => {
      closeModal(elements.importModal);
      selectProject(state.currentProject);
    }, 1000);
  } catch (e) {
    progressText.textContent = "Loi: " + e.message;
    showToast("Import loi: " + e.message, "error");
  }
}

window.browseRemoteShares = browseRemoteShares;
window.importRemoteShare = importRemoteShare;

// ========================================
// Google Drive Integration
// ========================================

async function checkGDriveStatus() {
  const statusEl = document.getElementById("gdriveStatus");
  const authEl = document.getElementById("gdriveAuthSection");
  const connEl = document.getElementById("gdriveConnected");

  statusEl.textContent = "Dang kiem tra ket noi...";
  authEl.style.display = "none";
  connEl.style.display = "none";

  try {
    const resp = await api.fetch("/api/gdrive/status");
    if (!resp.configured) {
      statusEl.innerHTML = '<span style="color: var(--text-muted);">Google Drive chua duoc cau hinh. Lien he quan tri vien de thiet lap.</span>';
    } else if (!resp.authenticated) {
      statusEl.innerHTML = '<span style="color: var(--warning);">Chua ket noi.</span> Nhan nut ben duoi de dang nhap Google Drive.';
      authEl.style.display = "block";
    } else {
      statusEl.innerHTML = '<span style="color: var(--success);">Da ket noi</span>' + (resp.email ? ': ' + resp.email : '');
      connEl.style.display = "block";
      loadGDriveUploadOptions();
      listDriveFiles();
    }
  } catch (e) {
    statusEl.innerHTML = '<span style="color: var(--danger);">Loi: ' + e.message + '</span>';
  }
}

async function authGDrive() {
  try {
    const resp = await api.fetch("/api/gdrive/auth-url");
    if (resp.url) {
      window.open(resp.url, "_blank", "width=600,height=700");
      showToast("Dang cho xac thuc Google... Sau khi xac thuc xong, nhan 'Lam moi' hoac chuyen tab lai.", "info");
      // Poll for auth completion
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.fetch("/api/gdrive/status");
          if (status.authenticated) {
            clearInterval(pollInterval);
            checkGDriveStatus();
            showToast("Ket noi Google Drive thanh cong!", "success");
          }
        } catch (e) { }
      }, 3000);
      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);
    }
  } catch (e) {
    showToast("Loi: " + e.message, "error");
  }
}

function loadGDriveUploadOptions() {
  const optionsEl = document.getElementById("gdriveUploadOptions");
  if (!state.currentProject) {
    optionsEl.innerHTML = '<div style="font-size: 12px; color: var(--text-muted);">Chon project truoc</div>';
    return;
  }
  let html = '<label style="display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 12px; cursor: pointer;">';
  html += '<input type="checkbox" name="gdriveUpload" value="main"> Main Data</label>';

  if (state.sections && state.sections.length > 0) {
    state.sections.forEach((s) => {
      const label = s.timestamp || s.id || s;
      html += '<label style="display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 12px; cursor: pointer;">';
      html += '<input type="checkbox" name="gdriveUpload" value="section:' + label + '"> Section: ' + label + '</label>';
    });
  }
  optionsEl.innerHTML = html;
}

async function uploadToDrive() {
  const checked = document.querySelectorAll('input[name="gdriveUpload"]:checked');
  if (checked.length === 0) {
    showToast("Vui long chon du lieu de upload", "warning");
    return;
  }

  const progressEl = document.getElementById("importProgress");
  const progressText = document.getElementById("importProgressText");
  progressEl.style.display = "block";

  try {
    for (const cb of checked) {
      const val = cb.value;
      let type, sectionId;
      if (val === "main") {
        type = "main";
        progressText.textContent = "Dang upload Main Data len Drive...";
      } else if (val.startsWith("section:")) {
        type = "section";
        sectionId = val.substring(8);
        progressText.textContent = "Dang upload Section " + sectionId + " len Drive...";
      }
      await api.fetch("/api/gdrive/upload", {
        method: "POST",
        body: JSON.stringify({ projectName: state.currentProject, type, sectionId }),
      });
    }
    progressText.textContent = "Upload thanh cong!";
    showToast("Upload len Drive thanh cong!", "success");
    listDriveFiles();
  } catch (e) {
    progressText.textContent = "Loi upload: " + e.message;
    showToast("Loi: " + e.message, "error");
  }
}

async function listDriveFiles() {
  const listEl = document.getElementById("gdriveFileList");
  if (!state.currentProject) {
    listEl.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-muted);">Chon project truoc</div>';
    return;
  }
  listEl.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-muted);">Dang tai...</div>';

  try {
    const resp = await api.fetch("/api/gdrive/files/" + encodeURIComponent(state.currentProject));
    if (!resp.files || resp.files.length === 0) {
      listEl.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-muted);">Chua co file nao tren Drive</div>';
      return;
    }
    let html = "";
    resp.files.forEach((f) => {
      const size = f.size ? (f.size / 1024).toFixed(1) + " KB" : "";
      const date = f.modifiedTime ? new Date(f.modifiedTime).toLocaleString() : "";
      html += '<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 12px;">';
      html += '<div style="flex: 1; min-width: 0;">';
      html += '<div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + f.name + '</div>';
      html += '<div style="color: var(--text-muted); font-size: 11px;">' + size + (date ? " - " + date : "") + '</div>';
      html += '</div>';
      html += '<div style="display: flex; gap: 4px; flex-shrink: 0;">';
      html += '<button class="btn btn-primary btn-xs" onclick="importFromDriveFile(\'' + f.id + '\', \'section\')">Import</button>';
      html += '<a href="' + f.link + '" target="_blank" class="btn btn-secondary btn-xs">Xem</a>';
      html += '</div></div>';
    });
    listEl.innerHTML = html;
  } catch (e) {
    listEl.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--danger);">Loi: ' + e.message + '</div>';
  }
}

async function importFromDriveFile(fileId, targetType) {
  const progressEl = document.getElementById("importProgress");
  const progressText = document.getElementById("importProgressText");
  progressEl.style.display = "block";
  progressText.textContent = "Dang download va import tu Drive...";

  try {
    await api.fetch("/api/gdrive/download", {
      method: "POST",
      body: JSON.stringify({
        projectName: state.currentProject,
        fileId,
        targetType,
      }),
    });
    progressText.textContent = "Import thanh cong!";
    showToast("Import tu Drive thanh cong!", "success");
    setTimeout(() => {
      closeModal(elements.importModal);
      selectProject(state.currentProject);
    }, 1000);
  } catch (e) {
    progressText.textContent = "Loi: " + e.message;
    showToast("Loi: " + e.message, "error");
  }
}

async function importFromDriveLink() {
  const link = document.getElementById("gdriveLinkInput").value.trim();
  const targetType = document.getElementById("gdriveLinkTargetType").value;
  if (!link) {
    showToast("Vui long nhap Drive link", "warning");
    return;
  }

  const progressEl = document.getElementById("importProgress");
  const progressText = document.getElementById("importProgressText");
  progressEl.style.display = "block";
  progressText.textContent = "Dang download va import tu Drive link...";

  try {
    await api.fetch("/api/gdrive/import-link", {
      method: "POST",
      body: JSON.stringify({
        projectName: state.currentProject,
        targetType,
        driveLink: link,
      }),
    });
    progressText.textContent = "Import thanh cong!";
    showToast("Import tu Drive thanh cong!", "success");
    setTimeout(() => {
      closeModal(elements.importModal);
      selectProject(state.currentProject);
    }, 1000);
  } catch (e) {
    progressText.textContent = "Loi: " + e.message;
    showToast("Loi: " + e.message, "error");
  }
}

async function disconnectGDrive() {
  try {
    await api.fetch("/api/gdrive/disconnect", { method: "POST" });
    showToast("Da ngat ket noi Google Drive", "info");
    checkGDriveStatus();
  } catch (e) {
    showToast("Loi: " + e.message, "error");
  }
}

// Expose Drive functions globally
window.authGDrive = authGDrive;
window.uploadToDrive = uploadToDrive;
window.listDriveFiles = listDriveFiles;
window.importFromDriveFile = importFromDriveFile;
window.importFromDriveLink = importFromDriveLink;
window.disconnectGDrive = disconnectGDrive;

window.compareSection = compareSection;
window.deleteReplaySection = deleteReplaySection;
window.deleteSection = deleteSection;
window.openMergeModal = openMergeModal;
window.compareHistory = compareHistory;
window.viewScreenDetails = viewScreenDetails;
window.loadScreenPreview = loadScreenPreview;
window.openCredentialsModal = function () {
  showToast('Tính năng cấu hình Login đang phát triển', 'info');
};
