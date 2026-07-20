import { usePlayer } from '../../lib/playerContextCore.jsx'
import PlayerIpod from './PlayerIpod.jsx'

export default function PlayerWidget() {
  const {
    currentSong,
    dismiss,
    isPlaying,
    next,
    openFullScreen,
    playPause,
    prev,
  } = usePlayer()

  if (!currentSong) return null

  return (
    <PlayerIpod
      artworkUrl={currentSong.artworkUrl}
      isPlaying={isPlaying}
      onClose={dismiss}
      onHubClick={playPause}
      onMenu={openFullScreen}
      onNext={next}
      onPrev={prev}
      onScreenClick={openFullScreen}
      title={currentSong.title}
    />
  )
}
