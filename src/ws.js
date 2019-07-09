const WebSocket = require('ws'); //引入模块
const http = require('http');
const server = http.createServer();

const wss = new WebSocket.Server({
    port: 8000,
    server
}, callback); //创建一个WebSocketServer的实例，监听端口8080

wss.on('connection', function connection(ws, req) {
    // const ip = req.connection.remoteAddress;
    console.log('ip is ', req);
    ws.on('message', function incoming(message) {
        wss.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send('data is send to every cients');
            }
        });
        console.log('received: %s', message);

        ws.send('Hi Client, your meassage is recieved');
        // wss.clients.forEach(function each(client) {
        //     client.send(data);
        // });
    }); //当收到消息时，在控制台打印出来，并回复一条信息

});

function callback() {
    console.log('this is callback! Server is on');
}