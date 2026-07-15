import { useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { TabView } from 'primereact/tabview';
import '../../styles/SongPage.css';

export default function PageTabs({
	children,
	className = '',
	tabCount,
	activeIndex,
	defaultActiveIndex = 0,
	onTabChange = null,
}) {
	const [internalActiveIndex, setInternalActiveIndex] = useState(defaultActiveIndex);
	const isControlled = typeof activeIndex === 'number';
	const currentIndex = isControlled ? activeIndex : internalActiveIndex;
	const lastIndex = Math.max(0, tabCount - 1);
	const safeIndex = Math.max(0, Math.min(currentIndex, lastIndex));
	const canGoPrevious = safeIndex > 0;
	const canGoNext = safeIndex < lastIndex;

	const setTabIndex = (index) => {
		const nextIndex = Math.max(0, Math.min(index, lastIndex));
		if (!isControlled) setInternalActiveIndex(nextIndex);
		onTabChange?.({ index: nextIndex });
	};

	return (
		<div className="page-tabs-shell">
			<button
				type="button"
				className="page-tabs-arrow page-tabs-arrow-left"
				onClick={() => setTabIndex(safeIndex - 1)}
				disabled={!canGoPrevious}
				aria-label="Previous tab"
				aria-hidden={!canGoPrevious}
				tabIndex={canGoPrevious ? 0 : -1}
			>
				<FaChevronLeft aria-hidden="true" />
			</button>
			<div className="page-tabs-panel">
				<TabView
					className={`page-tabview ${className}`.trim()}
					activeIndex={safeIndex}
					onTabChange={(event) => setTabIndex(event.index)}
				>
					{children}
				</TabView>
			</div>
			<button
				type="button"
				className="page-tabs-arrow page-tabs-arrow-right"
				onClick={() => setTabIndex(safeIndex + 1)}
				disabled={!canGoNext}
				aria-label="Next tab"
				aria-hidden={!canGoNext}
				tabIndex={canGoNext ? 0 : -1}
			>
				<FaChevronRight aria-hidden="true" />
			</button>
		</div>
	);
}
