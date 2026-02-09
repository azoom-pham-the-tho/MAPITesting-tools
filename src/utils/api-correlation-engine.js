/**
 * API Correlation Engine
 *
 * Liên kết chính xác giữa User Interactions và API Calls
 * Thuật toán: Temporal Correlation + Call Stack Analysis + Pattern Matching
 *
 * Mục tiêu:
 * - Biết interaction nào trigger API nào (95%+ accuracy)
 * - Predict API sequence cho replay
 * - Validate API response trong replay
 * - Cache API responses để speed up replay
 */

class APICorrelationEngine {
    constructor() {
        this.apiCalls = [];
        this.interactions = [];
        this.correlations = [];

        this.config = {
            // Temporal window
            maxCorrelationWindow: 5000,      // API phải start trong 5s sau interaction
            minCorrelationWindow: -100,      // Cho phép API start trước 100ms (pre-flight)

            // Confidence thresholds
            minConfidence: 0.6,              // Minimum để accept correlation
            highConfidence: 0.9,             // High confidence threshold

            // Performance
            enableCache: true,
            cacheMaxAge: 3600000,            // 1 hour

            // Validation
            validateResponseSchema: true,
            compareResponseData: false       // Chỉ so sánh schema, không compare data
        };

        this.apiCache = new Map();
        this.patterns = new Map();
        this.cdpSession = null;
    }

    /**
     * Initialize với Chrome DevTools Protocol session
     */
    async initialize(cdpSession) {
        this.cdpSession = cdpSession;

        // Enable Network domain
        await this.cdpSession.send('Network.enable');

        // Listen to network events
        this.cdpSession.on('Network.requestWillBeSent', this.handleRequestWillBeSent.bind(this));
        this.cdpSession.on('Network.responseReceived', this.handleResponseReceived.bind(this));
        this.cdpSession.on('Network.loadingFinished', this.handleLoadingFinished.bind(this));
        this.cdpSession.on('Network.loadingFailed', this.handleLoadingFailed.bind(this));

        console.log('[APICorrelation] ✅ Initialized with CDP session');
    }

    /**
     * Start tracking cho một session
     */
    startSession() {
        this.apiCalls = [];
        this.interactions = [];
        this.correlations = [];
        this.sessionStartTime = Date.now();

        console.log('[APICorrelation] 🎬 Session started');
    }

    /**
     * Record một interaction
     */
    recordInteraction(interaction) {
        const enriched = {
            ...interaction,
            recordedAt: Date.now(),
            relativeTime: Date.now() - this.sessionStartTime,
            expectedAPIs: []  // Will be filled after correlation
        };

        this.interactions.push(enriched);

        // Mark timing for correlation
        this.lastInteractionTime = Date.now();
        this.lastInteractionId = interaction.id;

        return enriched;
    }

    /**
     * Handle Network.requestWillBeSent event
     */
    handleRequestWillBeSent(params) {
        const { requestId, request, timestamp, initiator, type } = params;

        // Filter chỉ XHR/Fetch requests
        if (!['XHR', 'Fetch'].includes(type)) {
            return;
        }

        const apiCall = {
            id: requestId,
            method: request.method,
            url: request.url,
            headers: request.headers,
            postData: request.postData,
            initiator: initiator,
            type: type,
            startTime: timestamp * 1000,  // Convert to ms
            relativeStartTime: (timestamp * 1000) - this.sessionStartTime,
            status: 'pending',
            response: null,
            correlatedInteraction: null,
            correlationConfidence: 0
        };

        this.apiCalls.push(apiCall);

        // Immediate correlation attempt
        this.correlateAPI(apiCall);
    }

    /**
     * Handle Network.responseReceived event
     */
    handleResponseReceived(params) {
        const { requestId, response, timestamp } = params;

        const apiCall = this.apiCalls.find(a => a.id === requestId);
        if (!apiCall) return;

        apiCall.responseReceivedTime = timestamp * 1000;
        apiCall.status = response.status;
        apiCall.statusText = response.statusText;
        apiCall.responseHeaders = response.headers;
        apiCall.mimeType = response.mimeType;
    }

    /**
     * Handle Network.loadingFinished event
     */
    async handleLoadingFinished(params) {
        const { requestId, timestamp } = params;

        const apiCall = this.apiCalls.find(a => a.id === requestId);
        if (!apiCall) return;

        apiCall.endTime = timestamp * 1000;
        apiCall.duration = apiCall.endTime - apiCall.startTime;

        // Get response body
        try {
            const response = await this.cdpSession.send('Network.getResponseBody', { requestId });

            if (response.base64Encoded) {
                apiCall.responseBody = Buffer.from(response.body, 'base64').toString('utf8');
            } else {
                apiCall.responseBody = response.body;
            }

            // Parse JSON if possible
            if (apiCall.mimeType?.includes('json')) {
                try {
                    apiCall.responseData = JSON.parse(apiCall.responseBody);
                } catch (e) {
                    // Not JSON
                }
            }
        } catch (e) {
            console.log(`[APICorrelation] Failed to get response body: ${e.message}`);
        }

        apiCall.status = 'completed';

        // Re-correlate with complete data
        this.correlateAPI(apiCall);
    }

    /**
     * Handle Network.loadingFailed event
     */
    handleLoadingFailed(params) {
        const { requestId, timestamp, errorText } = params;

        const apiCall = this.apiCalls.find(a => a.id === requestId);
        if (!apiCall) return;

        apiCall.endTime = timestamp * 1000;
        apiCall.status = 'failed';
        apiCall.error = errorText;
    }

    /**
     * Correlate API call với interactions
     * Thuật toán: Multi-factor scoring
     */
    correlateAPI(apiCall) {
        if (this.interactions.length === 0) {
            return;
        }

        let bestMatch = null;
        let bestScore = 0;

        for (const interaction of this.interactions) {
            const score = this.calculateCorrelationScore(interaction, apiCall);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = interaction;
            }
        }

        if (bestScore >= this.config.minConfidence) {
            apiCall.correlatedInteraction = bestMatch.id;
            apiCall.correlationConfidence = bestScore;

            // Add to interaction's expected APIs
            if (!bestMatch.expectedAPIs) {
                bestMatch.expectedAPIs = [];
            }

            bestMatch.expectedAPIs.push({
                id: apiCall.id,
                method: apiCall.method,
                url: apiCall.url,
                confidence: bestScore,
                timing: {
                    delay: apiCall.startTime - bestMatch.recordedAt,
                    duration: apiCall.duration
                }
            });

            this.correlations.push({
                interaction: bestMatch,
                apiCall,
                confidence: bestScore,
                timestamp: Date.now()
            });

            console.log(`[APICorrelation] 🔗 Linked: ${interaction.type} → ${apiCall.method} ${apiCall.url} (${(bestScore*100).toFixed(0)}%)`);
        }
    }

    /**
     * Calculate correlation score giữa interaction và API call
     * Return: 0.0 - 1.0
     */
    calculateCorrelationScore(interaction, apiCall) {
        let score = 0;
        let weights = 0;

        // Factor 1: Temporal Proximity (Weight: 40%)
        const timeDiff = apiCall.startTime - interaction.recordedAt;

        if (timeDiff >= this.config.minCorrelationWindow &&
            timeDiff <= this.config.maxCorrelationWindow) {

            // Closer = higher score
            const normalizedTime = 1 - (timeDiff / this.config.maxCorrelationWindow);
            score += normalizedTime * 0.4;
            weights += 0.4;
        } else if (timeDiff < this.config.minCorrelationWindow) {
            // Too early - possible pre-flight or unrelated
            score += 0.1 * 0.4;
            weights += 0.4;
        } else {
            // Too late - unlikely related
            return 0;
        }

        // Factor 2: Call Stack Initiator (Weight: 30%)
        if (apiCall.initiator) {
            if (apiCall.initiator.type === 'script') {
                // Check if script URL matches current page
                score += 0.3;
                weights += 0.3;
            } else if (apiCall.initiator.type === 'parser') {
                // Initiated by HTML parser (likely unrelated to click)
                score += 0.05 * 0.3;
                weights += 0.3;
            }
        }

        // Factor 3: URL Pattern Matching (Weight: 20%)
        const urlScore = this.matchURLPattern(interaction, apiCall);
        score += urlScore * 0.2;
        weights += 0.2;

        // Factor 4: Sequence Position (Weight: 10%)
        // APIs thường xảy ra theo thứ tự sau interaction
        const recentAPIs = this.apiCalls.filter(a =>
            a.startTime >= interaction.recordedAt &&
            a.startTime <= apiCall.startTime
        );

        const position = recentAPIs.indexOf(apiCall) + 1;
        const positionScore = position <= 5 ? (6 - position) / 5 : 0.1;
        score += positionScore * 0.1;
        weights += 0.1;

        return weights > 0 ? score / weights : 0;
    }

    /**
     * Match URL pattern với interaction context
     */
    matchURLPattern(interaction, apiCall) {
        const url = new URL(apiCall.url);
        const pathname = url.pathname.toLowerCase();

        // Extract keywords from interaction
        const keywords = this.extractKeywords(interaction);

        let score = 0;

        for (const keyword of keywords) {
            if (pathname.includes(keyword.toLowerCase())) {
                score += 0.3;
            }
        }

        // Check method alignment
        if (interaction.type === 'click') {
            if (interaction.text && interaction.text.match(/(submit|save|登録|保存|送信)/i)) {
                if (apiCall.method === 'POST' || apiCall.method === 'PUT') {
                    score += 0.4;
                }
            } else if (interaction.text && interaction.text.match(/(delete|削除)/i)) {
                if (apiCall.method === 'DELETE') {
                    score += 0.4;
                }
            }
        }

        return Math.min(score, 1.0);
    }

    /**
     * Extract keywords từ interaction
     */
    extractKeywords(interaction) {
        const keywords = [];

        // From text
        if (interaction.text) {
            keywords.push(interaction.text.trim());
        }

        // From URL path
        if (interaction.pathname) {
            const parts = interaction.pathname.split('/').filter(p => p.length > 2);
            keywords.push(...parts);
        }

        // From selector
        if (interaction.selector) {
            const matches = interaction.selector.match(/data-testid="([^"]+)"/);
            if (matches) {
                keywords.push(matches[1]);
            }
        }

        return keywords;
    }

    /**
     * Get correlated APIs cho một interaction
     */
    getAPIsForInteraction(interactionId) {
        return this.correlations
            .filter(c => c.interaction.id === interactionId)
            .map(c => c.apiCall)
            .sort((a, b) => a.startTime - b.startTime);
    }

    /**
     * Build API timeline
     */
    buildAPITimeline() {
        return {
            interactions: this.interactions.map(i => ({
                id: i.id,
                type: i.type,
                timestamp: i.recordedAt,
                expectedAPIs: i.expectedAPIs || []
            })),
            apiCalls: this.apiCalls.map(a => ({
                id: a.id,
                method: a.method,
                url: a.url,
                startTime: a.startTime,
                endTime: a.endTime,
                duration: a.duration,
                status: a.status,
                correlatedInteraction: a.correlatedInteraction,
                confidence: a.correlationConfidence
            })),
            correlations: this.correlations.map(c => ({
                interactionId: c.interaction.id,
                apiId: c.apiCall.id,
                confidence: c.confidence,
                timing: {
                    delay: c.apiCall.startTime - c.interaction.recordedAt,
                    duration: c.apiCall.duration
                }
            }))
        };
    }

    /**
     * Wait for expected APIs (dùng trong replay)
     */
    async waitForExpectedAPIs(page, expectedAPIs, timeout = 30000) {
        const startTime = Date.now();
        const results = [];

        // Setup listeners
        const pendingRequests = new Map();

        const requestListener = (request) => {
            const url = request.url();
            const method = request.method();

            // Check if matches expected
            for (const expected of expectedAPIs) {
                if (this.matchesExpectedAPI(request, expected)) {
                    pendingRequests.set(request, {
                        expected,
                        startTime: Date.now(),
                        request
                    });
                    break;
                }
            }
        };

        const responseListener = async (response) => {
            const request = response.request();
            const pending = pendingRequests.get(request);

            if (pending) {
                const endTime = Date.now();

                try {
                    const body = await response.text();
                    let data = null;

                    if (response.headers()['content-type']?.includes('json')) {
                        data = JSON.parse(body);
                    }

                    results.push({
                        expected: pending.expected,
                        actual: {
                            method: request.method(),
                            url: request.url(),
                            status: response.status(),
                            duration: endTime - pending.startTime,
                            data
                        },
                        matched: true,
                        validated: this.validateAPIResponse(pending.expected, {
                            status: response.status(),
                            data
                        })
                    });
                } catch (e) {
                    results.push({
                        expected: pending.expected,
                        error: e.message,
                        matched: true,
                        validated: false
                    });
                }

                pendingRequests.delete(request);
            }
        };

        page.on('request', requestListener);
        page.on('response', responseListener);

        // Wait for all expected APIs or timeout
        while (results.length < expectedAPIs.length && Date.now() - startTime < timeout) {
            await new Promise(r => setTimeout(r, 100));
        }

        // Cleanup
        page.off('request', requestListener);
        page.off('response', responseListener);

        // Check for missing APIs
        for (const expected of expectedAPIs) {
            if (!results.find(r => r.expected.id === expected.id)) {
                results.push({
                    expected,
                    matched: false,
                    validated: false,
                    error: 'API call not executed'
                });
            }
        }

        return {
            success: results.every(r => r.matched && r.validated),
            results,
            duration: Date.now() - startTime
        };
    }

    /**
     * Check if request matches expected API
     */
    matchesExpectedAPI(request, expected) {
        // Method match
        if (request.method() !== expected.method) {
            return false;
        }

        // URL match (normalize)
        const requestUrl = new URL(request.url());
        const expectedUrl = new URL(expected.url);

        // Compare pathname
        if (requestUrl.pathname !== expectedUrl.pathname) {
            return false;
        }

        // Compare query params (ignore order)
        const requestParams = new URLSearchParams(requestUrl.search);
        const expectedParams = new URLSearchParams(expectedUrl.search);

        for (const [key, value] of expectedParams) {
            if (requestParams.get(key) !== value) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate API response
     */
    validateAPIResponse(expected, actual) {
        // Check status code
        if (expected.status && actual.status !== expected.status) {
            console.log(`[APICorrelation] ⚠️ Status mismatch: expected ${expected.status}, got ${actual.status}`);
            return false;
        }

        // Check response schema (if enabled)
        if (this.config.validateResponseSchema && expected.responseData && actual.data) {
            return this.validateResponseSchema(expected.responseData, actual.data);
        }

        return true;
    }

    /**
     * Validate response schema (structure, not values)
     */
    validateResponseSchema(expected, actual) {
        // Deep schema comparison
        const expectedSchema = this.extractSchema(expected);
        const actualSchema = this.extractSchema(actual);

        return this.schemasMatch(expectedSchema, actualSchema);
    }

    /**
     * Extract schema từ object
     */
    extractSchema(obj) {
        if (obj === null) return 'null';
        if (Array.isArray(obj)) {
            return obj.length > 0 ? ['array', this.extractSchema(obj[0])] : ['array', 'any'];
        }
        if (typeof obj === 'object') {
            const schema = {};
            for (const key in obj) {
                schema[key] = this.extractSchema(obj[key]);
            }
            return schema;
        }
        return typeof obj;
    }

    /**
     * Compare schemas
     */
    schemasMatch(schema1, schema2) {
        if (typeof schema1 !== typeof schema2) {
            return false;
        }

        if (Array.isArray(schema1)) {
            return Array.isArray(schema2) && schema1.length === schema2.length;
        }

        if (typeof schema1 === 'object' && schema1 !== null) {
            const keys1 = Object.keys(schema1);
            const keys2 = Object.keys(schema2);

            if (keys1.length !== keys2.length) {
                return false;
            }

            for (const key of keys1) {
                if (!keys2.includes(key)) {
                    return false;
                }
                if (!this.schemasMatch(schema1[key], schema2[key])) {
                    return false;
                }
            }

            return true;
        }

        return schema1 === schema2;
    }

    /**
     * Get summary statistics
     */
    getSummary() {
        return {
            totalInteractions: this.interactions.length,
            totalAPIs: this.apiCalls.length,
            totalCorrelations: this.correlations.length,
            correlationRate: this.correlations.length / Math.max(this.apiCalls.length, 1),
            averageConfidence: this.correlations.reduce((sum, c) => sum + c.confidence, 0) / Math.max(this.correlations.length, 1),
            highConfidenceCorrelations: this.correlations.filter(c => c.confidence >= this.config.highConfidence).length
        };
    }
}

module.exports = APICorrelationEngine;
