
var mqtt = require('mqtt');
var client = mqtt.connect("mqtt://10.112.163.194/", {
    port: 1883
})

var payload = {
    "method": "REG",
    "username": "cat",
    "password": "E10",
    "version": "1.0"
}
var str = JSON.stringify(payload);


client.on("connect", function () {
    console.log("connected");
    client.subscribe("/listener/catE", 0, subsCallBack)
})


// client.subscribe("/listener/catE", 0, subsCallBack)

function publish(topic, msg, options,callb) {
    console.log("publishing ", msg);
    if (client.connected == true) {
        console.log('connected status!');
        client.publish(topic, msg, options,callb);
    }
}

function subsCallBack(e){
    console.log('subscribe callbacks! ',e);
    // setInterval(function(){publish("/manage",payload,0);},5000);
    publish("/manage",str,{qos:0},callb);
}

function callb(e){
    console.log('publish calls back!',e);
}