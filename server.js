const express = require("express");
const multer = require("multer");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const userModel = require("./dbmodels/user");
const { userInfo } = require("os");
const secret = "Yash Pawar";

const app = express();
app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());
app.set("views", path.join(__dirname, "views")); // Optional if you want custom views folder

const upload = multer({ dest: "uploads/" });

app.get("/", async (req, res) => {
  if (req.cookies.token == null) {
    console.log("no user");
    res.render("index", { user: null, target: -1 });
  } else {
    console.log("token exists");
    try {
      let { email } = jwt.verify(req.cookies.token, secret);
      console.log(email);
      let user = await userModel.findOne({ email });
      userData = {
        fullName: user.fullName,
        email: user.email,
        session: user.session,
      };
      console.log(userData);
      res.render("index", { user: userData, target: -1 });
    } catch (e) {
      res.status(500).send({ status: "error occured: \n" + e });
    }
  }
});
app.get("/:target", async (req, res) => {
  if (req.cookies.token == null) {
    console.log("no user");
    res.redirect("/");
  } else {
    console.log("token exists");
    try {
      let { email } = jwt.verify(req.cookies.token, secret);
      console.log(email);
      let user = await userModel.findOne({ email });
      userData = {
        fullName: user.fullName,
        email: user.email,
        session: user.session,
      };
      console.log(userData);
      res.render("index", { user: userData, target: req.params.target });
    } catch (e) {
      res.status(500).send({ status: "error occured: \n" + e });
    }
  }
});

// loginStatus
// 0 : good
// 1 : userAlreadyExits (signup failed)
// 2 : login failed (email or password incorrect)

app.get("/login", (req, res) => {
  res.redirect("/login/0");
});

app.get("/login/:loginStatus", (req, res) => {
  loginStatus = req.params.loginStatus;
  res.render("login", { loginStatus });
});

app.post("/create-user", async (req, res) => {
  let { fullName, email, password } = req.body;

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      res.redirect("/login/1");
    }

    bcrypt.genSalt(10, function (err, salt) {
      bcrypt.hash(password, salt, async function (err, hash) {
        if (err) {
          console.log(err);
        } else {
          await userModel.create({
            fullName,
            email,
            password: hash,
          });
        }
      });
    });

    let token = jwt.sign({ email }, secret, { expiresIn: "30d" });

    res.cookie("token", token, {
      httpOnly: true, // Prevents JavaScript access (XSS safe)
      sameSite: "Strict", // Prevents CSRF (can use 'Lax' or 'None' if needed)
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    });

    res.redirect("/");
  } catch (e) {
    console.log(e);
    res.status(500).send({ status: "error occured: \n" + e });
  }
});

app.post("/verify-login", async (req, res) => {
  let { email, password } = req.body;

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      bcrypt.compare(password, existingUser.password, (err, result) => {
        if (err) console.log(err);
        else if (result) {
          let token = jwt.sign({ email }, secret, { expiresIn: "30d" });
          res.cookie("token", token, {
            httpOnly: true, // Prevents JavaScript access (XSS safe)
            sameSite: "Strict", // Prevents CSRF (can use 'Lax' or 'None' if needed)
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
          });
          res.redirect("/");
        } else {
          res.redirect("/login/2");
        }
      });
    } else {
      res.redirect("/login/2");
    }
  } catch (e) {
    console.error("Error saving test data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "Strict",
  });
  res.redirect("/");
});

app.post("/ask", async (req, res) => {
  const question = req.body.question;
  console.log("in the ask route (no target)");
  console.log("Question:", question);
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

app.post("/ask/:target", async (req, res) => {
  const question = req.body.question;

  try {
    console.log("in the ask/target route")
    let { email } = jwt.verify(req.cookies.token, secret);
    console.log(email);
    let user = await userModel.findOne({ email });
    userData = {
      fullName: user.fullName,
      email: user.email,
      session: user.session,
    };
    const target = parseInt(req.params.target, 10);

    console.log("Target:", target);
    console.log("Question:", question);

    // Check if target is valid
    if (target < 0) {
      return res.status(400).json({ answer: "Invalid session target." });
    }

    // Check if the session array exists and the target index is valid
    if (!user.session || !user.session[target]) {
      console.log(target);
      return res.status(404).json({ answer: "Session not found." });
    }

    const pdfData = user.session[target].pdfData;

    // Check if pdfData exists
    if (!pdfData) {
      return res.status(404).json({ answer: "PDF data not found." });
    }

    console.log(pdfData);

    const pythonRes = await axios.post("http://localhost:5001/ask-target", {
      question,
      pdfData,
    });

    if (pythonRes.data && pythonRes.data.answer) {

      const newInteraction = {
        question,
        response: JSON.stringify(pythonRes.data.answer)
      };
      
      
      const fieldPath = `session.${target}.interaction`;
      
      await userModel.updateOne(
        { email },
        { $push: { [fieldPath]: newInteraction } }
      );

      return res.json({ answer: pythonRes.data.answer });
    } else {
      console.error("Python server returned no answer:", pythonRes.data);
      return res
        .status(500)
        .json({ answer: "Sorry, no answer returned from Python server." });
    }
  } catch (error) {
    console.error("Error in /ask-target route:");
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

app.post("/upload", upload.single("pdf"), async (req, res) => {
  const filePath = req.file.path;

  console.log("[Node] file_path: ", filePath);
  try {
    const pythonResponse = await axios.post("http://localhost:5001/process", {
      pdf_path: filePath,
    });

    // Find user and update

    if (req.cookies.token) {
      let { email } = jwt.verify(req.cookies.token, secret);

      const loggedInUserEmail = email;

      const pdfData = pythonResponse.data.pdf_data;
      if (!pdfData) {
        return res
          .status(500)
          .json({ error: "No PDF data returned from Python server." });
      }

      const updatedUser = await userModel.findOneAndUpdate(
        { email: loggedInUserEmail },
        {
          $push: {
            session: {
              pdfData: {
                text: pdfData.text,
                meta_info: {
                  Title: pdfData.meta_info.Title,
                  Author: pdfData.meta_info.Author,
                  Pages: pdfData.meta_info.Pages,
                },
              },
              ineraction: [],
            },
          },
        },
        { new: true }
      );
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        message: "PDF processed and saved to user!",
        target: updatedUser.session.length - 1,
      });
    } else {
      res.json({
        message: "PDF processed but user's not logged In!"
      });
    }
  } catch (err) {
    console.error("Error uploading or processing PDF:", err.message);
    res.status(500).json({ error: err.message || "Error processing PDF" });
  }
});

app.post('/rename/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { newTitle } = req.body;

  try{
    let { email } = jwt.verify(req.cookies.token, secret);
      console.log(email);
      const fieldPath = `session.${id}.pdfData.meta_info.Title`;

      await userModel.updateOne(
        { email },
        { $set: { [fieldPath]: newTitle } }
      );
  }catch(e){
    res.status(500).send({ status: "error occured: \n" + e });
  }
  
  res.status(200).send('Renamed successfully');
});


app.listen(3000, () => {
  console.log("Express server listening on http://localhost:3000");
});
