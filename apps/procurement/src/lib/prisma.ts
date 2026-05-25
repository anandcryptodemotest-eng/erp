import { PrismaClient } from "../generated/prisma";
const globalForPrisma = globalThis as unknown as { prismaProcurement: PrismaClient | undefined };
export const prisma = globalForPrisma.prismaProcurement ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaProcurement = prisma;
