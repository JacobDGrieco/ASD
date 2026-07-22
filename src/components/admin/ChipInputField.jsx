import { useState } from 'react';

function normalizeTags(tags) {
	if (!Array.isArray(tags)) return [];

	const seenTags = new Set();
	return tags.reduce((normalizedTags, tag) => {
		const normalizedTag = String(tag ?? '').trim();
		const key = normalizedTag.toLowerCase();
		if (!normalizedTag || seenTags.has(key)) return normalizedTags;

		seenTags.add(key);
		normalizedTags.push(normalizedTag);
		return normalizedTags;
	}, []);
}

export default function ChipInputField({ value, onChange, placeholder = 'Add a tag' }) {
	const [draft, setDraft] = useState('');
	const tags = normalizeTags(value);

	const commitTag = (rawValue) => {
		const nextTag = String(rawValue ?? '').trim();
		if (!nextTag) return;
		onChange(normalizeTags([...tags, nextTag]));
		setDraft('');
	};

	const removeTag = (tagToRemove) => {
		onChange(tags.filter((tag) => tag !== tagToRemove));
	};

	const handleKeyDown = (event) => {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			commitTag(draft);
			return;
		}

		if (event.key === 'Backspace' && !draft && tags.length > 0) {
			event.preventDefault();
			onChange(tags.slice(0, -1));
		}
	};

	return (
		<div className="admin-chip-input">
			<div className="admin-chip-input-list">
				{tags.map((tag) => (
					<span key={tag} className="admin-chip-input-chip">
						<span>{tag}</span>
						<button
							type="button"
							className="admin-chip-input-remove"
							onClick={() => removeTag(tag)}
							aria-label={`Remove ${tag}`}
						>
							×
						</button>
					</span>
				))}
				<input
					type="text"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => commitTag(draft)}
					className="admin-chip-input-field"
					placeholder={tags.length ? '' : placeholder}
					aria-label={placeholder}
				/>
			</div>
		</div>
	);
}
