
/**
 * Module dependencies.
 */

// Express-related modules
var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/npm', routes.npmredirect);
app.get('/npm/:name', routes.npmview);
app.get('/github', routes.githubredirect);
app.get('/github/:user/:repo', routes.githubview);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
