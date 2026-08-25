/**
 * User model (read-only usage in costs-service).
 * Used to verify that a userid exists before adding a cost item.
 */
const mongoose = require('mongoose');

// Schema for documents stored in the users collection
const userSchema = new mongoose.Schema({
  // Custom numeric id (different from MongoDB _id)
  id: {
    type: Number,
    required: true,
    unique: true
  },
  // User first name
  first_name: {
    type: String,
    required: true
  },
  // User last name
  last_name: {
    type: String,
    required: true
  },
  // User date of birth
  birthday: {
    type: Date,
    required: true
  }
});

// Map the schema to the users collection
module.exports = mongoose.model('User', userSchema);
