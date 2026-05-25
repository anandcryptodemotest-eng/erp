import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as { prismaGateway: PrismaClient | undefined };

export const prisma = globalForPrisma.prismaGateway ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaGateway = prisma;
