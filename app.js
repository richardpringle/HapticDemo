// // Requires
// var http = require('http');
// var SerialPort = require("serialport").SerialPort;

// // Objects
// // var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});
// var serial0 = new SerialPort("COM10", {baudrate: 115200});

// // Create Server
// var server = http.createServer(function (request, response) {
// 	response.writeHead(200, {'Content-Type': 'text/plain'});
// 	response.end('Hello World!');
// // }).listen(1337, '142.157.114.70'); 
// }).listen(1337, '127.0.0.1'); 
// console.log('Server is running at http://142.157.114.70');

// // When the serial port is opened 
// serial0.on("open", function () {
// 	console.log('open');
// 	serial0.write("\n", function (err, results) {
// 		console.log('err ' + err);
// 	    console.log('results ' + results);
// 	});
// 	serial0.on('data', function (data) {
// 	    console.log('data received: ' + data);
// 	    console.log("data: " + data);
// 	});
// });

var SerialPort = require("serialport").SerialPort;

// Objects
// var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});
var serial0 = new SerialPort("COM10", {baudrate: 115200});

var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');

app.listen(1337);

function handler (request, response) {
  fs.readFile('./index.html',  function (err, data) {
    if (err) {
      response.writeHead(500);
      return response.end('Error loading index.html');
    }
    response.writeHead(200);
    response.end(data);
  });
}

io.on('connection', function (socket) {
	// When the serial port is opened 
	serial0.on("open", function () {
	console.log('open');
	serial0.write("\n", function (err, results) {
		console.log('err ' + err);
	    console.log('results ' + results);
	});
	serial0.on('data', function (data) {
	    console.log('data received: ' + data);
	    console.log("data: " + data);
	    socket.emit('news', data)
	});
});

});



