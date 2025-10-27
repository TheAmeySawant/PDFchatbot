require('dotenv').config();
const { sequelize, testConnection } = require('./config/database');

console.log('Database URL:', process.env.DATABASE_URL);

async function testDb() {
  try {
    await testConnection();
    await sequelize.sync({ force: false });
    console.log('✅ Database synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDb();