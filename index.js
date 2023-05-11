var http = require('http');
var https = require('https');
var crypto = require('crypto');
var ws = require('ws');
var fs = require('fs');
var url = require('url');
const fetch = require('node-fetch');

try {
    /*
    var server = https.createServer({
        key: fs.readFileSync('/etc/letsencrypt/live/tecesports.com/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/tecesports.com/cert.pem')
    });
    server.listen(8080);*/
    
    
    var server=http.createServer();
    server.listen(8080);

    console.log('server started');

} catch(e){
    console.log('error');
}

class ChatServer {
    constructor() {
        this.rooms = {};
    }

    addRoom(roomId){
        const keys = Object.keys(this.rooms);
        if(keys.indexOf(roomId)!==-1){
            return this.rooms[roomId];
        }
        const room = new Room(roomId);
        this.rooms[roomId] = room;
        return room;
    }

    removeRoom(roomId){
        return delete this.rooms[roomId]
    }

    getRoom(roomId){
        return this.rooms[roomId];
    }

    parseMessage(e, client){
        try {
            const m = JSON.parse(e);
            const roomId = m.room;
            const userId = m.uuid;
    
            switch (m.type){
                case 'm':
                    const roomMessage = this.getRoom(roomId);
                    roomMessage.sendMessage(client.id, m.msg);
                    break;
            }
        } catch (e) {
            //logerror
        }
    }

    handleLeave(client){
        const room = this.rooms[client.roomId];
        if(room===undefined){
            return;
        }
        return room.removeUser(client.id);
    }
}

class Room {
    constructor(roomId) {
        this.users = [];
        this.roomId = roomId;
    }

    addUser(user) {
        const clientId = user.getClient().id;
        const keys = Object.keys(this.users);
        if(keys.indexOf(clientId)!==-1){ //disconnect oldest version of this user if they join on a new tab
            /*
            const oldUser = this.users[clientId].client;
            oldUser.send(JSON.stringify({
                type:'system',
                title: 'You have been disconnected',
                msg:'You have opened the chat in a new window'
            }));
            oldUser.close();*/
        }
        this.users[clientId] = user;
    }

    removeUser(clientId){
        this.users=this.users.filter(e => {
            return e.clientId !== clientId;
        });
    }

    getRoomId() {
        return this.roomId;
    }

    sendMessage(clientId, msg){
        const user = this.users[clientId];
        if(user === undefined){
            return;
        }
        const userId = user.getUserId();
        const token = user.getToken();

        const res = fetch('https://api.tecesports.com/private/v2/chat', {
            method:'POST',
            headers: {
                'Content-Type':'application/json'
            },
            cache: 'no-cache',
            body: JSON.stringify({
                convoId:this.roomId,
                userId:userId,
                msg:msg,
                action:'sendChat',
                token:token
            })
        }).then(r => {
            return r.json();
        }).then(data => {
            this.broadcast({
                uuid:userId,
                msg:msg,
                type:'m',
                messageId:data.success
            });
        }).catch((e) => {
            logError(e);
        });
    }

    broadcast(data) {
        if(typeof data !== 'string'){
            data=JSON.stringify(data);
        }
        const keys = Object.keys(this.users);
        keys.forEach(e => {
            this.users[e].getClient().send(data);
        });
    }
}

class User {
    constructor(client, userId, token) {
        this.client=client;
        this.userId=userId;
        this.token=token;
    }

    getClient() {
        return this.client;
    }

    getUserId() {
        return this.userId;
    }

    getToken(){
        return this.token;
    }
}

const c = new ChatServer();
const wss = new ws.WebSocketServer({ 
    server: server,
});
console.log(wss.address());

wss.getID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
}

wss.on('connection', (client, req)=>{
    client.id = wss.getID();
    const search = url.parse(req.url).search;
    const query = Object.fromEntries(new URLSearchParams(search));

    const roomId = query.convoId;
    const token = query.token;
    const userId = query.userId;

    console.log(roomId, token, userId);
    
    const room = c.addRoom(roomId);
    room.addUser(new User(client, userId, token));
    room.broadcast({
        type:'join',
        userId:userId
    });

    client.on('message', (e) => {
        c.parseMessage(e, client);
    });
    client.on('close', (code, reason) => {
        c.handleLeave(client);
    });
    client.on('error', (e)=>{
        console.log('error');
    });
});

function logError(e) {
    console.log('###############    ERROR    #############');
    console.log(e);
    console.log('#########################################');
}