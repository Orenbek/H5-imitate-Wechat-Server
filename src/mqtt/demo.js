require('@/services/paho-mqtt.js');
// Create a client instance
var client = new Paho.MQTT.Client("mqtt://10.112.163.194/", {port: 1883}, "clientId");

// set callback handlers
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// connect the client
client.connect({onSuccess:onConnect});

var payload = {
    "method": "REG",
    "username": "cat",
    "password": "E10",
    "version": "1.0"
}
var str = JSON.stringify(payload);


// called when the client connects
function onConnect() {
  // Once a connection has been made, make a subscription and send a message.
  console.log("onConnect...");
  client.subscribe("/listener/catE", 0, subsCallBack);
  message = new Paho.MQTT.Message(str);
  message.destinationName = "/manage";
  client.send(message,onMessageArrived);
}

// called when the client loses its connection
function onConnectionLost(responseObject) {
  if (responseObject.errorCode !== 0) {
    console.log("onConnectionLost:"+responseObject.errorMessage);
  }
}

// called when a message arrives
function onMessageArrived(message) {
  console.log("onMessageArrived:"+message.payloadString);
}
