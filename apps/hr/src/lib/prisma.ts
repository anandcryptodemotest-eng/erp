import { PrismaClient } from "../generated/prisma";
const globalForPrisma = globalThis as unknown as { prismaHr: PrismaClient | undefined };
export const prisma = globalForPrisma.prismaHr ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaHr = prisma;
