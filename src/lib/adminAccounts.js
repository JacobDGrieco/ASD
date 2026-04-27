import { prisma } from './prisma.js'
import { verifyPassword } from './passwords.js'

export async function validateUniqueArtistPassword(password, currentArtistId = null) {
  if (!password) return null

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    return 'Artist passwords cannot match the global admin password.'
  }

  const existingAccessList = await prisma.artistAdminAccess.findMany({
    where: currentArtistId
      ? {
          artistId: {
            not: currentArtistId,
          },
        }
      : undefined,
    select: {
      passwordHash: true,
    },
  })

  const duplicate = existingAccessList.some((access) => verifyPassword(password, access.passwordHash))
  if (duplicate) return 'Each artist password must be unique.'

  return null
}
