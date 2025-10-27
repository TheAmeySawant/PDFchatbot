const { sequelize } = require('../config/database');
const User = require('./User');
const Session = require('./Session');

// Define relationships
User.hasMany(Session);
Session.belongsTo(User);

module.exports = {
  User,
  Session
};