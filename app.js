//jshint esversion:6
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const flash = require("connect-flash");
const User = require("./models/User");

const homeStartingContent =
  "This is the home page.  To add more blog add '/compose' in the address bar or click on the compose tab . For example - 'www.abc.blog/compose' and you will be able to add new blogs.";
const aboutContent =
  "This app is made using Node.js as the backend and Database used is MongoDB . This app was made with the help of Courses of Web Development from Udemy. ";
const contactContent =
  "This page is still being made , will be updated soon. :)";

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

mongoose
  .connect(`${process.env.MONGO_DB_URI}`, { useNewUrlParser: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const postSchema = {
  title: String,
  content: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
};

const Post = mongoose.model("Post", postSchema);

// Contact Message Schema
const contactSchema = {
  name: String,
  email: String,
  subject: String,
  message: String,
  date: {
    type: Date,
    default: Date.now,
  },
};

const Contact = mongoose.model("Contact", contactSchema);

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
};

app.get("/", async function (req, res) {
  try {
    const posts = await Post.find({}).populate("author", "username");
    res.render("home", {
      posts: posts,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

app.get("/compose", isAuthenticated, function (req, res) {
  res.render("compose");
});

app.post("/compose", isAuthenticated, async function (req, res) {
  try {
    const post = new Post({
      title: req.body.postTitle,
      content: req.body.postBody,
      author: req.user._id,
    });
    await post.save();
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

app.get("/posts/:postId", async function (req, res) {
  try {
    const post = await Post.findOne({ _id: req.params.postId }).populate(
      "author",
      "username"
    );
    res.render("post", {
      title: post.title,
      content: post.content,
      id: post._id,
      author: post.author,
      currentUser: req.user,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// Edit post route
app.get("/edit/:postId", isAuthenticated, async function (req, res) {
  try {
    const post = await Post.findOne({ _id: req.params.postId }).populate(
      "author",
      "username"
    );
    if (post.author && post.author._id.toString() !== req.user._id.toString()) {
      req.flash("error", "You can only edit your own posts");
      return res.redirect("/posts/" + req.params.postId);
    }
    res.render("edit", {
      title: post.title,
      content: post.content,
      id: post._id,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// Update post route
app.post("/edit/:postId", isAuthenticated, async function (req, res) {
  try {
    const post = await Post.findOne({ _id: req.params.postId }).populate(
      "author",
      "username"
    );
    if (post.author && post.author._id.toString() !== req.user._id.toString()) {
      req.flash("error", "You can only edit your own posts");
      return res.redirect("/posts/" + req.params.postId);
    }

    await Post.findByIdAndUpdate(req.params.postId, {
      title: req.body.postTitle,
      content: req.body.postBody,
    });
    res.redirect("/posts/" + req.params.postId);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// Delete post route
app.post("/delete/:postId", isAuthenticated, async function (req, res) {
  try {
    const post = await Post.findOne({ _id: req.params.postId }).populate(
      "author",
      "username"
    );
    if (post.author && post.author._id.toString() !== req.user._id.toString()) {
      req.flash("error", "You can only delete your own posts");
      return res.redirect("/posts/" + req.params.postId);
    }

    await Post.findByIdAndDelete(req.params.postId);
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

app.get("/about", function (req, res) {
  res.render("about", { aboutContent: aboutContent });
});

app.get("/contact", function (req, res) {
  res.render("contact", { contactContent: contactContent });
});

// Handle contact form submission
app.post("/contact", function (req, res) {
  const contact = new Contact({
    name: req.body.name,
    email: req.body.email,
    subject: req.body.subject,
    message: req.body.message,
  });

  contact.save(function (err) {
    if (err) {
      console.log(err);
      req.flash(
        "error",
        "There was an error sending your message. Please try again."
      );
      res.redirect("/contact");
    } else {
      req.flash(
        "success",
        "Your message has been sent successfully! We'll get back to you soon."
      );
      res.redirect("/contact");
    }
  });
});

// Authentication routes
app.get("/login", (req, res) => {
  res.render("login", { error: req.flash("error") });
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("error", info.message || "Invalid username or password");
      return res.redirect("/login");
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect("/");
    });
  })(req, res, next);
});

app.get("/register", (req, res) => {
  res.render("register", { error: req.flash("error") });
});

app.post("/register", (req, res) => {
  if (req.body.password !== req.body.confirmPassword) {
    req.flash("error", "Passwords do not match");
    return res.redirect("/register");
  }

  User.register(
    { username: req.body.username, email: req.body.email },
    req.body.password,
    (err, user) => {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("/register");
      }
      passport.authenticate("local")(req, res, () => {
        req.flash("success", "Registration successful! Welcome to the blog.");
        res.redirect("/");
      });
    }
  );
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// My Posts route
app.get("/myposts", isAuthenticated, async function (req, res) {
  try {
    const posts = await Post.find({ author: req.user._id }).populate("author", "username");
    res.render("myposts", {
      posts: posts,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

app.listen(process.env.PORT || 3000, function () {
  console.log("Server started on port 3000");
});
