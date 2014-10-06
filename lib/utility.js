var request = require('request');
var Users = require('../app/collections/users');

exports.getUrlTitle = function(url, cb) {
  request(url, function(err, res, html) {
    if (err) {
      console.log('Error reading url heading: ', err);
      return cb(err);
    } else {
      var tag = /<title>(.*)<\/title>/;
      var match = html.match(tag);
      var title = match ? match[1] : url;
      return cb(err, title);
    }
  });
};

var rValidUrl = /^(?!mailto:)(?:(?:https?|ftp):\/\/)?(?:\S+(?::\S*)?@)?(?:(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[0-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))|localhost)(?::\d{2,5})?(?:\/[^\s]*)?$/i;

exports.isValidUrl = function(url) {
  return url.match(rValidUrl);
};

/************************************************************/
// Add additional utility functions below
/************************************************************/

exports.checkSession = function(req, res, success){
  if (req.session.user) {
    success();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};

exports.checkUsername = function(username, notFound, found){
  Users.query({where: { 'username': username }}).fetchOne().then(function(user){
    if (!user) {
      notFound();
    } else {
      found(user);
    }
  });
}

exports.checkUsernameAndPassword = function(username, password, success, failure){
  exports.checkUsername(username, function(){
    failure();
  }, function(user) {
    if (user.get('password') === password) {
      success();
    }else{
      failure();
    }
  })
}
