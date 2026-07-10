import { useId, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import DOMPurify from 'dompurify';
import {
	FaBold,
	FaCode,
	FaHeading,
	FaImage,
	FaInfoCircle,
	FaItalic,
	FaLink,
	FaListOl,
	FaListUl,
	FaQuoteLeft,
	FaUnderline,
} from 'react-icons/fa';
import {
	countBoardBodyImages,
	countBoardBodyLinks,
	renderBoardBodyMarkdown,
	validateBoardBodyMarkdown,
} from '../../lib/boardMarkdown.js';

function sanitizeSegment(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function insertAtSelection(value, insertText, selectionStart, selectionEnd) {
	return `${value.slice(0, selectionStart)}${insertText}${value.slice(selectionEnd)}`;
}

function selectedTextOr(value, start, end, fallback) {
	const selectedText = value.slice(start, end);
	return selectedText || fallback;
}

function prependImageMarkdown(value, markdown) {
	const body = String(value ?? '');
	return `${markdown}\n\n${body.replace(/^\s+/, '')}`;
}

function markdownImageAlt(value) {
	return String(value ?? '')
		.replace(/[\r\n[\]]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export default function BoardMarkdownEditor({
	label = 'Body',
	value,
	onChange,
	token,
	entityLabel,
	error,
	onBodyImageUpload,
	maxImages = 1,
	maxLinks = 5,
}) {
	const inputId = useId();
	const textareaId = `${inputId}-body`;
	const textareaRef = useRef(null);
	const [helpOpen, setHelpOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState('');

	const body = value ?? '';
	const imageCount = countBoardBodyImages(body);
	const linkCount = countBoardBodyLinks(body);
	const limitError = validateBoardBodyMarkdown(body, { maxImages, maxLinks });
	const safePreview = DOMPurify.sanitize(renderBoardBodyMarkdown(body));

	const insertImageAtTop = (markdown) => {
		const nextBody = prependImageMarkdown(body, markdown);
		onChange(nextBody);

		requestAnimationFrame(() => {
			textareaRef.current?.focus();
			textareaRef.current?.setSelectionRange(0, markdown.length);
		});
	};

	const wrapSelection = (prefix, suffix, fallback) => {
		const textarea = textareaRef.current;
		const selectionStart = textarea?.selectionStart ?? body.length;
		const selectionEnd = textarea?.selectionEnd ?? body.length;
		const selectedText = selectedTextOr(body, selectionStart, selectionEnd, fallback);
		const markdown = `${prefix}${selectedText}${suffix}`;
		const nextBody = insertAtSelection(body, markdown, selectionStart, selectionEnd);
		onChange(nextBody);

		requestAnimationFrame(() => {
			textarea?.focus();
			const start = selectionStart + prefix.length;
			textarea?.setSelectionRange(start, start + selectedText.length);
		});
	};

	const prefixSelectionLines = (prefix, fallback, { skipEmptyLines = false } = {}) => {
		const textarea = textareaRef.current;
		const selectionStart = textarea?.selectionStart ?? body.length;
		const selectionEnd = textarea?.selectionEnd ?? body.length;
		const hasSelection = selectionStart !== selectionEnd;
		const selectedText = selectedTextOr(body, selectionStart, selectionEnd, fallback);
		const markdown = selectedText
			.split('\n')
			.map((line) => {
				if (skipEmptyLines && hasSelection && !line.trim()) return line;
				return `${prefix}${line || fallback}`;
			})
			.join('\n');
		const nextBody = insertAtSelection(body, markdown, selectionStart, selectionEnd);
		onChange(nextBody);

		requestAnimationFrame(() => {
			textarea?.focus();
			textarea?.setSelectionRange(selectionStart, selectionStart + markdown.length);
		});
	};

	const handleUpload = async (event) => {
		const file = event.target.files?.[0];
		if (!file || !token) return;

		if (imageCount >= maxImages) {
			setUploadError(`Only ${maxImages} image is allowed in the body.`);
			event.target.value = '';
			return;
		}

		setUploading(true);
		setUploadError('');

		try {
			const pathname = `board/${Date.now()}-${sanitizeSegment(file.name)}`;
			const blob = await upload(pathname, file, {
				access: 'public',
				handleUploadUrl: '/api/admin/uploads',
				clientPayload: JSON.stringify({ folder: 'board' }),
				headers: { Authorization: `Bearer ${token}` },
			});

			const uploadedPathname = blob.pathname ?? pathname;
			const altText = markdownImageAlt(entityLabel) || markdownImageAlt(file.name.replace(/\.[^.]+$/, '')) || 'Board image';
			onBodyImageUpload?.(uploadedPathname);
			insertImageAtTop(`![${altText}](${uploadedPathname})`);
		} catch (uploadFailure) {
			setUploadError(uploadFailure instanceof Error ? uploadFailure.message : 'Image upload failed');
		} finally {
			setUploading(false);
			event.target.value = '';
		}
	};

	return (
		<div className="admin-board-page-markdown-editor">
			<div className="admin-board-page-markdown-label-row">
				<label htmlFor={textareaId} className="admin-modal-label">{label}</label>
			</div>

			<div className="admin-board-page-markdown-formatbar" aria-label="Markdown formatting">
				<div className="admin-board-page-markdown-format-actions">
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => prefixSelectionLines('## ', 'Heading')} title="Heading">
						<FaHeading aria-hidden="true" />
					</button>
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => wrapSelection('**', '**', 'bold text')} title="Bold">
						<FaBold aria-hidden="true" />
					</button>
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => wrapSelection('*', '*', 'italic text')} title="Italic">
						<FaItalic aria-hidden="true" />
					</button>
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => wrapSelection('++', '++', 'underlined text')} title="Underline">
						<FaUnderline aria-hidden="true" />
					</button>
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => wrapSelection('[', '](https://example.com)', 'link text')} title="Link">
						<FaLink aria-hidden="true" />
					</button>
					<label
						htmlFor={inputId}
						className={`admin-board-page-markdown-format-btn${uploading || imageCount >= maxImages ? ' admin-board-page-markdown-format-btn-disabled' : ''}`}
						title={imageCount >= maxImages ? `Only ${maxImages} body image is allowed` : 'Upload image into body'}
						aria-label="Upload image into body"
					>
						<FaImage aria-hidden="true" />
					</label>
					<input
						id={inputId}
						type="file"
						accept="image/*"
						className="admin-board-page-markdown-file"
						onChange={handleUpload}
						disabled={uploading || imageCount >= maxImages}
					/>
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => prefixSelectionLines('- ', 'List item', { skipEmptyLines: true })} title="Bulleted list">
						<FaListUl aria-hidden="true" />
					</button>
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => prefixSelectionLines('1. ', 'List item', { skipEmptyLines: true })} title="Numbered list">
						<FaListOl aria-hidden="true" />
					</button>
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => prefixSelectionLines('> ', 'Quote')} title="Quote">
						<FaQuoteLeft aria-hidden="true" />
					</button>
					<button type="button" className="admin-board-page-markdown-format-btn" onClick={() => wrapSelection('`', '`', 'inline quote')} title="Inline quote">
						<FaCode aria-hidden="true" />
					</button>
				</div>
				<div className="admin-board-page-markdown-format-status">
					<span className="admin-board-page-markdown-counts">
						{imageCount}/{maxImages} image, {linkCount}/{maxLinks} links
					</span>
					<button
						type="button"
						className="admin-board-page-markdown-format-btn"
						onClick={() => setHelpOpen((current) => !current)}
						aria-expanded={helpOpen}
						aria-label="Show markdown help"
						title="Markdown help"
					>
						<FaInfoCircle aria-hidden="true" />
					</button>
				</div>
			</div>

			{helpOpen ? (
				<div className="admin-board-page-markdown-help">
					<div><code># Heading</code>, <code>## Heading</code>, or <code>### Heading</code></div>
					<div><code>[link text](https://example.com)</code> for links</div>
					<div><code>**bold**</code>, <code>*italic*</code>, <code>++underline++</code>, <code>`inline quote`</code>, <code>~~strike~~</code></div>
					<div><code>- item</code> for bullets, <code>1. item</code> for numbered lists, <code>&gt; quote</code> for quotes</div>
					<div><code>---</code> for a divider</div>
					<div><code>![image alt](board/image-file.jpg)</code> for body images, or use the upload button</div>
				</div>
			) : null}

			<div className="admin-board-page-markdown-grid">
				<div className="admin-board-page-markdown-pane">
					<div className="admin-board-page-markdown-pane-title">Markdown</div>
					<textarea
						id={textareaId}
						ref={textareaRef}
						className={`admin-board-page-markdown-input${error || limitError ? ' admin-board-page-input-invalid' : ''}`}
						value={body}
						onChange={(event) => onChange(event.target.value)}
						placeholder={'## New post\n\nWrite **bold**, *italic*, ++underline++, or add [a link](https://example.com).\n\n- Add bullets\n- Upload an image into this body'}
						spellCheck
					/>
				</div>
				<div className="admin-board-page-markdown-pane">
					<div className="admin-board-page-markdown-pane-title">Preview</div>
					<div className="admin-board-page-markdown-preview" aria-label="Body preview">
						{safePreview ? (
							<div
								className="admin-board-page-markdown-preview-content"
								dangerouslySetInnerHTML={{ __html: safePreview }}
							/>
						) : (
							<span className="admin-board-page-markdown-preview-empty">Preview appears here.</span>
						)}
					</div>
				</div>
			</div>

			{error || limitError || uploadError ? (
				<p className="admin-board-page-field-error">{error || limitError || uploadError}</p>
			) : null}
		</div>
	);
}
