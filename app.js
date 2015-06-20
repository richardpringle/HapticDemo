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
// Initialize Serial Port Connection
// var SerialPort = serialport.SerialPort;
// var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});
var ready = false;
var reset = false;

/* START BUFFERS */

// Create a buffer for forces to be written
buffx = new Buffer(4);
buffy = new Buffer(4);
buffOut = new Buffer(9);
// Dumby buffer
zeroBuffer = new Buffer(9).fill(0);
var outFull = false;
var inFull = false;


// Create buffers to send to Arduino
function force (step, fx, fy) {
	if (inFull) {
		fx = Math.floor(fx);
		fy = Math.floor(fy);
		outFull = false;
		buffOut.writeUInt8(step);
		if (fy) {
			buffOut.writeFloatLE(fy, 1);
		} else {
			buffOut.writeFloatLE(0, 1);
		}
		if (fx) {
			buffOut.writeFloatLE(fx, 5);	
		} else {
			buffOut.writeFloatLE(0,5);
		}
		outFull = true;
	} else {
		outFull = false;
		zeroBuffer.copy(buffOut);
		outFull = true;
	}
}

// var for data received
stateBuffer = new Buffer(16);
var start = 0;
var state = [0,0,0,0];

/* END BUFFERS*/


/* START TIME VARIABLES */

var renStep = 1/30;
var simStep = 1/250;
var renStepCounter = 0;

/* END TIME VARIABLEs */


/* START CP VARIABLES*/

// Screen Resolution
var width = 1024;
var height = 695;
var PPI = 3.21;

var topRight = [];
var topLeft = [];
var bottomRight = [];
var bottomLeft = [];
var center = [];
var x_min, x, y;

// Nodes for screen corners -> topLeft, bottomLeft, bottomRight, topRight
var bounds = [cp.v(0,0),cp.v(0,height),cp.v(width,height),cp.v(width,0)];
var GRABABLE_MASK_BIT = 1<<31;
var NOT_GRABABLE_MASK = ~GRABABLE_MASK_BIT;

// Current Simulation
var simulation = null;
var info;
var normal, normal2;
var r;
var f;
var a, b;
var k = 10000;	 // spring stiffness

/* END CP VARIABLES */

/* START SIMULATION FUNCTIONS */

function mm2px(x, inMin, inMax, outMin, outMax) {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}


function init_simulation_1 () {
	// Quick test: one static ball, one moving ball 

	var space = new cp.Space();
	space.iterations = 10;
	space.gravity = cp.v(0,0);
	space.damping = 0.9;
	space.sleepTimeThreshold = 0.5;
	space.collisionSlop = 0.5;
	space.collisionBias = 1;
	space.sleepTimeThreshold = 0.5;

	//add floor and ceiling
	var floor = space.addShape(new cp.SegmentShape(space.staticBody, bounds[1], bounds[2], 0));
	floor.setElasticity(0.5);
	floor.setFriction(0);
	floor.setLayers(NOT_GRABABLE_MASK);

	var ceiling = space.addShape(new cp.SegmentShape(space.staticBody, bounds[0], bounds[3], 0));
	floor.setElasticity(0.5);
	floor.setFriction(0);
	floor.setLayers(NOT_GRABABLE_MASK);
	  
	//add walls
	var wallLeft = space.addShape(new cp.SegmentShape(space.staticBody,bounds[0], bounds[1], 0));
	wallLeft.setElasticity(0.5);
	wallLeft.setFriction(0);
	floor.setLayers(NOT_GRABABLE_MASK);

	var wallRight = space.addShape(new cp.SegmentShape(space.staticBody, bounds[3], bounds[2], 0));
	wallRight.setElasticity(0.5);
	wallRight.setFriction(0);
	floor.setLayers(NOT_GRABABLE_MASK);

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
	tool_shape.setElasticity(0);
	tool_shape.setFriction(1);
	tool_shape.setLayers(NOT_GRABABLE_MASK);

	// add ball body
	var ball_mass = 40;
	var ball_radius = 40;
	var ball_moment = cp.momentForCircle(ball_mass, 0, ball_radius, cp.v(0,0));
	var ball_body = space.addBody(new cp.Body(ball_mass, ball_moment));
	ball_body.setPos(cp.v(500, 500));
	var ball_shape = space.addShape(new cp.CircleShape(ball_body, ball_radius, cp.v(0,0)));
	ball_shape.setElasticity(0.5);
	ball_shape.setFriction(1);

	// add pivot joint for sprint

	// add coupling for user and virtual tool
	// var couple = new cp.DampedSpring(user_body, tool_body, cp.v(0,0), cp.v(0,0), 0, 10000, 0);
	// var spring0 = new cp.DampedSpring(user_body, tool_body, cp.v(0, 0), cp.v(0,60), 0, 1000, 1000);
	// var spring1 = new cp.DampedSpring(user_body, tool_body, cp.v(0, 0), cp.v(Math.sqrt(10800),-30), 0, 1000, 1000);
	// var spring2 = new cp.DampedSpring(user_body, tool_body, cp.v(0, 0), cp.v(Math.sqrt(10800),-30), 0, 1000, 1000);
	var pivot = new cp.PivotJoint(user_body, tool_body, cp.v(0, 0), cp.v(1, 1));
	// space.addConstraint(spring0);
	// space.addConstraint(spring1);
	// space.addConstraint(spring2);
	// space.addConstraint(couple);
	space.addConstraint(pivot);

	return	{
				'space': space,
				'shapes': [, tool_shape, ball_shape], 
				'bodies': [user_body, tool_body, ball_body], 
				'constraints': [pivot]
			};
}

/* END SIMULATION FUNCTIONS */


/* START MAIN */

// Once the serial port is 'open', begin the simulation
serial0.on('open', function () {

	// Initialize force-buffer to zero
	force(0x00,0,0);
	
	// Print serial0 object
	console.log(serial0); 

	// Send Client-Side File
	app.get('/', function(req, res){
	  res.sendFile('index.html');
	});

	// Wait for socket.io connection to initialize VE
	io.on('connection', function(socket){
		
		console.log('a user connected');

		socket.on('ready', function () {
			ready = true;
			console.log('Start the simulation!')
		});

		socket.on('map', function (countClicks) {

			switch (countClicks) {

				case 0:
					center = [state[1], state[0]];
					console.log(center);
					break;
				case 1:
					bottomLeft = [state[1], state[0]];
					console.log(bottomLeft);
					break;
				case 2:
					bottomRight = [state[1], state[0]];
					console.log(bottomRight);
					break;
				case 3:
					topRight = [state[1], state[0]];
					x_min = 2*center[0] - bottomRight[0];
					console.log(topRight);
					break;
				case 4:
					topLeft = [state[1], state[0]];
					console.log(topLeft);
					break;
			}

		});


		/* START [NODE <-> ARDUNIO] COMMUNICATION LOOP */

		// Write buffOut to begin loop
		if (!reset) {
			serial0.write(zeroBuffer, function(err, data) {
				console.log('resultsOut4 ' + data);
				if (err) {
					console.error(err);
				}
			});
		}

		// On data receipt, slice data into (float) position and velocity
		serial0.on('data', function(data) {

			inFull = false;

			// copy 'data' into stateBuffer until full 
			data.copy(stateBuffer, start);
			start += data.length;


			// if stateBuffer is full:
			if (start === 16) {
				inFull = true;
				state = 	[
								stateBuffer.slice(0,4).readFloatLE(),
								stateBuffer.slice(4,8).readFloatLE(),
								stateBuffer.slice(8,12).readFloatLE(),
								stateBuffer.slice(12,16).readFloatLE()
							];

				// console.log([state[2], state[3], state[0], state[1]]);
				// console.log(state);

				// once state[] is populated, reset state to zero
				start = 0;


				if (topLeft.length) {
					x = mm2px(state[1], x_min, bottomRight[0], 0, 1024);
					y = mm2px(state[0], topRight[1], bottomRight[1], 0, 695);
				}

				// console.log(buffOut);
				if (inFull && outFull) {
					serial0.write(buffOut, function(err, data) {
						// console.log(buffOut.readFloatLE(1), buffOut.readFloatLE(5));
						// console.log("resultsOut0: ", data);
						if (err) {
							console.error(err);
						}
					});
				}			
			}
		});

		/* END [NODE <-> ARDUINO] COMMUNICATION LOOP */


		/* START CP LOOP */

		// To calculate whether the ball is loaded in slingshot 
		var size = 1.0;
		var mid = height / 2;
        a = mid + ((size / 2.0) * mid);
        b = mid - ((size / 2.0) * mid);

        var loaded = false; 
        var pivot = null;
        var rotSpring = null;

		// Initialize simulation_1
		simulation = init_simulation_1();

		var count = 0;
		
		// Loop through simulation at 1/simStep Hz
		setInterval(function () {	

			if (ready) {

				// If it hasn't already been loaded 
				if (!loaded) {
					// Check to see if in slingshot bounds
					loaded = simulation.bodies[2].p.x > 694 && simulation.bodies[2].p.y > b && simulation.bodies[2].p.y < a;
					if (pivot !== null && simulation.bodies[2].p.x < 655 && !loaded) {
						console.log('removing constraint');
						simulation.space.removeConstraint(pivot);
						pivot = null;
					}
				} else {
					loaded = simulation.bodies[2].p.x > 694;
				}
				simulation.bodies[0].setPos(cp.v(x,y));	

				// if (simulation.space.arbiters.length) {
				// 	console.log(simulation.space.arbiters[0].totalImpulse().x);
				// 	force(0x00, 0, simulation.space.arbiters[0].totalImpulse().x);
				// } else {
				// 	force(0x00, 0, 0);
				// }

				info = simulation.space.nearestPointQueryNearest(cp.v(x, y), 200, GRABABLE_MASK_BIT, cp.NO_GROUP);			
				
				// Step by timestep simStep
				simulation.space.step(simStep);

				// Distance between user and ball 
				if (info) {
					if (loaded) {
						if (!pivot) {
							// Add a pin constraint between the user and ball 
							pivot = new cp.PivotJoint(simulation.bodies[1], simulation.bodies[2], cp.v(0, 0), cp.v(95, 0));
							pivot.errorBias = 0.0000001;
							simulation.space.addConstraint(pivot);
							simulation.constraints.push(pivot);
						}

						normal = cp.v.normalize(cp.v.sub(simulation.bodies[2].p, cp.v(694, height / 2)));
						normal2 = cp.v.normalize(cp.v.sub(cp.v(x, y), simulation.bodies[2].p));	
						r = info.d;
						f = cp.v.add(cp.v.mult(normal, -k * r), cp.v.mult(normal2, -k * r));
						simulation.bodies[2].activate();
						simulation.bodies[2].f = f; 

						if (x >= 1024) {
							simulation.space.removeConstraint(pivot);
							pivot = null;
						}

					} else if (info.d >= 70) {
						// Add a magnetic force to pick up the ball
						normal = cp.v.normalize(cp.v.sub(cp.v(x, y), simulation.bodies[2].p));	
						r = info.d;
						f = cp.v.mult(normal, 100000000/(r*r));
						simulation.bodies[2].activate();
						simulation.bodies[2].f = f;
						// force(0x00, -3*f.x, -3*f.y);
						force(0x00, 0, 0);

						//console.log('magnetic:', normal, f);
					} else {
						simulation.bodies[2].f = cp.v(0,0);
						force(0x00, 0, 0);
						//console.log('freedom!');
					}
				}

				simulation.space.step(simStep);

			} else {
				force(0x00, 0, 0);
			}
		
		}, simStep*1000);

		/* END CP LOOP */


		/* START NODE -> CLIENT DATA TRANSFER */

		// Send client position data at
		setInterval( function () {
			socket.emit('state',[
									[x,simulation.bodies[2].p.x],
									[y,simulation.bodies[2].p.y]
								]);
		}, renStep*1000);

		/* END NODE -> CLIENT DATA TRANSFER */


	  	socket.on('disconnect', function(){
	    	console.log('user disconnected');
	    	ready = false;
	    	reset = true;
	    	force(0x00,0,0);
	  	});

	});

	// TODO: 
	// address subject to change
	// http.listen(3000, '142.157.114.94', function(){
	//   console.log('listening on 142.157.114.94:3000');
	// });
	http.listen(8080, '142.157.36.31', function(){
	  console.log('listening on 142.157.36.31:8080');
	});

});

/* END MAIN */