import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx'
import '../../styles/Turntable.css'

export default function Turntable({ activeTrack, isPlaying, onTonearmToggle }) {
  const coverArt = activeTrack?.song.album.coverArt ?? null
  const title = activeTrack?.song.title ?? null
  const artist = activeTrack?.song.album.artist.name ?? null
  const scUrl = activeTrack?.song.soundcloudUrl ?? null
  const canTogglePlayback = Boolean(scUrl)

  return (
    <div className="turntable-wrap">
      <div className="turntable-scene">
        <div className="turntable-body">
          <div className={`turntable-platter ${isPlaying ? 'turntable-spinning' : ''}`}>
            {coverArt && (
              <img
                src={coverArt}
                alt={title ?? ''}
                className="turntable-label"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            )}
            {!coverArt && <div className="turntable-label-blank" />}
          </div>
          <button
            type="button"
            className={`turntable-tonearm ${isPlaying ? 'turntable-playing' : ''}`}
            onClick={onTonearmToggle}
            disabled={!canTogglePlayback}
            aria-label={isPlaying ? 'Pause song' : 'Play song'}
            title={isPlaying ? 'Pause song' : 'Play song'}
          />
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
          <SoundCloudPlayer url={scUrl} isPlaying={isPlaying} hidden />
        </div>
      )}
    </div>
  )
}
