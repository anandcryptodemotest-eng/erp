import { PrismaClient } from "../generated/prisma";
const globalForPrisma = globalThis as unknown as { prismaSales: PrismaClient | undefined };
export const prisma = globalForPrisma.prismaSales ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaSales = prisma;
