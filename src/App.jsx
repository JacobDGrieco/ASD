import { Suspense, lazy } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Nav from './components/shared/Nav.jsx'
import HomePage from './pages/HomePage.jsx'
import ArtistPage from './pages/ArtistPage.jsx'
import SongPage from './pages/SongPage.jsx'
import AlbumPage from './pages/AlbumPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import AdminLayout from './components/admin/AdminLayout.jsx'
import AdminRoute from './components/admin/AdminRoute.jsx'
import { AdminProvider } from './lib/adminAuth.jsx'

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'))
const AdminArtistsPage = lazy(() => import('./pages/admin/AdminArtistsPage.jsx'))
const AdminAlbumsPage = lazy(() => import('./pages/admin/AdminAlbumsPage.jsx'))
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

export default function App() {
  return (
    <AdminProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/artists/:slug" element={<ArtistPage />} />
            <Route path="/:artistSlug/:albumSlug/:songSlug" element={<SongPage />} />
            <Route path="/:artistSlug/:albumSlug" element={<AlbumPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminArtistsPage />} />
              <Route path="/admin/artists" element={<AdminArtistsPage />} />
              <Route path="/admin/albums" element={<AdminAlbumsPage />} />
              <Route path="/admin/songs" element={<AdminSongsPage />} />
              <Route path="/admin/lyrics/:songId" element={<AdminLyricsPage />} />
              <Route path="/admin/record-player" element={<AdminRecordPlayerPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <Analytics />
    </AdminProvider>
  )
}
