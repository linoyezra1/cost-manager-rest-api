/**
 * Cost model - documents stored in the costs collection.
 * Categories must be one of: food, health, housing, sport, education.
 */
const mongoose = require('mongoose');

// Allowed cost categories (order matches the sample report in the project document)
const ALLOWED_CATEGORIES = ['food', 'education', 'health', 'housing', 'sport'];

// Schema for documents stored in the costs collection
const costSchema = new mongoose.Schema({
  // Short text describing the cost item
  description: {
    type: String,
    required: true
  },
  // Category name - must match one of the allowed values
  category: {
    type: String,
    required: true,
    enum: ALLOWED_CATEGORIES
  },
  // Custom user id (Number) of the user who owns this cost
  userid: {
    type: Number,
    required: true
  },
  // Monetary amount as Double (floating point)
  sum: {
    type: mongoose.Schema.Types.Double,
    required: true
  },
  // Creation date/time; defaults to request arrival time when omitted
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Export allowed categories for reuse in validation / report building
costSchema.statics.ALLOWED_CATEGORIES = ALLOWED_CATEGORIES;

// Map the schema to the costs collection
module.exports = mongoose.model('Cost', costSchema);
