const express = require("express");
const multer = require("multer");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require('express-session');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const userModel = require("./dbmodels/user");
const { marked } = require('marked');
const xss = require("xss");
const { userInfo } = require("os");
const secret = "Yash Pawar";

// Configure marked options
marked.setOptions({
  headerIds: false,
  mangle: false
});

// Database migration utility
async function migrateSessions() {
  try {
    console.log('[Migration] Starting session migration...');
    const users = await userModel.find({});
    console.log(`[Migration] Found ${users.length} users`);
    
    for (const user of users) {
      let needsUpdate = false;
      
      // Ensure session is an array
      if (!Array.isArray(user.session)) {
        user.session = [];
        needsUpdate = true;
      }
      
      // Filter out any invalid sessions and add sessionId where missing
      user.session = user.session.filter(session => {
        return session && session.pdfData && session.pdfData.meta_info;
      }).map(session => {
        if (!session.sessionId) {
          needsUpdate = true;
          const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
          return {
            ...session.toObject(),
            sessionId,
            lastInteraction: session.lastInteraction || new Date()
          };
        }
        return session;
      });
      
      if (needsUpdate) {
        console.log(`[Migration] Updating user ${user.email} with ${user.session.length} sessions`);
        await userModel.updateOne(
          { _id: user._id }, 
          { 
            $set: { 
              session: user.session 
            } 
          }
        );
      }
    }
    console.log('[Migration] Session migration completed successfully');
  } catch (err) {
    console.error('[Migration] Error migrating sessions:', err);
  }
}

const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true if using https
}));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views")); // Optional if you want custom views folder

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.redirect("/chat");
});

app.get("/chat", async (req, res) => {
  if (req.cookies.token == null) {
    console.log("no user");
    res.render("index", { 
      user: null, 
      sessionId: null,
      targetSession: null 
    });
  } else {
    console.log("token exists");
    try {
      let { email } = jwt.verify(req.cookies.token, secret);
      console.log("[Debug] User email:", email);
      
      let user = await userModel.findOne({ email }).lean();
      console.log("[Debug] MongoDB user data:", JSON.stringify(user, null, 2));
      
      if (!user) {
        console.log("[Debug] No user found with email:", email);
        return res.redirect("/login/0");
      }

      if (!user.session) {
        user.session = [];
      }
      
      // Filter out any invalid sessions
      user.session = user.session.filter(session => 
        session && session.pdfData && session.pdfData.meta_info
      );

      // Sort sessions by lastInteraction before sending to template
      user.session.sort((a, b) => {
        const timeA = a.lastInteraction ? new Date(a.lastInteraction) : new Date(0);
        const timeB = b.lastInteraction ? new Date(b.lastInteraction) : new Date(0);
        return timeB - timeA;
      });
      
      const userData = {
        fullName: user.fullName,
        email: user.email,
        session: user.session,
      };
      
      console.log("[Debug] Final userData:", JSON.stringify(userData, null, 2));
      
      res.render("index", { 
        user: userData, 
        sessionId: null,
        targetSession: null
      });
    } catch (e) {
      console.error("[Debug] Error in /chat route:", e);
      res.clearCookie("token");
      res.redirect("/login/0");
    }
  }
});

app.get("/chat/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId;
  
  if (req.cookies.token) {
    try {
      let { email } = jwt.verify(req.cookies.token, secret);
      console.log("[Debug] User email:", email);
      
      let user = await userModel.findOne({ email }).lean();
      console.log("[Debug] MongoDB user data:", JSON.stringify(user, null, 2));
      
      if (!user) {
        console.log("[Debug] No user found with email:", email);
        return res.redirect("/login/0");
      }

      if (!user.session) {
        user.session = [];
      }
      
      // Filter out any invalid sessions
      user.session = user.session.filter(session => 
        session && session.pdfData && session.pdfData.meta_info
      );

      // Sort sessions by lastInteraction before sending to template
      user.session.sort((a, b) => {
        const timeA = a.lastInteraction ? new Date(a.lastInteraction) : new Date(0);
        const timeB = b.lastInteraction ? new Date(b.lastInteraction) : new Date(0);
        return timeB - timeA;
      });
      
      const userData = {
        fullName: user.fullName,
        email: user.email,
        session: user.session,
      };
      
      // Find the target session by sessionId
      const targetSession = user.session.find(s => s.sessionId === sessionId);
      
      if (!targetSession) {
        return res.status(404).send("Session not found");
      }
      
      // Get past interactions
      let pastInteractions = targetSession.interaction || [];
      
      // Format responses with markdown
      pastInteractions = pastInteractions.map(interaction => ({
        question: interaction.question,
        response: marked(interaction.response)
      }));
      
      res.render("index", { 
        user: userData, 
        sessionId: sessionId,
        targetSession: targetSession,
        pastInteractions: pastInteractions 
      });
    } catch (e) {
      console.error("[Debug] Error in /chat/:sessionId route:", e);
      res.clearCookie("token");
      res.redirect("/login/0");
    }
  } else {
    // Handle non-logged in user with temporary session
    if (req.session[sessionId]) {
      const tempSession = req.session[sessionId];
      res.render("index", { 
        user: null, 
        sessionId: sessionId,
        targetSession: tempSession,
        pastInteractions: tempSession.interaction.map(interaction => ({
          question: interaction.question,
          response: marked(interaction.response)
        }))
      });
    } else {
      res.redirect("/");
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

app.post("/ask/:sessionId", async (req, res) => {
  const { question, chatHistory, tokenLimits } = req.body;
  const sessionId = req.params.sessionId;
  
  console.log("[Backend] /ask/:sessionId route called");
  console.log("[Backend] SessionId:", sessionId);
  console.log("[Backend] Question:", question);
  console.log("[Backend] TokenLimits:", tokenLimits);

  try {
    let tempSession;
    let pdfData;
    let email;

    if (req.cookies.token) {
      // Handle logged-in user
      const decoded = jwt.verify(req.cookies.token, secret);
      email = decoded.email;
      let user = await userModel.findOne({ email });
      
      const targetSession = user.session.find(s => s.sessionId === sessionId);
      if (!targetSession) {
        return res.status(404).json({ answer: "Session not found." });
      }
      pdfData = targetSession.pdfData;
    } else {
      // Handle non-logged in user
      tempSession = req.session[sessionId];
      if (!tempSession) {
        return res.status(404).json({ answer: "Session not found." });
      }
      pdfData = tempSession.pdfData;
    }
    
    // Format chat history for the prompt
    const formattedHistory = chatHistory
      .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const pythonRes = await axios.post("http://localhost:5001/ask-target", {
      question,
      pdfData,
      chatHistory: formattedHistory,
      tokenLimits
    });
    
    if (pythonRes.data && pythonRes.data.answer) {
      const timestamp = new Date();
      const newInteraction = {
        question,
        response: pythonRes.data.answer,
        timestamp: timestamp
      };

      if (req.cookies.token) {
        // Update database for logged-in user
        await userModel.updateOne(
          { 
            email, 
            "session.sessionId": sessionId 
          },
          { 
            $push: { "session.$.interaction": newInteraction },
            $set: { "session.$.lastInteraction": timestamp }
          }
        );
      } else {
        // Update session for non-logged in user
        if (!tempSession.interaction) {
          tempSession.interaction = [];
        }
        tempSession.interaction.push(newInteraction);
      }

      return res.json({ answer: pythonRes.data.answer });
    } else {
      return res.status(500).json({ 
        answer: "Sorry, no answer returned from Python server." 
      });
    }
  } catch (error) {
    console.error("[Backend] Error in /ask/:sessionId route:", error);
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

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err.message);
      } else {
        console.log("Uploaded PDF deleted successfully!");
      }
    });

    const pdfData = pythonResponse.data.pdf_data;
    if (!pdfData) {
      return res.status(500).json({ error: "No PDF data returned from Python server." });
    }

    // Generate a unique sessionId for both logged in and non-logged in users
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    if (req.cookies.token) {
      let { email } = jwt.verify(req.cookies.token, secret);
      const loggedInUserEmail = email;

      const updatedUser = await userModel.findOneAndUpdate(
        { email: loggedInUserEmail },
        {
          $push: {
            session: {
              sessionId,
              pdfData: {
                text: pdfData.text,
                meta_info: {
                  Title: pdfData.meta_info.Title,
                  Author: pdfData.meta_info.Author,
                  Pages: pdfData.meta_info.Pages,
                },
              },
              interaction: [],
              lastInteraction: new Date()
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
        sessionId: sessionId,
        availabelSpace: 512000 - JSON.stringify(pdfData).length
      });
    } else {
      // For non-logged in users, store PDF data in session
      if (!req.session) {
        req.session = {};
      }
      req.session[sessionId] = {
        pdfData: {
          text: pdfData.text,
          meta_info: {
            Title: pdfData.meta_info.Title,
            Author: pdfData.meta_info.Author,
            Pages: pdfData.meta_info.Pages,
          }
        },
        interaction: []
      };

      console.log("PDF processed for non-logged in user!");
      res.json({
        message: "PDF processed successfully!",
        sessionId: sessionId,
        title: pdfData.meta_info.Title,
        pages: pdfData.meta_info.Pages
      });
    }
  } catch (err) {
    console.error("Error uploading or processing PDF:", err.message);
    res.status(500).json({ error: err.message || "Error processing PDF" });
  }
});

app.post("/rename/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId;
  const { newTitle } = req.body;

  try {
    let { email } = jwt.verify(req.cookies.token, secret);
    console.log("[Backend] Renaming session:", sessionId);
    
    await userModel.updateOne(
      { 
        email, 
        "session.sessionId": sessionId 
      },
      { 
        $set: { "session.$.pdfData.meta_info.Title": newTitle }
      }
    );

    res.status(200).send("Renamed successfully");
  } catch (e) {
    console.error("[Backend] Error in rename:", e);
    res.status(500).send({ status: "error occurred: \n" + e });
  }
});

// Run migration when server starts
migrateSessions().then(() => {
  console.log('Session migration completed');
  app.listen(3000, () => {
    console.log("Express server listening on http://localhost:3000");
  });
});
