const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/PDFchatbot");

const sessionSchema = mongoose.Schema({
  pdfData: 
    {
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
    interaction: [
    {
      question: {
        type: String,
        required: true,
      },
      response: {
        type: String,
        required: true,
      },
    },
  ],
});

const schema = mongoose.Schema({
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
  session: [
    {
      type: sessionSchema,
    },
  ],
});

module.exports = mongoose.model("user", schema);
