const sequelize = require('./database');
const { User, Session } = require('../models');

async function initDatabase() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');

    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized successfully');

    // Create indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_userid ON "Sessions" ("UserId");
      CREATE INDEX IF NOT EXISTS idx_sessions_sessionid ON "Sessions" ("sessionId");
    `);
    console.log('✅ Database indexes created successfully');

  } catch (error) {
    console.error('❌ Unable to initialize database:', error);
    throw error;
  }
}

module.exports = initDatabase;