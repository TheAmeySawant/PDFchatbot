const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Session = sequelize.define('Session', {
  sessionId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  pdfData: {
    type: DataTypes.JSONB,  // Using JSONB for better performance in PostgreSQL
    allowNull: false,
    defaultValue: {
      text: '',
      meta_info: {
        Title: 'Unknown',
        Author: 'Unknown',
        Pages: 0
      }
    }
  },
  interaction: {
    type: DataTypes.JSONB,  // Using JSONB for chat history
    defaultValue: []
  },
  lastInteraction: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['sessionId']
    },
    {
      fields: ['lastInteraction']
    }
  ]
});

module.exports = Session;