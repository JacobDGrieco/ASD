import { prisma } from "../src/lib/prisma.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await prisma.$queryRaw`SELECT 1`;
  res.status(200).json({ status: "ok" });
}
