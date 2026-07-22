/**
 * Vite build and local-dev configuration for the React client.
 *
 * The dev proxy mirrors the Vercel `/api` boundary so browser pages can call
 * serverless routes during local development.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/api': {
				target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
				changeOrigin: true,
			},
		},
	},
});
