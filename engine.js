/*
	Contains the server backend and the Chipmunk simulation engine. 
*/

// Initialize server/socket 
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static(__dirname));

app.get('/', function (request, response) {
    response.sendFile(__dirname + '/demo.html');
});

// Initialize physics engine 
var cp = require('chipmunk');


// Some constants
var width = 1024;
var height = 768;

var bounds = [cp.v(0,0),cp.v(0,height),cp.v(width,height),cp.v(width,0)];

var GRABABLE_MASK_BIT = 1<<31;
var NOT_GRABABLE_MASK = ~GRABABLE_MASK_BIT;

// The current simulation 
var simulation = null;

function init_test_simulation () {
	// Quick test: one static ball, one moving ball 

	var space = new cp.Space();
	space.iterations = 10;
	space.gravity = cp.v(0, 100);
	space.sleepTimeThreshold = 0.5;
	space.collisionSlop = 0.5;
	space.collisionBias = 1;
	space.sleepTimeThreshold = 0.5;

	//add floor
	var floor = space.addShape(new cp.SegmentShape(space.staticBody, bounds[1], bounds[2], 0));
	floor.setElasticity(1);
	floor.setFriction(0);
	floor.setLayers(NOT_GRABABLE_MASK);
	  
	//add walls
	var wallLeft = space.addShape(new cp.SegmentShape(space.staticBody,bounds[0], bounds[1], 0));
	wallLeft.setElasticity(1);
	wallLeft.setFriction(1);
	wallLeft.setLayers(NOT_GRABABLE_MASK);

	var wallRight = space.addShape(new cp.SegmentShape(space.staticBody, bounds[3], bounds[2], 0));
	wallRight.setElasticity(1);
	wallRight.setFriction(1);
	wallRight.setLayers(NOT_GRABABLE_MASK);

	var mass = 100;
	var radius = 60;
	var moment = cp.momentForCircle(mass, 0, radius, cp.v(0, 0));
	var body = space.addBody(new cp.Body(mass, moment));
	body.p.x = 500;
	body.p.y = 200;
	var circle = space.addShape(new cp.CircleShape(body, radius, cp.v(0,0)));
	circle.setElasticity(1);
	circle.setFriction(0);

	console.log(circle);


	return {'space': space, 'circles': circle};
}

function start_test_simulation () {
	simulation = init_test_simulation();
	setInterval(function () {
		// Step through simulation 
		simulation.space.step(1/60);

		console.log(simulation.circles.tc.y);

		// Send positional data to front end at 30 hz
		var data = [simulation.circles.tc.x, simulation.circles.tc.y];
		io.emit('draw', data);
		
		if (simulation.circles.body.space.arbiters.length) {
			console.log(simulation.circles);
		}

	}, 16);
}


// Listen for connection events 
io.on('connection', function (socket) {
	console.log('a user connected');

	socket.on('ready', function () {
		console.log("frontend is ready");
		// Start the simulation 
		// start_ball_simulation();

		start_test_simulation();

	});

});

// Listen to port 3000
http.listen(3000, function () {
    console.log("listening on *:3000");
});
