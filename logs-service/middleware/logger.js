/**
 * Pino logger that persists every log entry into the MongoDB logs collection.
 */
const { Writable } = require('stream');
const pino = require('pino');
const Log = require('../models/log');

/*
 * Custom Node.js Writable stream for Pino.
 * Each log line is parsed as JSON and saved as a document in the logs collection.
 */
const mongoStream = new Writable({
  write: function writeLogLine(chunk, encoding, callback) {
    const msg = chunk.toString();
    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch (err) {
      return callback();
    }

    const doc = {
      level: parsed.level ? pino.levels.labels[parsed.level] || String(parsed.level) : 'info',
      message: parsed.msg || parsed.message || 'request',
      method: parsed.method || undefined,
      url: parsed.url || undefined,
      status: parsed.status !== undefined ? parsed.status : undefined,
      timestamp: parsed.time ? new Date(parsed.time) : new Date()
    };

    Log.create(doc)
      .catch(function handleLogError() {
        // Swallow DB write errors so logging never crashes the server
      })
      .finally(function done() {
        callback();
      });
  }
});

const logger = pino(mongoStream);

/**
 * Express middleware that logs every incoming HTTP request.
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', function onResponseFinish() {
    logger.info({
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Date.now() - start
    }, 'HTTP request received');
  });

  next();
}

/**
 * Explicitly log that a specific endpoint was accessed.
 */
function logEndpointAccess(req, endpointName) {
  logger.info({
    method: req.method,
    url: req.originalUrl || req.url,
    endpoint: endpointName
  }, 'Endpoint accessed: ' + endpointName);
}

module.exports = {
  logger: logger,
  requestLogger: requestLogger,
  logEndpointAccess: logEndpointAccess
};
