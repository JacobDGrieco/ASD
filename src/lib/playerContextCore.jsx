/**
 * React context shell for the global player.
 *
 * The stateful provider lives in `playerContext.jsx`; this file only exposes the
 * context and hook used by playback controls and public music components.
 */
import { createContext, useContext } from 'react';

export const PlayerContext = createContext(null);

export function usePlayer() {
	const context = useContext(PlayerContext);
	if (!context) throw new Error('usePlayer must be used within PlayerProvider');
	return context;
}
