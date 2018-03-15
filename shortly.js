var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var morgan = require('morgan');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

// set morgan to log info about our requests for development use.
app.use(morgan('dev'));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


// initialize cookie-parser to allow us access the cookies stored in the browser. 
app.use(cookieParser());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session({
  key: 'user_sid',
  secret: 'somerandomstuff',
  resave: false,
  saveUninitialized: true,
  //setting this true won't work
  cookie: {secure: false}
}));

app.get('/',  util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/create', util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/links', util.checkUser,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', util.checkUser,
function(req, res) {
  var uri = req.body.url;
  console.log('this is uri: ', uri);
  
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          console.log('this is the newLink: ', newLink)
          res.status(200).send(newLink);
        });
      });
    }
  });
});


/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login', 
function(req, res) {
  res.render('login');
});

// handle a login page submit
app.post('/login', 
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  // check the user ( req , callback ) => true or false
  //util.checkUser(req );
    
  // if valid user
  //   create a session
  //   direct user to ... ??? link ??? page  
      //res.render('index');
      
  // if not valid user
  //   redirect to signup page
  //res.redirect('signup');
  
  
  new User({ username: username }).fetch().then(function(found) {
    if (!found) {
      //console.log('Username already exists. Redirecting to login page..')
      res.redirect('/login');
      
    } else {
      // // get salt and hashed password (salt + original password)
      // // create user object with user, salt and hashed pw
      // var hashedPassword = 'getHashedPassword_TODO';
      // var salt = 'getSalt_TODO'
      var pw = found.get('password');
      
      bcrypt.compare(password, pw, function(err, match) {
        if (err) {
          console.log('Error reading user password: ', err);
          res.redirect(404,'/login');
          //return res.sendStatus(404);
        }else{
          req.session.regenerate(function(){
            req.session.user = found;
            res.redirect('/create');
          })
        }

        // var newUser = new User({
        //   username: username,
        //   password: hashedPassword,
        //   salt: salt
        // })
        // newUser.save().then(function(newUser) {
        //   // console.log('this is the newLink: ', newLink)
        //   // TODO - after user signup, 
        //   //   create a session for the user
        //   //     add a token (cookie) to their session
        //   //   direct user to index page ???
        //   req.session.regenerate(function(){
        //     req.session.user = newUser;
        //     res.redirect('/');
        //   })
          
          
        //   //res.status(200).send('newUser created ......' + JSON.stringify(newUser));
        // });
      });
    }
  });
  
  
  
});


app.get('/logout', 
function(req, res) {
  // todo implement delete link ???
  req.session.destroy(function(){
    res.redirect('/login');
  })
//  res.render('login');
});


// get sign up page form
app.get('/signup', 
function(req, res) {
  res.render('signup');
});

// post sign up submit 

app.post('/signup', 
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  
  console.log('POST: this is username: ', username);
  console.log('POST: this is password: ', password);
  

  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      console.log('Username already exists. Redirecting to login page..')
      res.redirect('signup');
      
    } else {
      // // get salt and hashed password (salt + original password)
      // // create user object with user, salt and hashed pw
      // var hashedPassword = 'getHashedPassword_TODO';
      // var salt = 'getSalt_TODO'
      
      
      util.getNewUserHashedPasswordAndSalt(username, password, function(err, hashedPassword, salt) {
        if (err) {
          console.log('Error reading user password: ', err);
          return res.sendStatus(404);
        }

        var newUser = new User({
          username: username,
          password: hashedPassword,
          salt: salt
        })
        newUser.save().then(function(newUser) {
          // console.log('this is the newLink: ', newLink)
          // TODO - after user signup, 
          //   create a session for the user
          //     add a token (cookie) to their session
          //   direct user to index page ???
          req.session.regenerate(function(){
            req.session.user = newUser;
            res.redirect('/');
          })
          
          
          //res.status(200).send('newUser created ......' + JSON.stringify(newUser));
        });
      });
    }
  });
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
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
