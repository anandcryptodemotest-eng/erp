import { PrismaClient } from "../generated/prisma";
const globalForPrisma = globalThis as unknown as { prismaInventory: PrismaClient | undefined };
export const prisma = globalForPrisma.prismaInventory ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaInventory = prisma;
