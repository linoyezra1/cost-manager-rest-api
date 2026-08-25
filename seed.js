/**
 * Seed script - resets the shared database to the submission state:
 * empty collections except for one imaginary user (mosh israeli / id 123123).
 *
 * Usage (from cost-manager root, after setting MONGODB_URI):
 *   node seed.js
 */
require('dotenv').config();

const mongoose = require('mongoose');

// Minimal schemas used only for clearing / seeding collections
const userSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  birthday: { type: Date, required: true }
});

const costSchema = new mongoose.Schema({
  description: String,
  category: String,
  userid: Number,
  sum: Number,
  created_at: Date
});

const logSchema = new mongoose.Schema({
  level: String,
  message: String,
  method: String,
  url: String,
  status: Number,
  timestamp: Date
});

const reportSchema = new mongoose.Schema({
  userid: Number,
  year: Number,
  month: Number,
  costs: Array
});

const User = mongoose.model('User', userSchema);
const Cost = mongoose.model('Cost', costSchema);
const Log = mongoose.model('Log', logSchema);
const Report = mongoose.model('Report', reportSchema);

/**
 * Clear all project collections and insert the required imaginary user.
 */
async function seed() {
  // Require a MongoDB connection string
  if (!process.env.MONGODB_URI) {
    console.error('Set MONGODB_URI in .env before running seed.js');
    process.exit(1);
  }

  // Connect to MongoDB Atlas
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Resetting collections...');

  // Remove all existing documents from each collection
  await Promise.all([
    User.deleteMany({}),
    Cost.deleteMany({}),
    Log.deleteMany({}),
    Report.deleteMany({})
  ]);

  // Insert the single required imaginary user for submission / grading
  await User.create({
    id: 123123,
    first_name: 'mosh',
    last_name: 'israeli',
    birthday: new Date('1990-01-01')
  });

  console.log('Seed complete: only user id=123123 (mosh israeli) remains.');
  await mongoose.disconnect();
}

// Run the seed and exit with a non-zero code on failure
seed().catch(function onSeedError(err) {
  console.error('Seed failed:', err);
  process.exit(1);
});
