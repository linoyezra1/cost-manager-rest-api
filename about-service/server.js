/**
 * About microservice (Process D).
 * Endpoint: GET /api/about
 *
 * Team member names are NOT stored in the database (submission requires
 * an empty DB except for one imaginary user). Names come from .env / code.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const { requestLogger, logEndpointAccess } = require('./middleware/logger');

// Create the Express application for the about process
const app = express();

// Read the listening port from environment
const PORT = process.env.PORT || 3004;

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
 * Build the team members array from environment variables (or hardcoded fallback).
 * Property names match the users collection: first_name, last_name only.
 */
function getTeamMembers() {
  // Prefer values from .env so names are not hard-coupled to source if needed
  const member1First = process.env.TEAM_MEMBER_1_FIRST || 'Linoy';
  const member1Last = process.env.TEAM_MEMBER_1_LAST || 'Ezra';
  const member2First = process.env.TEAM_MEMBER_2_FIRST || 'Dudu';
  const member2Last = process.env.TEAM_MEMBER_2_LAST || 'Dorani';

  // Return only first_name and last_name for each developer
  return [
    { first_name: member1First, last_name: member1Last },
    { first_name: member2First, last_name: member2Last }
  ];
}

/**
 * GET /api/about - return the development team members.
 */
app.get(['/api/about', '/api/about/'], async function getAbout(req, res) {
  // Log that this endpoint was accessed
  logEndpointAccess(req, 'GET /api/about');

  try {
    // Build the response without reading from the database
    const team = getTeamMembers();
    return res.status(200).json(team);
  } catch (err) {
    return sendError(res, 500, 'ABOUT_ERROR', err.message || 'failed to get team details');
  }
});

/**
 * Connect to MongoDB (for logging) and start listening.
 */
async function startServer() {
  // MongoDB is still required so request logs can be written
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing from environment variables');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('about-service connected to MongoDB');

  app.listen(PORT, function onListen() {
    console.log('about-service listening on port ' + PORT);
  });
}

// Boot only when this file is executed directly (not when required by tests)
if (require.main === module) {
  startServer().catch(function onStartError(err) {
    console.error('Failed to start about-service:', err);
    process.exit(1);
  });
}

module.exports = app;
