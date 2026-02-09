/**
 * Test Runner Service
 *
 * Automated testing service for comparing section data against main/baseline
 * Calculates similarity scores (DOM, API, Visual) and generates test reports
 *
 * Features:
 * - Run automated comparison tests
 * - Calculate similarity scores with configurable thresholds
 * - Track test history
 * - Generate pass/fail results
 * - Store test results in database (JSON files)
 *
 * Storage Structure:
 * storage/{project}/.system/test-runs/
 *   ├── {testId}.json         # Individual test result
 *   └── index.json            # Test history index
 *
 * @module services/test-runner
 */

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const storageService = require('./storage.service');
const compareService = require('./compare.service');

/**
 * Default similarity thresholds for test pass/fail
 * @constant {Object}
 */
const DEFAULT_THRESHOLDS = {
    dom: 95,      // 95% DOM similarity required
    api: 100,     // 100% API match required
    visual: 90    // 90% visual similarity required
};

/**
 * Test Runner Service Class
 *
 * Manages automated test execution and result tracking
 */
class TestRunnerService {
    /**
     * Initialize test runner service
     */
    constructor() {
        this.compareService = compareService;
    }

    /**
     * Get system directory path for a project
     *
     * @param {string} projectName - Project name
     * @returns {string} Absolute path to .system directory
     * @private
     */
    getSystemPath(projectName) {
        return path.join(storageService.getProjectPath(projectName), '.system');
    }

    /**
     * Get test runs directory path
     *
     * @param {string} projectName - Project name
     * @returns {string} Absolute path to test-runs directory
     * @private
     */
    getTestRunsPath(projectName) {
        return path.join(this.getSystemPath(projectName), 'test-runs');
    }

    /**
     * Get test index file path
     *
     * @param {string} projectName - Project name
     * @returns {string} Absolute path to index.json
     * @private
     */
    getIndexPath(projectName) {
        return path.join(this.getTestRunsPath(projectName), 'index.json');
    }

    /**
     * Get test result file path
     *
     * @param {string} projectName - Project name
     * @param {string} testId - Test run identifier
     * @returns {string} Absolute path to test result file
     * @private
     */
    getTestResultPath(projectName, testId) {
        return path.join(this.getTestRunsPath(projectName), `${testId}.json`);
    }

    /**
     * Run automated test comparing section vs main/baseline
     *
     * @param {Object} params - Test parameters
     * @param {string} params.projectName - Project name
     * @param {string} params.sectionTimestamp - Section timestamp to test
     * @param {string} [params.baselineTimestamp='main'] - Baseline to compare against
     * @param {Object} [params.threshold] - Custom thresholds
     * @param {number} [params.threshold.dom=95] - DOM similarity threshold
     * @param {number} [params.threshold.api=100] - API similarity threshold
     * @param {number} [params.threshold.visual=90] - Visual similarity threshold
     * @param {string} [params.testName] - Optional test name
     * @param {Object} [params.metadata] - Additional metadata
     * @returns {Promise<Object>} Test result with pass/fail status
     *
     * @example
     * const result = await testRunner.runTest({
     *   projectName: 'my-project',
     *   sectionTimestamp: '2026-02-08T10-00-00-000Z',
     *   threshold: { dom: 95, api: 100, visual: 90 }
     * });
     */
    async runTest(params) {
        const {
            projectName,
            sectionTimestamp,
            baselineTimestamp = 'main',
            threshold = {},
            testName,
            metadata = {}
        } = params;

        // Validate inputs
        if (!projectName || !sectionTimestamp) {
            throw new Error('projectName and sectionTimestamp are required');
        }

        // Merge with default thresholds
        const finalThreshold = { ...DEFAULT_THRESHOLDS, ...threshold };

        // Generate test ID
        const testId = uuidv4();
        const startTime = Date.now();

        try {
            // Verify section exists
            const sectionPath = storageService.getSectionPath(projectName, sectionTimestamp);
            if (!await fs.pathExists(sectionPath)) {
                throw new Error(`Section "${sectionTimestamp}" does not exist`);
            }

            // Verify baseline exists
            let baselinePath;
            if (baselineTimestamp === 'main') {
                baselinePath = storageService.getMainPath(projectName);
            } else {
                baselinePath = storageService.getSectionPath(projectName, baselineTimestamp);
            }

            if (!await fs.pathExists(baselinePath)) {
                throw new Error(`Baseline "${baselineTimestamp}" does not exist`);
            }

            // Run comparison
            console.log(`[TestRunner] Starting test ${testId} for ${projectName}/${sectionTimestamp}`);
            const comparisonResult = await this.compareService.compareSections(
                projectName,
                baselineTimestamp,
                sectionTimestamp
            );

            // Calculate similarity scores
            const scores = this.calculateSimilarityScores(comparisonResult);

            // Determine pass/fail status
            const passed = this.evaluateTestResult(scores, finalThreshold);

            // Calculate execution time
            const executionTime = Date.now() - startTime;

            // Build test result
            const testResult = {
                testId,
                projectName,
                sectionTimestamp,
                baselineTimestamp,
                testName: testName || `Test ${sectionTimestamp}`,
                status: passed ? 'passed' : 'failed',
                createdAt: new Date().toISOString(),
                executionTime,
                threshold: finalThreshold,
                scores,
                summary: comparisonResult.summary,
                details: {
                    totalPages: comparisonResult.summary.total2,
                    matchedPages: comparisonResult.summary.matched,
                    changedPages: comparisonResult.summary.changed,
                    addedPages: comparisonResult.summary.added,
                    removedPages: comparisonResult.summary.removed,
                    unchangedPages: comparisonResult.summary.unchanged
                },
                failures: passed ? [] : this.collectFailures(scores, finalThreshold),
                metadata: {
                    ...metadata,
                    comparisonItemCount: comparisonResult.items.length
                }
            };

            // Save test result
            await this.saveTestResult(projectName, testResult);

            console.log(`[TestRunner] Test ${testId} ${passed ? 'PASSED' : 'FAILED'} (${executionTime}ms)`);

            return testResult;

        } catch (error) {
            console.error(`[TestRunner] Test ${testId} ERROR:`, error.message);

            // Save error result
            const errorResult = {
                testId,
                projectName,
                sectionTimestamp,
                baselineTimestamp,
                testName: testName || `Test ${sectionTimestamp}`,
                status: 'error',
                createdAt: new Date().toISOString(),
                executionTime: Date.now() - startTime,
                threshold: finalThreshold,
                error: {
                    message: error.message,
                    stack: error.stack
                },
                metadata
            };

            await this.saveTestResult(projectName, errorResult);

            throw error;
        }
    }

    /**
     * Calculate similarity scores from comparison result
     *
     * @param {Object} comparisonResult - Result from compareService
     * @returns {Object} Similarity scores
     * @private
     */
    calculateSimilarityScores(comparisonResult) {
        const { summary, items } = comparisonResult;

        // DOM similarity: based on matched/unchanged vs total
        let domScore = 0;
        if (summary.total2 > 0) {
            domScore = ((summary.matched + summary.unchanged) / summary.total2) * 100;
        }

        // API similarity: based on API match percentage
        let apiScore = 0;
        let totalApiComparisons = 0;
        let matchedApis = 0;

        items.forEach(item => {
            if (item.apiDiff) {
                totalApiComparisons++;
                if (item.apiDiff.similarityScore >= 100) {
                    matchedApis++;
                }
            }
        });

        if (totalApiComparisons > 0) {
            apiScore = (matchedApis / totalApiComparisons) * 100;
        } else {
            apiScore = 100; // No APIs = 100% match
        }

        // Visual similarity: based on DOM structure similarity
        let visualScore = 0;
        let totalVisualComparisons = 0;
        let visualSimilaritySum = 0;

        items.forEach(item => {
            if (item.domDiff && item.domDiff.similarityScore !== undefined) {
                totalVisualComparisons++;
                visualSimilaritySum += item.domDiff.similarityScore;
            }
        });

        if (totalVisualComparisons > 0) {
            visualScore = visualSimilaritySum / totalVisualComparisons;
        } else {
            visualScore = domScore; // Fallback to DOM score
        }

        return {
            dom: Math.round(domScore * 100) / 100,
            api: Math.round(apiScore * 100) / 100,
            visual: Math.round(visualScore * 100) / 100,
            overall: Math.round(((domScore + apiScore + visualScore) / 3) * 100) / 100
        };
    }

    /**
     * Evaluate if test passes based on scores and thresholds
     *
     * @param {Object} scores - Calculated similarity scores
     * @param {Object} threshold - Required thresholds
     * @returns {boolean} True if test passes all thresholds
     * @private
     */
    evaluateTestResult(scores, threshold) {
        return (
            scores.dom >= threshold.dom &&
            scores.api >= threshold.api &&
            scores.visual >= threshold.visual
        );
    }

    /**
     * Collect failure details when test fails
     *
     * @param {Object} scores - Calculated scores
     * @param {Object} threshold - Required thresholds
     * @returns {Array} Array of failure descriptions
     * @private
     */
    collectFailures(scores, threshold) {
        const failures = [];

        if (scores.dom < threshold.dom) {
            failures.push({
                metric: 'dom',
                expected: threshold.dom,
                actual: scores.dom,
                difference: threshold.dom - scores.dom,
                message: `DOM similarity ${scores.dom}% is below threshold ${threshold.dom}%`
            });
        }

        if (scores.api < threshold.api) {
            failures.push({
                metric: 'api',
                expected: threshold.api,
                actual: scores.api,
                difference: threshold.api - scores.api,
                message: `API similarity ${scores.api}% is below threshold ${threshold.api}%`
            });
        }

        if (scores.visual < threshold.visual) {
            failures.push({
                metric: 'visual',
                expected: threshold.visual,
                actual: scores.visual,
                difference: threshold.visual - scores.visual,
                message: `Visual similarity ${scores.visual}% is below threshold ${threshold.visual}%`
            });
        }

        return failures;
    }

    /**
     * Save test result to storage
     *
     * @param {string} projectName - Project name
     * @param {Object} testResult - Test result object
     * @returns {Promise<void>}
     * @private
     */
    async saveTestResult(projectName, testResult) {
        const testRunsPath = this.getTestRunsPath(projectName);
        await fs.ensureDir(testRunsPath);

        // Save individual test result
        const resultPath = this.getTestResultPath(projectName, testResult.testId);
        await fs.writeJson(resultPath, testResult, { spaces: 2 });

        // Update index (atomic operation)
        await this.updateTestIndex(projectName, {
            testId: testResult.testId,
            testName: testResult.testName,
            sectionTimestamp: testResult.sectionTimestamp,
            baselineTimestamp: testResult.baselineTimestamp,
            status: testResult.status,
            createdAt: testResult.createdAt,
            executionTime: testResult.executionTime,
            scores: testResult.scores
        });
    }

    /**
     * Update test index with new test entry
     *
     * @param {string} projectName - Project name
     * @param {Object} indexEntry - Test index entry
     * @returns {Promise<void>}
     * @private
     */
    async updateTestIndex(projectName, indexEntry) {
        const indexPath = this.getIndexPath(projectName);
        let index = { tests: [] };

        if (await fs.pathExists(indexPath)) {
            try {
                index = await fs.readJson(indexPath);
            } catch (e) {
                console.error('[TestRunner] Failed to read index, creating new one');
            }
        }

        // Add new entry at the beginning (newest first)
        index.tests.unshift(indexEntry);

        // Keep last 1000 entries
        if (index.tests.length > 1000) {
            index.tests = index.tests.slice(0, 1000);
        }

        // Update statistics
        index.lastUpdated = new Date().toISOString();
        index.totalTests = index.tests.length;
        index.passedTests = index.tests.filter(t => t.status === 'passed').length;
        index.failedTests = index.tests.filter(t => t.status === 'failed').length;
        index.errorTests = index.tests.filter(t => t.status === 'error').length;

        // Atomic write
        await fs.writeJson(indexPath, index, { spaces: 2 });
    }

    /**
     * Get test result by ID
     *
     * @param {string} projectName - Project name
     * @param {string} testId - Test ID
     * @returns {Promise<Object>} Test result object
     * @throws {Error} If test not found
     */
    async getTestResult(projectName, testId) {
        const resultPath = this.getTestResultPath(projectName, testId);

        if (!await fs.pathExists(resultPath)) {
            throw new Error(`Test result "${testId}" not found`);
        }

        return await fs.readJson(resultPath);
    }

    /**
     * Get test history for a project
     *
     * @param {string} projectName - Project name
     * @param {Object} [options] - Query options
     * @param {number} [options.limit=50] - Maximum number of results
     * @param {number} [options.offset=0] - Number of results to skip
     * @param {string} [options.status] - Filter by status (passed/failed/error)
     * @param {string} [options.sectionTimestamp] - Filter by section
     * @returns {Promise<Object>} Test history with pagination info
     */
    async getTestHistory(projectName, options = {}) {
        const {
            limit = 50,
            offset = 0,
            status,
            sectionTimestamp
        } = options;

        const indexPath = this.getIndexPath(projectName);

        if (!await fs.pathExists(indexPath)) {
            return {
                tests: [],
                total: 0,
                limit,
                offset,
                hasMore: false
            };
        }

        const index = await fs.readJson(indexPath);
        let tests = index.tests || [];

        // Apply filters
        if (status) {
            tests = tests.filter(t => t.status === status);
        }

        if (sectionTimestamp) {
            tests = tests.filter(t => t.sectionTimestamp === sectionTimestamp);
        }

        // Pagination
        const total = tests.length;
        const paginatedTests = tests.slice(offset, offset + limit);
        const hasMore = offset + limit < total;

        return {
            tests: paginatedTests,
            total,
            limit,
            offset,
            hasMore,
            statistics: {
                totalTests: index.totalTests || 0,
                passedTests: index.passedTests || 0,
                failedTests: index.failedTests || 0,
                errorTests: index.errorTests || 0,
                lastUpdated: index.lastUpdated
            }
        };
    }

    /**
     * Delete test result
     *
     * @param {string} projectName - Project name
     * @param {string} testId - Test ID to delete
     * @returns {Promise<Object>} Deletion confirmation
     */
    async deleteTestResult(projectName, testId) {
        const resultPath = this.getTestResultPath(projectName, testId);

        if (!await fs.pathExists(resultPath)) {
            throw new Error(`Test result "${testId}" not found`);
        }

        // Remove test file
        await fs.remove(resultPath);

        // Remove from index
        const indexPath = this.getIndexPath(projectName);
        if (await fs.pathExists(indexPath)) {
            const index = await fs.readJson(indexPath);
            index.tests = index.tests.filter(t => t.testId !== testId);

            // Recalculate statistics
            index.totalTests = index.tests.length;
            index.passedTests = index.tests.filter(t => t.status === 'passed').length;
            index.failedTests = index.tests.filter(t => t.status === 'failed').length;
            index.errorTests = index.tests.filter(t => t.status === 'error').length;
            index.lastUpdated = new Date().toISOString();

            await fs.writeJson(indexPath, index, { spaces: 2 });
        }

        return { deleted: testId };
    }

    /**
     * Get test statistics for a project
     *
     * @param {string} projectName - Project name
     * @returns {Promise<Object>} Test statistics
     */
    async getTestStatistics(projectName) {
        const indexPath = this.getIndexPath(projectName);

        if (!await fs.pathExists(indexPath)) {
            return {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                errorTests: 0,
                passRate: 0,
                recentTests: []
            };
        }

        const index = await fs.readJson(indexPath);
        const totalTests = index.totalTests || 0;
        const passedTests = index.passedTests || 0;

        return {
            totalTests,
            passedTests: index.passedTests || 0,
            failedTests: index.failedTests || 0,
            errorTests: index.errorTests || 0,
            passRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
            lastUpdated: index.lastUpdated,
            recentTests: (index.tests || []).slice(0, 10)
        };
    }
}

module.exports = new TestRunnerService();
