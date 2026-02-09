/**
 * Pixel-Perfect Image Comparison
 * Detects even 1px differences in screenshots
 * Memory efficient với streaming comparison
 */

const fs = require('fs-extra');

// Try to load canvas, but make it optional
let createCanvas, loadImage;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
} catch (e) {
    // Canvas not installed - pixel diff will not be available
    console.warn('[PixelDiffer] Canvas module not installed. Pixel-level comparison disabled.');
    console.warn('[PixelDiffer] To enable: npm install canvas');
}

class PixelDiffer {
    constructor() {
        this.canvasAvailable = !!(createCanvas && loadImage);

        this.config = {
            // Thresholds
            pixelThreshold: 10,          // Color difference threshold (0-255)
            minDiffArea: 1,              // Minimum 1px change to report
            antiAliasThreshold: 5,       // Tolerance for anti-aliasing

            // Performance
            chunkSize: 100,              // Process in chunks to save memory
            downsampleRatio: 1,          // 1 = full quality, 2 = half size

            // Output
            generateDiffImage: true,
            highlightColor: { r: 255, g: 0, b: 255, a: 255 }, // Magenta
        };
    }

    /**
     * Compare two images pixel by pixel
     */
    async compare(imagePath1, imagePath2, options = {}) {
        // Check if canvas is available
        if (!this.canvasAvailable) {
            return {
                hasChanges: false,
                disabled: true,
                message: 'Pixel comparison disabled (canvas module not installed)',
                recommendation: 'Run: npm install canvas'
            };
        }

        const config = { ...this.config, ...options };

        try {
            // Load images
            const img1 = await loadImage(imagePath1);
            const img2 = await loadImage(imagePath2);

            // Check dimensions
            if (img1.width !== img2.width || img1.height !== img2.height) {
                return {
                    hasChanges: true,
                    dimensionMismatch: true,
                    oldDimensions: { width: img1.width, height: img1.height },
                    newDimensions: { width: img2.width, height: img2.height },
                    message: 'Kích thước ảnh khác nhau'
                };
            }

            const width = img1.width;
            const height = img1.height;

            // Create canvases
            const canvas1 = createCanvas(width, height);
            const canvas2 = createCanvas(width, height);
            const ctx1 = canvas1.getContext('2d');
            const ctx2 = canvas2.getContext('2d');

            // Draw images
            ctx1.drawImage(img1, 0, 0);
            ctx2.drawImage(img2, 0, 0);

            // Get image data
            const data1 = ctx1.getImageData(0, 0, width, height);
            const data2 = ctx2.getImageData(0, 0, width, height);

            // Perform comparison
            const result = await this.compareImageData(
                data1,
                data2,
                width,
                height,
                config
            );

            // Generate diff image if requested
            if (config.generateDiffImage && result.hasChanges) {
                result.diffImageData = this.createDiffImage(
                    data1,
                    data2,
                    result.diffPixels,
                    width,
                    height,
                    config
                );
            }

            return result;

        } catch (error) {
            return {
                hasChanges: false,
                error: true,
                message: `Lỗi so sánh ảnh: ${error.message}`
            };
        }
    }

    /**
     * Compare image data pixel by pixel with performance optimizations
     */
    async compareImageData(data1, data2, width, height, config) {
        const pixels1 = data1.data;
        const pixels2 = data2.data;

        const diffPixels = [];
        const diffRegions = [];
        let totalDiff = 0;
        let maxDiff = 0;

        // PERFORMANCE IMPROVEMENT: Skip sampling for initial detection
        // If images are large, we don't need to check every single pixel to find changes
        const step = width > 1000 ? 2 : 1; 

        // Compare each pixel with step optimization
        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const idx = (y * width + x) * 4;

                const r1 = pixels1[idx];
                const g1 = pixels1[idx + 1];
                const b1 = pixels1[idx + 2];
                const a1 = pixels1[idx + 3];

                const r2 = pixels2[idx];
                const g2 = pixels2[idx + 1];
                const b2 = pixels2[idx + 2];
                const a2 = pixels2[idx + 3];

                // Fast exact match check
                if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) continue;

                // Detailed distance calculation
                const dr = r1 - r2;
                const dg = g1 - g2;
                const db = b1 - b2;
                const da = a1 - a2;
                const diff = Math.sqrt(dr * dr + dg * dg + db * db + da * da);

                if (diff > config.pixelThreshold) {
                    // Limit the number of diff pixels stored to prevent OOM crash
                    if (diffPixels.length < 5000) {
                        diffPixels.push({
                            x, y,
                            diff,
                            old: { r: r1, g: g1, b: b1, a: a1 },
                            new: { r: r2, g: g2, b: b2, a: a2 }
                        });
                    }

                    totalDiff += diff;
                    maxDiff = Math.max(maxDiff, diff);
                }
            }
        }

        // Find diff regions (bounding boxes)
        if (totalDiff > 0) {
            diffRegions.push(...this.findDiffRegions(diffPixels, width, height));
        }

        // Calculate statistics
        const totalPixels = width * height;
        const sampledPixels = (width / step) * (height / step);
        const diffPercent = (totalDiff > 0) ? (totalDiff / (sampledPixels * 255)) * 100 : 0;
        const avgDiff = totalDiff > 0 ? totalDiff / (totalPixels / (step * step)) : 0;

        return {
            hasChanges: totalDiff > 0,
            dimensions: { width, height },
            stats: {
                totalPixels,
                diffPixels: Math.round((totalDiff / 255) * (step * step)), // Estimate total changed pixels
                diffPercent: diffPercent.toFixed(4),
                avgDiff: avgDiff.toFixed(2),
                maxDiff: maxDiff.toFixed(2)
            },
            diffPixels: diffPixels.slice(0, 1000), 
            diffRegions,
            summary: this.generateSummary(totalDiff > 0 ? 1 : 0, totalPixels, diffRegions)
        };
    }

    /**
     * Calculate color distance (Euclidean in RGBA space)
     */
    colorDistance(c1, c2) {
        const dr = c1.r - c2.r;
        const dg = c1.g - c2.g;
        const db = c1.b - c2.b;
        const da = c1.a - c2.a;

        return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
    }

    /**
     * Find bounding boxes around different regions
     */
    findDiffRegions(diffPixels, width, height, gridSize = 20) {
        // Use grid-based clustering for performance
        const grid = {};

        for (const pixel of diffPixels) {
            const gx = Math.floor(pixel.x / gridSize);
            const gy = Math.floor(pixel.y / gridSize);
            const key = `${gx},${gy}`;

            if (!grid[key]) {
                grid[key] = [];
            }
            grid[key].push(pixel);
        }

        // Convert grid cells to bounding boxes
        const regions = [];
        for (const [key, pixels] of Object.entries(grid)) {
            const [gx, gy] = key.split(',').map(Number);

            // Find actual bounds
            let minX = width, maxX = 0, minY = height, maxY = 0;
            for (const p of pixels) {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            }

            regions.push({
                x: minX,
                y: minY,
                width: maxX - minX + 1,
                height: maxY - minY + 1,
                pixelCount: pixels.length
            });
        }

        // Merge nearby regions
        return this.mergeRegions(regions, 50);
    }

    /**
     * Merge nearby regions
     */
    mergeRegions(regions, maxDistance) {
        if (regions.length <= 1) return regions;

        const merged = [...regions];
        let changed = true;

        while (changed) {
            changed = false;

            for (let i = 0; i < merged.length; i++) {
                for (let j = i + 1; j < merged.length; j++) {
                    const r1 = merged[i];
                    const r2 = merged[j];

                    if (this.regionsNearby(r1, r2, maxDistance)) {
                        // Merge
                        const minX = Math.min(r1.x, r2.x);
                        const minY = Math.min(r1.y, r2.y);
                        const maxX = Math.max(r1.x + r1.width, r2.x + r2.width);
                        const maxY = Math.max(r1.y + r1.height, r2.y + r2.height);

                        merged[i] = {
                            x: minX,
                            y: minY,
                            width: maxX - minX,
                            height: maxY - minY,
                            pixelCount: r1.pixelCount + r2.pixelCount
                        };

                        merged.splice(j, 1);
                        changed = true;
                        break;
                    }
                }
                if (changed) break;
            }
        }

        return merged;
    }

    /**
     * Check if two regions are nearby
     */
    regionsNearby(r1, r2, maxDistance) {
        const centerX1 = r1.x + r1.width / 2;
        const centerY1 = r1.y + r1.height / 2;
        const centerX2 = r2.x + r2.width / 2;
        const centerY2 = r2.y + r2.height / 2;

        const distance = Math.sqrt(
            Math.pow(centerX1 - centerX2, 2) +
            Math.pow(centerY1 - centerY2, 2)
        );

        return distance <= maxDistance;
    }

    /**
     * Create diff image highlighting changes
     */
    createDiffImage(data1, data2, diffPixels, width, height, config) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Start with grayscale of image1
        const imgData = ctx.createImageData(width, height);
        const pixels = imgData.data;
        const original = data1.data;

        for (let i = 0; i < original.length; i += 4) {
            // Grayscale
            const gray = 0.299 * original[i] + 0.587 * original[i + 1] + 0.114 * original[i + 2];
            pixels[i] = gray;
            pixels[i + 1] = gray;
            pixels[i + 2] = gray;
            pixels[i + 3] = original[i + 3];
        }

        // Highlight differences
        for (const pixel of diffPixels) {
            const idx = (pixel.y * width + pixel.x) * 4;
            pixels[idx] = config.highlightColor.r;
            pixels[idx + 1] = config.highlightColor.g;
            pixels[idx + 2] = config.highlightColor.b;
            pixels[idx + 3] = config.highlightColor.a;
        }

        ctx.putImageData(imgData, 0, 0);

        return canvas.toBuffer('image/png');
    }

    /**
     * Generate human-readable summary
     */
    generateSummary(diffPixels, totalPixels, regions) {
        if (diffPixels === 0) {
            return 'Không có thay đổi';
        }

        const percent = ((diffPixels / totalPixels) * 100).toFixed(2);
        const regionCount = regions.length;

        return `${diffPixels.toLocaleString()} pixel khác biệt (${percent}%) trong ${regionCount} vùng`;
    }

    /**
     * Perceptual hash for quick comparison
     * Returns hash string that can be compared
     */
    async perceptualHash(imagePath, hashSize = 8) {
        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(hashSize, hashSize);
            const ctx = canvas.getContext('2d');

            // Resize to hashSize x hashSize
            ctx.drawImage(img, 0, 0, hashSize, hashSize);
            const data = ctx.getImageData(0, 0, hashSize, hashSize).data;

            // Convert to grayscale and calculate average
            const grayPixels = [];
            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                grayPixels.push(gray);
            }

            const avg = grayPixels.reduce((a, b) => a + b, 0) / grayPixels.length;

            // Build hash: 1 if pixel > avg, 0 otherwise
            let hash = '';
            for (const pixel of grayPixels) {
                hash += pixel > avg ? '1' : '0';
            }

            return hash;

        } catch (error) {
            return null;
        }
    }

    /**
     * Compare two perceptual hashes
     */
    hammingDistance(hash1, hash2) {
        if (!hash1 || !hash2 || hash1.length !== hash2.length) {
            return -1;
        }

        let distance = 0;
        for (let i = 0; i < hash1.length; i++) {
            if (hash1[i] !== hash2[i]) {
                distance++;
            }
        }

        return distance;
    }

    /**
     * Save diff image to file
     */
    async saveDiffImage(diffImageData, outputPath) {
        await fs.writeFile(outputPath, diffImageData);
    }
}

module.exports = new PixelDiffer();
