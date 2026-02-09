/**
 * Comment Service
 *
 * Manages collaborative comments and annotations for screenshots and test results
 *
 * Features:
 * - Add comments to screens
 * - Thread discussions with replies
 * - Edit/Delete comments
 * - Mark as resolved
 * - User mentions (@username)
 * - Timestamps and author tracking
 * - Canvas-based annotations (rectangles, arrows, text, highlights)
 *
 * Directory Structure:
 * storage/{projectName}/.comments/
 *   ├── comments.json              # Index of all comments
 *   └── {screenId}/
 *       └── comments.json          # Comments for specific screen
 *
 * @module services/comment
 */

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const storageService = require('./storage.service');

class CommentService {
    /**
     * Get comments directory for a project
     * @param {string} projectName - Name of the project
     * @returns {string} Absolute path to comments directory
     */
    getCommentsPath(projectName) {
        const projectPath = storageService.getProjectPath(projectName);
        return path.join(projectPath, '.comments');
    }

    /**
     * Get comments directory for a specific screen
     * @param {string} projectName - Name of the project
     * @param {string} screenId - Screen identifier
     * @returns {string} Absolute path to screen comments directory
     */
    getScreenCommentsPath(projectName, screenId) {
        return path.join(this.getCommentsPath(projectName), screenId);
    }

    /**
     * Get comments index file path
     * @param {string} projectName - Name of the project
     * @returns {string} Absolute path to comments index file
     */
    getCommentsIndexPath(projectName) {
        return path.join(this.getCommentsPath(projectName), 'comments.json');
    }

    /**
     * Get screen comments file path
     * @param {string} projectName - Name of the project
     * @param {string} screenId - Screen identifier
     * @returns {string} Absolute path to screen comments file
     */
    getScreenCommentsFilePath(projectName, screenId) {
        return path.join(this.getScreenCommentsPath(projectName, screenId), 'comments.json');
    }

    /**
     * Load comments index
     * @param {string} projectName - Name of the project
     * @returns {Promise<Object>} Comments index data
     */
    async loadCommentsIndex(projectName) {
        const indexPath = this.getCommentsIndexPath(projectName);

        if (!await fs.pathExists(indexPath)) {
            return {
                projectName,
                totalComments: 0,
                unresolvedComments: 0,
                screens: {},
                lastUpdated: new Date().toISOString()
            };
        }

        return await fs.readJson(indexPath);
    }

    /**
     * Save comments index
     * @param {string} projectName - Name of the project
     * @param {Object} index - Comments index data
     * @returns {Promise<void>}
     */
    async saveCommentsIndex(projectName, index) {
        const commentsPath = this.getCommentsPath(projectName);
        await fs.ensureDir(commentsPath);

        const indexPath = this.getCommentsIndexPath(projectName);
        index.lastUpdated = new Date().toISOString();
        await fs.writeJson(indexPath, index, { spaces: 2 });
    }

    /**
     * Load comments for a specific screen
     * @param {string} projectName - Name of the project
     * @param {string} screenId - Screen identifier
     * @returns {Promise<Array>} Array of comments
     */
    async loadScreenComments(projectName, screenId) {
        const filePath = this.getScreenCommentsFilePath(projectName, screenId);

        if (!await fs.pathExists(filePath)) {
            return [];
        }

        return await fs.readJson(filePath);
    }

    /**
     * Save comments for a specific screen
     * @param {string} projectName - Name of the project
     * @param {string} screenId - Screen identifier
     * @param {Array} comments - Array of comments
     * @returns {Promise<void>}
     */
    async saveScreenComments(projectName, screenId, comments) {
        const screenPath = this.getScreenCommentsPath(projectName, screenId);
        await fs.ensureDir(screenPath);

        const filePath = this.getScreenCommentsFilePath(projectName, screenId);
        await fs.writeJson(filePath, comments, { spaces: 2 });
    }

    /**
     * Update comments index statistics
     * @param {string} projectName - Name of the project
     * @returns {Promise<void>}
     */
    async updateIndex(projectName) {
        const index = await this.loadCommentsIndex(projectName);
        const commentsPath = this.getCommentsPath(projectName);

        // Reset counters
        let totalComments = 0;
        let unresolvedComments = 0;
        const screens = {};

        // Scan all screen comment files
        if (await fs.pathExists(commentsPath)) {
            const screenDirs = await fs.readdir(commentsPath);

            for (const screenId of screenDirs) {
                if (screenId === 'comments.json') continue;

                const comments = await this.loadScreenComments(projectName, screenId);
                const screenStats = {
                    total: comments.length,
                    unresolved: comments.filter(c => !c.resolved).length,
                    lastCommentAt: comments.length > 0
                        ? comments.reduce((latest, c) =>
                            c.updatedAt > latest ? c.updatedAt : latest,
                            comments[0].updatedAt)
                        : null
                };

                screens[screenId] = screenStats;
                totalComments += screenStats.total;
                unresolvedComments += screenStats.unresolved;
            }
        }

        index.totalComments = totalComments;
        index.unresolvedComments = unresolvedComments;
        index.screens = screens;

        await this.saveCommentsIndex(projectName, index);
    }

    /**
     * Parse mentions from comment text
     * @param {string} text - Comment text
     * @returns {Array<string>} Array of mentioned usernames
     */
    parseMentions(text) {
        if (!text) return [];
        const matches = text.match(/@[\w.-]+/g) || [];
        return matches.map(m => m.substring(1));
    }

    /**
     * Sanitize HTML content
     * @param {string} text - Text to sanitize
     * @returns {string} Sanitized text
     */
    sanitizeContent(text) {
        if (!text) return '';
        return text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Validate annotation coordinates
     * @param {Object} annotation - Annotation object
     * @returns {boolean} True if valid
     */
    validateAnnotation(annotation) {
        if (!annotation || !annotation.type) return false;

        const validTypes = ['rectangle', 'arrow', 'text', 'highlight', 'circle', 'line'];
        if (!validTypes.includes(annotation.type)) return false;

        // Check required numeric fields
        if (typeof annotation.x !== 'number' || typeof annotation.y !== 'number') {
            return false;
        }

        // Type-specific validation
        switch (annotation.type) {
            case 'rectangle':
            case 'highlight':
                return typeof annotation.width === 'number' && typeof annotation.height === 'number';

            case 'arrow':
            case 'line':
                return typeof annotation.endX === 'number' && typeof annotation.endY === 'number';

            case 'circle':
                return typeof annotation.radius === 'number' && annotation.radius > 0;

            case 'text':
                return typeof annotation.text === 'string' && annotation.text.length > 0;

            default:
                return false;
        }
    }

    /**
     * Create a new comment
     * @param {string} projectName - Name of the project
     * @param {Object} commentData - Comment data
     * @returns {Promise<Object>} Created comment
     */
    async createComment(projectName, commentData) {
        const {
            screenId,
            sectionTimestamp,
            author,
            content,
            annotations = []
        } = commentData;

        // Validate required fields
        if (!screenId || !author || !content) {
            throw new Error('Missing required fields: screenId, author, content');
        }

        // Sanitize content
        const sanitizedContent = this.sanitizeContent(content);

        // Validate annotations
        const validAnnotations = annotations.filter(a => this.validateAnnotation(a));

        // Create comment object
        const comment = {
            commentId: uuidv4(),
            projectName,
            screenId,
            sectionTimestamp: sectionTimestamp || null,
            author,
            content: sanitizedContent,
            mentions: this.parseMentions(content),
            resolved: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            replies: [],
            annotations: validAnnotations
        };

        // Load existing comments
        const comments = await this.loadScreenComments(projectName, screenId);

        // Add new comment
        comments.push(comment);

        // Save comments
        await this.saveScreenComments(projectName, screenId, comments);

        // Update index
        await this.updateIndex(projectName);

        return comment;
    }

    /**
     * Get all comments for a screen
     * @param {string} projectName - Name of the project
     * @param {string} screenId - Screen identifier
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of comments
     */
    async getScreenComments(projectName, screenId, options = {}) {
        const {
            resolved = null,
            author = null,
            sectionTimestamp = null,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = options;

        let comments = await this.loadScreenComments(projectName, screenId);

        // Apply filters
        if (resolved !== null) {
            comments = comments.filter(c => c.resolved === resolved);
        }

        if (author) {
            comments = comments.filter(c => c.author === author);
        }

        if (sectionTimestamp) {
            comments = comments.filter(c => c.sectionTimestamp === sectionTimestamp);
        }

        // Sort comments
        comments.sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        return comments;
    }

    /**
     * Get a specific comment by ID
     * @param {string} projectName - Name of the project
     * @param {string} commentId - Comment ID
     * @returns {Promise<Object|null>} Comment object or null
     */
    async getComment(projectName, commentId) {
        const index = await this.loadCommentsIndex(projectName);

        // Search through all screens
        for (const screenId of Object.keys(index.screens)) {
            const comments = await this.loadScreenComments(projectName, screenId);
            const comment = comments.find(c => c.commentId === commentId);

            if (comment) {
                return comment;
            }
        }

        return null;
    }

    /**
     * Update a comment
     * @param {string} projectName - Name of the project
     * @param {string} commentId - Comment ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object|null>} Updated comment or null
     */
    async updateComment(projectName, commentId, updates) {
        const index = await this.loadCommentsIndex(projectName);

        // Search through all screens
        for (const screenId of Object.keys(index.screens)) {
            const comments = await this.loadScreenComments(projectName, screenId);
            const commentIndex = comments.findIndex(c => c.commentId === commentId);

            if (commentIndex !== -1) {
                const comment = comments[commentIndex];

                // Update allowed fields
                if (updates.content !== undefined) {
                    comment.content = this.sanitizeContent(updates.content);
                    comment.mentions = this.parseMentions(updates.content);
                }

                if (updates.annotations !== undefined) {
                    comment.annotations = updates.annotations.filter(a => this.validateAnnotation(a));
                }

                comment.updatedAt = new Date().toISOString();

                // Save updated comments
                await this.saveScreenComments(projectName, screenId, comments);
                await this.updateIndex(projectName);

                return comment;
            }
        }

        return null;
    }

    /**
     * Delete a comment
     * @param {string} projectName - Name of the project
     * @param {string} commentId - Comment ID
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteComment(projectName, commentId) {
        const index = await this.loadCommentsIndex(projectName);

        // Search through all screens
        for (const screenId of Object.keys(index.screens)) {
            const comments = await this.loadScreenComments(projectName, screenId);
            const filteredComments = comments.filter(c => c.commentId !== commentId);

            if (filteredComments.length !== comments.length) {
                // Comment was found and removed
                await this.saveScreenComments(projectName, screenId, filteredComments);
                await this.updateIndex(projectName);
                return true;
            }
        }

        return false;
    }

    /**
     * Add a reply to a comment
     * @param {string} projectName - Name of the project
     * @param {string} commentId - Comment ID
     * @param {Object} replyData - Reply data
     * @returns {Promise<Object|null>} Created reply or null
     */
    async addReply(projectName, commentId, replyData) {
        const { author, content } = replyData;

        if (!author || !content) {
            throw new Error('Missing required fields: author, content');
        }

        const index = await this.loadCommentsIndex(projectName);

        // Search through all screens
        for (const screenId of Object.keys(index.screens)) {
            const comments = await this.loadScreenComments(projectName, screenId);
            const comment = comments.find(c => c.commentId === commentId);

            if (comment) {
                const reply = {
                    replyId: uuidv4(),
                    author,
                    content: this.sanitizeContent(content),
                    mentions: this.parseMentions(content),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                comment.replies.push(reply);
                comment.updatedAt = new Date().toISOString();

                await this.saveScreenComments(projectName, screenId, comments);
                await this.updateIndex(projectName);

                return reply;
            }
        }

        return null;
    }

    /**
     * Update a reply
     * @param {string} projectName - Name of the project
     * @param {string} commentId - Comment ID
     * @param {string} replyId - Reply ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object|null>} Updated reply or null
     */
    async updateReply(projectName, commentId, replyId, updates) {
        const index = await this.loadCommentsIndex(projectName);

        for (const screenId of Object.keys(index.screens)) {
            const comments = await this.loadScreenComments(projectName, screenId);
            const comment = comments.find(c => c.commentId === commentId);

            if (comment) {
                const reply = comment.replies.find(r => r.replyId === replyId);

                if (reply) {
                    if (updates.content !== undefined) {
                        reply.content = this.sanitizeContent(updates.content);
                        reply.mentions = this.parseMentions(updates.content);
                    }

                    reply.updatedAt = new Date().toISOString();
                    comment.updatedAt = new Date().toISOString();

                    await this.saveScreenComments(projectName, screenId, comments);
                    await this.updateIndex(projectName);

                    return reply;
                }
            }
        }

        return null;
    }

    /**
     * Delete a reply
     * @param {string} projectName - Name of the project
     * @param {string} commentId - Comment ID
     * @param {string} replyId - Reply ID
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteReply(projectName, commentId, replyId) {
        const index = await this.loadCommentsIndex(projectName);

        for (const screenId of Object.keys(index.screens)) {
            const comments = await this.loadScreenComments(projectName, screenId);
            const comment = comments.find(c => c.commentId === commentId);

            if (comment) {
                const originalLength = comment.replies.length;
                comment.replies = comment.replies.filter(r => r.replyId !== replyId);

                if (comment.replies.length !== originalLength) {
                    comment.updatedAt = new Date().toISOString();
                    await this.saveScreenComments(projectName, screenId, comments);
                    await this.updateIndex(projectName);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Mark a comment as resolved/unresolved
     * @param {string} projectName - Name of the project
     * @param {string} commentId - Comment ID
     * @param {boolean} resolved - Resolved status
     * @returns {Promise<Object|null>} Updated comment or null
     */
    async setResolved(projectName, commentId, resolved) {
        const index = await this.loadCommentsIndex(projectName);

        for (const screenId of Object.keys(index.screens)) {
            const comments = await this.loadScreenComments(projectName, screenId);
            const comment = comments.find(c => c.commentId === commentId);

            if (comment) {
                comment.resolved = resolved;
                comment.updatedAt = new Date().toISOString();

                await this.saveScreenComments(projectName, screenId, comments);
                await this.updateIndex(projectName);

                return comment;
            }
        }

        return null;
    }

    /**
     * Get all comments for a project
     * @param {string} projectName - Name of the project
     * @returns {Promise<Object>} Comments grouped by screen
     */
    async getAllComments(projectName) {
        const index = await this.loadCommentsIndex(projectName);
        const result = {
            ...index,
            comments: {}
        };

        for (const screenId of Object.keys(index.screens)) {
            result.comments[screenId] = await this.loadScreenComments(projectName, screenId);
        }

        return result;
    }

    /**
     * Search comments by text
     * @param {string} projectName - Name of the project
     * @param {string} query - Search query
     * @returns {Promise<Array>} Matching comments
     */
    async searchComments(projectName, query) {
        const index = await this.loadCommentsIndex(projectName);
        const results = [];
        const lowerQuery = query.toLowerCase();

        for (const screenId of Object.keys(index.screens)) {
            const comments = await this.loadScreenComments(projectName, screenId);

            for (const comment of comments) {
                // Search in comment content
                if (comment.content.toLowerCase().includes(lowerQuery)) {
                    results.push(comment);
                    continue;
                }

                // Search in replies
                const matchingReplies = comment.replies.filter(r =>
                    r.content.toLowerCase().includes(lowerQuery)
                );

                if (matchingReplies.length > 0) {
                    results.push(comment);
                }
            }
        }

        return results;
    }
}

module.exports = new CommentService();
