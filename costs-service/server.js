/**
 * Costs microservice (Process C).
 * Endpoints: POST /api/add, GET /api/report
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const Cost = require('./models/cost');
const User = require('./models/user');
const Report = require('./models/report');
const { requestLogger, logEndpointAccess } = require('./middleware/logger');

// Create the Express application for the costs process
const app = express();

// Read the listening port from environment (Railway sets PORT automatically)
const PORT = process.env.PORT || 3003;

// Enable CORS so the grading test script can call this service
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Log every incoming HTTP request into the MongoDB logs collection
app.use(requestLogger);

/*
 * Computed Design Pattern implementation for monthly reports:
 *
 * 1. When GET /api/report is called, first look for a cached report document
 *    in the reports collection for the given userid + year + month.
 * 2. If a cached report exists, return it immediately (no recalculation).
 * 3. If no cache exists, query the costs collection, group by category,
 *    and build the required JSON structure (all 5 categories always present).
 * 4. If the requested month is entirely in the past (relative to "now"),
 *    save the generated report into the reports collection for future reuse.
 * 5. Current and future months are never cached, because new costs may still
 *    be added. The server also rejects adding costs dated in the past, so
 *    past-month reports remain stable once computed.
 */

/**
 * Build an empty report skeleton with all five required categories.
 */
function buildEmptyCostsArray() {
  // Always include every category, even when it has no cost items
  const categories = Cost.ALLOWED_CATEGORIES;
  const result = [];

  // Create one object per category with an empty array
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const entry = {};
    entry[cat] = [];
    result.push(entry);
  }

  return result;
}

/**
 * Group cost documents into the report "costs" array format.
 */
function groupCostsByCategory(costDocs) {
  // Start from the mandatory empty category skeleton
  const grouped = buildEmptyCostsArray();

  // Index categories for quick lookup while iterating cost documents
  const indexByCategory = {};
  for (let i = 0; i < grouped.length; i++) {
    const key = Object.keys(grouped[i])[0];
    indexByCategory[key] = i;
  }

  // Place each cost under its category with sum, description and day
  for (let i = 0; i < costDocs.length; i++) {
    const item = costDocs[i];
    const cat = item.category;
    const idx = indexByCategory[cat];

    // Skip unknown categories defensively (should not happen after validation)
    if (idx === undefined) {
      continue;
    }

    // Extract the day-of-month from the cost creation date
    const created = item.created_at ? new Date(item.created_at) : new Date();
    const day = created.getDate();

    // Push the slim cost descriptor into the matching category array
    grouped[idx][cat].push({
      sum: item.sum,
      description: item.description,
      day: day
    });
  }

  return grouped;
}

/**
 * Return true when the given year/month is fully in the past.
 */
function isPastMonth(year, month) {
  // Compare against the first day of the current month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Past year, or same year but earlier month
  if (year < currentYear) {
    return true;
  }
  if (year === currentYear && month < currentMonth) {
    return true;
  }
  return false;
}

/**
 * Return true when a date falls strictly before today (date-only comparison).
 */
function isPastDate(dateObj) {
  // Normalize both sides to midnight local time for a fair comparison
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  return target < today;
}

/**
 * Send a standardized error JSON document.
 */
function sendError(res, status, id, message) {
  // Always include at least id and message as required by the project
  return res.status(status).json({
    id: id,
    message: message
  });
}

/**
 * POST /api/add - add a new cost item.
 */
app.post(['/api/add', '/api/add/'], async function addCost(req, res) {
  // Log that this endpoint was accessed
  logEndpointAccess(req, 'POST /api/add');

  try {
    // Read required fields from the request body
    const description = req.body.description;
    const category = req.body.category;
    const userid = req.body.userid;
    const sum = req.body.sum;

    // Validate that description is a non-empty string
    if (typeof description !== 'string' || description.trim() === '') {
      return sendError(res, 400, 'INVALID_DESCRIPTION', 'description is required and must be a non-empty string');
    }

    // Validate that category is one of the five allowed values
    if (typeof category !== 'string' || Cost.ALLOWED_CATEGORIES.indexOf(category) === -1) {
      return sendError(res, 400, 'INVALID_CATEGORY', 'category must be one of: food, health, housing, sport, education');
    }

    // Validate that userid is a number
    if (typeof userid !== 'number' || Number.isNaN(userid)) {
      return sendError(res, 400, 'INVALID_USERID', 'userid is required and must be a number');
    }

    // Validate that sum is a finite number (Double)
    if (typeof sum !== 'number' || Number.isNaN(sum) || !Number.isFinite(sum)) {
      return sendError(res, 400, 'INVALID_SUM', 'sum is required and must be a number');
    }

    // Verify the user exists in the users collection
    const existingUser = await User.findOne({ id: userid });
    if (!existingUser) {
      return sendError(res, 404, 'USER_NOT_FOUND', 'user with the given userid does not exist');
    }

    // Resolve creation date: use provided value or server receive time
    let createdAt = new Date();
    if (req.body.created_at !== undefined && req.body.created_at !== null) {
      createdAt = new Date(req.body.created_at);
      if (Number.isNaN(createdAt.getTime())) {
        return sendError(res, 400, 'INVALID_DATE', 'created_at must be a valid date');
      }
    } else if (req.body.date !== undefined && req.body.date !== null) {
      // Also accept "date" as an alternate field name for convenience
      createdAt = new Date(req.body.date);
      if (Number.isNaN(createdAt.getTime())) {
        return sendError(res, 400, 'INVALID_DATE', 'date must be a valid date');
      }
    }

    // Reject cost items whose date belongs to the past
    if (isPastDate(createdAt)) {
      return sendError(res, 400, 'PAST_DATE_NOT_ALLOWED', 'adding costs with dates in the past is not allowed');
    }

    // Create and persist the new cost document
    const newCost = await Cost.create({
      description: description.trim(),
      category: category,
      userid: userid,
      sum: sum,
      created_at: createdAt
    });

    // Return the newly created cost document as JSON
    return res.status(201).json({
      description: newCost.description,
      category: newCost.category,
      userid: newCost.userid,
      sum: newCost.sum,
      created_at: newCost.created_at,
      _id: newCost._id
    });
  } catch (err) {
    // Return a generic server error document on unexpected failures
    return sendError(res, 500, 'ADD_COST_ERROR', err.message || 'failed to add cost item');
  }
});

/**
 * GET /api/report - get a monthly cost report for a user (Computed Design Pattern).
 */
app.get(['/api/report', '/api/report/'], async function getReport(req, res) {
  // Log that this endpoint was accessed
  logEndpointAccess(req, 'GET /api/report');

  try {
    // Parse query string parameters
    const id = Number(req.query.id);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    // Validate id (userid)
    if (!Number.isFinite(id)) {
      return sendError(res, 400, 'INVALID_ID', 'id query parameter is required and must be a number');
    }

    // Validate year
    if (!Number.isFinite(year) || year < 1970) {
      return sendError(res, 400, 'INVALID_YEAR', 'year query parameter is required and must be a valid year');
    }

    // Validate month (1-12)
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return sendError(res, 400, 'INVALID_MONTH', 'month query parameter is required and must be between 1 and 12');
    }

    // Step 1 of Computed Design Pattern: try to load a cached past-month report
    const cached = await Report.findOne({ userid: id, year: year, month: month });
    if (cached) {
      // Return the cached report without recalculating
      return res.status(200).json({
        userid: cached.userid,
        year: cached.year,
        month: cached.month,
        costs: cached.costs
      });
    }

    // Step 2: compute the report from the costs collection
    const rangeStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const rangeEnd = new Date(year, month, 1, 0, 0, 0, 0);

    // Fetch all costs for this user within the requested month
    const costDocs = await Cost.find({
      userid: id,
      created_at: { $gte: rangeStart, $lt: rangeEnd }
    });

    // Build the grouped costs structure (all categories always present)
    const costsArray = groupCostsByCategory(costDocs);

    // Assemble the final report document
    const report = {
      userid: id,
      year: year,
      month: month,
      costs: costsArray
    };

    // Step 3: if the month is in the past, cache the report for future requests
    if (isPastMonth(year, month)) {
      try {
        await Report.create(report);
      } catch (cacheErr) {
        // Ignore duplicate-key races; another request may have cached it first
      }
    }

    // Return the freshly computed report
    return res.status(200).json(report);
  } catch (err) {
    // Return a generic server error document on unexpected failures
    return sendError(res, 500, 'REPORT_ERROR', err.message || 'failed to generate report');
  }
});

/**
 * Connect to MongoDB Atlas and start listening for HTTP requests.
 */
async function startServer() {
  // Ensure the connection string is configured
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing from environment variables');
    process.exit(1);
  }

  // Connect to the shared MongoDB Atlas database
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('costs-service connected to MongoDB');

  // Start the HTTP server on the configured port
  app.listen(PORT, function onListen() {
    console.log('costs-service listening on port ' + PORT);
  });
}

// Boot only when this file is executed directly (not when required by tests)
if (require.main === module) {
  startServer().catch(function onStartError(err) {
    console.error('Failed to start costs-service:', err);
    process.exit(1);
  });
}

// Export the app for optional unit testing without listening
module.exports = app;
