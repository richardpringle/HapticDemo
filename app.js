var http = require('http');
var SerialPort = require("serialport").SerialPort;
var serial0 = new SerialPort("COM10", {baudrate: 115200});

serial0.on("open", function () {
	console.log('open');
	http.createServer(function (req, res) {
		res.writeHead(200, {'Content-Type': 'text/plain'});
		if (req.method === 'GET') {
			serial0.write("\n", function(err, data) {
				console.log('results ' + data);
			});
			serial0.on('data', function(data) {
				console.log('data received: ' + data);
				res.end(data);
			});
		}
	}).listen(1000);
});

