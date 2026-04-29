/**
 * UniNMS Harvester — Cron Scheduler
 *
 * Runs the OAI-PMH harvester on a schedule without external dependencies.
 * Uses Node's built-in setTimeout loop so no extra packages are required.
 *
 * Schedule (configurable via env):
 *   HARVEST_INTERVAL_HOURS  — default 24 (once per day)
 *   HARVEST_SOURCE          — default "all"  (kashere | openjnl | njol | all)
 *
 * Usage:
 *   node cron.js
 *   HARVEST_INTERVAL_HOURS=6 HARVEST_SOURCE=all node cron.js
 *
 * In production, keep this process alive with PM2:
 *   pm2 start cron.js --name uninms-harvester
 */

require('dotenv').config({ path: '../uninms-backend/.env' });
const { execFile } = require('child_process');
const path = require('path');

const INTERVAL_HOURS = parseFloat(process.env.HARVEST_INTERVAL_HOURS ?? '24');
const SOURCE         = process.env.HARVEST_SOURCE ?? 'all';
const INTERVAL_MS    = INTERVAL_HOURS * 60 * 60 * 1000;
const HARVEST_SCRIPT = path.join(__dirname, 'harvest.js');

function timestamp() {
  return new Date().toISOString();
}

function runHarvest() {
  console.log(`[${timestamp()}] Starting harvest — source: ${SOURCE}`);

  const child = execFile(
    process.execPath,
    [HARVEST_SCRIPT, '--source', SOURCE],
    { cwd: __dirname, timeout: 30 * 60 * 1000 },
    (err, stdout, stderr) => {
      if (err) {
        console.error(`[${timestamp()}] Harvest failed:`, err.message);
        if (stderr) console.error(stderr);
      } else {
        console.log(`[${timestamp()}] Harvest complete`);
        if (stdout) console.log(stdout);
      }
    }
  );

  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
}

// Run immediately on startup, then on schedule
runHarvest();

setInterval(() => {
  runHarvest();
}, INTERVAL_MS);

console.log(`[${timestamp()}] Harvester scheduler started — running every ${INTERVAL_HOURS}h (source: ${SOURCE})`);
