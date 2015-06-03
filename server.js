// Requirements
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');

var indexPath = path.join(__dirname, 'index.html');

app.get('/', function(req, res){
	res.sendFile(indexPath);
});

io.on('connection', function(socket){
	
	console.log('a user connected');

  	socket.on('disconnect', function(){
    	console.log('user disconnected');
  	});

});

http.listen(1000, function(){
  console.log('listening on *:1000');
});