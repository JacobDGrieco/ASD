import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function optionImage(option, className) {
	if (!option?.image) return <span className={`${className} crew-picker-option-img-blank`} aria-hidden="true" />;
	return <img src={option.image.previewUrl || option.image.url} alt="" className={className} />;
}

export default function MusicRolePersonPickerField({
	name,
	artistId,
	outsideArtistId,
	artistOptions = [],
	outsideArtistOptions = [],
	onChange,
}) {
	const [filter, setFilter] = useState('');
	const [open, setOpen] = useState(false);
	const [dropdownStyle, setDropdownStyle] = useState(null);
	const listboxId = useId();
	const containerRef = useRef(null);
	const dropdownRef = useRef(null);

	useEffect(() => {
		if (!open) return undefined;

		const handleOutside = (event) => {
			const target = event.target;
			const isInInput = containerRef.current?.contains(target);
			const isInDropdown = dropdownRef.current?.contains(target);

			if (!isInInput && !isInDropdown) {
				setOpen(false);
				setFilter('');
			}
		};

		document.addEventListener('mousedown', handleOutside);
		return () => document.removeEventListener('mousedown', handleOutside);
	}, [open]);

	useEffect(() => {
		if (!open) return undefined;

		const updateDropdownPosition = () => {
			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) return;

			const spaceBelow = window.innerHeight - rect.bottom - 8;
			const spaceAbove = rect.top - 8;
			const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
			const maxHeight = Math.max(120, Math.min(280, (openAbove ? spaceAbove : spaceBelow) - 4));

			setDropdownStyle({
				left: rect.left,
				top: openAbove ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
				width: rect.width,
				maxHeight,
			});
		};

		updateDropdownPosition();
		window.addEventListener('resize', updateDropdownPosition);
		window.addEventListener('scroll', updateDropdownPosition, true);

		return () => {
			window.removeEventListener('resize', updateDropdownPosition);
			window.removeEventListener('scroll', updateDropdownPosition, true);
		};
	}, [open]);

	const normalizedFilter = filter.trim().toLowerCase();
	const filteredArtists = artistOptions.filter((artist) => artist.name.toLowerCase().includes(normalizedFilter));
	const filteredOutsideArtists = outsideArtistOptions.filter((artist) => artist.name.toLowerCase().includes(normalizedFilter));
	const hasResults = filteredArtists.length > 0 || filteredOutsideArtists.length > 0;

	const selectArtist = (artist) => {
		onChange({
			artistId: artist.id,
			outsideArtistId: '',
			name: artist.name,
		});
		setFilter('');
		setOpen(false);
	};

	const selectOutsideArtist = (artist) => {
		onChange({
			artistId: '',
			outsideArtistId: artist.id,
			name: artist.name,
			externalUrl: artist.externalUrl ?? '',
			_prefillRole: artist.role ?? '',
		});
		setFilter('');
		setOpen(false);
	};

	const handleFocus = () => {
		setFilter(name || '');
		setOpen(true);
	};

	const handleInputChange = (event) => {
		const value = event.target.value;
		setFilter(value);
		setOpen(true);
		onChange({ artistId: '', outsideArtistId: '', externalUrl: '', name: value });
	};

	const dropdown = open && dropdownStyle ? (
		<div id={listboxId} className="crew-picker-dropdown" role="listbox" ref={dropdownRef} style={dropdownStyle}>
			{filteredArtists.length > 0 && (
				<>
					<div className="crew-picker-group-label">Artists</div>
					{filteredArtists.map((artist) => (
						<button
							key={artist.id}
							type="button"
							role="option"
							aria-selected={artist.id === artistId}
							className="crew-picker-option"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => selectArtist(artist)}
						>
							{optionImage(artist, 'crew-picker-option-img')}
							<span className="crew-picker-option-name">{artist.name}</span>
							<span className="crew-picker-option-role">Artist</span>
						</button>
					))}
				</>
			)}

			{filteredOutsideArtists.length > 0 && (
				<>
					<div className="crew-picker-group-label">Outside Artists</div>
					{filteredOutsideArtists.map((artist) => (
						<button
							key={artist.id}
							type="button"
							role="option"
							aria-selected={artist.id === outsideArtistId}
							className="crew-picker-option"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => selectOutsideArtist(artist)}
						>
							{optionImage(artist, 'crew-picker-option-img')}
							<span className="crew-picker-option-name">{artist.name}</span>
							<span className="crew-picker-option-role">{artist.role}</span>
						</button>
					))}
				</>
			)}

			{!hasResults && <div className="crew-picker-empty">No results</div>}
		</div>
	) : null;

	return (
		<div className="crew-picker-field" ref={containerRef}>
			<div className="crew-picker-input-row">
				<input
					type="text"
					className="admin-artists-page-input crew-picker-input"
					placeholder="Search artists or outside artists..."
					value={open ? filter : (name || '')}
					onChange={handleInputChange}
					onFocus={handleFocus}
					role="combobox"
					aria-controls={listboxId}
					aria-expanded={open}
					aria-autocomplete="list"
					autoComplete="off"
				/>
			</div>

			{dropdown ? createPortal(dropdown, document.body) : null}
		</div>
	);
}
