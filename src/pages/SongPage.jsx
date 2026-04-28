import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TabPanel, TabView } from 'primereact/tabview'
import { useApi } from '../hooks/useApi.js'
import SongHeader from '../components/song/SongHeader.jsx'
import LyricsView from '../components/song/LyricsView.jsx'
import AboutSection from '../components/song/AboutSection.jsx'
import SongInfoLinks from '../components/song/SongInfoLinks.jsx'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import '../styles/SongPage.css'

export default function SongPage() {
  const { albumSlug, songSlug } = useParams()
  const { data: song, loading, error } = useApi(`/api/songs/${songSlug}?albumSlug=${encodeURIComponent(albumSlug)}`, {
    refreshAtUtcMidnight: true,
  })
  const lyricLineCount = song?.lyricBlocks?.filter((block) => block.text?.trim()).length ?? 0
  const defaultTabIndex = lyricLineCount < 2 ? 1 : 0
  const [activeTabIndex, setActiveTabIndex] = useState(0)

  useEffect(() => {
    if (!song) return
    setActiveTabIndex(defaultTabIndex)
  }, [song, defaultTabIndex])

  if (!loading && (error || !song)) return <div className="page not-found"><h1>Song not found</h1></div>

  return (
    <div className="page aurora-page">
      <AuroraBackground />
      {song && (
        <div className="aurora-page-content">
          <SongHeader song={song} />
          <div className="song-page-body">
            <TabView className="page-tabview" activeIndex={activeTabIndex} onTabChange={(event) => setActiveTabIndex(event.index)}>
              <TabPanel header="Lyrics">
                <LyricsView blocks={song.lyricBlocks} />
              </TabPanel>
              <TabPanel header="About & Info">
                <div className="page-tab-panel-stack">
                  <AboutSection meta={song.meta} />
                  <SongInfoLinks song={song} />
                  {!song.meta?.aboutText && !song.meta?.producers && !song.meta?.writers && !song.meta?.featuredArtists && !(song.meta?.tags?.length > 0) && (
                    <p className="page-tab-empty-state">More song information will show up here.</p>
                  )}
                </div>
              </TabPanel>
            </TabView>
          </div>
        </div>
      )}
    </div>
  )
}
