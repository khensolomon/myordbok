/**
 * Custom Webpack Loader for Dynamic SVG Manipulation and Optimization.
 * * This loader intercepts `.svg` imports and applies transformations (resizing, 
 * format conversion, and minification) based on URL query parameters.
 * It features an in-memory cache to prevent redundant processing of identical 
 * files + queries across different files (e.g., multiple SCSS blocks).
 *
 * @example
 * // 1. Legacy Favicons (Auto-converts to PNG, extracts size from name)
 * import "../psd/icon.svg?as=favicon-32x32";
 * import "../psd/icon.svg?as=apple-touch-icon";
 * * // 2. Format Conversion (Rasterizes to WebP, JPEG, or PNG using 'sharp')
 * import "../psd/hero.svg?as=banner&w=800&format=webp";
 * * // 3. SVG-to-SVG Resizing & Vanilla Minification (Bypasses 'sharp', preserves vector)
 * import "../psd/logo.svg?as=logo-small&w=250";
 * * @param {string} this.resourceQuery - The query string (e.g., ?as=logo&w=600&format=png)
 * - `as`: Target filename/alias (also triggers legacy fallback if it contains "favicon")
 * - `w`: Target width in pixels
 * - `h`: Target height in pixels
 * - `format`: Target output format ('svg', 'png', 'webp', 'jpeg', 'jpg')
 * @param {Buffer} content - The raw file buffer of the imported SVG.
 * @returns {Buffer} The processed image buffer (SVG string buffer or rasterized image).
 */
const sharp = require("sharp");

// In-memory cache to prevent re-processing identical files + queries during the same build
const imageCache = new Map();

module.exports = async function (content) {
	const callback = this.async();
	
	// 'this.resource' contains the absolute file path PLUS the query string (e.g., /path/icon.svg?as=logo&w=600&format=png)
	// This makes it a perfect, unique cache key.
	const cacheKey = this.resource;

	// Check if we've already processed this exact request during this build
	if (imageCache.has(cacheKey)) {
		return callback(null, imageCache.get(cacheKey));
	}

	const query = new URLSearchParams(this.resourceQuery || "");
	
	const as = query.get("as");
	const queryFormat = query.get("format");
	let width = query.get("w") ? parseInt(query.get("w"), 10) : null;
	let height = query.get("h") ? parseInt(query.get("h"), 10) : null;

	const isLegacyFavicon = as && (as.includes("favicon") || as.includes("apple") || as.includes("chrome"));

	// Determine the target format. 
	// Default to 'svg' to preserve vectors, unless it's a legacy favicon which defaults to 'png'.
	const format = queryFormat || (isLegacyFavicon ? "png" : "svg");

	// Fallback to extract size from legacy names like "favicon-32x32"
	const sizeMatch = as ? as.match(/(\d+)x(\d+)/) : null;
	if (sizeMatch && !width && !height) {
		width = parseInt(sizeMatch[1], 10);
		height = parseInt(sizeMatch[2], 10);
	} else if (as && as.includes("apple-touch-icon") && !width) {
		width = 180;
		height = 180; // Apple touch icons standard size
	}

	// Check if we need to process this image.
	const hasExplicitArgs = query.has("w") || query.has("h") || query.has("format");

	if (!isLegacyFavicon && !hasExplicitArgs) {
		// Even for untouched files, we can cache the original content buffer
		imageCache.set(cacheKey, content);
		return callback(null, content);
	}

	try {
		// Native SVG-to-SVG handling
		if (format === "svg") {
			let svgStr = content.toString("utf-8");
			
			if (width || height) {
				// Safely find the root <svg> tag and replace/inject the new dimensions
				svgStr = svgStr.replace(/<svg([^>]+)>/i, (match, attributes) => {
					// Remove existing width and height attributes to avoid duplicates
					let newAttributes = attributes.replace(/\s*(?:width|height)="[^"]*"/gi, "");
					
					// Inject the new requested dimensions
					if (width) newAttributes += ` width="${width}"`;
					if (height) newAttributes += ` height="${height}"`;
					
					return `<svg ${newAttributes.trim()}>`;
				});
			}

			// Vanilla Minification (No dependencies)
			// 1. Remove XML comments
			svgStr = svgStr.replace(/<!--[\s\S]*?-->/g, "");
			// 2. Remove line breaks and tabs
			svgStr = svgStr.replace(/[\r\n\t]+/g, " ");
			// 3. Remove whitespace directly between tags
			svgStr = svgStr.replace(/>\s+</g, "><");
			// 4. Crush multiple spaces into a single space
			svgStr = svgStr.replace(/\s{2,}/g, " ");
			
			const resultBuffer = Buffer.from(svgStr.trim());
			
			// Save the optimized buffer to our cache before returning
			imageCache.set(cacheKey, resultBuffer);
			return callback(null, resultBuffer);
		}

		// Rasterization handling (for PNG, WebP, JPEG) using sharp
		let pipeline = sharp(content);

		// Apply resizing if dimensions exist
		if (width || height) {
			pipeline = pipeline.resize(width, height);
		}

		// Apply format conversions
		if (format === "webp") {
			pipeline = pipeline.webp();
		} else if (format === "jpeg" || format === "jpg") {
			pipeline = pipeline.jpeg();
		} else {
			pipeline = pipeline.png();
		}

		const buffer = await pipeline.toBuffer();
		
		// Save the generated image buffer to our cache before returning
		imageCache.set(cacheKey, buffer);
		callback(null, buffer);
	} catch (err) {
		callback(err);
	}
};

module.exports.raw = true;