/**
 * Browser entry point for the React application.
 *
 * Mounts routing, global providers from `App`, PrimeReact styles, project CSS,
 * and Vercel Analytics into the `#root` element defined by `index.html`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";
import App from './App.jsx';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<BrowserRouter>
			<App />
			<Analytics debug={false} />
		</BrowserRouter>
	</StrictMode>
);
