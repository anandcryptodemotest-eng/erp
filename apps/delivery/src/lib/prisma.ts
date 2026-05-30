import { PrismaClient } from "../generated/prisma";
const globalForPrisma = globalThis as unknown as { prismaDelivery: PrismaClient | undefined };
export const prisma = globalForPrisma.prismaDelivery ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaDelivery = prisma;
