require('dotenv').config();
const express      = require('express');
const config       = require('./config');
const { ping: dbPing } = require('./db/pool');

// Validate config on startup
config.validateConfig();

const app = express();
app.use(express.json({ limit: '5mb' }));

// ── Background services ───────────────────────────────────────────────────
require('./automation/worker');    // BullMQ worker
require('./automation/cron');      // monthly + weekly + daily crons
require('./audit/retention');      // 7-year retention enforcer

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api',    require('./routes/invoice.routes'));
app.use('/admin',  require('./admin/dashboard.routes'));

// ── Health (used by load balancer / UptimeRobot) ──────────────────────────
const { runHealthCheck } = require('./monitoring/healthcheck');
app.get('/health', async (req, res) => {
  const result = await runHealthCheck().catch(err => ({
    status: 'error', error: err.message,
  }));
  res.status(result.status === 'ok' ? 200 : 503).json(result);
});

app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n[App] ✅ Multi-Tenant e-Invoice Service Started');
  console.log(`[App] Global Environment: ${config.ENV.toUpperCase()}`);
  console.log(`[App] Database:           Connected`);
  console.log(`[App] Listening on:       http://localhost:${PORT}\n`);
});
