var http = require('http');
var serialport = require('serialport');
var util = require('util');

var SerialPort = serialport.SerialPort;
var serial0 = new SerialPort("COM10", {baudrate: 115200, parser: serialport.parsers.raw});


// // The code below works. Once the serial port is opened, the server is created.
// // Inside you can receive and send serial commands, passing them to the client.
// serial0.on("open", function () {
// 	console.log('open');
// 	http.createServer(function (req, res) {
// 		res.writeHead(200, {'Content-Type': 'text/plain'});
// 		if (req.method === 'GET') {
// 			serial0.write(0x, function(err, data) {
// 				console.log('results ' + data);
// 			});
// 			serial0.on('data', function(data) {
// 				console.log('data received: ' + data);
// 				res.end(data);
// 			});
// 		}
// 	}).listen(1000);
// });

var i = 0x01;

serial0.on('open', function () {
	console.log('open');
	serial0.write(0x01, function(err, data) {
		console.log('results ' + data);
	});
	serial0.on('data', function(data) { 
		console.log(data.readFloatLE());
		// serial0.write(++i, function(err, data) {
		// 	console.log('results2 ' + data);
		// });
	});
});