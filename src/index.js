var mosca = require('mosca');
var settings = {
    port: 1883
    // backend:{
    // //    type: 'zmq',
    //     json: true,
    //     // zmq: require("zmq"),  
    //     port: "ws://127.0.0.1:9000",
    //     controlPort: "ws://127.0.0.1:9010",
    //     delay: 5
    // },
    // persistence:{
    //   factory: mosca.persistence.Mongo,
    //   url: "mongodb://localhost:27017/mosca"
    // }
  };

// var settings = {
//   port: 1883,
//   url: 'mqtt://localhost:8090/'
// };

var server = new mosca.Server(settings);

server.on('clientConnected', function(client) {
    console.log('client connected', client.id);
});

// fired when a message is received
server.on('published', function(packet, client) {
  console.log('Published', packet.payload);
});

server.on('ready', setup);

// fired when the mqtt server is ready
function setup() {
  console.log('Mosca server is up and running');
}
