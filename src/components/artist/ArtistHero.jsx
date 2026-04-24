import styles from './ArtistHero.module.css'

export default function ArtistHero({ artist }) {
  return (
    <section className={styles.hero}>
      <div className={styles.portrait_wrap}>
        <img src={artist.portrait} alt={artist.name} className={styles.portrait} />
      </div>
      <div className={styles.info}>
        <h1 className={styles.name}>{artist.name}</h1>
        <p className={styles.bio}>{artist.bio}</p>
        {artist.aboutMe && <p className={styles.about}>{artist.aboutMe}</p>}
        <div className={styles.links}>
          {artist.soundcloudProfile && <a href={artist.soundcloudProfile} target="_blank" rel="noopener noreferrer">SoundCloud</a>}
          {artist.spotifyProfile && <a href={artist.spotifyProfile} target="_blank" rel="noopener noreferrer">Spotify</a>}
          {artist.appleMusicProfile && <a href={artist.appleMusicProfile} target="_blank" rel="noopener noreferrer">Apple Music</a>}
        </div>
      </div>
    </section>
  )
}
