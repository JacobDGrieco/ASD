import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import Nav from './components/shared/Nav.jsx';
import HomePage from './pages/HomePage.jsx';
import MusicHomePage from './pages/MusicHomePage.jsx';
import ArtistPage from './pages/ArtistPage.jsx';
import VideosPage from './pages/VideosPage.jsx';
import CrosshairPage from './pages/CrosshairPage.jsx';
import SongPage from './pages/SongPage.jsx';
import AlbumPage from './pages/AlbumPage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import LegalPage from './pages/LegalPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import FashionHomePage from './pages/FashionHomePage.jsx';
import FashionTalentPage from './pages/FashionTalentPage.jsx';
import FashionTalentProfilePage from './pages/FashionTalentProfilePage.jsx';
import FashionCataloguePage from './pages/FashionCataloguePage.jsx';
import FashionLookPage from './pages/FashionLookPage.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminRoute from './components/admin/AdminRoute.jsx';
import SideRails from './components/shared/SideRails.jsx';
import { AdminProvider, useAdminAuth } from './lib/adminAuth.jsx';
import { isAdminPreviewSession } from './lib/publicPreview.js';
import './styles/PublicAdminPreview.css';

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'));
const AdminAccountsPage = lazy(() => import('./pages/admin/AdminAccountsPage.jsx'));
const AdminMusicArtistsPage = lazy(() => import('./pages/admin/AdminMusicArtistsPage.jsx'));
const AdminMusicAlbumsPage = lazy(() => import('./pages/admin/AdminMusicAlbumsPage.jsx'));
const AdminMusicBoardPage = lazy(() => import('./pages/admin/AdminMusicBoardPage.jsx'));
const AdminMusicVideosPage = lazy(() => import('./pages/admin/AdminMusicVideosPage.jsx'));
const AdminMusicCrosshairPage = lazy(() => import('./pages/admin/AdminMusicCrosshairPage.jsx'));
const AdminMusicSongsPage = lazy(() => import('./pages/admin/AdminMusicSongsPage.jsx'));
const AdminMusicLyricsPage = lazy(() => import('./pages/admin/AdminMusicLyricsPage.jsx'));
const AdminMusicRecordPlayerPage = lazy(() => import('./pages/admin/AdminMusicRecordPlayerPage.jsx'));
const AdminFashionTalentPage = lazy(() => import('./pages/admin/AdminFashionTalentPage.jsx'));
const AdminFashionLooksPage = lazy(() => import('./pages/admin/AdminFashionLooksPage.jsx'));

function RouteFallback() {
	return <div className="page" style={{ minHeight: '100vh' }} />;
}

function ScrollToTop() {
	const location = useLocation();

	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
	}, [location.pathname, location.search, location.hash]);

	return null;
}

function PublicLayout() {
	const { session, token, logout } = useAdminAuth();
	const adminPreview = isAdminPreviewSession(session, token);

	useEffect(() => {
		if (!window.navigation || !document.startViewTransition) return undefined;

		const handleNavigate = (event) => {
			if (
				event.navigationType !== 'traverse' ||
				!event.canIntercept ||
				event.hashChange
			) return;

			const destination = new URL(event.destination.url);
			if (destination.pathname !== '/') return;

			event.intercept({
				handler: async () => {
					await document.startViewTransition(() => {}).finished;
				},
			});
		};

		window.navigation.addEventListener('navigate', handleNavigate);
		return () => window.navigation.removeEventListener('navigate', handleNavigate);
	}, []);

	return (
		<>
			<ScrollToTop />
			<Nav />
			<Outlet />
			{adminPreview && (
				<>
					<button
						type="button"
						className="public-admin-preview-exit"
						onClick={() => {
							logout();
							window.location.reload();
						}}
					>
						Return to Public View
					</button>
				</>
			)}
		</>
	);
}

function AdminHomeRedirect() {
	const { session } = useAdminAuth();
	if (session?.role === 'ARTIST') return <AdminMusicAlbumsPage />;
	return <AdminMusicArtistsPage />;
}

function AdminVideosAccessRoute() {
	const { session } = useAdminAuth();
	if (session?.role === 'VIEWER') return <Navigate to="/admin" replace />;
	return <AdminMusicVideosPage />;
}

function AdminCrosshairAccessRoute() {
	const { session } = useAdminAuth();
	if (session?.role !== 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
	return <AdminMusicCrosshairPage />;
}

function AdminFashionAccessRoute({ children }) {
	const { session } = useAdminAuth();
	if (session?.role !== 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
	return children;
}

export default function App() {
	return (
		<AdminProvider>
			<Suspense fallback={<RouteFallback />}>
				<Routes>
					<Route element={<PublicLayout />}>
						<Route path="/" element={<HomePage />} />
						<Route path="/music" element={<MusicHomePage />} />
						<Route path="/board" element={<BoardPage />} />
						<Route path="/videos" element={<VideosPage />} />
						<Route path="/crosshair" element={<CrosshairPage />} />
						<Route path="/artists/:slug" element={<ArtistPage />} />
						<Route path="/albums/:albumId" element={<AlbumPage />} />
						<Route path="/songs/:songId" element={<SongPage />} />
						<Route path="/fashion" element={<FashionHomePage />} />
						<Route path="/fashion/talent" element={<FashionTalentPage />} />
						<Route path="/fashion/talent/:slug" element={<FashionTalentProfilePage />} />
						<Route path="/fashion/catalogue" element={<FashionCataloguePage />} />
						<Route path="/fashion/looks/:slug" element={<FashionLookPage />} />
						<Route
							path="/terms-of-service"
							element={<LegalPage title="Terms of Service" documentSrc="/legal/terms-of-service.html" />}
						/>
						<Route
							path="/privacy-policy"
							element={<LegalPage title="Privacy Policy" documentSrc="/legal/privacy-policy.html" />}
						/>
						<Route path="*" element={<NotFoundPage />} />
					</Route>
					<Route path="/admin/login" element={<AdminLoginPage />} />
					<Route element={<AdminRoute />}>
						<Route element={<AdminLayout />}>
							<Route path="/admin" element={<AdminHomeRedirect />} />
							<Route path="/admin/accounts" element={<AdminAccountsPage />} />
							<Route path="/admin/artists" element={<AdminMusicArtistsPage />} />
							<Route path="/admin/albums" element={<AdminMusicAlbumsPage />} />
							<Route path="/admin/board" element={<AdminMusicBoardPage />} />
							<Route path="/admin/videos" element={<AdminVideosAccessRoute />} />
							<Route path="/admin/crosshair" element={<AdminCrosshairAccessRoute />} />
							<Route path="/admin/songs" element={<AdminMusicSongsPage />} />
							<Route path="/admin/lyrics/:songId" element={<AdminMusicLyricsPage />} />
							<Route path="/admin/record-player" element={<AdminMusicRecordPlayerPage />} />
							<Route path="/admin/fashion/talent" element={<AdminFashionAccessRoute><AdminFashionTalentPage /></AdminFashionAccessRoute>} />
							<Route path="/admin/fashion/looks" element={<AdminFashionAccessRoute><AdminFashionLooksPage /></AdminFashionAccessRoute>} />
						</Route>
					</Route>
				</Routes>
			</Suspense>
			<SideRails />
		</AdminProvider>
	);
}
