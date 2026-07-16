/**
 * Shared Prisma client singleton for every `api/*.js` handler. Cached on
 * `globalThis` outside production so Vite/dev hot-reload doesn't spawn a new
 * client (and a new DB connection pool) on every file edit. Server-only.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
	});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
