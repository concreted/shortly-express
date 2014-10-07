var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');


// =========================== Github authentication ===============================
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: '5e96d0407ffe910f6999',
    clientSecret: 'e23206f4a583c38ed481cb72a1f2f4c2a6565b6c',
    //callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // process.nextTick required here for synchronous call - otherwise redirect happens
    // before calling done(), which causes login to fail
    process.nextTick(function () {
      new User({
        'githubId': profile.id
      }).save();
      return done(null, profile);
    });
  }
));

// ==============================================================================

// ============================= Middleware setup ===============================
var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({secret: 'nyancat', cookie: { path: '/', httpOnly: true, secure: false, maxAge: 36000000 }}));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname + '/public'));

// ==============================================================================

// ============================= Routes ========================================
app.get('/', util.checkSession,
function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/login/github', passport.authenticate('github'));

app.get('/create', util.checkSession,
function(req, res) {
  res.render('index');
});

app.get('/links', util.checkSession,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', util.checkSession,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login', function(request, response) {
  var username = request.body.username;
  var password = request.body.password;
  //check the username
  util.checkUsernameAndPassword(username, password, function(){
    request.session.regenerate(function(){
      request.session.user = username;
      request.session.save();
      response.redirect('/');
    });
  }, function(){
    response.redirect('/login');
  });

});

app.get('/logout', function(request, response){
  request.session.destroy(function(){
    response.redirect('/');
  });
});

app.get('/signup', function(request, response){
  response.render('signup')
});

app.post('/signup', function(request, response) {
  var username = request.body.username;
  var password = bcrypt.hashSync(request.body.password);

  //checks the user if it exists already
  util.checkUsername(username, function() {
    new User({
      'username': username,
      'password': password
    }).save();
    request.session.regenerate(function(){
      request.session.user = username;
      response.redirect('/');
    });
  }, function() {
    response.redirect('/signup');
  });
});


app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
