/**
 * Logs microservice (Process A).
 * Endpoint: GET /api/logs
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const Log = require('./models/log');
const { requestLogger, logEndpointAccess } = require('./middleware/logger');

// Create the Express application for the logs process
const app = express();

// Read the listening port from environment
const PORT = process.env.PORT || 3001;

// Enable CORS for external test clients
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Log every incoming HTTP request into MongoDB
app.use(requestLogger);

/**
 * Send a standardized error JSON document.
 */
function sendError(res, status, id, message) {
  return res.status(status).json({
    id: id,
    message: message
  });
}

/**
 * GET /api/logs - return all log documents from the logs collection.
 */
app.get(['/api/logs', '/api/logs/'], async function listLogs(req, res) {
  // Log that this endpoint was accessed
  logEndpointAccess(req, 'GET /api/logs');

  try {
    // Load all log documents, newest first for easier inspection
    const logs = await Log.find({}).sort({ timestamp: -1 }).select('-__v');

    // Map to plain objects with schema property names
    const result = logs.map(function mapLog(entry) {
      return {
        level: entry.level,
        message: entry.message,
        method: entry.method,
        url: entry.url,
        status: entry.status,
        timestamp: entry.timestamp,
        _id: entry._id
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, 500, 'LIST_LOGS_ERROR', err.message || 'failed to list logs');
  }
});

/**
 * Connect to MongoDB Atlas and start listening.
 */
async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing from environment variables');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('logs-service connected to MongoDB');

  app.listen(PORT, function onListen() {
    console.log('logs-service listening on port ' + PORT);
  });
}

// Boot only when this file is executed directly (not when required by tests)
if (require.main === module) {
  startServer().catch(function onStartError(err) {
    console.error('Failed to start logs-service:', err);
    process.exit(1);
  });
}

module.exports = app;
