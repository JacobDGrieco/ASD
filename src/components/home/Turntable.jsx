import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx'
import '../../styles/Turntable.css'

export default function Turntable({ activeTrack, isPlaying }) {
  const coverArt = activeTrack?.song.album.coverArt ?? null
  const title = activeTrack?.song.title ?? null
  const artist = activeTrack?.song.album.artist.name ?? null
  const scUrl = activeTrack?.song.soundcloudUrl ?? null

  return (
    <div className="turntable-wrap">
      <div className="turntable-scene">
        <div className="turntable-body">
          <div className={`turntable-platter ${isPlaying ? 'turntable-spinning' : ''}`}>
            {coverArt && (
              <img src={coverArt} alt={title ?? ''} className="turntable-label" />
            )}
            {!coverArt && <div className="turntable-label-blank" />}
          </div>
          <div className={`turntable-tonearm ${isPlaying ? 'turntable-playing' : ''}`} />
        </div>
      </div>
      {title && (
        <div
          className="turntable-now-playing"
          aria-label="Now playing"
          aria-live="polite"
        >
          <span className="turntable-track-title">{title}</span>
          <span className="turntable-track-artist">{artist}</span>
        </div>
      )}
      {scUrl && (
        <div className="turntable-player">
          <SoundCloudPlayer url={scUrl} autoPlay={isPlaying} />
        </div>
      )}
    </div>
  )
}
