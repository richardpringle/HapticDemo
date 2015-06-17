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
var ready = false;

/* START BUFFERS */

// Create a buffer for forces to be written
buffx = new Buffer(4);
buffy = new Buffer(4);
buffOut = new Buffer(9);

// Create buffers to send to Arduino
function force (step, fx, fy) {
	buffx.writeFloatLE(fx);
	buffy.writeFloatLE(fy);
	// Concats buffx and buffy into new Buffer bufForce
	buffOut.writeUInt8(step);
	buffx.copy(buffOut, 1);
	buffy.copy(buffOut, 5);
}

// var for data received
stateBuffer = new Buffer(16);
var start = 0;
var state = [0,0,0,0];

/* END BUFFERS*/


/* START TIME VARIABLES */

var renStep = 1/30;
var simStep = 1/100;
var time = Date.now();

/* END TIME VARIABLEs */


/* START CP VARIABLES*/

// Screen Resolution
var width = 1024;
var height = 695;
var PPI = 3.21;

var EE_topRight = [];
var EE_topLeft = [];
var EE_bottomRight = [];
var EE_bottomLeft = [];
var center = [];
var x_min, x, y;

// Nodes for screen corners -> topLeft, bottomLeft, bottomRight, topRight
var bounds = [cp.v(0,0),cp.v(0,height),cp.v(width,height),cp.v(width,0)];

// Current Simulation
var simulation = null;

/* END CP VARIABLES */

/* START SIMULATION FUNCTIONS */

function mm2px(x, inMin, inMax, outMin, outMax) {
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

	// add ball body
	var ball_mass = 40;
	var ball_radius = 40;
	var ball_moment = cp.momentForCircle(ball_mass, 0, ball_radius, cp.v(0,0));
	var ball_body = space.addBody(new cp.Body(ball_mass, ball_moment));
	ball_body.setPos(cp.v(500, 100));
	var ball_shape = space.addShape(new cp.CircleShape(ball_body, ball_radius, cp.v(0,0)));
	ball_shape.setElasticity(0.5);

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
				'shapes': [ ,tool_shape, ball_shape], 
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
					break;
				case 2:
					bottomRight = [state[1], state[0]];
					break;
				case 3:
					topRight = [state[1], state[0]];
					x_min = 2*center[0] - bottomRight[0];
					break;
				case 4:
					topLeft = [state[1], state[0]];
					break;
			}

		});

		// Initilize simulation_1
		simulation = init_simulation_1();


		/* START [NODE <-> ARDUNIO] COMMUNICATION LOOP */

		// Write buffOut to begin loop
		serial0.write(buffOut, function(err, data) {
			console.log('resultsOut4 ' + data);
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

				// console.log(state);

				// Write to Arduino to continue loop
				serial0.write(buffOut, function(err, data) {
					if (err) {
						console.error(err);
					}
				});	





/* This is a test to see if I should run the simulation loop within the arduino loop */

				if (ready) {

					// Update state
					x = mm2px(state[1], x_min, bottomRight[0], 0, 1024);
					y = mm2px(state[0], topRight[1], bottomRight[1], 0, 695);
					// var vx = state[3]*PPI;
					// var vy = state[2]*PPI;

					simulation.bodies[0].setPos(cp.v(x,y));	

					if (x > 600) {
						force(0x00, 0, -50000);
					} else {
						force(0x00, 0, 0);
					}

					// if (simulation.space.arbiters.length && (x < 600)) {
					// 	console.log(simulation.space.arbiters[0].totalImpulse(), cp.v.mult(simulation.space.arbiters[0].contacts[0].n, simulation.space.arbiters[0].contacts[0].jnAcc));
					// }
					console.log(simulation.arbiters[0].getImpulse());
					// simStep = Date.now() - time;
					// time = Date.now(); 
					// Step by timestep simStep
					simulation.space.step(3);
				}


			
			}
		
		});

		/* END [NODE <-> ARDUINO] COMMUNICATION LOOP */


		/* START CP LOOP */

		// Loop through simulation at 1/simStep Hz
		// setInterval(function () {	

		// 	if (ready) {

		// 		// Update state
		// 		x = mm2px(state[1], x_min, bottomRight[0], 0, 1024);
		// 		y = mm2px(state[0], topRight[1], bottomRight[1], 0, 695);
		// 		// var vx = state[3]*PPI;
		// 		// var vy = state[2]*PPI;

		// 		simulation.bodies[0].setPos(cp.v(x,y));	

		// 		if (x > 600) {
		// 			force(0x00, 0, -75000);
		// 		} else {
		// 			force(0x00, 0, 0);
		// 		}

		// 		// if (simulation.space.arbiters.length && (x < 600)) {
		// 		// 	console.log(simulation.space.arbiters[0].totalImpulse(), cp.v.mult(simulation.space.arbiters[0].contacts[0].n, simulation.space.arbiters[0].contacts[0].jnAcc));
		// 		// }

		// 		// Step by timestep simStep
		// 		simulation.space.step(simStep);
		// 	}
		
		// }, simStep*1000);

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