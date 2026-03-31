const { Queue }  = require('bullmq');
const IORedis    = require('ioredis');
const config     = require('../config');

const connection = process.env.REDIS_URL 
  ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : new IORedis({
      host:                 process.env.REDIS_HOST || '127.0.0.1',
      port:                 parseInt(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null, // required by BullMQ
    });

// Main invoice processing queue
const einvoiceQueue = new Queue('einvoice', { connection });

// Dead Letter Queue — jobs that exhausted all retries
const dlqQueue = new Queue('einvoice-dlq', { connection });

/**
 * Add an invoice job to the queue.
 * Every job MUST include merchantId so the worker knows which merchant to load.
 */
async function enqueueInvoiceJob(type, merchantId, payload) {
  if (!merchantId) throw new Error('[Queue] merchantId is required for all jobs');

  await einvoiceQueue.add(type, { merchantId, ...payload }, {
    attempts: config.QUEUE.ATTEMPTS,
    backoff: {
      type:  'exponential',
      delay: config.QUEUE.BACKOFF_DELAY,
    },
    jobId: `${merchantId}:${type}:${payload.orderNumber || payload.refNumber || Date.now()}`,
    removeOnComplete: { count: 200 },
    removeOnFail:     false,
  });

  console.log(
    `[Queue] Enqueued type="${type}" merchant="${merchantId}" ` +
    `order="${payload.orderNumber || payload.refNumber || 'consolidated'}"`
  );
}

/**
 * Get queue health stats for a specific merchant
 */
async function getMerchantQueueStats(merchantId) {
  const jobs = await einvoiceQueue.getJobs(['waiting', 'active', 'failed', 'completed']);
  const merchantJobs = jobs.filter(j => j.data?.merchantId === merchantId);
  return {
    waiting:   merchantJobs.filter(j => j.opts?.delay).length,
    active:    merchantJobs.filter(j => !j.finishedOn && !j.failedReason).length,
    failed:    merchantJobs.filter(j => j.failedReason).length,
    completed: merchantJobs.filter(j => j.finishedOn && !j.failedReason).length,
  };
}

module.exports = { einvoiceQueue, dlqQueue, connection, enqueueInvoiceJob, getMerchantQueueStats };
