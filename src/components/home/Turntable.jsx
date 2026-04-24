import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx'
import styles from './Turntable.module.css'

export default function Turntable({ activeTrack, isPlaying }) {
  const coverArt = activeTrack?.song.album.coverArt ?? null
  const title = activeTrack?.song.title ?? null
  const artist = activeTrack?.song.album.artist.name ?? null
  const scUrl = activeTrack?.song.soundcloudUrl ?? null

  return (
    <div className={styles.wrap}>
      <div className={styles.scene}>
        <div className={styles.body}>
          <div className={`${styles.platter} ${isPlaying ? styles.spinning : ''}`}>
            {coverArt && (
              <img src={coverArt} alt={title ?? ''} className={styles.label} />
            )}
            {!coverArt && <div className={styles.label_blank} />}
          </div>
          <div className={`${styles.tonearm} ${isPlaying ? styles.playing : ''}`} />
        </div>
      </div>
      {title && (
        <div className={styles.now_playing}>
          <span className={styles.track_title}>{title}</span>
          <span className={styles.track_artist}>{artist}</span>
        </div>
      )}
      {scUrl && (
        <div className={styles.player}>
          <SoundCloudPlayer url={scUrl} autoPlay={isPlaying} />
        </div>
      )}
    </div>
  )
}
