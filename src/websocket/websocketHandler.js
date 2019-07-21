const WebSocket = require('ws'); //引入模块
const http = require('http');
const uuidv1 = require('uuid/v1');

const wss = new WebSocket.Server({
    port: 8000,
    clientTracking: true,
    backlog: 50
}, callBack);

// message.state: 'launch','accept','break'
var objectId = [];
var RVBuffer = [];
//radio and video messages buffer
var faceTimeOject = new Map();

wss.on('connection', (ws, req)=> {

    ws.on('message',(rawMes)=> {

        if (typeof rawMes === 'object') {
            if (ws.facestate==='connected') {
                sendFaceTimeStream(ws,rawMes);
                return;
            }
            bufferRVmessageAndSendHash(ws,rawMes);
            return;
        }

        console.log('received: %s', rawMes);
        let message = JSON.parse(rawMes);
        objectId = message.objectid;
        if(message.type==='init'){
            markClientWithId(ws,message);
            sendUserlist();
            //第一次连接服务器会标记客户端并且发送当前在线用户列表
        }

        if (message.state === 'launch') {
            let faceClient =  faceTimeOject.get(objectId[0]);
            if(faceClient.state!=='connected'){
                clientFacestateConnecting(ws);
            } else{
                message.state = 'reject';
                ws.send(JSON.stringify(message));
                //对方正在通话
            }
        }
        if (message.state === 'accept') {
            clientAndFaceobjConnected(ws);
        }
        if (message.state === 'reject'){
            FacetimeConnectRejected();
            //发送拒绝接受消息 使对方的状态改为空。注：此时我的的状态不要改
        }
        if (message.state === 'break') {
            FacetimeConnectBroke(ws);
            //发送断开连接消息(待做)
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

function callBack() {
    console.log('server is on')
}

wss.broadcast = function(data) {
	wss.clients.forEach( (client)=> {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};


function sendFaceTimeStream(client,message){
    let objid = client.faceobj;
    let faceClient = faceTimeOject.get(objid);
    faceClient.send(message);
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
        faceTimeOject.set(userid, client);
        //目前只考虑两人之间视频。
        //发送请求连接消息
}

function clientAndFaceobjConnected(client){
    client.faceobj = objectId[0];
    client.facestate = 'connected';
    faceTimeOject.set(userid, client);
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
    faceTimeOject.delete(userid);
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