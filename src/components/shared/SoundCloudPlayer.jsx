export default function SoundCloudPlayer({ url, autoPlay = false }) {
  if (!url) return null

  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23c8a96e&auto_play=${autoPlay}&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`

  return (
    <iframe
      key={`${url}-${autoPlay}`}
      title="SoundCloud Player"
      width="100%"
      height="166"
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      src={src}
      style={{ borderRadius: '4px' }}
    />
  )
}
