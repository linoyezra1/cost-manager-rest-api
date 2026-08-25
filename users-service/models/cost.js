/**
 * Cost model (read usage in users-service).
 * Used to calculate the total costs for GET /api/users/:id.
 */
const mongoose = require('mongoose');

// Schema for documents stored in the costs collection
const costSchema = new mongoose.Schema({
  // Short text describing the cost item
  description: {
    type: String,
    required: true
  },
  // Category name
  category: {
    type: String,
    required: true
  },
  // Custom user id of the owner
  userid: {
    type: Number,
    required: true
  },
  // Monetary amount as Double
  sum: {
    type: mongoose.Schema.Types.Double,
    required: true
  },
  // Creation date/time
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Map the schema to the costs collection
module.exports = mongoose.model('Cost', costSchema);
