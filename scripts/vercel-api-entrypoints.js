import about from '../api/admin/about.js'
import accounts from '../api/admin/accounts.js'
import albums from '../api/admin/albums.js'
import annotations from '../api/admin/annotations.js'
import artists from '../api/admin/artists.js'
import crosshair from '../api/admin/crosshair.js'
import fashion from '../api/admin/fashion.js'
import fashionCollections from '../api/admin/fashionCollections.js'
import login from '../api/admin/login.js'
import lyrics from '../api/admin/lyrics.js'
import outsideArtists from '../api/admin/outside-artists.js'
import recordPlayer from '../api/admin/record-player.js'
import songs from '../api/admin/songs.js'
import uploads from '../api/admin/uploads.js'
import videos from '../api/admin/videos.js'
import blob from '../api/blob.js'
import publicApi from '../api/public.js'

// Vercel discovers these modules from the api/ file-system router, not from
// JavaScript imports. Keep a static entrypoint so code health tools can see the
// server route graph without bundling it into the browser app.
void [
  about,
  accounts,
  albums,
  annotations,
  artists,
  crosshair,
  fashion,
  fashionCollections,
  login,
  lyrics,
  outsideArtists,
  recordPlayer,
  songs,
  uploads,
  videos,
  blob,
  publicApi,
]
