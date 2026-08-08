/**
 * Ensure documented demo / e2e users have PASSWORD credentials (Argon2id).
 *
 *   DATABASE_URL=postgresql://erp:erp_dev_password@127.0.0.1:5432/erp_gateway \
 *     pnpm exec tsx scripts/repair-demo-passwords.ts
 */
import { PrismaClient } from "../apps/gateway/src/generated/prisma";
import { hashPassword } from "../apps/gateway/src/lib/identity/password";

const prisma = new PrismaClient();

const KNOWN = [
  { email: "admin@simhapurifresh.com", password: "Admin@123" },
  { email: "sales@trustwood.test", password: "Sales@123" },
  { email: "buyer@trustwood.test", password: "Buyer@12345" },
  { email: "pricing@oms.test", password: "Test@123" },
  { email: "dispatch@oms.test", password: "Test@123" },
  { email: "delivery@oms.test", password: "Test@123" },
  { email: "accountant@oms.test", password: "Test@123" },
] as const;

const E2E_PASSWORD = process.env.E2E_PASSWORD || "Pass@12345";

async function upsertPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`skip (no user): ${email}`);
    return false;
  }
  const hash = await hashPassword(password);
  const existing = await prisma.authCredential.findFirst({
    where: { userId: user.id, type: "PASSWORD" },
  });
  if (existing) {
    await prisma.authCredential.update({
      where: { id: existing.id },
      data: { passwordHash: hash },
    });
    console.log(`updated: ${email}`);
  } else {
    await prisma.authCredential.create({
      data: { userId: user.id, type: "PASSWORD", passwordHash: hash },
    });
    console.log(`created: ${email}`);
  }
  return true;
}

async function main() {
  for (const row of KNOWN) {
    await upsertPassword(row.email, row.password);
  }

  const leftovers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "manager.", endsWith: "@simhapurifresh.com" } },
        { email: { startsWith: "user.", endsWith: "@simhapurifresh.com" } },
      ],
    },
    select: { email: true },
  });
  for (const row of leftovers) {
    await upsertPassword(row.email, E2E_PASSWORD);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
