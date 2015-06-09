// Requirements
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var serialport = require('serialport');
var util = require('util');

// Start Serial: One line commented for system not in use
var SerialPort = serialport.SerialPort;
// var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});
var serial0 = new SerialPort("COM10", {baudrate: 115200});

// Gives access to the entire directory (for client-side libraries)
app.use(express.static(__dirname));

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
stateBuffer = new Buffer(16);
var start = 0;
var state;
var time;
var i = 0;


// The following code works for receiving the position and velocity data on COM10
// Haven't tested for /dev/ttymxc3 (might need to change the bash settings)
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
		// if (data.length < 16) append new data to 16 byte buffer
		// read data into state with 16ByteBuffer.slice
			data.copy(stateBuffer, start);
			start += data.length;
			if (start === 16) {
				state = 	[
								stateBuffer.slice(0,4).readFloatLE(),
								stateBuffer.slice(4,8).readFloatLE(),
								stateBuffer.slice(8,12).readFloatLE(),
								stateBuffer.slice(12,16).readFloatLE()
							];

				// console.log(Date.now());
				console.log(state[1]);
				start = 0;
				// Writes to Arduino Notifying it to send a message back
				serial0.write(bufForce, function(err, data) {
					if (err) {
						console.error(err);
					}
				});				
			
			}
		});

		setInterval( function () {
			socket.emit('state', state);
		}, 17);

	  	socket.on('disconnect', function(){
	    	console.log('user disconnected');
	  	});

	});

	// Lines below commented for use on PC
	// http.listen(3000, '142.157.114.67', function(){
	//   console.log('listening on 142.157.114.67:3000');
	// });
	http.listen(1000, '142.157.36.66', function(){
	  console.log('listening on 142.157.36.66:1000');
	});

});