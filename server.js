// Requirements
var express = require('express');
var app =express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');

app.use(express.static(__dirname));
// var indexPath = path.join(__dirname, 'index.html');


app.get('/', function(req, res){
	// res.sendFile(indexPath);
	res.sendFile('index.html')
});

io.on('connection', function(socket){
	
	console.log('a user connected');

  	socket.on('disconnect', function(){
    	console.log('user disconnected');
  	});

});

http.listen(1000, '142.157.36.23', function(){
  console.log('server running at 142.157.36.26')
  console.log('listening on *:1000');
});