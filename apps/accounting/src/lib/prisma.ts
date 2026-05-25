import { PrismaClient } from "../generated/prisma";
const globalForPrisma = globalThis as unknown as { prismaAccounting: PrismaClient | undefined };
export const prisma = globalForPrisma.prismaAccounting ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaAccounting = prisma;
