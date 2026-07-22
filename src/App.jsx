/**
 * Top-level route map and layout composition for the site.
 *
 * This file connects public routes, admin routes, preview-aware public layout,
 * document-title updates, and the global admin/player providers.
 */
import { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import Nav from './components/shared/Nav.jsx';
import PageTitle from './components/shared/PageTitle.jsx';
import HomePage from './pages/HomePage.jsx';
import MusicHomePage from './pages/MusicHomePage.jsx';
import ArtistPage from './pages/ArtistPage.jsx';
import ShelfPage from './pages/ShelfPage.jsx';
import CrosshairPage from './pages/CrosshairPage.jsx';
import SongPage from './pages/SongPage.jsx';
import AlbumPage from './pages/AlbumPage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import LegalPage from './pages/LegalPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import FashionHomePage from './pages/FashionHomePage.jsx';
import FashionTalentPage from './pages/FashionTalentPage.jsx';
import FashionTalentProfilePage from './pages/FashionTalentProfilePage.jsx';
import FashionCataloguePage from './pages/FashionCataloguePage.jsx';
import FashionLookPage from './pages/FashionLookPage.jsx';
import FashionCollectionPage from './pages/FashionCollectionPage.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminRoute from './components/admin/AdminRoute.jsx';
import SideRails from './components/shared/SideRails.jsx';
import PublicLegalFooter from './components/shared/PublicLegalFooter.jsx';
import { AdminProvider, useAdminAuth } from './lib/adminAuth.jsx';
import { PlayerProvider } from './lib/playerContext.jsx';
import { clearAdminFilterState } from './lib/adminFilterState.js';
import { isAdminPreviewSession } from './lib/publicPreview.js';
import { ADMIN_PAGE_KEYS, firstAccessibleAdminPath, hasAdminPageAccess } from './lib/adminPageAccess.js';
import './styles/PublicAdminPreview.css';
import './styles/ViewTransitions.css';

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'));
const AdminAccountsPage = lazy(() => import('./pages/admin/AdminAccountsPage.jsx'));
const AdminAboutPage = lazy(() => import('./pages/admin/AdminAboutPage.jsx'));
const AdminMusicArtistsPage = lazy(() => import('./pages/admin/AdminMusicArtistsPage.jsx'));
const AdminMusicAlbumsPage = lazy(() => import('./pages/admin/AdminMusicAlbumsPage.jsx'));
const AdminMusicOutsideArtistsPage = lazy(() => import('./pages/admin/AdminMusicOutsideArtistsPage.jsx'));
const AdminMusicBoardPage = lazy(() => import('./pages/admin/AdminMusicBoardPage.jsx'));
const AdminMusicCrosshairPage = lazy(() => import('./pages/admin/AdminMusicCrosshairPage.jsx'));
const AdminMusicSongsPage = lazy(() => import('./pages/admin/AdminMusicSongsPage.jsx'));
const AdminMusicLyricsPage = lazy(() => import('./pages/admin/AdminMusicLyricsPage.jsx'));
const AdminMusicRecordPlayerPage = lazy(() => import('./pages/admin/AdminMusicRecordPlayerPage.jsx'));
const AdminFashionTalentPage = lazy(() => import('./pages/admin/AdminFashionTalentPage.jsx'));
const AdminFashionOutsideTalentPage = lazy(() => import('./pages/admin/AdminFashionOutsideTalentPage.jsx'));
const AdminFashionLooksPage = lazy(() => import('./pages/admin/AdminFashionLooksPage.jsx'));
const AdminFashionCollectionsPage = lazy(() => import('./pages/admin/AdminFashionCollectionsPage.jsx'));

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

function ClearAdminFiltersOnExit() {
	const location = useLocation();
	const previousPathnameRef = useRef(location.pathname);

	useEffect(() => {
		const previousPathname = previousPathnameRef.current;
		const wasInAdmin = previousPathname === '/admin' || previousPathname.startsWith('/admin/');
		const isInAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

		if (wasInAdmin && !isInAdmin) {
			clearAdminFilterState();
		}

		previousPathnameRef.current = location.pathname;
	}, [location.pathname]);

	return null;
}

function PublicLayout() {
	const { session, token, logout } = useAdminAuth();
	const location = useLocation();
	const adminPreview = isAdminPreviewSession(session, token);
	const legalFooterVariant = location.pathname === '/board' ? 'board' : 'default';

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
					await document.startViewTransition(() => { }).finished;
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
			<PublicLegalFooter variant={legalFooterVariant} />
			{adminPreview && (
				<>
					<button
						type="button"
						className="public-admin-preview-exit"
						onClick={async () => {
							await logout();
							window.location.reload();
						}}
					>
						Public View
					</button>
				</>
			)}
		</>
	);
}

function AdminHomeRedirect() {
	const { session } = useAdminAuth();
	return <Navigate to={firstAccessibleAdminPath(session)} replace />;
}

function AdminSuperRoute({ children }) {
	const { session } = useAdminAuth();
	if (session?.role !== 'SUPER_ADMIN') return <Navigate to={firstAccessibleAdminPath(session)} replace />;
	return children;
}

function AdminPageAccessRoute({ pageKey, children }) {
	const { session } = useAdminAuth();
	if (!hasAdminPageAccess(session, pageKey)) return <Navigate to={firstAccessibleAdminPath(session)} replace />;
	return children;
}

export default function App() {
	return (
		<AdminProvider>
			<PlayerProvider>
				<PageTitle />
				<ClearAdminFiltersOnExit />
				<Suspense fallback={<RouteFallback />}>
					<Routes>
						<Route element={<PublicLayout />}>
							<Route path="/" element={<HomePage />} />
							<Route path="/music" element={<MusicHomePage />} />
							<Route path="/about" element={<AboutPage />} />
							<Route path="/board" element={<BoardPage />} />
							<Route path="/shelf" element={<ShelfPage />} />
							<Route path="/crosshair" element={<CrosshairPage />} />
							<Route path="/artists/:slug" element={<ArtistPage />} />
							<Route path="/albums/:albumId" element={<AlbumPage />} />
							<Route path="/songs/:songId" element={<SongPage />} />
							<Route path="/fashion" element={<FashionHomePage />} />
							<Route path="/fashion/talent" element={<FashionTalentPage />} />
							<Route path="/fashion/talent/:slug" element={<FashionTalentProfilePage />} />
							<Route path="/fashion/catalogue" element={<FashionCataloguePage />} />
							<Route path="/fashion/looks/:slug" element={<FashionLookPage />} />
							<Route path="/fashion/collections/:slug" element={<FashionCollectionPage />} />
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
								<Route path="/admin/accounts" element={<AdminSuperRoute><AdminAccountsPage /></AdminSuperRoute>} />
								<Route path="/admin/about" element={<AdminSuperRoute><AdminAboutPage /></AdminSuperRoute>} />
								<Route path="/admin/artists" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.MUSIC_ARTISTS}><AdminMusicArtistsPage /></AdminPageAccessRoute>} />
								<Route path="/admin/outside-artists" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.MUSIC_OUTSIDE_ARTISTS}><AdminMusicOutsideArtistsPage /></AdminPageAccessRoute>} />
								<Route path="/admin/albums" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.MUSIC_ALBUMS}><AdminMusicAlbumsPage /></AdminPageAccessRoute>} />
								<Route path="/admin/board" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.BOARD}><AdminMusicBoardPage /></AdminPageAccessRoute>} />
								<Route path="/admin/crosshair" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.MUSIC_CROSSHAIR}><AdminMusicCrosshairPage /></AdminPageAccessRoute>} />
								<Route path="/admin/songs" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.MUSIC_SONGS}><AdminMusicSongsPage /></AdminPageAccessRoute>} />
								<Route path="/admin/lyrics/:songId" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.MUSIC_SONGS}><AdminMusicLyricsPage /></AdminPageAccessRoute>} />
								<Route path="/admin/record-player" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.MUSIC_RECORD_PLAYER}><AdminMusicRecordPlayerPage /></AdminPageAccessRoute>} />
								<Route path="/admin/fashion/talent" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.FASHION_TALENT}><AdminFashionTalentPage /></AdminPageAccessRoute>} />
								<Route path="/admin/fashion/outside_talent" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.FASHION_OUTSIDE_TALENT}><AdminFashionOutsideTalentPage /></AdminPageAccessRoute>} />
								<Route path="/admin/fashion/looks" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.FASHION_LOOKS}><AdminFashionLooksPage /></AdminPageAccessRoute>} />
								<Route path="/admin/fashion/collections" element={<AdminPageAccessRoute pageKey={ADMIN_PAGE_KEYS.FASHION_COLLECTIONS}><AdminFashionCollectionsPage /></AdminPageAccessRoute>} />
							</Route>
						</Route>
					</Routes>
				</Suspense>
				<SideRails />
			</PlayerProvider>
		</AdminProvider>
	);
}
