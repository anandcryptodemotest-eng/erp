import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = (process.env.PLATFORM_OWNER_EMAIL || "platform@erp.local").toLowerCase();
  const password = process.env.PLATFORM_OWNER_PASSWORD || "Platform@123";
  const name = process.env.PLATFORM_OWNER_NAME || "Platform Owner";
  const hash = await bcrypt.hash(password, 12);

  const op = await prisma.platformOperator.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash: hash,
      role: "PLATFORM_OWNER",
      isActive: true,
    },
    update: {
      name,
      passwordHash: hash,
      role: "PLATFORM_OWNER",
      isActive: true,
    },
  });

  console.log(`Platform operator ready: ${op.email} (${op.role})`);
  console.log(`Default password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
