const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/PDFchatbot");

const sessionSchema = mongoose.Schema({
  sessionId: {
    type: String,
    required: true
  },
  pdfData: {
    text: {
      type: String,
      required: true,
    },
    meta_info: {
      Title: {
        type: String,
        required: true,
      },
      Author: {
        type: String,
        required: true,
      },
      Pages: {
        type: Number,
        required: true,
      }
    }
  },
  interaction: [{
    question: {
      type: String,
      required: true,
    },
    response: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastInteraction: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const userSchema = mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  session: [sessionSchema],
}, { timestamps: true });

// Only index sessionId, email is already indexed due to unique constraint
userSchema.index({ "session.sessionId": 1 });

const User = mongoose.model("user", userSchema);

// Run this once to ensure indexes are created
User.createIndexes().then(() => {
  console.log("Database indexes ensured");
}).catch(err => {
  console.error("Error creating indexes:", err);
});

module.exports = User;
