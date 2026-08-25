/**
 * Log model - documents stored in the logs collection.
 */
const mongoose = require('mongoose');

// Schema for documents stored in the logs collection
const logSchema = new mongoose.Schema({
  // Log severity level
  level: {
    type: String,
    required: true
  },
  // Human-readable log message
  message: {
    type: String,
    required: true
  },
  // HTTP method of the request
  method: {
    type: String
  },
  // Request URL path
  url: {
    type: String
  },
  // HTTP response status code
  status: {
    type: Number
  },
  // Time when the log entry was created
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Map the schema to the logs collection
module.exports = mongoose.model('Log', logSchema);
