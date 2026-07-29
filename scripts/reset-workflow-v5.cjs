const { PrismaClient } = require("../apps/sales/src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  console.log("tasks", (await prisma.workflowTask.deleteMany({})).count);
  console.log("events", (await prisma.workflowEvent.deleteMany({})).count);
  console.log("inst", (await prisma.workflowInstance.deleteMany({})).count);
  console.log(
    "so",
    (
      await prisma.salesOrder.updateMany({
        where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        data: { status: "CANCELLED" },
      })
    ).count
  );
  console.log(
    "sreq",
    (
      await prisma.salesRequest.updateMany({
        where: { status: { in: ["OPEN", "CONVERTED"] } },
        data: { status: "CANCELLED", rejectReason: "Greenfield workflow reset" },
      })
    ).count
  );
  console.log("forms", (await prisma.workflowFormVersion.deleteMany({})).count);
  console.log("tmpl", (await prisma.workflowTemplateVersion.deleteMany({})).count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
