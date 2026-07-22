/**
 * Hand-rolled, security-conscious markdown-subset renderer + validator for "board"
 * post bodies (the freeform pinboard feature). Board posts are written by
 * artist-scoped admins, so the threat model is "semi-trusted CMS input, not fully
 * trusted, not fully untrusted public input": output is escaped by default, and
 * only an explicit allowlist of things is permitted through unescaped.
 *
 * What's allowed through:
 * - A fixed set of block-level HTML tags (see `HTML_BLOCK_TAG_PATTERN`) — if a
 *   paragraph block matches one of these, its lines are treated as raw HTML rather
 *   than run through the markdown-subset parser.
 * - Markdown images/links, but only with `isSafeUrl`-approved URLs (http(s)/mailto/
 *   tel schemes, or root-relative paths) — this blocks `javascript:`-style payloads.
 * - A small set of inline markdown tokens (`**bold**`, `*italic*`, `++underline++`,
 *   `~~strike~~`, `` `code` ``).
 *
 * `validateBoardBodyMarkdown` separately enforces per-post image/link count caps —
 * an anti-abuse limit on a CMS field with fairly open-ended admin write access, not
 * a security control (see `IMAGE_LIMIT`/`LINK_LIMIT`).
 *
 * The renderer's output is still expected to pass through DOMPurify client-side
 * (see `BoardCardDetail.jsx`) before being used with `dangerouslySetInnerHTML` —
 * this module reduces the attack surface DOMPurify has to sanitize, it isn't a
 * substitute for it.
 *
 * Runs in both server (validation on save, `adminBoardHandler.js`) and client
 * (rendering for display, `BoardCardDetail.jsx`; live preview, `BoardMarkdownEditor.jsx`)
 * contexts — pure string transforms, no I/O.
 */
const IMAGE_LIMIT = 1;
const LINK_LIMIT = 5;

const HTML_TAG_TOKEN_PATTERN = /<\/?[a-z][^>]*>/gi;
const HTML_BLOCK_TAG_PATTERN = /<\/?(?:address|article|aside|blockquote|div|figure|figcaption|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/i;
const HTML_IMAGE_PATTERN = /<img\b/gi;
const HTML_IMAGE_SRC_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi;
const HTML_LINK_PATTERN = /<a\b[^>]*href\s*=/gi;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const MARKDOWN_LINK_PATTERN = /(^|[^!])\[[^\]]+]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
	return escapeHtml(value).replace(/`/g, '&#96;');
}

// Allowlists URL schemes for rendered links/images: bare relative paths, root-
// relative paths, or absolute URLs using http(s)/mailto/tel. Deliberately excludes
// `javascript:`, `data:`, and any other scheme that could execute in the viewer.
function isSafeUrl(value) {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return false;
	if (/^[a-z0-9][a-z0-9._/-]*$/i.test(trimmed)) return true;
	if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;

	try {
		const url = new URL(trimmed);
		return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
	} catch {
		return false;
	}
}

function resolveImageUrl(value) {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return '';
	if (/^[a-z0-9][a-z0-9._/-]*$/i.test(trimmed)) {
		return `/api/blob?pathname=${encodeURIComponent(trimmed)}`;
	}
	return trimmed;
}

function imageValueToPathname(value) {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return '';

	if (/^[a-z0-9][a-z0-9._/-]*$/i.test(trimmed)) return trimmed;

	try {
		const url = new URL(trimmed, 'http://localhost');
		if (url.pathname === '/api/blob') return url.searchParams.get('pathname') ?? '';
		if (/\.public\.blob\.vercel-storage\.com$/i.test(url.hostname)) {
			return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
		}
	} catch {
		return '';
	}

	return '';
}

/**
 * Finds every managed-blob image pathname referenced in a post body (markdown
 * `![]()` syntax or raw `<img src>`), so `blobCleanup.js` can include body images
 * when deciding what's still referenced after an edit or delete.
 *
 * @returns {Set<string>} Pathnames found in the body.
 */
export function extractBoardBodyImagePathnames(body) {
	const source = String(body ?? '');
	const pathnames = new Set();

	for (const match of source.matchAll(MARKDOWN_IMAGE_PATTERN)) {
		const pathname = imageValueToPathname(match[1]);
		if (pathname) pathnames.add(pathname);
	}

	for (const match of source.matchAll(HTML_IMAGE_SRC_PATTERN)) {
		const pathname = imageValueToPathname(match[2]);
		if (pathname) pathnames.add(pathname);
	}

	return pathnames;
}

function countMatches(value, pattern) {
	return (String(value ?? '').match(pattern) ?? []).length;
}

export function countBoardBodyImages(body) {
	return countMatches(body, HTML_IMAGE_PATTERN) + countMatches(body, MARKDOWN_IMAGE_PATTERN);
}

export function countBoardBodyLinks(body) {
	return countMatches(body, HTML_LINK_PATTERN) + countMatches(body, MARKDOWN_LINK_PATTERN);
}

/**
 * Enforces the per-post image/link caps on a board body before save.
 * @returns {string} A user-facing error message, or `''` if the body is within limits.
 */
export function validateBoardBodyMarkdown(body, { maxImages = IMAGE_LIMIT, maxLinks = LINK_LIMIT } = {}) {
	const imageCount = countBoardBodyImages(body);
	const linkCount = countBoardBodyLinks(body);

	if (imageCount > maxImages) {
		return `Board posts can include at most ${maxImages} image in the body.`;
	}

	if (linkCount > maxLinks) {
		return `Board posts can include at most ${maxLinks} links in the body.`;
	}

	return '';
}

function restoreTokens(value, tokens) {
	// Tokens are intentionally wrapped in NUL sentinels so user text cannot collide with generated placeholders.
	// eslint-disable-next-line no-control-regex
	return value.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] ?? '');
}

// Renders one line's worth of inline markdown to HTML. HTML tags, images, links,
// and inline code are extracted into `tokens` and replaced with a NUL-delimited
// placeholder *before* the remaining text is HTML-escaped — this stops the escape
// pass from mangling the already-built-safe HTML, and `restoreTokens` splices the
// real markup back in afterward.
function renderInlineMarkdown(value) {
	const tokens = [];
	const stash = (html) => {
		const index = tokens.length;
		tokens.push(html);
		return `\u0000${index}\u0000`;
	};

	let text = String(value ?? '');

	text = text.replace(HTML_TAG_TOKEN_PATTERN, (tag) => stash(tag));

	text = text.replace(MARKDOWN_IMAGE_PATTERN, (match, url) => {
		if (!isSafeUrl(url)) return match;
		const alt = match.match(/^!\[([^\]]*)]/)?.[1] ?? '';
		return stash(`<img src="${escapeAttribute(resolveImageUrl(url))}" alt="${escapeAttribute(alt)}" />`);
	});

	text = text.replace(MARKDOWN_LINK_PATTERN, (match, prefix, url) => {
		if (!isSafeUrl(url)) return match;
		const label = match.slice(prefix.length).match(/^\[([^\]]+)]/)?.[1] ?? url;
		return `${prefix}${stash(`<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`)}`;
	});

	text = text.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
	text = escapeHtml(text);
	text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	text = text.replace(/\+\+([^+]+)\+\+/g, '<u>$1</u>');
	text = text.replace(/(^|[^\w*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
	text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');

	return restoreTokens(text, tokens);
}

function renderList(lines) {
	const items = lines
		.flatMap((line) => {
			const trimmedLine = line.replace(/^\s*[-*]\s+/, '').trim();
			return trimmedLine ? [`<li>${renderInlineMarkdown(trimmedLine)}</li>`] : [];
		})
		.join('');

	return items ? `<ul>${items}</ul>` : '';
}

function renderOrderedList(lines) {
	const items = lines
		.flatMap((line) => {
			const trimmedLine = line.replace(/^\s*\d+[.)]\s+/, '').trim();
			return trimmedLine ? [`<li>${renderInlineMarkdown(trimmedLine)}</li>`] : [];
		})
		.join('');

	return items ? `<ol>${items}</ol>` : '';
}

function renderQuote(lines) {
	const content = lines
		.flatMap((line) => {
			const trimmedLine = line.replace(/^\s*>\s?/, '').trim();
			return trimmedLine ? [renderInlineMarkdown(trimmedLine)] : [];
		})
		.join('<br />');

	return content ? `<blockquote>${content}</blockquote>` : '';
}

function renderParagraph(lines) {
	const content = lines.map((line) => renderInlineMarkdown(line)).join('<br />');
	return content.trim() ? `<p>${content}</p>` : '';
}

function renderHtmlBlock(lines) {
	return lines.map((line) => renderInlineMarkdown(line)).join('<br />');
}

function renderMarkdownBlock(lines) {
	const output = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];
		const headingMatch = line.match(/^\s*(#{1,3})\s+(.+)$/) ?? line.match(/^\s*(#{1,3})([^#\s].+)$/);

		if (headingMatch) {
			const level = headingMatch[1].length;
			output.push(`<h${level}>${renderInlineMarkdown(headingMatch[2].trim())}</h${level}>`);
			index += 1;
			continue;
		}

		if (/^\s*---+\s*$/.test(line)) {
			output.push('<hr />');
			index += 1;
			continue;
		}

		if (/^\s*[-*]\s+/.test(line)) {
			const listLines = [];
			while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
				listLines.push(lines[index]);
				index += 1;
			}
			output.push(renderList(listLines));
			continue;
		}

		if (/^\s*\d+[.)]\s+/.test(line)) {
			const listLines = [];
			while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
				listLines.push(lines[index]);
				index += 1;
			}
			output.push(renderOrderedList(listLines));
			continue;
		}

		if (/^\s*>\s?/.test(line)) {
			const quoteLines = [];
			while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
				quoteLines.push(lines[index]);
				index += 1;
			}
			output.push(renderQuote(quoteLines));
			continue;
		}

		const paragraphLines = [];
		while (
			index < lines.length &&
			!/^\s*(#{1,3})\s+(.+)$/.test(lines[index]) &&
			!/^\s*(#{1,3})([^#\s].+)$/.test(lines[index]) &&
			!/^\s*---+\s*$/.test(lines[index]) &&
			!/^\s*[-*]\s+/.test(lines[index]) &&
			!/^\s*\d+[.)]\s+/.test(lines[index]) &&
			!/^\s*>\s?/.test(lines[index])
		) {
			paragraphLines.push(lines[index]);
			index += 1;
		}

		output.push(renderParagraph(paragraphLines));
	}

	return output.filter(Boolean).join('');
}

/**
 * Renders a board post body to sanitized-ish HTML (see module header — still
 * expected to go through DOMPurify before `dangerouslySetInnerHTML`). Splits the
 * body into blank-line-separated blocks; a block containing an allowlisted HTML
 * block tag is passed through as raw HTML (inline-formatted), everything else is
 * parsed as the markdown subset (headings, lists, blockquotes, paragraphs).
 */
export function renderBoardBodyMarkdown(body) {
	const source = String(body ?? '').trim();
	if (!source) return '';

	const blocks = source.replace(/\r\n?/g, '\n').split(/\n{2,}/);

	return blocks
		.flatMap((block) => {
			const lines = block.split('\n').filter((line) => line.trim());
			if (!lines.length) return [];
			const renderedBlock = HTML_BLOCK_TAG_PATTERN.test(block)
				? renderHtmlBlock(lines)
				: renderMarkdownBlock(lines);
			return renderedBlock ? [renderedBlock] : [];
		})
		.join('');
}
