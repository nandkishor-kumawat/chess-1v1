const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const cors = require('cors');
const PORT = process.env.PORT || 3000;

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');

const app = express();

const server = http.createServer(app);
const io = socketio(server);

app.use(cors());

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    // res.send('server is running');
    res.sendFile(__dirname + '/public/game.html');
});

io.on('connect', (socket) => {
    console.log('new connection')
    socket.on('join', ({ name, room }) => {
        const { error, user } = addUser({ id: socket.id, name, room });

        // if (error) return callback(error);
        if (error) {
            socket.emit('error', error);
            return;
        };
        socket.join(user.room);
        socket.emit('success');
        // console.log(name + ' ' + room + ' joined');
    })

    socket.on('deselect-piece', () => {
        const user = getUser(socket.id);
        // socket.broadcast.emit('deselect-piece');
        io.to(user.room).emit('deselect-piece');
    })

    socket.on('select-piece', Id => {
        const user = getUser(socket.id);
        // socket.broadcast.to(user.room).emit('select-piece', Id);
        io.to(user.room).emit('select-piece', Id);
    })

    socket.on('toggle-suggestion', () => {
        const user = getUser(socket.id);
        // socket.broadcast.emit('toggle-suggestion');
        io.to(user.room).emit('toggle-suggestion');
    })

    socket.on('piece-move', data => {
        const user = getUser(socket.id);
        // socket.broadcast.emit('piece-move', data);
        io.to(user.room).emit('piece-move', data)
    })

    socket.on('disconnect', () => {
        console.log(socket.id + ' left');
        removeUser(socket.id)
    })
})





server.listen(PORT, () => console.log(`server started on http://localhost:${PORT}/`))
