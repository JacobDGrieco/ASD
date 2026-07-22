import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CollectionCard from './CollectionCard.jsx';
import LookCard from './LookCard.jsx';

function isLooseCollection(item) {
	return item.collectionType === 'LOOSE_LOOK' || item.catalogueType === 'loose';
}

export default function FashionCatalogueGrid({ items }) {
	const gridRef = useRef(null);
	const [openCollectionId, setOpenCollectionId] = useState(null);
	const [columns, setColumns] = useState(1);

	useEffect(() => {
		const grid = gridRef.current;
		if (!grid) return;

		const updateColumns = () => {
			const next = Number.parseInt(
				getComputedStyle(grid).getPropertyValue('--catalogue-columns'),
				10,
			) || 1;
			setColumns(next);
		};

		updateColumns();
		const observer = new ResizeObserver(updateColumns);
		observer.observe(grid);
		return () => observer.disconnect();
	}, []);

	const openIndex = items.findIndex(
		(item) => item.type === 'collection' && !isLooseCollection(item) && item.id === openCollectionId,
	);
	const openItem = openIndex === -1 ? null : items[openIndex];
	const openRowEndIndex = openItem
		? Math.min(items.length - 1, Math.floor(openIndex / columns) * columns + columns - 1)
		: -1;

	return (
		<div ref={gridRef} className="fashion-catalogue-grid">
			{items.map((item, index) => (
				<Fragment key={`${item.type}-${item.id}`}>
					{item.type === 'collection' ? (
						<CollectionCard
							collection={item}
							isOpen={openCollectionId === item.id}
							to={isLooseCollection(item) && item.linkedLook?.slug ? `/fashion/looks/${item.linkedLook.slug}` : undefined}
							onClick={isLooseCollection(item) ? undefined : () =>
								setOpenCollectionId((current) => (current === item.id ? null : item.id))
							}
						/>
					) : (
						<LookCard look={item} />
					)}
					{openItem && index === openRowEndIndex && (
						<div className="fashion-catalogue-expand" key={`${openItem.id}-expand`}>
							<div className="fashion-catalogue-expand-header">
								<span className="fashion-catalogue-expand-title">{openItem.title}</span>
								<Link
									to={`/fashion/collections/${openItem.slug}`}
									className="fashion-catalogue-expand-link"
								>
									View Collection
								</Link>
							</div>
							{openItem.looks?.length ? (
								<div className="fashion-catalogue-expand-grid">
									{openItem.looks.map((look) => (
										<LookCard key={look.id} look={look} />
									))}
								</div>
							) : (
								<p className="fashion-page-empty">No looks in this collection yet.</p>
							)}
						</div>
					)}
				</Fragment>
			))}
		</div>
	);
}
