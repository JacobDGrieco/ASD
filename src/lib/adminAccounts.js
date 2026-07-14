import { prisma } from './prisma.js'
import { getAdminAccountSchemaCapabilities } from './adminAccountSchema.js'
import { verifyPassword } from './passwords.js'

export async function validateUniqueArtistPassword(password, currentArtistId = null, currentTalentId = null) {
  if (!password) return null

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    return 'Account passwords cannot match the global admin password.'
  }

  const capabilities = await getAdminAccountSchemaCapabilities(prisma)
  const [artistAccessList, talentAccessList] = await Promise.all([
    prisma.artistAdminAccess.findMany({
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
    }),
    capabilities.hasFashionTalentAdminAccess
      ? prisma.fashionTalentAdminAccess.findMany({
          where: currentTalentId
            ? {
                talentId: {
                  not: currentTalentId,
                },
              }
            : undefined,
          select: {
            passwordHash: true,
          },
        })
      : [],
  ])

  const duplicate = [...artistAccessList, ...talentAccessList].some((access) => verifyPassword(password, access.passwordHash))
  if (duplicate) return 'Each account password must be unique.'

  return null
}

export async function validateUniqueAccountPassword(password, current = {}) {
  return validateUniqueArtistPassword(password, current.artistId ?? null, current.talentId ?? null)
}
