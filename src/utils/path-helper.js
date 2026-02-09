const path = require('path');

/**
 * Path Helper - Utilities for converting between URLs and file paths
 */
class PathHelper {
    /**
     * Convert a URL to a file system path
     * @param {string} url - Full URL or URL path
     * @returns {string} File system path
     */
    urlToPath(url) {
        // Remove protocol and domain
        let urlPath = url.replace(/^https?:\/\/[^\/]+/, '');

        // Remove query string and fragment
        urlPath = urlPath.split('?')[0].split('#')[0];

        // Remove leading and trailing slashes
        urlPath = urlPath.replace(/^\/+|\/+$/g, '');

        // Handle empty path (root)
        if (!urlPath) {
            return 'home';
        }

        // Replace URL path separators with OS path separator
        urlPath = urlPath.split('/').join(path.sep);

        // Sanitize path components (remove special characters)
        urlPath = urlPath.split(path.sep).map(part => {
            return part.replace(/[<>:"|?*]/g, '_');
        }).join(path.sep);

        return urlPath;
    }

    /**
     * Convert a file system path back to a URL path
     * @param {string} fsPath - File system path
     * @returns {string} URL path
     */
    pathToUrl(fsPath) {
        // Normalize path separators
        let urlPath = fsPath.split(path.sep).join('/');

        // Handle home as root
        if (urlPath === 'home') {
            return '/';
        }

        return '/' + urlPath;
    }

    /**
     * Extract domain from URL
     * @param {string} url - Full URL
     * @returns {string} Domain name
     */
    extractDomain(url) {
        const match = url.match(/^https?:\/\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * Build full URL from base and path
     * @param {string} baseUrl - Base URL with domain
     * @param {string} urlPath - URL path
     * @returns {string} Full URL
     */
    buildUrl(baseUrl, urlPath) {
        // Remove trailing slash from base
        const base = baseUrl.replace(/\/+$/, '');

        // Ensure path starts with slash
        const path = urlPath.startsWith('/') ? urlPath : '/' + urlPath;

        return base + path;
    }

    /**
     * Compare two URLs ignoring query strings and fragments
     * @param {string} url1 - First URL
     * @param {string} url2 - Second URL
     * @returns {boolean} True if URLs match
     */
    urlsMatch(url1, url2) {
        const clean1 = url1.split('?')[0].split('#')[0].replace(/\/+$/, '');
        const clean2 = url2.split('?')[0].split('#')[0].replace(/\/+$/, '');
        return clean1 === clean2;
    }

    /**
     * Group URLs by path depth
     * @param {Array<string>} urls - Array of URLs
     * @returns {Object} URLs grouped by depth
     */
    groupByDepth(urls) {
        const groups = {};

        for (const url of urls) {
            const path = this.urlToPath(url);
            const depth = path.split(path.sep).length;

            if (!groups[depth]) {
                groups[depth] = [];
            }
            groups[depth].push({ url, path });
        }

        return groups;
    }

    /**
     * Get parent path
     * @param {string} urlPath - URL path
     * @returns {string|null} Parent path or null if root
     */
    getParent(urlPath) {
        const parts = urlPath.split('/').filter(p => p);
        if (parts.length <= 1) {
            return null;
        }
        return '/' + parts.slice(0, -1).join('/');
    }

    /**
     * Check if path is a child of another path
     * @param {string} childPath - Potential child path
     * @param {string} parentPath - Potential parent path
     * @returns {boolean} True if child is under parent
     */
    isChildOf(childPath, parentPath) {
        const child = childPath.replace(/^\/+|\/+$/g, '');
        const parent = parentPath.replace(/^\/+|\/+$/g, '');
        return child.startsWith(parent + '/');
    }
}

module.exports = new PathHelper();
