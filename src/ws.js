const WebSocket = require('ws'); //引入模块
const http = require('http');
const uuidv1 = require('uuid/v1');
const server = http.createServer();

const wss = new WebSocket.Server({
    port: 8000,
    server,
    clientTracking: true,
    backlog: 50
},callBack); //创建一个WebSocketServer的实例，监听端口8000

// message.state: 'launch','accept','break'
// var userList = [];
var objectId = [];
var radioBuffer = [];
var faceTimeOject = [];
wss.on('connection', function connection(ws,req) {
    // if(userList){
    //     ws.send(JSON.stringify(userList));
    // } else{
    //     ws.send('[]');
    // }
    
    ws.on('message', function incoming(message) {

        if(typeof message ==='object'){
        let random = uuidv1();
        radioBuffer[random]=message;
        let res = JSON.stringify({type:'hash',random: random})
        console.log('random is ',random);
        ws.send(res);
        } else {
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
            userList = {userList:userList, type: 'userList'};
        ws.send(JSON.stringify(userList));

        if(message.type==='faceTime'&&message.state==='launch'){
            
        }
            if(message.random){
                
                if(radioBuffer[message.random]){
                    var val = radioBuffer[message.random]
                    wss.clients.forEach(client=>{
                        if(objectId){
                            if (client.readyState === WebSocket.OPEN && objectId.indexOf(client.userid)>-1) {
                                // client.userid===objectId
                                //不是上面这个判断语句。objectId是个数组。
                                // client.send(message);
                                client.send(val,()=>{
                                    client.send(JSON.stringify(message))
                                });
                            }
                        } else{
                            console.log('没有发送objectid！');
                        }
                    });
                }
            } else{
                //发送文本消息
                wss.clients.forEach(client=>{
                    if(objectId){
                        if (client.readyState === WebSocket.OPEN && objectId.indexOf(client.userid)>-1) {
                            client.send(JSON.stringify(message));
                        }
                    } else{
                        console.log('没有发送objectid！');
                    }
                });
            }
            
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
        }
        


        // console.log('userid is ',userid)
        // ws.send('your meassage is received!');
        // wss.clients.forEach(function each(client) {
        //     client.send(data);
        // });
    }); //当收到消息时，在控制台打印出来，并回复一条信息

});

function callBack(){
    console.log('server is on')
}