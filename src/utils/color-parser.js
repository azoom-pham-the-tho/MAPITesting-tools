/**
 * Advanced Color Parser & Comparator
 * Chuyển đổi và so sánh mọi định dạng màu CSS
 * Hỗ trợ: hex, rgb, rgba, hsl, hsla, named colors
 */

class ColorParser {
    constructor() {
        // CSS named colors
        this.namedColors = {
            // Basic colors
            'black': '#000000',
            'white': '#ffffff',
            'red': '#ff0000',
            'green': '#008000',
            'blue': '#0000ff',
            'yellow': '#ffff00',
            'cyan': '#00ffff',
            'magenta': '#ff00ff',
            'silver': '#c0c0c0',
            'gray': '#808080',
            'maroon': '#800000',
            'olive': '#808000',
            'lime': '#00ff00',
            'aqua': '#00ffff',
            'teal': '#008080',
            'navy': '#000080',
            'fuchsia': '#ff00ff',
            'purple': '#800080',
            'orange': '#ffa500',
            'transparent': 'rgba(0,0,0,0)',
            // Extended colors (thêm nhiều màu nếu cần)
        };

        this.config = {
            // Thresholds for color comparison
            perceptualThreshold: 5,      // Just Noticeable Difference (JND)
            strictThreshold: 1,           // Strict pixel-perfect
            alphaThreshold: 0.01         // Alpha channel threshold
        };
    }

    /**
     * Parse bất kỳ định dạng màu CSS nào thành RGBA
     */
    parse(colorString) {
        if (!colorString) {
            return null;
        }

        colorString = colorString.trim().toLowerCase();

        // Named color
        if (this.namedColors[colorString]) {
            return this.parse(this.namedColors[colorString]);
        }

        // Transparent
        if (colorString === 'transparent') {
            return { r: 0, g: 0, b: 0, a: 0 };
        }

        // HEX (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)
        if (colorString.startsWith('#')) {
            return this.parseHex(colorString);
        }

        // RGB/RGBA
        if (colorString.startsWith('rgb')) {
            return this.parseRgb(colorString);
        }

        // HSL/HSLA
        if (colorString.startsWith('hsl')) {
            return this.parseHsl(colorString);
        }

        return null;
    }

    /**
     * Parse HEX color
     */
    parseHex(hex) {
        hex = hex.replace('#', '');

        let r, g, b, a = 255;

        if (hex.length === 3) {
            // #RGB
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 4) {
            // #RGBA
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
            a = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 6) {
            // #RRGGBB
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        } else if (hex.length === 8) {
            // #RRGGBBAA
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
            a = parseInt(hex.substr(6, 2), 16);
        } else {
            return null;
        }

        return { r, g, b, a: a / 255 };
    }

    /**
     * Parse RGB/RGBA color
     */
    parseRgb(rgb) {
        // rgb(255, 0, 0) or rgba(255, 0, 0, 0.5)
        const match = rgb.match(/rgba?\(([^)]+)\)/);
        if (!match) return null;

        const parts = match[1].split(',').map(p => p.trim());

        const r = parseInt(parts[0]);
        const g = parseInt(parts[1]);
        const b = parseInt(parts[2]);
        const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;

        return { r, g, b, a };
    }

    /**
     * Parse HSL/HSLA color
     */
    parseHsl(hsl) {
        // hsl(120, 100%, 50%) or hsla(120, 100%, 50%, 0.5)
        const match = hsl.match(/hsla?\(([^)]+)\)/);
        if (!match) return null;

        const parts = match[1].split(',').map(p => p.trim());

        const h = parseFloat(parts[0]);
        const s = parseFloat(parts[1].replace('%', '')) / 100;
        const l = parseFloat(parts[2].replace('%', '')) / 100;
        const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;

        // Convert HSL to RGB
        return this.hslToRgb(h, s, l, a);
    }

    /**
     * Convert HSL to RGB
     */
    hslToRgb(h, s, l, a = 1) {
        h = h / 360;

        let r, g, b;

        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
            a
        };
    }

    /**
     * Convert RGBA to HEX
     */
    toHex(rgba) {
        if (!rgba) return null;

        const rHex = rgba.r.toString(16).padStart(2, '0');
        const gHex = rgba.g.toString(16).padStart(2, '0');
        const bHex = rgba.b.toString(16).padStart(2, '0');

        if (rgba.a !== undefined && rgba.a < 1) {
            const aHex = Math.round(rgba.a * 255).toString(16).padStart(2, '0');
            return `#${rHex}${gHex}${bHex}${aHex}`;
        }

        return `#${rHex}${gHex}${bHex}`;
    }

    /**
     * Convert RGBA to CSS string
     */
    toRgbaString(rgba) {
        if (!rgba) return null;

        if (rgba.a === 1 || rgba.a === undefined) {
            return `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
        }

        return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
    }

    /**
     * So sánh hai màu
     * Trả về true nếu giống nhau (trong threshold)
     */
    equals(color1, color2, options = {}) {
        const threshold = options.threshold || this.config.perceptualThreshold;

        const rgba1 = this.parse(color1);
        const rgba2 = this.parse(color2);

        if (!rgba1 || !rgba2) {
            return color1 === color2; // Fallback to string comparison
        }

        // Check alpha first
        if (Math.abs(rgba1.a - rgba2.a) > this.config.alphaThreshold) {
            return false;
        }

        // Calculate color distance
        const distance = this.colorDistance(rgba1, rgba2);

        return distance <= threshold;
    }

    /**
     * Calculate color distance (Euclidean in RGB space)
     * More accurate: use CIEDE2000 for perceptual difference
     */
    colorDistance(rgba1, rgba2) {
        const dr = rgba1.r - rgba2.r;
        const dg = rgba1.g - rgba2.g;
        const db = rgba1.b - rgba2.b;

        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    /**
     * Perceptual color difference using CIEDE2000
     * Most accurate for human perception
     */
    ciede2000(color1, color2) {
        const rgba1 = this.parse(color1);
        const rgba2 = this.parse(color2);

        if (!rgba1 || !rgba2) return null;

        // Convert RGB to LAB color space
        const lab1 = this.rgbToLab(rgba1);
        const lab2 = this.rgbToLab(rgba2);

        // Calculate CIEDE2000 delta E
        return this.deltaE2000(lab1, lab2);
    }

    /**
     * Convert RGB to LAB color space
     */
    rgbToLab(rgba) {
        // RGB to XYZ
        let r = rgba.r / 255;
        let g = rgba.g / 255;
        let b = rgba.b / 255;

        r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

        const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
        const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
        const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

        // XYZ to LAB
        const xn = 0.95047;
        const yn = 1.00000;
        const zn = 1.08883;

        const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1 / 3) : (7.787 * x / xn + 16 / 116);
        const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1 / 3) : (7.787 * y / yn + 16 / 116);
        const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1 / 3) : (7.787 * z / zn + 16 / 116);

        const L = 116 * fy - 16;
        const a = 500 * (fx - fy);
        const b2 = 200 * (fy - fz);

        return { L, a, b: b2 };
    }

    /**
     * CIEDE2000 color difference
     * Simplified implementation
     */
    deltaE2000(lab1, lab2) {
        const deltaL = lab2.L - lab1.L;
        const deltaA = lab2.a - lab1.a;
        const deltaB = lab2.b - lab1.b;

        const C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
        const C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
        const deltaC = C2 - C1;

        const deltaH = Math.sqrt(deltaA * deltaA + deltaB * deltaB - deltaC * deltaC);

        const SL = 1;
        const SC = 1 + 0.045 * ((C1 + C2) / 2);
        const SH = 1 + 0.015 * ((C1 + C2) / 2);

        const deltaE = Math.sqrt(
            Math.pow(deltaL / SL, 2) +
            Math.pow(deltaC / SC, 2) +
            Math.pow(deltaH / SH, 2)
        );

        return deltaE;
    }

    /**
     * Compare two color strings and return detailed diff
     */
    compare(color1, color2) {
        const rgba1 = this.parse(color1);
        const rgba2 = this.parse(color2);

        if (!rgba1 || !rgba2) {
            return {
                equal: color1 === color2,
                originalEqual: color1 === color2,
                error: 'Không thể parse màu'
            };
        }

        const distance = this.colorDistance(rgba1, rgba2);
        const perceptualDiff = this.ciede2000(color1, color2);

        return {
            equal: this.equals(color1, color2),
            originalEqual: color1 === color2,
            color1: {
                original: color1,
                rgba: rgba1,
                hex: this.toHex(rgba1)
            },
            color2: {
                original: color2,
                rgba: rgba2,
                hex: this.toHex(rgba2)
            },
            diff: {
                rgb: distance,
                perceptual: perceptualDiff,
                r: Math.abs(rgba1.r - rgba2.r),
                g: Math.abs(rgba1.g - rgba2.g),
                b: Math.abs(rgba1.b - rgba2.b),
                a: Math.abs(rgba1.a - rgba2.a)
            }
        };
    }

    /**
     * Extract all colors from CSS style string
     */
    extractColors(styleString) {
        if (!styleString) return [];

        const colors = [];

        // Match hex colors
        const hexMatches = styleString.match(/#[0-9a-f]{3,8}/gi) || [];
        colors.push(...hexMatches);

        // Match rgb/rgba
        const rgbMatches = styleString.match(/rgba?\([^)]+\)/gi) || [];
        colors.push(...rgbMatches);

        // Match hsl/hsla
        const hslMatches = styleString.match(/hsla?\([^)]+\)/gi) || [];
        colors.push(...hslMatches);

        return colors;
    }

    /**
     * Compare colors in two style strings
     */
    compareStyles(style1, style2) {
        const colors1 = this.extractColors(style1);
        const colors2 = this.extractColors(style2);

        const changes = [];

        // Simple comparison (can be enhanced)
        for (let i = 0; i < Math.max(colors1.length, colors2.length); i++) {
            const c1 = colors1[i];
            const c2 = colors2[i];

            if (c1 && c2) {
                const comparison = this.compare(c1, c2);
                if (!comparison.equal) {
                    changes.push({
                        type: 'changed',
                        old: c1,
                        new: c2,
                        diff: comparison.diff
                    });
                }
            } else if (c1) {
                changes.push({ type: 'removed', color: c1 });
            } else if (c2) {
                changes.push({ type: 'added', color: c2 });
            }
        }

        return {
            hasChanges: changes.length > 0,
            changes
        };
    }
}

module.exports = new ColorParser();
