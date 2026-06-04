import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TabPanel, TabView } from 'primereact/tabview'
import { useApi } from '../hooks/useApi.js'
import SongHeader from '../components/song/SongHeader.jsx'
import LyricsView from '../components/song/LyricsView.jsx'
import SongInfoLinks from '../components/song/SongInfoLinks.jsx'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import { useAdminAuth } from '../lib/adminAuth.jsx'
import { isAdminPreviewSession, publicPreviewCacheKey, publicPreviewHeaders } from '../lib/publicPreview.js'
import '../styles/SongPage.css'

export default function SongPage() {
  const { songId } = useParams()
  const { session, token } = useAdminAuth()
  const adminPreview = isAdminPreviewSession(session, token)
  const apiUrl = `/api/songs/${songId}`
  const previewHeaders = useMemo(() => publicPreviewHeaders(adminPreview ? token : null), [adminPreview, token])
  const { data: song, loading, error } = useApi(apiUrl, {
    refreshAtUtcMidnight: true,
    headers: previewHeaders,
    cacheKey: publicPreviewCacheKey(apiUrl, adminPreview),
  })
  const lyricLineCount = song?.lyricBlocks?.filter((block) => block.text?.trim()).length ?? 0
  const defaultTabIndex = lyricLineCount < 2 ? 1 : 0
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const hasSongInfo = Boolean(
    song?.duration ||
    song?.meta?.bpm ||
    song?.meta?.key ||
    song?.album?.type ||
    song?.trackNumber ||
    song?.meta?.aboutText ||
    song?.meta?.releaseDate ||
    song?.meta?.genre ||
    song?.meta?.tags?.length > 0 ||
    Object.values(song?.meta?.roleGroups ?? {}).some((group) => group?.length)
  )

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
          <SongHeader song={song} adminPreview={adminPreview} />
          <div className="song-page-body">
            <TabView className="page-tabview song-page-tabview" activeIndex={activeTabIndex} onTabChange={(event) => setActiveTabIndex(event.index)}>
              <TabPanel header="Lyrics">
                <LyricsView blocks={song.lyricBlocks} />
              </TabPanel>
              <TabPanel header="About & Info">
                <div className="page-tab-panel-stack">
                  <SongInfoLinks song={song} />
                  {!hasSongInfo && (
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
