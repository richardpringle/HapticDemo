var exec = require('child_process').exec, child;

child = exec('cat /sys/class/gpio/gpio40/direction', function (error, stdout, stderr) {
	console.log('stdout: ' + stdout);
	console.log('stderr' + stderr);
	if (error) {
		console.log('exec error: ' + error)
	}
})