const express = require("express");
const multer = require("multer");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views")); // Optional if you want custom views folder

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.render("index"); // It looks for views/index.ejs
});

app.post("/upload", upload.single("pdf"), async (req, res) => {
  const filePath = req.file.path;

  try {
    const pythonResponse = await axios.post("http://localhost:5001/process", {
      pdf_path: filePath,
    });
    res.json({ message: "PDF processed!", chat_history: "", answer: null });
  } catch (err) {
    res.status(500).json({ error: "Error processing PDF" });
  }
});

app.post("/ask", async (req, res) => {
  const question = req.body.question;

  try {
    const pythonRes = await axios.post("http://localhost:5001/ask", {
      question,
    });

    if (pythonRes.data && pythonRes.data.answer) {
      return res.json({ answer: pythonRes.data.answer });
    } else {
      console.error("Python server returned no answer:", pythonRes.data);
      return res
        .status(500)
        .json({ answer: "Sorry, no answer returned from Python server." });
    }
  } catch (error) {
    console.error("Error in /ask route:");
    console.error(error); // Log full error
    if (error.response) {
      console.error("Python server responded with:", error.response.data);
    } else if (error.request) {
      console.error("No response received from Python server:", error.request);
    } else {
      console.error("Error message:", error.message);
    }

    return res.status(500).json({ answer: "Sorry, there was an error." });
  }
});

app.listen(3000, () => {
  console.log("Express server listening on http://localhost:3000");
});
