var http = require('http');
var crypto = require('crypto');
var ws = require('ws');

var server = http.createServer((req, res) => {
});
server.listen(8080);



const rooms = {};
const userMap = {};


const wss = new ws.WebSocketServer({ server: server });
wss.on('connection', (client)=>{
    client.on('message', (data)=>{
        const msg = JSON.parse(data);
        const { type, room, uuid } = msg
        if (type === 'init'){
            if(rooms[room] === undefined){
                rooms[room]=[];
            }

            const { token } = msg;
            userMap[uuid] = token;

            const users = rooms[room].map(e=>e.uuid);
            if(users.indexOf(uuid)===-1){
                rooms[room].push({
                    uuid:uuid,
                    client:client
                });
            }
            
            broadcast(room,{
                type:'join',
                uuid:uuid
            });

        } else if (type === 'm'){
            const message = msg.msg;
            sendMessage(room,uuid,message);
        }
    });
    client.on('close', (code, reason) => {
        //code=1001 = closed
    });
});

function broadcast(room,data){
    const d = JSON.stringify(data);
    rooms[room].forEach(e=>{
        e.client.send(d);
    });
}

function sendMessage(room,uuid,message){
    const res = fetch('https://api.tecesports.com/private/v2/chat', {
        method:'POST',
        headers: {
            'Content-Type':'application/json'
        },
        cache: 'no-cache',
        body: JSON.stringify({
            convoId:room,
            userId:uuid,
            msg:message,
            action:'sendChat',
            token:userMap[uuid]
        })
    }).then(r => {
        return r.json();
    }).then(data => {
        broadcast(room,{
            uuid:uuid,
            msg:message,
            type:'m',
            messageId:data.success
        });
    });
}