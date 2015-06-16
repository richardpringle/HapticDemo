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
// var SerialPort = serialport.SerialPort;
// var serial0 = new SerialPort("COM10", {baudrate: 115200});

// TODO:
// Initialize Serial Port Connection
var SerialPort = serialport.SerialPort;
var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});
var data_received = false;

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

var renStep = 1/30;
var simStep = 1/250;

/* END TIME VARIABLEs */


// TODO:
// Screen Resolution
// var width = 2048;
// var height = 1536;
// var PPI = 11.06;


/* START CP VARIABLES*/

// Screen Resolution
var width = 1024;
var height = 695;
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
	space.iterations = 15;
	space.gravity = cp.v(0,0);
	space.damping = 1;
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
	wallLeft.setElasticity(0.5);
	wallLeft.setFriction(0);

	var wallRight = space.addShape(new cp.SegmentShape(space.staticBody, bounds[3], bounds[2], 0));
	wallRight.setElasticity(0.5);
	wallRight.setFriction(0);

	// add user body
	var user_body = space.addBody(new cp.Body(Infinity, Infinity));
	// Rotated by 90 for now!!!!
	user_body.setPos(cp.v(200,200));

	// add tool body
	var tool_mass = 100;
	var tool_radius = 60;
	var tool_moment = cp.momentForCircle(tool_mass, 0, tool_radius, cp.v(0, 0));
	var tool_body = space.addBody(new cp.Body(tool_mass, tool_moment));
	// Rotated by 90 for now!!!!
	tool_body.setPos(cp.v(200,200));

	// add tool shape
	var tool_shape = space.addShape(new cp.CircleShape(tool_body, tool_radius, cp.v(0,0)));
	tool_shape.setElasticity(1);
	tool_shape.setFriction(0);

	// add coupling for user and virtual tool
	// var couple = new cp.DampedSpring(user_body, tool_body, cp.v(0,0), cp.v(0,0), 0, 10000, 0);
	// var spring0 = new cp.DampedSpring(user_body, tool_body, cp.v(0, 0), cp.v(0,60), 0, 1000, 1000);
	// var spring1 = new cp.DampedSpring(user_body, tool_body, cp.v(0, 0), cp.v(Math.sqrt(10800),-30), 0, 1000, 1000);
	// var spring2 = new cp.DampedSpring(user_body, tool_body, cp.v(0, 0), cp.v(Math.sqrt(10800),-30), 0, 1000, 1000);
	var pivot = new cp.PivotJoint(user_body, tool_body, cp.v(0, 0), cp.v(0, 0));
	// space.addConstraint(spring0);
	// space.addConstraint(spring1);
	// space.addConstraint(spring2);
	// space.addConstraint(couple);
	space.addConstraint(pivot);

	return	{
				'space': space,
				'shapes': [ ,tool_shape], 
				'bodies': [user_body, tool_body], 
				'constraints': [pivot]
			};
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

		socket.on('map', function (countClicks) {

			switch (countClicks) {

				case 0:
					serial0.write(buffOut, function(err, data) {
						console.log('resultsOut ' + data);
						if (err) {
							console.error(err);
						}
						data_received = false;
					});
					if (!data_received) {
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
								data_received = true
								console.log(state);
							}
						});
					}
					break;
				case 1:
					serial0.write(buffOut, function(err, data) {
						console.log('resultsOut ' + data);
						if (err) {
							console.error(err);
						}
						data_received = false;
					});
					if (!data_received) {
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
								data_received = true
								console.log(state);
							}
						});
					}
					break;
				case 2:
					serial0.write(buffOut, function(err, data) {
						console.log('resultsOut ' + data);
						if (err) {
							console.error(err);
						}
						data_received = false;
					});
					if (!data_received) {
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
								data_received = true
								console.log(state);
							}
						});
					}
					break;
				case 3:
					serial0.write(buffOut, function(err, data) {
						console.log('resultsOut ' + data);
						if (err) {
							console.error(err);
						}
						data_received = false;
					});
					if (!data_received) {
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
								data_received = true
								console.log(state);
							}
						});
					}
					break;
			}

		});

		socket.on('ready', function() {

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
						console.log('resultsOut ' + data);
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

			var count = 0;

			// Loop through simulation at 1/simStep Hz
			setInterval(function () {		

				// Update state
				// simulation.bodies.p.x = map(state[1], 87, 200, 0, 1024);
				// simulation.bodies.p.y = map(state[0], -95, 95, 0, 768);
				// simulation.circles.tc.x = map(state[1], 87, 200, 0, 1024);
				// simulation.circles.tc.y = map(state[0], -95, 95, 0, 768);
				// simulation.bodies.vx = state[3]*PPI;
				// simulation.bodies.vy = state[2]*PPI;

				var x = map(state[1], 87, 200, 0, 1024);
				var y = map(state[0], -95, 95, 0, 768);
				// var vx = state[3]*PPI;
				// var vy = state[2]*PPI;

				simulation.bodies[0].setPos(cp.v(x,y));	

				// console.log(simulation.bodies[1].getPos());

				// if ((simulation.space.arbiters.length) && (count < 1)) {
				// 	console.log(simulation.space.constraints[0].f);
				// 	count++;
				// }

				// Step by timestep simStep
				simulation.space.step(simStep);
			
			}, simStep*1000);
			// }, 100);

			/* END CP LOOP */


			/* START NODE -> CLIENT DATA TRANSFER */

			// Send client position data at
			setInterval( function () {
				socket.emit('state', simulation.shapes[1].tc);
			}, renStep*1000);

			/* END NODE -> CLIENT DATA TRANSFER */

		});


	  	socket.on('disconnect', function(){
	    	console.log('user disconnected');
	  	});

	});

	// TODO: 
	// address subject to change
	http.listen(3000, '142.157.114.94', function(){
	  console.log('listening on 142.157.114.94:3000');
	});
	// http.listen(3000, '142.157.36.19', function(){
	//   console.log('listening on 142.157.36.19:3000');
	// });

});

/* END MAIN */