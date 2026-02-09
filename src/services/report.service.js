/**
 * Report Service
 *
 * Generates comprehensive reports for MAPI Testing Tool
 *
 * Features:
 * - HTML report generation with charts
 * - PDF export using Puppeteer
 * - Multiple report types (comparison, test run, project health)
 * - Customizable templates
 * - Auto-cleanup of old reports (30 days)
 *
 * Report Types:
 * 1. Comparison Report: Side-by-side diff between sections
 * 2. Test Run Report: Pass/fail summary for a section
 * 3. Project Health Report: Trends over time
 */

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const storageService = require('./storage.service');
const compareService = require('./compare.service');

class ReportService {
    constructor() {
        this.REPORT_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    }

    /**
     * Get reports directory for a project
     */
    getReportsPath(projectName) {
        return path.join(storageService.getProjectPath(projectName), '.reports');
    }

    /**
     * Get reports metadata file path
     */
    getReportsMetaPath(projectName) {
        return path.join(this.getReportsPath(projectName), 'reports.json');
    }

    /**
     * List all reports for a project
     */
    async listReports(projectName) {
        const metaPath = this.getReportsMetaPath(projectName);
        if (!await fs.pathExists(metaPath)) {
            return [];
        }

        const reports = await fs.readJson(metaPath);

        // Sort by creation date (newest first)
        reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return reports;
    }

    /**
     * Generate a report based on type
     */
    async generateReport(projectName, options) {
        const { type, section1, section2, format = 'html', includeScreenshots = true, includeCharts = true } = options;

        // Validate inputs
        if (!['comparison', 'test-run', 'project-health'].includes(type)) {
            throw new Error(`Invalid report type: ${type}`);
        }

        if (!['html', 'pdf'].includes(format)) {
            throw new Error(`Invalid format: ${format}`);
        }

        // Generate report based on type
        let reportData;
        switch (type) {
            case 'comparison':
                reportData = await this.generateComparisonReport(projectName, section1, section2, options);
                break;
            case 'test-run':
                reportData = await this.generateTestRunReport(projectName, section2 || section1, options);
                break;
            case 'project-health':
                reportData = await this.generateProjectHealthReport(projectName, options);
                break;
        }

        // Create HTML report
        const htmlContent = this.buildHTMLReport(reportData, options);

        // Save to storage
        const reportId = uuidv4();
        const reportsDir = this.getReportsPath(projectName);
        await fs.ensureDir(reportsDir);

        const htmlPath = path.join(reportsDir, `report-${reportId}.html`);
        await fs.writeFile(htmlPath, htmlContent, 'utf-8');

        // Generate PDF if requested
        let pdfPath = null;
        if (format === 'pdf') {
            pdfPath = path.join(reportsDir, `report-${reportId}.pdf`);
            await this.generatePDF(htmlContent, pdfPath);
        }

        // Save metadata
        const metadata = {
            id: reportId,
            type,
            format,
            section1,
            section2,
            createdAt: new Date().toISOString(),
            htmlFile: `report-${reportId}.html`,
            pdfFile: pdfPath ? `report-${reportId}.pdf` : null,
            options
        };

        await this.saveReportMetadata(projectName, metadata);

        // Cleanup old reports
        await this.cleanupOldReports(projectName);

        return {
            reportId,
            htmlPath,
            pdfPath,
            metadata
        };
    }

    /**
     * Generate comparison report data
     */
    async generateComparisonReport(projectName, section1, section2, options) {
        const comparisonResult = await compareService.compareSections(projectName, section1, section2);

        // Build report data structure
        const reportData = {
            title: 'Comparison Report',
            projectName,
            section1,
            section2,
            generatedAt: new Date().toISOString(),
            summary: {
                total1: comparisonResult.summary.total1,
                total2: comparisonResult.summary.total2,
                matched: comparisonResult.summary.matched,
                added: comparisonResult.summary.added,
                removed: comparisonResult.summary.removed,
                changed: comparisonResult.summary.changed,
                unchanged: comparisonResult.summary.unchanged,
                passRate: comparisonResult.summary.total2 > 0
                    ? ((comparisonResult.summary.unchanged / comparisonResult.summary.total2) * 100).toFixed(2)
                    : 0
            },
            items: comparisonResult.items.map(item => ({
                status: item.status,
                path: item.path,
                name: item.name,
                hasChanges: item.diff?.hasChanges || false,
                uiChanged: item.diff?.uiChanged || false,
                apiChanged: item.diff?.apiChanged || false,
                changeDetails: item.diff?.changeDetails || []
            })),
            charts: options.includeCharts ? this.buildComparisonCharts(comparisonResult) : null
        };

        return reportData;
    }

    /**
     * Generate test run report data
     */
    async generateTestRunReport(projectName, sectionTimestamp, options) {
        const sectionDetails = await storageService.getSectionDetails(projectName, sectionTimestamp);

        // Compare against main if it exists
        let comparisonResult = null;
        try {
            comparisonResult = await compareService.compareAgainstMain(projectName, sectionTimestamp);
        } catch (e) {
            console.log('[ReportService] No main section to compare against');
        }

        const reportData = {
            title: 'Test Run Report',
            projectName,
            sectionTimestamp,
            generatedAt: new Date().toISOString(),
            summary: {
                totalScreens: sectionDetails.screens.length,
                totalAPIs: sectionDetails.totalApiRequests,
                size: sectionDetails.sizeFormatted,
                passRate: comparisonResult ?
                    ((comparisonResult.summary.unchanged / comparisonResult.summary.total2) * 100).toFixed(2) :
                    'N/A'
            },
            screens: sectionDetails.screens.map(screen => ({
                name: screen.name,
                path: screen.path,
                type: screen.type,
                url: screen.url,
                apiCount: screen.apiCount,
                actionsCount: screen.actionsCount,
                hasPreview: screen.hasPreview
            })),
            comparison: comparisonResult ? {
                matched: comparisonResult.summary.matched,
                added: comparisonResult.summary.added,
                removed: comparisonResult.summary.removed,
                changed: comparisonResult.summary.changed,
                unchanged: comparisonResult.summary.unchanged
            } : null,
            charts: options.includeCharts ? this.buildTestRunCharts(sectionDetails, comparisonResult) : null
        };

        return reportData;
    }

    /**
     * Generate project health report data
     */
    async generateProjectHealthReport(projectName, options) {
        const sections = await storageService.listSections(projectName);

        // Calculate metrics over time
        const trends = sections.slice(0, 30).reverse().map(section => ({
            timestamp: section.timestamp,
            screenCount: section.screenCount,
            apiCount: section.apiCount,
            size: section.size
        }));

        // Identify hot spots (most changed screens)
        const hotspots = await this.calculateHotspots(projectName, sections);

        const reportData = {
            title: 'Project Health Report',
            projectName,
            generatedAt: new Date().toISOString(),
            summary: {
                totalSections: sections.length,
                avgScreensPerSection: sections.length > 0
                    ? (sections.reduce((sum, s) => sum + s.screenCount, 0) / sections.length).toFixed(1)
                    : 0,
                avgAPIsPerSection: sections.length > 0
                    ? (sections.reduce((sum, s) => sum + s.apiCount, 0) / sections.length).toFixed(1)
                    : 0,
                totalSize: sections.reduce((sum, s) => sum + s.size, 0),
                period: '30 days'
            },
            trends,
            hotspots,
            charts: options.includeCharts ? this.buildProjectHealthCharts(trends, hotspots) : null
        };

        return reportData;
    }

    /**
     * Calculate hotspots (most changed screens across sections)
     */
    async calculateHotspots(projectName, sections) {
        const screenChangeCount = new Map();

        // Compare recent sections
        for (let i = 0; i < Math.min(10, sections.length - 1); i++) {
            const section1 = sections[i];
            const section2 = sections[i + 1];

            try {
                const comparison = await compareService.compareSections(
                    projectName,
                    section1.timestamp,
                    section2.timestamp
                );

                // Count changes per screen
                comparison.items.forEach(item => {
                    if (item.status === 'changed') {
                        const count = screenChangeCount.get(item.path) || 0;
                        screenChangeCount.set(item.path, count + 1);
                    }
                });
            } catch (e) {
                console.error(`[ReportService] Error comparing sections for hotspots: ${e.message}`);
            }
        }

        // Sort and return top 10
        const hotspots = Array.from(screenChangeCount.entries())
            .map(([screen, changes]) => ({ screen, changes }))
            .sort((a, b) => b.changes - a.changes)
            .slice(0, 10);

        return hotspots;
    }

    /**
     * Build chart data for comparison report
     */
    buildComparisonCharts(comparisonResult) {
        return {
            summaryChart: {
                type: 'pie',
                data: {
                    labels: ['Unchanged', 'Changed', 'Added', 'Removed'],
                    datasets: [{
                        data: [
                            comparisonResult.summary.unchanged,
                            comparisonResult.summary.changed,
                            comparisonResult.summary.added,
                            comparisonResult.summary.removed
                        ],
                        backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444']
                    }]
                }
            }
        };
    }

    /**
     * Build chart data for test run report
     */
    buildTestRunCharts(sectionDetails, comparisonResult) {
        const charts = {
            screensChart: {
                type: 'bar',
                data: {
                    labels: sectionDetails.screens.map(s => s.name),
                    datasets: [{
                        label: 'API Calls',
                        data: sectionDetails.screens.map(s => s.apiCount),
                        backgroundColor: '#3b82f6'
                    }, {
                        label: 'Actions',
                        data: sectionDetails.screens.map(s => s.actionsCount),
                        backgroundColor: '#10b981'
                    }]
                }
            }
        };

        if (comparisonResult) {
            charts.comparisonChart = {
                type: 'doughnut',
                data: {
                    labels: ['Unchanged', 'Changed'],
                    datasets: [{
                        data: [comparisonResult.summary.unchanged, comparisonResult.summary.changed],
                        backgroundColor: ['#10b981', '#f59e0b']
                    }]
                }
            };
        }

        return charts;
    }

    /**
     * Build chart data for project health report
     */
    buildProjectHealthCharts(trends, hotspots) {
        return {
            trendsChart: {
                type: 'line',
                data: {
                    labels: trends.map(t => new Date(t.timestamp).toLocaleDateString()),
                    datasets: [{
                        label: 'Screens',
                        data: trends.map(t => t.screenCount),
                        borderColor: '#3b82f6',
                        fill: false
                    }, {
                        label: 'APIs',
                        data: trends.map(t => t.apiCount),
                        borderColor: '#10b981',
                        fill: false
                    }]
                }
            },
            hotspotsChart: {
                type: 'bar',
                data: {
                    labels: hotspots.map(h => h.screen),
                    datasets: [{
                        label: 'Changes',
                        data: hotspots.map(h => h.changes),
                        backgroundColor: '#f59e0b'
                    }]
                }
            }
        };
    }

    /**
     * Build HTML report from report data
     */
    buildHTMLReport(reportData, options) {
        const chartsHTML = reportData.charts ? this.buildChartsHTML(reportData.charts) : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportData.title} - ${reportData.projectName}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #1f2937; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        header { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #111827; }
        .subtitle { color: #6b7280; font-size: 0.875rem; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-label { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem; }
        .stat-value { font-size: 2rem; font-weight: bold; color: #111827; }
        .stat-unit { font-size: 1rem; color: #6b7280; margin-left: 0.25rem; }
        .section { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .section-title { font-size: 1.5rem; margin-bottom: 1rem; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; color: #374151; }
        .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .status-unchanged { background: #d1fae5; color: #065f46; }
        .status-changed { background: #fef3c7; color: #92400e; }
        .status-added { background: #dbeafe; color: #1e40af; }
        .status-removed { background: #fee2e2; color: #991b1b; }
        .chart-container { position: relative; height: 300px; margin: 1rem 0; }
        footer { text-align: center; color: #6b7280; font-size: 0.875rem; margin-top: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${reportData.title}</h1>
            <div class="subtitle">
                Project: ${reportData.projectName} |
                Generated: ${new Date(reportData.generatedAt).toLocaleString()}
            </div>
        </header>

        <div class="summary">
            ${this.buildSummaryCards(reportData)}
        </div>

        ${chartsHTML}

        <div class="section">
            <h2 class="section-title">Details</h2>
            ${this.buildDetailsTable(reportData)}
        </div>

        <footer>
            Generated by MAPI Testing Tool - ${new Date(reportData.generatedAt).toLocaleString()}
        </footer>
    </div>

    ${reportData.charts ? this.buildChartsScript(reportData.charts) : ''}
</body>
</html>`;
    }

    /**
     * Build summary cards HTML
     */
    buildSummaryCards(reportData) {
        const cards = [];

        if (reportData.summary.total1 !== undefined) {
            cards.push(`<div class="stat-card"><div class="stat-label">Section 1 Screens</div><div class="stat-value">${reportData.summary.total1}</div></div>`);
            cards.push(`<div class="stat-card"><div class="stat-label">Section 2 Screens</div><div class="stat-value">${reportData.summary.total2}</div></div>`);
        }

        if (reportData.summary.totalScreens !== undefined) {
            cards.push(`<div class="stat-card"><div class="stat-label">Total Screens</div><div class="stat-value">${reportData.summary.totalScreens}</div></div>`);
        }

        if (reportData.summary.totalAPIs !== undefined) {
            cards.push(`<div class="stat-card"><div class="stat-label">Total API Calls</div><div class="stat-value">${reportData.summary.totalAPIs}</div></div>`);
        }

        if (reportData.summary.changed !== undefined) {
            cards.push(`<div class="stat-card"><div class="stat-label">Changed</div><div class="stat-value">${reportData.summary.changed}</div></div>`);
        }

        if (reportData.summary.passRate !== undefined) {
            cards.push(`<div class="stat-card"><div class="stat-label">Pass Rate</div><div class="stat-value">${reportData.summary.passRate}<span class="stat-unit">%</span></div></div>`);
        }

        return cards.join('');
    }

    /**
     * Build details table HTML
     */
    buildDetailsTable(reportData) {
        if (reportData.items) {
            // Comparison report
            return `<table>
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Screen</th>
                        <th>Path</th>
                        <th>Changes</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.items.map(item => `
                        <tr>
                            <td><span class="status-badge status-${item.status}">${item.status.toUpperCase()}</span></td>
                            <td>${item.name}</td>
                            <td>${item.path}</td>
                            <td>${item.changeDetails.join(', ') || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        } else if (reportData.screens) {
            // Test run report
            return `<table>
                <thead>
                    <tr>
                        <th>Screen</th>
                        <th>Type</th>
                        <th>API Calls</th>
                        <th>Actions</th>
                        <th>Preview</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.screens.map(screen => `
                        <tr>
                            <td>${screen.name}</td>
                            <td>${screen.type}</td>
                            <td>${screen.apiCount}</td>
                            <td>${screen.actionsCount}</td>
                            <td>${screen.hasPreview ? 'Yes' : 'No'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        } else if (reportData.hotspots) {
            // Project health report
            return `<table>
                <thead>
                    <tr>
                        <th>Screen</th>
                        <th>Change Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.hotspots.map(hotspot => `
                        <tr>
                            <td>${hotspot.screen}</td>
                            <td>${hotspot.changes}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        }

        return '<p>No details available</p>';
    }

    /**
     * Build charts HTML containers
     */
    buildChartsHTML(charts) {
        const chartContainers = Object.keys(charts).map(key =>
            `<div class="section">
                <h2 class="section-title">${this.chartTitleFromKey(key)}</h2>
                <div class="chart-container">
                    <canvas id="${key}"></canvas>
                </div>
            </div>`
        ).join('');

        return chartContainers;
    }

    /**
     * Build charts initialization script
     */
    buildChartsScript(charts) {
        const scripts = Object.entries(charts).map(([key, config]) => {
            return `
                new Chart(document.getElementById('${key}'), {
                    type: '${config.type}',
                    data: ${JSON.stringify(config.data)},
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            `;
        }).join('\n');

        return `<script>${scripts}</script>`;
    }

    /**
     * Convert chart key to readable title
     */
    chartTitleFromKey(key) {
        const titles = {
            summaryChart: 'Comparison Summary',
            screensChart: 'Screen Activity',
            comparisonChart: 'Test Results',
            trendsChart: 'Trends Over Time',
            hotspotsChart: 'Most Changed Screens'
        };
        return titles[key] || key;
    }

    /**
     * Generate PDF from HTML using Playwright
     */
    async generatePDF(htmlContent, outputPath) {
        const { chromium } = require('playwright-core');

        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle' });

            await page.pdf({
                path: outputPath,
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '10mm',
                    bottom: '20mm',
                    left: '10mm'
                }
            });
        } finally {
            await browser.close();
        }
    }

    /**
     * Save report metadata
     */
    async saveReportMetadata(projectName, metadata) {
        const metaPath = this.getReportsMetaPath(projectName);

        let reports = [];
        if (await fs.pathExists(metaPath)) {
            reports = await fs.readJson(metaPath);
        }

        reports.push(metadata);
        await fs.writeJson(metaPath, reports, { spaces: 2 });
    }

    /**
     * Delete a report
     */
    async deleteReport(projectName, reportId) {
        const metaPath = this.getReportsMetaPath(projectName);

        if (!await fs.pathExists(metaPath)) {
            throw new Error('No reports found');
        }

        let reports = await fs.readJson(metaPath);
        const report = reports.find(r => r.id === reportId);

        if (!report) {
            throw new Error(`Report ${reportId} not found`);
        }

        // Delete files
        const reportsDir = this.getReportsPath(projectName);
        if (report.htmlFile) {
            await fs.remove(path.join(reportsDir, report.htmlFile));
        }
        if (report.pdfFile) {
            await fs.remove(path.join(reportsDir, report.pdfFile));
        }

        // Update metadata
        reports = reports.filter(r => r.id !== reportId);
        await fs.writeJson(metaPath, reports, { spaces: 2 });

        return { deleted: reportId };
    }

    /**
     * Download a report file
     */
    async getReportFile(projectName, reportId) {
        const metaPath = this.getReportsMetaPath(projectName);

        if (!await fs.pathExists(metaPath)) {
            throw new Error('No reports found');
        }

        const reports = await fs.readJson(metaPath);
        const report = reports.find(r => r.id === reportId);

        if (!report) {
            throw new Error(`Report ${reportId} not found`);
        }

        const reportsDir = this.getReportsPath(projectName);
        const htmlPath = path.join(reportsDir, report.htmlFile);

        if (!await fs.pathExists(htmlPath)) {
            throw new Error('Report file not found');
        }

        return {
            filePath: htmlPath,
            pdfPath: report.pdfFile ? path.join(reportsDir, report.pdfFile) : null,
            metadata: report
        };
    }

    /**
     * Cleanup old reports (older than 30 days)
     */
    async cleanupOldReports(projectName) {
        const metaPath = this.getReportsMetaPath(projectName);

        if (!await fs.pathExists(metaPath)) {
            return { deleted: 0 };
        }

        let reports = await fs.readJson(metaPath);
        const now = Date.now();
        const reportsDir = this.getReportsPath(projectName);

        let deletedCount = 0;

        const newReports = [];
        for (const report of reports) {
            const age = now - new Date(report.createdAt).getTime();

            if (age > this.REPORT_MAX_AGE) {
                // Delete files
                if (report.htmlFile) {
                    await fs.remove(path.join(reportsDir, report.htmlFile)).catch(() => {});
                }
                if (report.pdfFile) {
                    await fs.remove(path.join(reportsDir, report.pdfFile)).catch(() => {});
                }
                deletedCount++;
            } else {
                newReports.push(report);
            }
        }

        if (deletedCount > 0) {
            await fs.writeJson(metaPath, newReports, { spaces: 2 });
        }

        return { deleted: deletedCount };
    }
}

module.exports = new ReportService();
