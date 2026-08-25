/**
 * Users microservice (Process B).
 * Endpoints: POST /api/add, GET /api/users, GET /api/users/:id
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const User = require('./models/user');
const Cost = require('./models/cost');
const { requestLogger, logEndpointAccess } = require('./middleware/logger');

// Create the Express application for the users process
const app = express();

// Read the listening port from environment
const PORT = process.env.PORT || 8080;

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
  // Always include at least id and message
  return res.status(status).json({
    id: id,
    message: message
  });
}

/**
 * POST /api/add - add a new user.
 * Rejects duplicates (same custom id) with an error JSON document.
 */
app.post(['/api/add', '/api/add/'], async function addUser(req, res) {
  // Log that this endpoint was accessed
  logEndpointAccess(req, 'POST /api/add');

  try {
    // Read required fields from the request body
    const id = req.body.id;
    const firstName = req.body.first_name;
    const lastName = req.body.last_name;
    const birthdayRaw = req.body.birthday;

    // Validate id is a number
    if (typeof id !== 'number' || Number.isNaN(id)) {
      return sendError(res, 400, 'INVALID_ID', 'id is required and must be a number');
    }

    // Validate first_name is a non-empty string
    if (typeof firstName !== 'string' || firstName.trim() === '') {
      return sendError(res, 400, 'INVALID_FIRST_NAME', 'first_name is required and must be a non-empty string');
    }

    // Validate last_name is a non-empty string
    if (typeof lastName !== 'string' || lastName.trim() === '') {
      return sendError(res, 400, 'INVALID_LAST_NAME', 'last_name is required and must be a non-empty string');
    }

    // Validate birthday can be parsed into a Date
    if (birthdayRaw === undefined || birthdayRaw === null) {
      return sendError(res, 400, 'INVALID_BIRTHDAY', 'birthday is required');
    }
    const birthday = new Date(birthdayRaw);
    if (Number.isNaN(birthday.getTime())) {
      return sendError(res, 400, 'INVALID_BIRTHDAY', 'birthday must be a valid date');
    }

    // Reject if a user with this custom id already exists
    const existing = await User.findOne({ id: id });
    if (existing) {
      return sendError(res, 409, 'USER_EXISTS', 'a user with this id already exists');
    }

    // Create and persist the new user document
    const newUser = await User.create({
      id: id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      birthday: birthday
    });

    // Return the newly created user (property names match the collection)
    return res.status(201).json({
      id: newUser.id,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      birthday: newUser.birthday,
      _id: newUser._id
    });
  } catch (err) {
    // Handle MongoDB duplicate-key race conditions
    if (err && err.code === 11000) {
      return sendError(res, 409, 'USER_EXISTS', 'a user with this id already exists');
    }
    return sendError(res, 500, 'ADD_USER_ERROR', err.message || 'failed to add user');
  }
});

/**
 * GET /api/users - list all users.
 */
app.get(['/api/users', '/api/users/'], async function listUsers(req, res) {
  // Log that this endpoint was accessed
  logEndpointAccess(req, 'GET /api/users');

  try {
    // Load all user documents from the collection
    const users = await User.find({}).select('-__v');

    // Map to plain objects with the required property names
    const result = users.map(function mapUser(u) {
      return {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        birthday: u.birthday,
        _id: u._id
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, 500, 'LIST_USERS_ERROR', err.message || 'failed to list users');
  }
});

/**
 * GET /api/users/:id - get details of a specific user including total costs.
 */
app.get('/api/users/:id', async function getUserDetails(req, res) {
  // Log that this endpoint was accessed
  logEndpointAccess(req, 'GET /api/users/:id');

  try {
    // Parse the custom user id from the URL
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return sendError(res, 400, 'INVALID_ID', 'user id must be a number');
    }

    // Find the user by custom id (not MongoDB _id)
    const user = await User.findOne({ id: userId });
    if (!user) {
      return sendError(res, 404, 'USER_NOT_FOUND', 'user not found');
    }

    // Aggregate the total sum of all costs belonging to this userid
    const totals = await Cost.aggregate([
      { $match: { userid: userId } },
      { $group: { _id: null, total: { $sum: '$sum' } } }
    ]);

    // Default total to 0 when the user has no costs yet
    const total = totals.length > 0 ? totals[0].total : 0;

    // Reply with first_name, last_name, id and total only
    return res.status(200).json({
      first_name: user.first_name,
      last_name: user.last_name,
      id: user.id,
      total: total
    });
  } catch (err) {
    return sendError(res, 500, 'GET_USER_ERROR', err.message || 'failed to get user details');
  }
});

/**
 * Health check so Railway / browsers can verify the process is alive.
 */
app.get(['/', '/health'], function health(req, res) {
  return res.status(200).json({ ok: true, service: 'users-service' });
});

/**
 * Start HTTP first (Railway needs an open port), then connect MongoDB.
 */
async function startServer() {
  // Bind to 0.0.0.0 so Railway's proxy can reach this process
  app.listen(PORT, '0.0.0.0', function onListen() {
    console.log('users-service listening on port ' + PORT);
  });

  if (!process.env.MONGODB_URI) {
    console.error('WARNING: MONGODB_URI is missing - user endpoints will fail until it is set');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('users-service connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
  }
}

// Boot only when this file is executed directly (not when required by tests)
if (require.main === module) {
  startServer().catch(function onStartError(err) {
    console.error('Failed to start users-service:', err);
    process.exit(1);
  });
}

module.exports = app;
