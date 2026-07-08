export default function DiskoText({
	text,
	fillColor = 'white',
	outlineColor = 'currentColor',
	fontSize = null,
	className = '',
	style = null,
	...props
}) {
	const cssVars = {
		'--disko-fill-color': fillColor,
		'--disko-outline-color': outlineColor,
		...(fontSize ? { '--disko-font-size': fontSize } : {}),
		...(style ?? {}),
	};

	return (
		<span
			{...props}
			className={`disko-layered-text ${className}`.trim()}
			data-text={text}
			style={cssVars}
		>
			<span className="disko-layered-text__outline">{text}</span>
		</span>
	);
}
