/**
 * Admin autocomplete field for reusable fashion crew/outside-talent credits.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TALENT_ROLE_TO_LABEL = {
	MODEL: 'Model',
	DESIGNER: 'Designer',
	PHOTOGRAPHER: 'Photographer',
	EDITOR: 'Photo Editor',
	STYLIST: 'Stylist',
	OTHER: 'Other',
};

function optionImage(option, className) {
	if (!option.image) return <div className={`${className} crew-picker-option-img-blank`} />;
	return <img src={option.image.previewUrl || option.image.url} alt="" className={className} />;
}

function talentRoleLabel(role) {
	return TALENT_ROLE_TO_LABEL[role] ?? role ?? '';
}

export default function CrewPickerField({ creditName, talentId, crewId, talentOptions = [], crewOptions = [], onChange }) {
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
	const filteredTalent = talentOptions.filter((talent) => talent.name.toLowerCase().includes(normalizedFilter));
	const filteredCrew = crewOptions.filter((member) => member.name.toLowerCase().includes(normalizedFilter));
	const hasResults = filteredTalent.length > 0 || filteredCrew.length > 0;
	const dropdown = open && dropdownStyle ? (
		<div id={listboxId} className="crew-picker-dropdown" role="listbox" ref={dropdownRef} style={dropdownStyle}>
			{filteredTalent.length > 0 && (
				<>
					<div className="crew-picker-group-label">Talent</div>
					{filteredTalent.map((talent) => (
						<button
							key={talent.id}
							type="button"
							role="option"
							aria-selected={talent.id === talentId}
							className="crew-picker-option"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => selectTalent(talent)}
						>
							{optionImage(talent, 'crew-picker-option-img')}
							<span className="crew-picker-option-name">{talent.name}</span>
							<span className="crew-picker-option-role">{talentRoleLabel(talent.role)}</span>
						</button>
					))}
				</>
			)}

			{filteredCrew.length > 0 && (
				<>
					<div className="crew-picker-group-label">Outside Talent</div>
					{filteredCrew.map((member) => (
						<button
							key={member.id}
							type="button"
							role="option"
							aria-selected={member.id === crewId}
							className="crew-picker-option"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => selectCrew(member)}
						>
							{optionImage(member, 'crew-picker-option-img')}
							<span className="crew-picker-option-name">{member.name}</span>
							<span className="crew-picker-option-role">{member.role}</span>
						</button>
					))}
				</>
			)}

			{!hasResults && <div className="crew-picker-empty">No results</div>}
		</div>
	) : null;

	const handleFocus = () => {
		setFilter(creditName || '');
		setOpen(true);
	};

	const handleInputChange = (event) => {
		const value = event.target.value;
		setFilter(value);
		setOpen(true);
		onChange({ talentId: '', crewId: '', creditName: value });
	};

	const selectTalent = (talent) => {
		onChange({
			talentId: talent.id,
			crewId: '',
			creditName: talent.name,
			_prefillRole: talentRoleLabel(talent.role),
		});
		setFilter('');
		setOpen(false);
	};

	const selectCrew = (member) => {
		onChange({
			talentId: '',
			crewId: member.id,
			creditName: member.name,
			_prefillRole: member.role,
		});
		setFilter('');
		setOpen(false);
	};

	return (
		<div className="crew-picker-field" ref={containerRef}>
			<div className="crew-picker-input-row">
				<input
					type="text"
					className="admin-artists-page-input crew-picker-input"
					placeholder="Search talent or outside talent..."
					value={open ? filter : (creditName || '')}
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
