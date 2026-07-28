import EmbeddedPostgres from "embedded-postgres";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseDir = resolve(__dirname, "data/db");
const alreadyInit = existsSync(resolve(databaseDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "erp",
  password: "erp_dev_password",
  port: 5432,
  persistent: true,
});

const dbs = [
  "erp_gateway",
  "erp_sales",
  "erp_inventory",
  "erp_accounting",
  "erp_hr",
  "erp_procurement",
  "erp_delivery",
];

async function main() {
  if (!alreadyInit) {
    console.log("[pg] initialise cluster…");
    await pg.initialise();
  } else {
    console.log("[pg] cluster already initialised");
  }

  console.log("[pg] starting on :5432…");
  await pg.start();

  for (const name of dbs) {
    try {
      await pg.createDatabase(name);
      console.log(`[pg] created ${name}`);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (/already exists/i.test(msg)) {
        console.log(`[pg] exists ${name}`);
      } else {
        console.warn(`[pg] ${name}: ${msg}`);
      }
    }
  }

  console.log("[pg] ready — leave this process running");
  // Keep alive
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
