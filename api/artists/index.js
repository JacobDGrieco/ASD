import { prisma } from '../../src/lib/prisma.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const artists = await prisma.artist.findMany({
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      bio: true,
      portrait: true,
      order: true,
      soundcloudProfile: true,
      spotifyProfile: true,
      appleMusicProfile: true,
    },
  })

  return res.status(200).json(artists)
}
