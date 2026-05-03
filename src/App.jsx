import { Suspense, lazy } from 'react'
import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import Nav from './components/shared/Nav.jsx'
import HomePage from './pages/HomePage.jsx'
import ArtistPage from './pages/ArtistPage.jsx'
import VideosPage from './pages/VideosPage.jsx'
import SongPage from './pages/SongPage.jsx'
import AlbumPage from './pages/AlbumPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import AdminLayout from './components/admin/AdminLayout.jsx'
import AdminRoute from './components/admin/AdminRoute.jsx'
import { AdminProvider, useAdminAuth } from './lib/adminAuth.jsx'

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'))
const AdminAccountsPage = lazy(() => import('./pages/admin/AdminAccountsPage.jsx'))
const AdminArtistsPage = lazy(() => import('./pages/admin/AdminArtistsPage.jsx'))
const AdminAlbumsPage = lazy(() => import('./pages/admin/AdminAlbumsPage.jsx'))
const AdminVideosPage = lazy(() => import('./pages/admin/AdminVideosPage.jsx'))
const AdminSongsPage = lazy(() => import('./pages/admin/AdminSongsPage.jsx'))
const AdminLyricsPage = lazy(() => import('./pages/admin/AdminLyricsPage.jsx'))
const AdminRecordPlayerPage = lazy(() => import('./pages/admin/AdminRecordPlayerPage.jsx'))

function RouteFallback() {
  return <div className="page" style={{ minHeight: '100vh' }} />
}

function PublicLayout() {
  return (
    <>
      <Nav />
      <Outlet />
    </>
  )
}

function AdminHomeRedirect() {
  const { session } = useAdminAuth()
  if (session?.role === 'ARTIST') return <AdminAlbumsPage />
  return <AdminArtistsPage />
}

function AdminVideosAccessRoute() {
  const { session } = useAdminAuth()
  if (session?.role === 'VIEWER') return <Navigate to="/admin" replace />
  return <AdminVideosPage />
}

export default function App() {
  return (
    <AdminProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/artists/:slug" element={<ArtistPage />} />
            <Route path="/songs/:songSlug" element={<SongPage />} />
            <Route path="/:artistSlug/:albumSlug/:songSlug" element={<SongPage />} />
            <Route path="/:artistSlug/:albumSlug" element={<AlbumPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminHomeRedirect />} />
              <Route path="/admin/accounts" element={<AdminAccountsPage />} />
              <Route path="/admin/artists" element={<AdminArtistsPage />} />
              <Route path="/admin/albums" element={<AdminAlbumsPage />} />
              <Route path="/admin/videos" element={<AdminVideosAccessRoute />} />
              <Route path="/admin/songs" element={<AdminSongsPage />} />
              <Route path="/admin/lyrics/:songId" element={<AdminLyricsPage />} />
              <Route path="/admin/record-player" element={<AdminRecordPlayerPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AdminProvider>
  )
}
