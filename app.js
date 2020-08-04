//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const passport = require("passport");
const session = require("express-session");
const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require('mongoose-findorcreate');


const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect( process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  facebookId: String
});



userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({
  userid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  title: String,
  content: String
});

passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

const Post = new mongoose.model("Post", postSchema);

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://agile-peak-72266.herokuapp.com/auth/google/userfeed"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://agile-peak-72266.herokuapp.com/auth/facebook/userfeed"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      facebookId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res) => {
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate("google", {
    scope: ["profile"]
  }));

app.get('/auth/google/userfeed',
  passport.authenticate('google', {
    failureRedirect: '/signin'
  }),
  function(req, res) {
    res.redirect('/userfeed');
  });

app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/userfeed',
  passport.authenticate('facebook', {
    failureRedirect: '/signin'
  }),
  function(req, res) {
    res.redirect('/userfeed');
  });

app.get("/signin", (req, res) => {
  res.render("signin");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/compose", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("compose");
  } else {
    res.redirect("/signin");
  }
});

app.get("/userfeed", (req, res) => {
  if (req.isAuthenticated()) {
    Post.find({
      userid: req.user.id
    }, function(err, postsFound) {
      if (err) {
        console.log(err);
      } else {
        res.render("userfeed", {
          posts: postsFound
        });
      }
    });
  } else {
    res.redirect("/signin");
  }
});

app.post("/signup", (req, res) => {
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/signup");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/userfeed");
      });
    }
  });
});

app.post('/signin', (req, res) => {

  const user = User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
      res.redirect("/signin");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/userfeed");
      });
    }
  });
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.post("/compose", (req, res) => {
  let post = new Post({
    userid: req.user._id,
    title: req.body.title,
    content: req.body.postBody
  });

  post.save(function(err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/userfeed");
    }
  });
});

app.get("/posts/:postTitle", (req, res) => {
  if (req.isAuthenticated()) {
    let paramTitle = _.lowerCase(req.params.postTitle);
    Post.find({
      userid: req.user.id
    }, function(err, postsFound) {
      if (err) {
        console.log(err);
      } else {
        postsFound.forEach(post =>
          _.lowerCase(post.title) === paramTitle ?
          res.render("post", {
            postTitle: post.title,
            postBody: post.content
          }) :
          console.log("Match not found"));
      }
    });
  } else {
    res.redirect("/signin");
  }
});

app.listen(process.env.PORT || 3000, function() {
  console.log("Server started on port 3000");
});
