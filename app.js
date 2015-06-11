 /* START REQUIREMENTS */

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var serialport = require('serialport');
var util = require('util');
var cp = require('chipmunk');

/* END REQUIREMENTS */


// Give access to the entire directory (for client-side JS libraries)
app.use(express.static(__dirname));


// Initialize Serial Port Connection
var SerialPort = serialport.SerialPort;
var serial0 = new SerialPort("COM10", {baudrate: 115200});

// TODO:
// // Start Serial:
// var SerialPort = serialport.SerialPort;
// var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});

// TODO:
// // Create a buffer for forces to be written and the stepper to be driven
// buffStep = new Buffer(1);
// buffx = new Buffer(4);
// buffy = new Buffer(4);
// buffOut = new Buffer(8);

// // Create buffers to send to Arduino
// // step: 0x00 for no step, 0x0F for open, 0x0B for close
// function force (step, fx, fy) {
// 	buffStep.writeUInt8(step);
// 	buffx.writeFloatLE(fx);
// 	buffy.writeFloatLE(fy);
// 	// Concats buffx and buffy into new Buffer bufForce
// 	buffStep.copy(buffOut, 0);
// 	buffx.copy(buffOut, 1);
// 	buffy.copy(buffOut, 5);
// }


/* START BUFFERS */

// Create a buffer for forces to be written
buffx = new Buffer(4);
buffy = new Buffer(4);
buffOut = new Buffer(8);

// Create buffers to send to Arduino
function force (fx, fy) {
	buffx.writeFloatLE(fx);
	buffy.writeFloatLE(fy);
	// Concats buffx and buffy into new Buffer bufForce
	buffx.copy(buffOut, 0);
	buffy.copy(buffOut, 4);
}

// var for data received
stateBuffer = new Buffer(16);
var start = 0;
var state = [0,0,0,0];

/* END BUFFERS*/


/* START TIME VARIABLES */

var renStep = 1/60;
var simStep = 1/5;

/* END TIME VARIABLEs */


// TODO:
// // Screen Resolution
// var width = 2048;
// var height = 1536;
// var PPI = 11.06;


/* START CP VARIABLES*/

// Screen Resolution
var width = 1024;
var height = 768;
var PPI = 3.21;

// Nodes for screen corners -> topLeft, bottomLeft, bottomRight, topRight
var bounds = [cp.v(0,0),cp.v(0,height),cp.v(width,height),cp.v(width,0)];

// Current Simulation
var simulation = null;

/* END CP VARIABLES */

/* START SIMULATION FUNCTIONS */

function map(x, inMin, inMax, outMin, outMax) {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}


function init_simulation_1 () {
	// Quick test: one static ball, one moving ball 

	var space = new cp.Space();
	space.iterations = 10;
	space.gravity = cp.v(0,0);
	space.sleepTimeThreshold = 0.5;
	space.collisionSlop = 0.5;
	space.collisionBias = 1;
	space.sleepTimeThreshold = 0.5;

	//add floor and ceiling
	var floor = space.addShape(new cp.SegmentShape(space.staticBody, bounds[1], bounds[2], 0));
	floor.setElasticity(0.5);
	floor.setFriction(0);

	var ceiling = space.addShape(new cp.SegmentShape(space.staticBody, bounds[0], bounds[3], 0));
	floor.setElasticity(0.5);
	floor.setFriction(0);
	  
	//add walls
	var wallLeft = space.addShape(new cp.SegmentShape(space.staticBody,bounds[0], bounds[1], 0));
	wallLeft.setElasticity(1);
	wallLeft.setFriction(1);

	var wallRight = space.addShape(new cp.SegmentShape(space.staticBody, bounds[3], bounds[2], 0));
	wallRight.setElasticity(1);
	wallRight.setFriction(1);

	// add user
	var mass = 100;
	var radius = 60;
	var moment = cp.momentForCircle(mass, 0, radius, cp.v(0, 0));
	var body = space.addBody(new cp.Body(mass, moment));
	// Rotated by 90 for now!!!!
	body.p.x = map(state[1], 87, 200, 0, 1024);
	body.p.y = map(state[0], -95, 95, 0, 768);
	var circle = space.addShape(new cp.CircleShape(body, radius, cp.v(0,0)));
	circle.setElasticity(1);
	circle.setFriction(0);

	return {'space': space, 'circles': circle, 'bodies': body};
}

/* END SIMULATION FUNCTIONS */


/* START MAIN */

// Once the serial port is 'open', begin the simulation
serial0.on('open', function () {
	
	// Print serial0 object
	console.log(serial0); 

	// Send Client-Side File
	app.get('/', function(req, res){
	  res.sendFile('index.html');
	});

	// Wait for socket.io connection to initialize VE
	io.on('connection', function(socket){
		
		console.log('a user connected');


		/* START [NODE <-> ARDUNIO] COMMUNICATION LOOP */
		
		// Initialize force-buffer to zero
		force(0,0);

		// Write buffOut to begin loop
		serial0.write(buffOut, function(err, data) {
			console.log('resultsOut ' + data);
			if (err) {
				console.error(err);
			}
		});

		// On data receipt, slice data into (float) position and velocity
		serial0.on('data', function(data) {

			// copy 'data' into stateBuffer until full 
			data.copy(stateBuffer, start);
			start += data.length;

			// if stateBuffer is full:
			if (start === 16) {
				state = 	[
								stateBuffer.slice(0,4).readFloatLE(),
								stateBuffer.slice(4,8).readFloatLE(),
								stateBuffer.slice(8,12).readFloatLE(),
								stateBuffer.slice(12,16).readFloatLE()
							];

				// once state[] is populated, reset state to zero
				start = 0;

				// Write to Arduino to continue loop
				serial0.write(buffOut, function(err, data) {
					if (err) {
						console.error(err);
					}
				});				
			
			}
		});

		/* END [NODE <-> ARDUINO] COMMUNICATION LOOP */


		/* START CP LOOP */

		// Initilize simulation_1
		simulation = init_simulation_1();

		// Loop through simulation at 1/simStep Hz
		setInterval(function () {
			
			// Step by timestep simStep
			simulation.space.step(simStep);

			// Update state
			simulation.bodies.p.x = map(state[1], 87, 200, 0, 1024);
			simulation.bodies.p.y = map(state[0], -95, 95, 0, 768);
			simulation.circles.tc.x = map(state[1], 87, 200, 0, 1024);
			simulation.circles.tc.y = map(state[0], -95, 95, 0, 768);
			simulation.bodies.vx = state[3]*PPI;
			simulation.bodies.vy = state[2]*PPI;

			console.log(simulation.circles.tc.y);
			// console.log(simulation.circles.body.space.arbiters);			

			if (simulation.circles.body.space.arbiters.length) {
				console.log(simulation.space.arbiters);
			}
		
		}, simStep);


		/* END CP LOOP */


		/* START NODE -> CLIENT DATA TRANSFER */

		// Send client position data at
		setInterval( function () {
			socket.emit('state', simulation.circles.tc);
		}, renStep);

		/* END NODE -> CLIENT DATA TRANSFER */


	  	socket.on('disconnect', function(){
	    	console.log('user disconnected');
	  	});

	});

	// TODO: 
	// address subject to change
	// http.listen(3000, '142.157.114.67', function(){
	//   console.log('listening on 142.157.114.67:3000');
	// });
	http.listen(1000, '142.157.36.66', function(){
	  console.log('listening on 142.157.36.66:1000');
	});

});

/* END MAIN */