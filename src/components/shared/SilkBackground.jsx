/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
	forwardRef,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Color } from 'three';

const SILK_COLOR = '#c8a96e';

const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
	vPosition = position;
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform vec3 uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
	float G = e;
	vec2 r = G * sin(G * texCoord);
	return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
	float c = cos(angle);
	float s = sin(angle);
	mat2 rot = mat2(c, -s, s, c);
	return rot * uv;
}

void main() {
	float rnd = noise(gl_FragCoord.xy);
	vec2 uv = rotateUvs(vUv * uScale, uRotation);
	vec2 tex = uv * uScale;
	float tOffset = uSpeed * uTime;

	tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

	float pattern = 0.6 +
		0.4 * sin(5.0 * (tex.x + tex.y +
			cos(3.0 * tex.x + 5.0 * tex.y) +
			0.02 * tOffset) +
			sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

	vec4 col = vec4(uColor, 1.0) * vec4(pattern) -
		rnd / 15.0 * uNoiseIntensity;
	col.a = 1.0;
	gl_FragColor = col;
}
`;

function hexToNormalizedRgb(hex) {
	const value = hex.replace('#', '');

	return [
		Number.parseInt(value.slice(0, 2), 16) / 255,
		Number.parseInt(value.slice(2, 4), 16) / 255,
		Number.parseInt(value.slice(4, 6), 16) / 255,
	];
}

function usePrefersReducedMotion() {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
		typeof window !== 'undefined'
			? window.matchMedia('(prefers-reduced-motion: reduce)').matches
			: false
	));

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

		updatePreference();
		mediaQuery.addEventListener('change', updatePreference);

		return () => mediaQuery.removeEventListener('change', updatePreference);
	}, []);

	return prefersReducedMotion;
}

const SilkPlane = forwardRef(function SilkPlane({ uniforms, animated }, ref) {
	const { viewport } = useThree();

	useLayoutEffect(() => {
		if (ref.current) {
			ref.current.scale.set(viewport.width, viewport.height, 1);
		}
	}, [ref, viewport]);

	useFrame((_, delta) => {
		if (!animated || !ref.current) return;
		ref.current.material.uniforms.uTime.value += 0.1 * delta;
	});

	return (
		<mesh ref={ref}>
			<planeGeometry args={[1, 1, 1, 1]} />
			<shaderMaterial
				uniforms={uniforms}
				vertexShader={vertexShader}
				fragmentShader={fragmentShader}
			/>
		</mesh>
	);
});

export default function SilkBackground() {
	const meshRef = useRef(null);
	const prefersReducedMotion = usePrefersReducedMotion();
	const animated = !prefersReducedMotion;
	const uniforms = useMemo(() => ({
		uSpeed: { value: 1 },
		uScale: { value: 1.2 },
		uNoiseIntensity: { value: 1 },
		uColor: { value: new Color(...hexToNormalizedRgb(SILK_COLOR)) },
		uRotation: { value: 0 },
		uTime: { value: 0 },
	}), []);

	return (
		<div className="artist-splash-silk" aria-hidden="true">
			<Canvas dpr={[1, 2]} frameloop={animated ? 'always' : 'demand'}>
				<SilkPlane ref={meshRef} uniforms={uniforms} animated={animated} />
			</Canvas>
		</div>
	);
}
