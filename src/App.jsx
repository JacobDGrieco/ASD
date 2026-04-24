import { Routes, Route, Outlet } from 'react-router-dom'
import Nav from './components/shared/Nav.jsx'
import HomePage from './pages/HomePage.jsx'
import ArtistPage from './pages/ArtistPage.jsx'
import SongPage from './pages/SongPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx'
import AdminLayout from './components/admin/AdminLayout.jsx'
import AdminRoute from './components/admin/AdminRoute.jsx'
import AdminArtistsPage from './pages/admin/AdminArtistsPage.jsx'
import AdminAlbumsPage from './pages/admin/AdminAlbumsPage.jsx'
import AdminSongsPage from './pages/admin/AdminSongsPage.jsx'
import AdminLyricsPage from './pages/admin/AdminLyricsPage.jsx'
import AdminRecordPlayerPage from './pages/admin/AdminRecordPlayerPage.jsx'
import { AdminProvider } from './lib/adminAuth.jsx'

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
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/artists/:slug" element={<ArtistPage />} />
          <Route path="/songs/:slug" element={<SongPage />} />
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
    </AdminProvider>
  )
}
