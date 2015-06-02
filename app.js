// Requirements
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var serialport = require('serialport');
var util = require('util');

// Start Serial: One line commented for system not in use
var SerialPort = serialport.SerialPort;
// var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});
var serial0 = new SerialPort("COM10", {baudrate: 115200});

var indexPath = path.join(__dirname, 'index.html');

// Create buffers to send to Arduino
var fx = 0.0;
var fy = 120000.0;
buffx = new Buffer(4);
buffx.writeFloatLE(fx);
buffy = new Buffer(4);
buffy.writeFloatLE(fy);
// array of buffers to concatenate
var buff_xy = [buffx,buffy]
// Concats buffx and buffy into new Buffer bufForce
bufForce = Buffer.concat(buff_xy);
// var for data received
var state;


// The following code works for receiving the position and velocity data
serial0.on('open', function () {
	
	console.log(serial0); // Print serial0 object

	app.get('/', function(req, res){
	  res.sendFile(indexPath);
	});

	io.on('connection', function(socket){
		
		console.log('a user connected');

		// Writes to Arduino Notifying it to send a message back
		serial0.write(bufForce, function(err, data) {
			console.log('resultsOut ' + data);
			if (err) {
				console.error(err);
			}
		});

		// Once data is received, slice the data into float position and velocity
		serial0.on('data', function(data) { 
			state = 	[
							data.slice(0,4).readFloatLE(),
							data.slice(4,8).readFloatLE(),
							data.slice(8,12).readFloatLE(),
							data.slice(12,16).readFloatLE()
						];
			console.log(state);
			socket.emit('chat message', JSON.stringify(state));
			serial0.write(bufForce, function(err, data) {
				console.log('resultsOut ' + data);
				if (err) {
					console.error(err);
				}
			});
		});

	  	socket.on('disconnect', function(){
	    	console.log('user disconnected');
	  	});

	});

	http.listen(1000, function(){
	  console.log('listening on *:1000');
	});

});



// The following code works for receiving the position and velocity data
// serial0.on('open', function () {
	
// 	console.log(serial0); // Print serial0 object

// 	// Start http server (must happen within open Serial port)
// 	var server = http.createServer(function (req, res) {
		
// 		console.log(this); // Print server object
// 		res.writeHead(200, {'Content-Type': 'text/html'});
		
// 		// Writes to Arduino Notifying it to send a message back
// 		serial0.write(bufForce, function(err, data) {
// 			console.log('resultsOut ' + data);
// 			if (err) {
// 				console.error(err);
// 			}
// 		});

// 		// Writes index.html to client (browser);
// 		res.end(file);
		
// 		// Once data is received, slice the data into float position and velocity
// 		serial0.on('data', function(data) { 
// 			state = 	[
// 							data.slice(0,4).readFloatLE(),
// 							data.slice(4,8).readFloatLE(),
// 							data.slice(8,12).readFloatLE(),
// 							data.slice(12,16).readFloatLE()
// 						];
// 			console.log(state);
			
// 			// Writes data to client and keeps connection open
// 			// res.write(JSON.stringify(state) + '\n');

// 			// Write Force after data is received
// 			// serial0.write(bufForce, function(err, data) {
// 			// 	if (err) {
// 			// 		console.error(err);
// 			// 	}
// 			// });

// 		});

// 	}).listen(1000); // Listening to port 1000 on local host

// });