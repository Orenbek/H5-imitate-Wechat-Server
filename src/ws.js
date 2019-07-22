const WebSocket = require('ws'); //引入模块
const http = require('http');
const uuidv1 = require('uuid/v1');
const server = http.createServer();

const wss = new WebSocket.Server({
    port: 8000,
    server: server,
    clientTracking: true,
    backlog: 50
}, callBack); //创建一个WebSocketServer的实例，监听端口8000

// message.state: 'launch','accept','break'
var objectId = [];
var radioBuffer = [];
var faceTimeOject = new Map();
wss.on('connection', function connection(ws, req) {
    // if(userList){
    //     ws.send(JSON.stringify(userList));
    // } else{
    //     ws.send('[]');
    // }

    ws.on('message', function incoming(message) {

        if (typeof message === 'object') {
            if (ws.facestate==='connected') {
                let objid = ws.faceobj;
                let faceClient = faceTimeOject.get(objid);
                faceClient.send(message);

            } else {
                let random = uuidv1();
                radioBuffer[random] = message;
                let res = JSON.stringify({
                    type: 'hash',
                    random: random
                })
                console.log('random is ', random);
                ws.send(res);
            }
            return;
        }

        console.log('received: %s', message);
        message = JSON.parse(message);
        let userid = message.userid;
        objectId = message.objectid;
        ws.userid = userid;
        var userList = [];
        wss.clients.forEach(client => {
            userList.push(client.userid);
            userList = Array.from(new Set(userList));
        });
        userList = {
            userList: userList,
            type: 'userList'
        };
        ws.send(JSON.stringify(userList));

        if (message.state === 'launch') {
            let faceClient =  faceTimeOject.get(objectId[0]);
            if(faceClient.state!=='connected'){
                ws.faceobj = objectId[0];
                ws.facestate = 'connecting';
                // faceTimeOject.set(userid, {
                //     client: ws,
                //     faceobj: objectId[0],
                //     facestate: 'connecting'
                // });
                faceTimeOject.set(userid, ws);
                //目前只考虑两人之间视频。
                //发送请求连接消息
            } else{
                message.state = 'reject';
                ws.send(JSON.stringify(message));
                //对方正在通话
            }
        }
        if (message.state === 'accept') {
            ws.faceobj = objectId[0];
            ws.facestate = 'connected';
            faceTimeOject.set(userid, ws);
            let faceClient = faceTimeOject.get(objectId[0]);
            faceClient.facestate = 'connected';
            faceTimeOject.set(objectId[0], faceClient);
            //更新自己和对方的状态为已连接。
            //发送接受连接消息
        }
        if (message.state === 'reject'){
            let faceClient = faceTimeOject.get(objectId[0]);
            faceClient.faceobj = '';
            faceClient.facestate = '';
            faceTimeOject.delete(objectId[0]);
            //发送拒绝接受消息 使对方的状态改为空。注：此时我的的状态不要改
        }
        if (message.state === 'break') {
            ws.faceobj = '';
            ws.facestate = '';
            let faceClient = faceTimeOject.get(objectId[0]);
            faceClient.faceobj = '';
            faceClient.facestate = '';
            faceTimeOject.delete(userid);
            faceTimeOject.delete(objectId[0]);
            //发送断开连接消息
        }

        if (message.random) {
            if (radioBuffer[message.random]) {
                var val = radioBuffer[message.random]
                wss.clients.forEach(client => {
                    if (objectId) {
                        if (client.readyState === WebSocket.OPEN && objectId.indexOf(client.userid) > -1) {
                            // client.userid===objectId
                            //不是上面这个判断语句。objectId是个数组。
                            // client.send(message);
                            client.send(val, () => {
                                client.send(JSON.stringify(message))
                            });
                        }
                    } else {
                        console.log('没有发送objectid！');
                    }
                });
            }
            return;
        }

        //发送文本消息或者其他请求。
        wss.clients.forEach(client => {
            if (objectId) {
                if (client.readyState === WebSocket.OPEN && objectId.indexOf(client.userid) > -1) {
                    client.send(JSON.stringify(message));
                }
            } else {
                console.log('没有发送objectid！');
            }
        });

        // wss.clients.forEach(function each(client) {
        //     userList = Array.from(new Set([...userList, client.userid]));
        //     //userList去重。
        //     // console.log('wss is ',JSON.stringify(client))
        //     if(objectId){
        //         // client !== ws && 
        //         if (client.readyState === WebSocket.OPEN && objectId.indexOf(client.userid)>-1) {
        //             client.send(JSON.stringify(message));
        //         }
        //     } else{
        //         client.send(JSON.stringify(message));
        //     }  
        // });


    });

});

function callBack() {
    console.log('server is on')
}