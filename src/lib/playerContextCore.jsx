import { createContext, useContext } from 'react'

export const PlayerContext = createContext(null)

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer must be used within PlayerProvider')
  return context
}
