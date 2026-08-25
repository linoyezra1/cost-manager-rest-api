/**
 * Pino logger that persists every log entry into the MongoDB logs collection.
 * Used as middleware and for explicit endpoint-access logging.
 */
const { Writable } = require('stream');
const pino = require('pino');
const Log = require('../models/log');

/*
 * Custom Node.js Writable stream for Pino.
 * Each log line is parsed as JSON and saved as a document in the logs collection.
 */
const mongoStream = new Writable({
  // Write a single Pino log line into MongoDB
  write: function writeLogLine(chunk, encoding, callback) {
    // Convert the chunk buffer/string into text
    const msg = chunk.toString();

    // Parse the JSON string produced by Pino
    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch (err) {
      // Ignore malformed log lines and continue
      return callback();
    }

    // Build the document that will be stored in the logs collection
    const doc = {
      level: parsed.level ? pino.levels.labels[parsed.level] || String(parsed.level) : 'info',
      message: parsed.msg || parsed.message || 'request',
      method: parsed.method || undefined,
      url: parsed.url || undefined,
      status: parsed.status !== undefined ? parsed.status : undefined,
      timestamp: parsed.time ? new Date(parsed.time) : new Date()
    };

    // Persist asynchronously; always invoke callback so the stream stays healthy
    Log.create(doc)
      .catch(function handleLogError() {
        // Swallow DB write errors so logging never crashes the server
      })
      .finally(function done() {
        callback();
      });
  }
});

// Create the Pino logger instance bound to the MongoDB stream
const logger = pino(mongoStream);

/**
 * Express middleware that logs every incoming HTTP request
 * and its final response status into MongoDB via Pino.
 */
function requestLogger(req, res, next) {
  // Capture start time for potential future duration metrics
  const start = Date.now();

  // Hook into the response finish event to know the final status code
  res.on('finish', function onResponseFinish() {
    // Log method, URL, status and a short message for every HTTP request
    logger.info({
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Date.now() - start
    }, 'HTTP request received');
  });

  // Continue to the next middleware / route handler
  next();
}

/**
 * Explicitly log that a specific endpoint was accessed.
 * Called at the beginning of each route handler.
 */
function logEndpointAccess(req, endpointName) {
  // Write an additional log entry whenever an endpoint is accessed
  logger.info({
    method: req.method,
    url: req.originalUrl || req.url,
    endpoint: endpointName
  }, 'Endpoint accessed: ' + endpointName);
}

// Export logger helpers for use in server.js
module.exports = {
  logger: logger,
  requestLogger: requestLogger,
  logEndpointAccess: logEndpointAccess
};
