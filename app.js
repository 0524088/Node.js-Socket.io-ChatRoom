// 使用環境變數
import dotenv from 'dotenv/config.js';
import express       from 'express';
import http          from 'http';
import socketIo      from 'socket.io';
import sharedSession from 'express-socket.io-session';
import routes        from './routes/route.js'; // 引入路由文件

import * as Middleware    from './app/middleware/middlewareController.js';

const app_Url = process.env["APP_URL"];
const app_Port = process.env["APP_PORT"];
const socket_Url = process.env["SOCKET_URL"];
const socket_Port = process.env["SOCKET_PORT"];

/**
 * socketData = {
 *     roomList: // 房間列表
 *     {
 *         [roomname1]: // 房間成員
 *         {
 *             [username1]: {},
 *             [username2]: {},...
 *         },
 *         [roomname2]: [
 *             [username1]: {},
 *             [username2]: {},...
 *         ],...
 *     }
 * }
 * 
 */
const socketData = {
    roomList: {}
};

const app = express();
const httpServer = http.createServer(app); // 創建伺服器實例 with express框架
const wsServer = http.createServer();

// 加上一個監聽器來監聽這個 port
httpServer.listen(app_Port, () => {    
    console.log(`Http server start.\napp listening at ${app_Url}`);
});

// WebSocket服务器
wsServer.listen(socket_Port, () => {
    console.log(`WebSocket server start.\napp listening at ${socket_Url}`);
});

// 创建Socket.IO实例
const io = socketIo(wsServer);

// session 設置
app.use(Middleware.sessionMiddleware);
io.use(sharedSession(Middleware.sessionMiddleware, {
    autoSave: true
}));

// 設定模板引擎
app.set('view engine', 'ejs');

// 設定 ejs 引入目錄的路徑
app.use(express.static(`${process.cwd()}/public`));
app.use('/node_modules', express.static(`${process.cwd()}/node_modules/`));

// 解析JSON
app.use(express.json());

// 使用路由
app.use(routes);

// 連線事件處理
io.on('connection', (socket) => {
    console.log('WebSocket client connect');
    const session = socket.handshake.session;

    // 意外斷線情況回復
    if(session.room) {
        socket.join(session.room);
        socketData.roomList[session.room][session.token] = {};
        joinRoomEvent({
            roomList : socketData.roomList,
            io       : io,
            socket   : socket,
            room     : session.room,
            token    : session.token,
            username : session.username
        });
    }

    // 加入房間
    socket.on('join', (room) => {
        // 将用户加入指定房间
        socket.join(room);
        
        session.room = room;

        if(!socketData.roomList.hasOwnProperty(room)) {
            socketData.roomList[room] = {}; // 房間內部成員
        }

        socketData.roomList[session.room][session.token] = {};
        joinRoomEvent({
            roomList : socketData.roomList,
            io       : io,
            socket   : socket,
            room     : session.room,
            token    : session.token,
            username : session.username
        });
        socket.emit('joinSuccess', room);
    });
    
    // 發送訊息
    socket.on('sendMessage', (msg) => {
        console.log(`User: "${session.username}" send message: "${msg}"`);
        socket.to(session.room).emit('getUsersMsg', { 
                                username: session.username,
                                msg: msg
                            });
    });

    // 取得數量
    socket.on('getUsersCount', () => {
        console.log(`session room: ${session.room}`);
        const roomUsersCount = Object.keys(socketData.roomList[session.room]).length;
        socket.emit('getUsersCount', roomUsersCount);
    });

    // 登出(手動斷開 socket，需註銷 session)
    socket.on('leave', () => {
        console.log(`User: "${session.username}" left`);

        // 將使用者從房間內移除
        delete socketData.roomList[session.room][session.token];
        leaveRoomEvent({
            roomList : socketData.roomList,
            socket   : socket,
            room     : session.room,
            token    : session.token,
            username : session.username
        });

        // 清除 session 房間紀錄
        delete session.room;

        // 斷開房間連接
        socket.leave(session.room);
        socket.emit('leaveSuccess');
    });

    // 斷線
    socket.on('disconnect', (reason) => {
        // 在房間的時候斷線
        if(session.room) {
            // 將使用者從房間內移除
            delete socketData.roomList[session.room][session.token];
            leaveRoomEvent({
                roomList : socketData.roomList,
                socket   : socket,
                room     : session.room,
                token    : session.token,
                username : session.username
            });
        }
        else console.log(`User: "${session.username}" left unexpected`);
    });
});

function joinRoomEvent({ roomList, io, socket, room, token, username }) {
    
    // 获取房间内的连接数量
    const roomUsersCount = Object.keys(roomList[room]).length;

    // 廣播給所有用戶
    io.to(room).emit('getUsersCount', roomUsersCount);

    // 廣播給其他用戶
    socket.to(room).emit('getServerMsg', `${username} 加入聊天室`);
}

function leaveRoomEvent({ roomList, io, socket, room, token, username }) {
    // 获取房间内的连接数量
    const roomUsersCount = Object.keys(roomList[room]).length;

    // 广播给房间内其他用户
    socket.to(room).emit('getUsersCount', roomUsersCount);
    socket.to(room).emit('getServerMsg', `${username} 離開聊天室`);
}
  
export default app;