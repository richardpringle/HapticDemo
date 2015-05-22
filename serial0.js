var SerialPort = require("serialport").SerialPort;
var serial0 = new SerialPort("/dev/ttymxc3", {baudrate: 115200});

serial0.on("open", function () {
  console.log('open');
  serial0.on('data', function(data) {
    console.log('data received: ' + data);
  });
  serial0.write("\n", function(err, results) {
    console.log('err ' + err);
    console.log('results ' + results);
  });
});