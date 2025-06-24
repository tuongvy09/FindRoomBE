// bullmq.js  – version BullMQ v5
const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('Thiếu REDIS_URL');

const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,   // yêu cầu của BullMQ
    enableReadyCheck: false,
    // Nếu bạn bật TLS trong Render ➜ dùng:
    // tls: {}
});
// KHÔNG còn QueueScheduler ở v5
const autoReplyQueue = new Queue('autoReplyQueue', { connection });

// (tuỳ chọn) theo dõi sự kiện để chắc chắn job bị stalled sẽ tự xử lý
const queueEvents = new QueueEvents('autoReplyQueue', { connection });
queueEvents.on('failed', ({ jobId, failedReason }) =>
    console.error(`Job ${jobId} failed:`, failedReason)
);
queueEvents.on('completed', ({ jobId }) =>
    console.log(`Job ${jobId} completed`)
);

// Worker gửi tin
const worker = new Worker(
    'autoReplyQueue',
    async job => {
        const { socketId, reply } = job.data;
        const io = require('../../congfig/websocket').io; // path tới file export io
        io.to(socketId).emit('botReply', reply);
    },
    { connection }
);

module.exports = { autoReplyQueue };
