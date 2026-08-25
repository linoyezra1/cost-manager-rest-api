/**
 * User model - documents stored in the users collection.
 * Note: id (Number) is distinct from MongoDB's _id.
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
