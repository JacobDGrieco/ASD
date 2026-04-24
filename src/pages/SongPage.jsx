import { useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi.js'
import SongHeader from '../components/song/SongHeader.jsx'
import LyricsView from '../components/song/LyricsView.jsx'
import AboutSection from '../components/song/AboutSection.jsx'
import SongInfoLinks from '../components/song/SongInfoLinks.jsx'
import styles from './SongPage.module.css'

export default function SongPage() {
  const { slug } = useParams()
  const { data: song, loading, error } = useApi(`/api/songs/${slug}`)

  if (loading) return <div className="page" style={{ minHeight: '100vh' }} />
  if (error || !song) return <div className="page not-found"><h1>Song not found</h1></div>

  return (
    <div className="page">
      <SongHeader song={song} />
      <div className={styles.body}>
        <LyricsView blocks={song.lyricBlocks} />
        <AboutSection meta={song.meta} />
        <SongInfoLinks song={song} />
      </div>
    </div>
  )
}
