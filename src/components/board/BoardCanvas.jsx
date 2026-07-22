import { useRef, useEffect } from 'react';
import { LazyMotion, domAnimation, m, useMotionValue } from 'framer-motion';
import '../../styles/board-canvas.css';

export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 2000;

export default function BoardCanvas({ children, editMode }) {
	const viewportRef = useRef(null);
	const x = useMotionValue(0);
	const y = useMotionValue(0);

	useEffect(() => {
		const el = viewportRef.current;
		if (!el) return;
		const { width, height } = el.getBoundingClientRect();
		x.set(Math.round(width / 2 - CANVAS_WIDTH / 2));
		y.set(Math.round(height / 2 - CANVAS_HEIGHT / 2));
	}, [x, y]);

	return (
		<div
			ref={viewportRef}
			className="board-viewport"
		>
			<LazyMotion features={domAnimation}>
				<m.div
					className="board-canvas"
					drag
					dragMomentum={false}
					dragElastic={0}
					dragConstraints={{
						left: -(CANVAS_WIDTH - (viewportRef.current?.offsetWidth ?? 0)),
						right: 0,
						top: -(CANVAS_HEIGHT - (viewportRef.current?.offsetHeight ?? 0)),
						bottom: 0,
					}}
					style={{ x, y, width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
				>
					{children}
				</m.div>
			</LazyMotion>
		</div>
	);
}
