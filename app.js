var http = require('http');
var serialport = require('serialport');
var util = require('util');

var SerialPort = serialport.SerialPort;
var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});

var fx = 0.0;
var fy = 999999999999.0;
buffx = new Buffer(4);
buffx.writeFloatLE(fx);
buffy = new Buffer(4);
buffy.writeFloatLE(fy);

var buff_xy = [buffx,buffy]

bufForce = Buffer.concat(buff_xy);

var allData;

// The following code works for receiving the position and velocity data
serial0.on('open', function () {
	console.log('open');
		serial0.write(bufForce, function(err, data) {
			console.log('resultsOut ' + data);
			if (err) {
				console.error(err);
			}
		});
	serial0.on('data', function(data) { 
		allData = 	[
						data.slice(0,4).readFloatLE(),
						data.slice(4,8).readFloatLE(),
						data.slice(8,12).readFloatLE(),
						data.slice(12,16).readFloatLE()
					]
		console.log(allData);
		serial0.write(bufForce, function(err, data) {
			if (err) {
				console.error(err);
			}
		});
	});
});