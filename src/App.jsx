import { Routes, Route } from 'react-router-dom'
import Nav from './components/shared/Nav.jsx'
import HomePage from './pages/HomePage.jsx'
import ArtistPage from './pages/ArtistPage.jsx'
import SongPage from './pages/SongPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/artists/:slug" element={<ArtistPage />} />
        <Route path="/songs/:slug" element={<SongPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
