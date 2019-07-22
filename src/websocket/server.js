const WebSocket = require('ws'); //引入模块
const http = require('http');
const uuidv1 = require('uuid/v1');
const os = require('os');

let STREAM_SECRET = process.argv[2],
    WEBSOCKET_PORT = 8000,
	STREAM_PORT = 8001,
	RECORD_STREAM = false;
if (process.argv.length < 1) {
    console.log(
        'Usage: \n' +
        'node server.js <secret>'
    );
    process.exit();
}

const wss = new WebSocket.Server({
    port: WEBSOCKET_PORT,
    clientTracking: true,
    backlog: 50
}, callBack);


// message.state: 'launch','accept','break','reject'
let objectId = [];
// 储存每次接受client消息时的objectid
let RVBuffer = [];
// radio and video messages buffer
let faceTimeOject = new Map();
let clientAddrToObjClient = new Map();

wss.on('connection', (ws)=> {

    ws.on('message',(rawMes)=> {

        if (typeof rawMes === 'object') {
            bufferRVmessageAndSendHash(ws,rawMes);
            return;
            // ws客户端只会给ws服务器发送blob消息和string消息
        }

        console.log('received: %s', rawMes);
        let message = JSON.parse(rawMes);
        objectId = message.objectid;
        if(message.type==='init'){
            markClientWithId(ws,message);
            sendUserlist();
            //第一次连接服务器会标记客户端并且发送当前在线用户列表
        }
        switch (message.state){
            case 'launch': 
                let faceClient =  faceTimeOject.get(objectId[0]);
                if(faceClient === undefined){
                    console.log('can not find object user!')
                    return;
                }
                if(faceClient.state!=='connected'){
                    clientFacestateConnecting(ws);
                } else{
                    message.state = 'reject';
                    ws.send(JSON.stringify(message));
                    //对方正在通话
                }
                break;
            case 'accept':
                clientAndFaceobjConnected(ws);
                break;
            case 'reject':
                FacetimeConnectRejected();
                //发送拒绝接受消息 使对方的状态改为空。注：此时我的的状态不要改
                break;
            case 'break':
                FacetimeConnectBroke(ws);
                //发送断开连接消息(待做)
                break;
        }

        if (message.random) {
            if (RVBuffer[message.random]) {
                //其实上面这句判断可加可不加 只是为了系统更严谨壮硕一些
                sendBlobAndMessageToObjClient(message);
            }
            return;
        }

        //发送文本消息或者其他请求。
        sendStringMessage(message);
    });
    setInterval(()=>{
        sendUserlist();
      },5000);
});

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
http.createServer( (request, response)=> {
	var params = request.url.substr(1).split('/');
	if (params[0] !== STREAM_SECRET) {
		console.log(
			'Failed Stream Connection: '+ request.socket.remoteAddress + ':' +
			request.socket.remotePort + ' - wrong secret.'
		);
		response.end();
	}

	response.connection.setTimeout(0);
	console.log(
		'Stream Connected: ' + 
		request.socket.remoteAddress + ':' +
		request.socket.remotePort
	);
	request.on('data', (data)=>{
        let remoteAddr = request.socket.remoteAddress;
        sendFaceTimeStream(remoteAddr,data);
		// socketServer.broadcast(data);
		if (request.socket.recording) {
			request.socket.recording.write(data);
		}
	});
	request.on('end',()=>{
		console.log('Stream closed');
		if (request.socket.recording) {
			request.socket.recording.close();
		}
	});

	// Record the stream to a local file?
	if (RECORD_STREAM) {
		var path = 'recordings/' + Date.now() + '.ts';
		request.socket.recording = fs.createWriteStream(path);
	}
}).listen(STREAM_PORT);

let localIP = getLocalIP();
console.log(`Listening for incomming MPEG-TS Stream on http://${localIP}:${STREAM_PORT}/<secret>`);

function callBack() {
    console.log(`Awaiting WebSocket connections on ws://${localIP}:${WEBSOCKET_PORT}/`);
}

wss.broadcast = function(data) {
	wss.clients.forEach( (client)=> {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};

function sendFaceTimeStream(remoteAddr,message){
    let faceClient = clientAddrToObjClient.get(remoteAddr);
    if(faceClient){
        faceClient.send(message);
    } else{
        let client;
        wss.clients.forEach( (cli)=> {
            if(cli._socket.remoteAddress===remoteAddr){
                client = cli;
            }
        });
        if(client.faceobj){
            let objid = client.faceobj;
            let faceClient = faceTimeOject.get(objid);
            if (faceClient.readyState === WebSocket.OPEN) {
                faceClient.send(message);
            }
            clientAddrToObjClient.set(remoteAddr,faceClient);
            //只要第一次发送消息的时候遍历一遍找到对象client 之后不会走这个流程。
            // 这个算是历史遗留问题了 之前标注wsclient时候用的是userid 要是用ip可能就简单了
        } else{
            console.log('faceobj is not found');
        }
    }
    
}

function bufferRVmessageAndSendHash(client,message){
    let random = uuidv1();
    RVBuffer[random] = message;
    let res = JSON.stringify({
        type: 'hash',
        random: random
    })
    client.send(res);
}

function sendUserlist(){
    var list = [];
    wss.clients.forEach(client => {
        if(client.userid){
            list.push(client.userid);
        }
        list = Array.from(new Set(list));
        //数组去重
    });
    let mes = {
        userList: list,
        type: 'userList'
    };
    wss.clients.forEach( (client)=> {
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(mes));
		}
	});
}

function markClientWithId(client,message){
    let userid = message.userid;
    client.userid = userid;
}

function clientFacestateConnecting(client){
        client.faceobj = objectId[0];
        client.facestate = 'connecting';
        // faceTimeOject.set(userid, {
        //     client: client,
        //     faceobj: objectId[0],
        //     facestate: 'connecting'
        // });
        faceTimeOject.set(client.userid, client);
        //目前只考虑两人之间视频。
        //发送请求连接消息
}

function clientAndFaceobjConnected(client){
    client.faceobj = objectId[0];
    client.facestate = 'connected';
    faceTimeOject.set(client.userid, client);
    let faceClient = faceTimeOject.get(objectId[0]);
    faceClient.facestate = 'connected';
    faceTimeOject.set(objectId[0], faceClient);
    //更新自己和对方的状态为已连接。
    //发送接受连接消息
}

function FacetimeConnectRejected(){
    let faceClient = faceTimeOject.get(objectId[0]);
    delete faceClient.faceobj;
    delete faceClient.facestate;
    faceTimeOject.delete(objectId[0]);
    //发送拒绝接受消息 使对方的状态改为空。注：此时我的的状态不要改
}

function FacetimeConnectBroke(client){
    delete client.faceobj;
    delete client.facestate;
    let faceClient = faceTimeOject.get(objectId[0]);
    delete faceClient.faceobj;
    delete faceClient.facestate;
    faceTimeOject.delete(client.userid);
    faceTimeOject.delete(objectId[0]);
}

function sendBlobAndMessageToObjClient(message){
    var val = RVBuffer[message.random]
    wss.clients.forEach(client => {
        if (objectId) {
            if (client.readyState === WebSocket.OPEN && objectId.indexOf(client.userid) > -1) {
                // client.userid===objectId
                //不是上面这个判断语句。objectId是个数组。
                // client.send(message);
                client.send(val, () => {
                    client.send(JSON.stringify(message))
                });
                //服务器段send函数是有回调的，但是客户端websocket的send函数没有回调。
                // 另外即使客户端websocket的send函数有回调 发送音频和视频不好用那个回调
                // 因为不知道在服务器接收消息时的顺序是不是跟客户端发送消息的顺序一致
            }
        } else {
            console.log('没有发送objectid！');
        }
    });
}

function sendStringMessage(message){
    wss.clients.forEach(client => {
        if (objectId) {
            if (client.readyState === WebSocket.OPEN && objectId.indexOf(client.userid) > -1) {
                client.send(JSON.stringify(message));
            }
        } else {
            console.log('没有发送objectid！');
        }
    });
}

function getLocalIP(){
    let interfaces=os.networkInterfaces();
    let ip;
    interfaces.en0.forEach((element)=>{
        if(element.family==='IPv4'){
            ip = element.address;
            //这里万万不可return foreach函数里面return 函数就变成异步的
            // 得在函数外return
            // 另外foreach函数中不可写异步函数 因为foreach没法封装成同步函数(用promise)
            //foreach函数不等callback resolved
        }
        //貌似en0下会有多个元素 根据是不是IPv4来判断
    })
    return ip;
}
