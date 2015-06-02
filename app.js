// Requirements
var http = require('http');
var serialport = require('serialport');
var util = require('util');

// Start Serial: One line commented for system not in use
var SerialPort = serialport.SerialPort;
// var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});
var serial0 = new SerialPort("COM10", {baudrate: 115200});

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
var allData;

// The following code works for receiving the position and velocity data
serial0.on('open', function () {
	
	console.log(serial0); // Print serial0 object

	// Start http server (must happen within open Serial port)
	http.createServer(function (req, res) {
		
		console.log(this); // Print server object
		res.writeHead(200, {'Content-Type': 'text/plain', 'connection': 'keep-alive'});
		
		// Writes to Arduino Notifying it to send a message back
		serial0.write(bufForce, function(err, data) {
			console.log('resultsOut ' + data);
			if (err) {
				console.error(err);
			}
		});
		// Once data is received, slice the data into float position and velocity
		serial0.on('data', function(data) { 
			allData = 	[
							data.slice(0,4).readFloatLE(),
							data.slice(4,8).readFloatLE(),
							data.slice(8,12).readFloatLE(),
							data.slice(12,16).readFloatLE()
						];
			console.log(allData);
			// setInterval(function () {
				res.write(allData.toString() + '\n');
			// }, 100);
			serial0.write(bufForce, function(err, data) {
				if (err) {
					console.error(err);
				}
			});
		});

	}).listen(1000);

});