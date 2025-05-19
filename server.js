// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (like your index.html)
app.use(express.static('public'));

app.get('/room', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'room', 'room.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game', 'game.html'));
});

let roles = ["droid", "escroc", "imposter", "romeo", "snake", "hero", "double"];

const rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', ({ username, roomCode }, callback) => {
        socket.join(roomCode);
        console.log(`${username} a créé la room ${roomCode}`);
        rooms[roomCode] = [{ id: socket.id, username }];
        callback({ success: true, roomCode });
    });

    socket.on('joinRoom', ({ roomCode, username }, callback) => {
        if (rooms[roomCode]) {
            socket.join(roomCode);

            console.log(`${username} a rejoint la room ${roomCode}`);

            const alreadyInRoom = rooms[roomCode].some(p => p.id === socket.id);
            if (!alreadyInRoom) {
                rooms[roomCode].push({ id: socket.id, username });
            }

            // UPDATE
            io.to(roomCode).emit('updatePlayers', rooms[roomCode]);

            callback({ success: true });
        } else {
            callback({ success: false, message: 'Room not found' });
        }
    });

    socket.on('disconnect', () => {
        for (const [code, players] of Object.entries(rooms)) {
            const index = players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                console.log(`${players[index].username} quitte la room ${code}`);
                players.splice(index, 1);
                io.to(code).emit('updatePlayers', players);
                if (players.length === 0) delete rooms[code];
                break;
            }
        }
    });

    socket.on('startGame', (roomCode) => {
        const players = rooms[roomCode];
        if (!players) return;

        console.log(`Starting game in ${roomCode}…`);

        const shuffled = [...roles];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        players.forEach((p, idx) => {
            p.role = shuffled[idx % shuffled.length];   // recycle si + joueurs que rôles
            io.to(p.id).emit('redirectToGame', { roomCode, role: p.role });
        });

        console.table(players.map(p => ({ user: p.username, role: p.role })));
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});