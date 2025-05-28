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

app.get('/endgame', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'endgame', 'endgame.html'));
});

let roles = ["escroc", "imposter", "romeo", "snake", "hero", "double", "butler", "noflash"];

const rooms = {};

const endgameResults = {};

io.on('connection', (socket) => {

    socket.on('registerPath', ({ path, username, roomCode }) => {
        let players = rooms[roomCode];
        if (!players) return;
        for (let i = 0; i < players.length; i++) {
            if (players[i].username === username) {
                players[i].path = path;
                players[i].id = socket.id;
            }
        }
    });

    socket.on('createRoom', ({ username, roomCode }, callback) => {
        socket.join(roomCode);
        console.log(`${username} a créé la room ${roomCode}`);
        rooms[roomCode] = [{ id: socket.id, username, path: '/room' }];
        callback({ success: true, roomCode });
    });

    socket.on('joinRoom', ({ roomCode, username }, callback) => {
        if (rooms[roomCode]) {
            socket.join(roomCode);

            console.log(`${username} a rejoint la room ${roomCode}`);

            const alreadyInRoom = rooms[roomCode].some(p => p.id === socket.id);
            if (!alreadyInRoom) {
                rooms[roomCode].push({ id: socket.id, username, path: '/room/' });
            }

            // UPDATE
            io.to(roomCode).emit('updatePlayers', rooms[roomCode]);
            callback({ success: true });
        } else {
            callback({ success: false, message: 'Room not found' });
        }
    });

    socket.on('getRooms', ({ roomCode }, callback) => {
        console.log(`Demande de la room ${roomCode} par ${socket.id}`);
        if (rooms[roomCode]) {
            callback({success: true, room: rooms[roomCode]});
        }
        callback({success: false, room: []});
    })

    socket.on('getRoles', (callback) => {
        callback({success: true, roles: roles});
    })

    socket.on('disconnect', () => {
        for (const [code, players] of Object.entries(rooms)) {
            const index = players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                const player = players[index];

                if (player.path?.startsWith('/game') || player.path?.startsWith('/endgame') || player.path?.startsWith('/room')) {
                    console.log(`Déconnexion ignorée de ${player.username} (encore sur ${player.path})`);
                    return;
                }

                console.log(`${player.username} quitte la room ${code}`);
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
            io.to(p.id).emit('redirectToGame', { roomCode, role: p.role, username: p.username });
        });

        console.table(players.map(p => ({ user: p.username, role: p.role })));
    });

    socket.on('endGame', (roomCode) => {
        const players = rooms[roomCode];
        console.log(players);
        console.log(socket.id);
        players.forEach((p, _) => {
            io.to(p.id).emit('redirectToEnd');
        });
    })

    socket.on('playerResults', ({ roomCode, username, guesses }) => {
        if (!endgameResults[roomCode]) endgameResults[roomCode] = [];
        // Empêche les doublons
        if (!endgameResults[roomCode].some(r => r.username === username)) {
            endgameResults[roomCode].push({ username, guesses, socketId: socket.id });
        }

        // Vérifie si tous les joueurs ont répondu
        const players = rooms[roomCode] || [];
        if (endgameResults[roomCode].length === players.length) {
            // Calcul des scores
            const playerRoles = players.map(p => ({ username: p.username, role: p.role }));
            
            console.log(playerRoles)

            // Map username -> score
            const scores = {};
            players.forEach(p => scores[p.username] = 0);

            // 1. +1 point pour chaque bonne réponse
            endgameResults[roomCode].forEach(result => {
                result.guesses.forEach(guess => {
                    console.log(guess)
                    const targetPlayer = playerRoles[guess.playerIndex];
                    if (targetPlayer && guess.role === targetPlayer.role) {
                        console.log("trouver");
                        scores[result.username]++;
                    } else if (targetPlayer) {
                        // Si la réponse est fausse, le joueur qui devait être deviné gagne 1 point
                        console.log("cacher");
                        scores[targetPlayer.username]++;
                    }
                    console.log(scores)
                });
            });

            // Envoie le score à chaque joueur
            endgameResults[roomCode].forEach(result => {
                io.to(result.socketId).emit("finalScore", { points: scores[result.username] });
            });

            // Reset pour la prochaine partie
            delete endgameResults[roomCode];
        }
    });
});

const port = 4000

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});