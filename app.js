// Requires
var http = require('http');
// var SerialPort = require("serialport").SerialPort;

// // Objects
// var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});

// Create Server
var server = http.createServer(function (request, response) {
	response.writeHead(200, {'Content-Type': 'text/plain'});
	response.end('Hello World!');
}).listen(1337, '127.0.0.1'); // The IP address is subject to change depending on the network
console.log('Server is running at http://142.157.114.70');

// serial0.on("open", function () {
//   console.log('open');
//   serial0.on('data', function(data) {
//     console.log('data received: ' + data);
//   });
//   serial0.write("\n", function(err, results) {
//     console.log('err ' + err);
//     console.log('results ' + results);
//   });
// });