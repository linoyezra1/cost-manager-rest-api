/**
 * Log model - used so about-service can also write Pino logs to MongoDB.
 */
const mongoose = require('mongoose');

// Schema for documents stored in the logs collection
const logSchema = new mongoose.Schema({
  level: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  method: {
    type: String
  },
  url: {
    type: String
  },
  status: {
    type: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Log', logSchema);
