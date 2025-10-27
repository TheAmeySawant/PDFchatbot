// Configuration for different environments
const config = {
    development: {
        mongoUri: "mongodb://localhost:27017/PDFchatbot",
        port: 3000,
        pythonPort: 5001,
        corsOrigin: 'http://localhost:3000'
    },
    production: {
        mongoUri: process.env.MONGODB_URI,
        port: process.env.PORT || 3000,
        pythonPort: process.env.PYTHON_PORT || 5001,
        corsOrigin: process.env.CORS_ORIGIN || 'https://your-app-name.onrender.com'
    }
};

// Determine environment
const env = process.env.NODE_ENV || 'development';

module.exports = config[env];