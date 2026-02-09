const express = require('express');
const router = express.Router();
const commentService = require('../services/comment.service');

// Create comment
router.post('/:projectName/comments', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { screenId, content, author, section, annotations } = req.body;

        if (!screenId || !content || !author) {
            return res.status(400).json({
                error: 'screenId, content, and author are required'
            });
        }

        const comment = await commentService.createComment(projectName, {
            screenId,
            content,
            author,
            section,
            annotations
        });
        res.json({ success: true, comment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all comments for project
router.get('/:projectName/comments', async (req, res) => {
    try {
        const { projectName } = req.params;

        const comments = await commentService.getAllComments(projectName);
        res.json({ success: true, comments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search comments
router.get('/:projectName/comments/search', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                error: 'Search query (q) is required'
            });
        }

        const comments = await commentService.searchComments(projectName, q);
        res.json({ success: true, comments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get comments for screen
router.get('/:projectName/screens/:screenId/comments', async (req, res) => {
    try {
        const { projectName, screenId } = req.params;

        const comments = await commentService.getScreenComments(projectName, screenId, req.query);
        res.json({ success: true, comments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific comment
router.get('/:projectName/comments/:commentId', async (req, res) => {
    try {
        const { projectName, commentId } = req.params;

        const comment = await commentService.getComment(projectName, commentId);
        res.json({ success: true, comment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update comment
router.put('/:projectName/comments/:commentId', async (req, res) => {
    try {
        const { projectName, commentId } = req.params;
        const updates = req.body;

        const comment = await commentService.updateComment(projectName, commentId, updates);
        res.json({ success: true, comment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete comment
router.delete('/:projectName/comments/:commentId', async (req, res) => {
    try {
        const { projectName, commentId } = req.params;

        await commentService.deleteComment(projectName, commentId);
        res.json({ success: true, deleted: commentId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add reply
router.post('/:projectName/comments/:commentId/reply', async (req, res) => {
    try {
        const { projectName, commentId } = req.params;
        const { content, author } = req.body;

        if (!content || !author) {
            return res.status(400).json({
                error: 'content and author are required'
            });
        }

        const reply = await commentService.addReply(projectName, commentId, {
            content,
            author
        });
        res.json({ success: true, reply });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update reply
router.put('/:projectName/comments/:commentId/replies/:replyId', async (req, res) => {
    try {
        const { projectName, commentId, replyId } = req.params;
        const updates = req.body;

        const reply = await commentService.updateReply(projectName, commentId, replyId, updates);
        res.json({ success: true, reply });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete reply
router.delete('/:projectName/comments/:commentId/replies/:replyId', async (req, res) => {
    try {
        const { projectName, commentId, replyId } = req.params;

        await commentService.deleteReply(projectName, commentId, replyId);
        res.json({ success: true, deleted: replyId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set resolved status
router.patch('/:projectName/comments/:commentId/resolve', async (req, res) => {
    try {
        const { projectName, commentId } = req.params;
        const { resolved } = req.body;

        if (resolved === undefined) {
            return res.status(400).json({
                error: 'resolved field is required'
            });
        }

        const comment = await commentService.setResolved(projectName, commentId, resolved);
        res.json({ success: true, comment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
