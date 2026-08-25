/**
 * Computed Report model - caches monthly reports for past months.
 *
 * Computed Design Pattern:
 * When a monthly report is requested for a month that has already passed,
 * the generated report is stored in this collection. Later requests for the
 * same userid/year/month return the cached document instead of recalculating.
 * Current and future months are always computed on the fly and are NOT cached.
 */
const mongoose = require('mongoose');

// Schema for cached monthly reports (Computed Design Pattern)
const reportSchema = new mongoose.Schema({
  // Custom user id the report belongs to
  userid: {
    type: Number,
    required: true
  },
  // Report year (e.g. 2026)
  year: {
    type: Number,
    required: true
  },
  // Report month (1-12)
  month: {
    type: Number,
    required: true
  },
  // Grouped costs array in the exact format required by the API
  costs: {
    type: Array,
    required: true
  }
});

// Ensure one cached report per userid + year + month combination
reportSchema.index({ userid: 1, year: 1, month: 1 }, { unique: true });

// Map the schema to the reports collection
module.exports = mongoose.model('Report', reportSchema);
