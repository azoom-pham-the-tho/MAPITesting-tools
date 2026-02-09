/**
 * Auth Routes - Session & Authentication Management
 * Extracted from replay.routes.js for clean separation
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const storageService = require('../services/storage.service');
const path = require('path');
const fs = require('fs-extra');

/**
 * Get session status for a project
 * GET /api/auth/session/:projectName
 */
router.get('/session/:projectName', async (req, res, next) => {
    try {
        const { projectName } = req.params;
        const session = await authService.getSession(projectName);
        const isValid = await authService.hasValidSession(projectName);

        res.json({
            hasSession: !!session,
            isValid,
            savedAt: session?.savedAt || null,
            loginMethod: session?.loginMethod || null,
            cookieCount: session?.cookies?.length || 0,
            localStorageKeys: session?.localStorage ? Object.keys(session.localStorage).length : 0
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Get full auth data for a project
 * GET /api/auth/:projectName
 */
router.get('/:projectName', async (req, res, next) => {
    try {
        const { projectName } = req.params;
        const authData = await storageService.getAuth(projectName);
        res.json({ 
            success: true, 
            ...authData,
            // Hide sensitive values
            cookies: authData.cookies?.map(c => ({ 
                name: c.name, 
                domain: c.domain,
                expires: c.expires 
            }))
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Save/Update auth data for a project
 * POST /api/auth/:projectName
 */
router.post('/:projectName', async (req, res, next) => {
    try {
        const { projectName } = req.params;
        const { cookies, localStorage, sessionStorage, loginMethod } = req.body;

        await authService.saveSession(projectName, {
            cookies: cookies || [],
            localStorage: localStorage || {},
            sessionStorage: sessionStorage || {},
            loginMethod: loginMethod || 'manual'
        });

        res.json({ success: true, message: 'Auth data saved' });
    } catch (error) {
        next(error);
    }
});

/**
 * Delete saved session
 * DELETE /api/auth/session/:projectName
 */
router.delete('/session/:projectName', async (req, res, next) => {
    try {
        const { projectName } = req.params;
        await authService.deleteSession(projectName);
        res.json({ success: true, message: 'Session deleted' });
    } catch (error) {
        next(error);
    }
});

/**
 * Force refresh session (used after manual login)
 * POST /api/auth/session/:projectName/refresh
 */
router.post('/session/:projectName/refresh', async (req, res, next) => {
    try {
        const { projectName } = req.params;
        const { cookies, localStorage, sessionStorage, loginMethod } = req.body;

        await authService.saveSession(projectName, {
            cookies: cookies || [],
            localStorage: localStorage || {},
            sessionStorage: sessionStorage || {},
            loginMethod: loginMethod || 'manual'
        });

        res.json({ success: true, message: 'Session refreshed' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
