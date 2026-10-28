// Entry point of the e2e backend (`node e2e/stack/start.mjs`, run by Playwright's webServer): a fresh
// database with every migration applied, and the gateway that stands in for Supabase in front of it.
import { ANON_KEY, DATABASE, GATEWAY_PORT, GATEWAY_URL, SERVICE_ROLE_KEY } from "./config.mjs";
import { createPool, resetDatabase } from "./db.mjs";
import { createFunctions } from "./functions.mjs";
import { startGateway } from "./gateway.mjs";

const log = (line) => console.log(`[e2e] ${line}`);

async function main() {
  await resetDatabase({ log });
  const pool = createPool({ log });
  try {
    const functions = createFunctions({ supabaseUrl: GATEWAY_URL, anonKey: ANON_KEY, serviceRoleKey: SERVICE_ROLE_KEY, log });
    const gateway = await startGateway({ port: GATEWAY_PORT, pool, functions, log });
    console.log(`e2e gateway ready on ${GATEWAY_URL} (database ${DATABASE})`);

    let stopping = false;
    const stop = async (signal) => {
      if (stopping) return;
      stopping = true;
      log(`${signal} received, shutting down`);
      await gateway.close();
      await pool.end();
      process.exit(0);
    };
    process.on("SIGINT", () => stop("SIGINT"));
    process.on("SIGTERM", () => stop("SIGTERM"));
  } catch (error) {
    await pool.end().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(`e2e gateway failed to start: ${error.message}`);
  process.exit(1);
});
