var http = require('http');
var dbo = require('./dbconfig');
var mysql = require('mysql');
var db = mysql.createConnection({
    host:dbo.HOST,
    user:dbo.USER,
    pass:dbo.PASS,
    database:dbo.DB,
});
db.connect((err)=>{
    //console.log(error);
});
var crypto = require('crypto');
var ws = require('ws');

var server = http.createServer((req, res) => {
});
server.listen(8080);



const rooms = {};
const wss = new ws.WebSocketServer({ server: server });
wss.on('connection', (client)=>{
    client.on('message', (data)=>{
        const msg = JSON.parse(data);
        const { type, room, userId } = msg
        if (type === 'init'){
            if(rooms[room] === undefined){
                rooms[room]=[];
            }

            const users = rooms[room].map(e=>e.userId);
            if(users.indexOf(userId)===-1){
                rooms[room].push({
                    userId:userId,
                    client:client
                });
            }
            broadcast(room,{
                type:'join',
                userId:userId
            });

        } else if (type === 'm'){
            const { message } = msg;
            broadcast(room,{
                userId:userId,
                message:message
            });
            sendMessage(room,userId,message);
        }
    });
});

function broadcast(room,data){
    rooms[room].forEach(e=>{
        e.client.send(JSON.stringify(data));
    });
}

function sendMessage(room,userId,message){
    const uuid = crypto.randomUUID();
    db.query('INSERT INTO `messages` (`id`, `convo_id`, `user_id`, `msg`) VALUES (?, ?, ?, ?)',[uuid,room,userId,message]);
}