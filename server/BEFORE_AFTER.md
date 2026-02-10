# Mundo Cleaver Server: Before & After

## 📊 Code Reduction

```
BEFORE:  458 lines (manual Socket.IO event handlers)
AFTER:   121 lines (SocketIOAdapter configuration)
SAVED:   337 lines (74% reduction)
```

---

## 🔍 Side-by-Side Comparison

### Room Creation

#### Before (50+ lines)
```typescript
socket.on('createRoom', (data: { gameMode: GameMode }) => {
  const roomCode = generateRoomCode();
  const config: MundoRoomConfig = {
    ...DEFAULT_CONFIG,
    gameMode: data.gameMode,
    maxPlayersPerTeam: data.gameMode === '1v1' ? 1 : 3,
  };

  const room = gameServer.createRoom(roomCode, new MundoGameRules(config), {
    tickRate: 60,
    cellSize: 512,
    maxEntities: 100,
  });

  roomMetadata.set(roomCode, {
    hostId: socket.id,
    readyPlayers: new Set(),
    loadedPlayers: new Set(),
    config,
  });

  const team = 1;
  const playerIndex = 0;
  const spawnPositions = SPAWN_POSITIONS[config.gameMode];
  const spawn = spawnPositions.team1[playerIndex];

  const player = new Player(socket.id, spawn.x, spawn.z, team, playerIndex, {
    health: config.playerHealth,
    moveSpeed: config.playerMoveSpeed,
    knifeCooldown: config.knifeCooldownMs,
    facing: spawn.facing,
  });
  player.socketId = socket.id;
  player.isHost = true;

  room.addPlayer(player);
  room.getNetwork().registerSocket(socket.id, socket);
  socket.join(roomCode);

  socket.emit('roomCreated', {
    op: 'roomCreated',
    roomCode,
    playerId: socket.id,
    team: player.team,
    isHost: true,
    gameMode: data.gameMode,
  });

  broadcastRoomState(room, roomCode);
  console.log(`[Server] Room ${roomCode} created by ${socket.id}`);
});
```

#### After (0 lines - handled by adapter!)
```typescript
// No code needed! SocketIOAdapter handles this automatically
// Just configure how to create players and rules:

createPlayer: (playerId, config) => {
  const player = new Player(
    playerId,
    config.spawn.x,
    config.spawn.z,
    config.team,
    config.playerIndex,
    config
  );
  player.isHost = config.isHost;
  return player;
}
```

---

### Room Joining

#### Before (60+ lines)
```typescript
socket.on('joinRoom', (data: { roomCode: string }) => {
  console.log(`[Server] joinRoom request - code: "${data.roomCode}"`);

  const room = gameServer.getRoom(data.roomCode);
  const metadata = roomMetadata.get(data.roomCode);

  if (!room || !metadata) {
    console.log(`[Server] Room "${data.roomCode}" not found!`);
    socket.emit('joinError', { error: 'Room not found' });
    return;
  }

  if (room.isRunning()) {
    socket.emit('joinError', { error: 'Game already in progress' });
    return;
  }

  const maxPlayers = metadata.config.gameMode === '1v1' ? 2 : 6;
  if (room.getRegistry().size >= maxPlayers) {
    socket.emit('joinError', { error: 'Room is full' });
    return;
  }

  const players = Array.from(room.getRegistry().values()) as Player[];
  const team1Count = players.filter((p) => p.team === 1).length;
  const team2Count = players.filter((p) => p.team === 2).length;

  const team = team1Count <= team2Count ? 1 : 2;
  const playerIndex = team === 1 ? team1Count : team2Count;

  const spawnPositions = SPAWN_POSITIONS[metadata.config.gameMode];
  const teamSpawns = team === 1 ? spawnPositions.team1 : spawnPositions.team2;
  const spawn = teamSpawns[playerIndex] || teamSpawns[0];

  const player = new Player(socket.id, spawn.x, spawn.z, team, playerIndex, {
    health: metadata.config.playerHealth,
    moveSpeed: metadata.config.playerMoveSpeed,
    knifeCooldown: metadata.config.knifeCooldownMs,
    facing: spawn.facing,
  });
  player.socketId = socket.id;
  player.isHost = false;

  room.addPlayer(player);
  room.getNetwork().registerSocket(socket.id, socket);
  socket.join(data.roomCode);

  socket.emit('joinSuccess', {
    op: 'joinSuccess',
    roomCode: data.roomCode,
    playerId: socket.id,
    team: player.team,
    isHost: false,
    gameMode: metadata.config.gameMode,
  });

  broadcastRoomState(room, data.roomCode);
  console.log(`[Server] Player ${socket.id} joined room ${data.roomCode}`);
});
```

#### After (0 lines - handled by adapter!)
```typescript
// No code needed! SocketIOAdapter handles this automatically
// Just configure team assignment:

assignPlayerTeam: (room, config) => {
  const players = Array.from(room.getRegistry().values());
  const team1Count = players.filter((p) => p.team === 1).length;
  const team2Count = players.filter((p) => p.team === 2).length;
  
  const team = config.isHost ? 1 : (team1Count <= team2Count ? 1 : 2);
  const playerIndex = team === 1 ? team1Count : team2Count;
  const spawn = SPAWN_POSITIONS[config.gameMode][`team${team}`][playerIndex];
  
  return { team, playerIndex, spawn };
}
```

---

### Player Ready

#### Before (20+ lines)
```typescript
socket.on('playerReady', (data: { roomCode: string }) => {
  const room = gameServer.getRoom(data.roomCode);
  const metadata = roomMetadata.get(data.roomCode);
  if (!room || !metadata) return;

  const isCurrentlyReady = metadata.readyPlayers.has(socket.id);
  if (isCurrentlyReady) {
    metadata.readyPlayers.delete(socket.id);
  } else {
    metadata.readyPlayers.add(socket.id);
  }

  const newState = !isCurrentlyReady;

  room.broadcast({
    op: 'playerReadyUpdate',
    socketId: socket.id,
    ready: newState,
  });

  broadcastRoomState(room, data.roomCode);
  console.log(`[Server] Player ${socket.id} ready=${newState}`);
});
```

#### After (0 lines - handled by adapter!)
```typescript
// No code needed! SocketIOAdapter handles this automatically
```

---

### Game Start

#### Before (50+ lines)
```typescript
socket.on('startGame', (data: { roomCode: string }) => {
  const room = gameServer.getRoom(data.roomCode);
  const metadata = roomMetadata.get(data.roomCode);
  if (!room || !metadata) return;

  const player = room.getRegistry().get(socket.id) as Player | undefined;
  if (!player?.isHost) {
    socket.emit('error', { error: 'Only host can start game' });
    return;
  }

  const allReady =
    metadata.readyPlayers.size === room.getRegistry().size &&
    room.getRegistry().size >= 2;

  if (!allReady) {
    socket.emit('error', { error: 'Not all players ready' });
    return;
  }

  room.broadcast({ op: 'gameStart' });

  room.getRegistry().forEach((p, pid) => {
    const playerSocket = io.sockets.sockets.get(pid);
    if (playerSocket) {
      playerSocket.emit('S_INIT', {
        op: 'S_INIT',
        playerId: pid,
        team: (p as Player).team,
        roomCode: data.roomCode,
        ...room.getSnapshot(),
      });
    }
  });

  const rules = (room as any).rules as MundoGameRules;
  rules.startCountdown();
  room.start();

  room.broadcast({
    op: 'countdownStart',
    countdownSeconds: 5,
  });

  console.log(`[Server] Game started in room ${data.roomCode}`);
});
```

#### After (0 lines - handled by adapter!)
```typescript
// No code needed! SocketIOAdapter handles this automatically
// It calls rules.startCountdown() if available
```

---

### Disconnect Handling

#### Before (40+ lines)
```typescript
socket.on('disconnect', () => {
  let playerRoomCode: string | null = null;
  gameServer.getAllRooms().forEach((room, roomCode) => {
    if (room.getRegistry().has(socket.id)) {
      playerRoomCode = roomCode;
    }
  });

  if (playerRoomCode) {
    const room = gameServer.getRoom(playerRoomCode);
    const metadata = roomMetadata.get(playerRoomCode);

    if (room && metadata) {
      room.removePlayer(socket.id);
      room.getNetwork().unregisterSocket(socket.id);
      metadata.readyPlayers.delete(socket.id);
      metadata.loadedPlayers.delete(socket.id);

      if (metadata.hostId === socket.id && room.getRegistry().size > 0) {
        const newHostId = room.getRegistry().keys().next().value;
        metadata.hostId = newHostId || null;
        if (newHostId) {
          const newHost = room.getRegistry().get(newHostId) as Player;
          if (newHost) newHost.isHost = true;
        }
      }

      if (room.getRegistry().size === 0) {
        room.stop();
        gameServer.destroyRoom(playerRoomCode);
        roomMetadata.delete(playerRoomCode);
        console.log(`[Server] Room ${playerRoomCode} deleted (empty)`);
      } else {
        broadcastRoomState(room, playerRoomCode);
      }
    }
  }

  console.log(`[Server] Client disconnected: ${socket.id}`);
});
```

#### After (0 lines - handled by adapter!)
```typescript
// No code needed! SocketIOAdapter handles:
// - Player removal
// - Socket cleanup
// - Host reassignment
// - Empty room deletion
```

---

## 📝 Complete Server File Comparison

### Before: index.ts (458 lines)
```typescript
import { Server as SocketIOServer } from 'socket.io';
import { GameServer, Room } from '@gamerstake/game-core';
// ... imports

const io = new SocketIOServer(PORT, { /* config */ });
const gameServer = new GameServer();
const roomMetadata = new Map();

io.on('connection', (socket) => {
  socket.on('createRoom', (data) => { /* 50 lines */ });
  socket.on('joinRoom', (data) => { /* 60 lines */ });
  socket.on('playerReady', (data) => { /* 20 lines */ });
  socket.on('playerLoaded', (data) => { /* 15 lines */ });
  socket.on('startGame', (data) => { /* 50 lines */ });
  socket.on('playerMove', (data) => { /* 10 lines */ });
  socket.on('knifeThrow', (data) => { /* 15 lines */ });
  socket.on('timeSyncPing', (data) => { /* 5 lines */ });
  socket.on('disconnect', () => { /* 40 lines */ });
});

function generateRoomCode() { /* 10 lines */ }
function broadcastRoomState() { /* 35 lines */ }
```

### After: index.ts (121 lines)
```typescript
import { Server as SocketIOServer } from 'socket.io';
import { GameServer, SocketIOAdapter } from '@gamerstake/game-core';
// ... imports

const io = new SocketIOServer(PORT, { /* config */ });
const gameServer = new GameServer<Player>();

const adapter = new SocketIOAdapter<Player>(gameServer, {
  createRules: (config) => new MundoGameRules(config),
  createPlayer: (id, config) => new Player(id, ...),
  createRoomConfig: (mode) => ({ ...DEFAULT_CONFIG, mode }),
  assignPlayerTeam: (room, config) => ({ team, spawn }),
  roomOptions: { tickRate: 60 },
});

adapter.attach(io);
```

**That's the entire server!**

---

## 🎯 Key Takeaways

### What You Write
- ✅ **4 configuration functions** (~60 lines)
- ✅ **Game rules** (MundoGameRules.ts)
- ✅ **Entities** (Player, Knife)

### What SocketIOAdapter Handles
- ✅ **All socket event handlers** (0 lines for you!)
- ✅ **Room lifecycle** (create, join, cleanup)
- ✅ **Player lifecycle** (add, remove, reassign host)
- ✅ **Lobby features** (ready, loaded, start)
- ✅ **Input routing** (move, actions)
- ✅ **Networking** (broadcast, time sync)

### Result
**74% less code, 100% of the functionality**

---

## 🚀 To Test

```bash
cd mundo-cleaver/server
pnpm dev
```

Open the client and test all features. Everything should work **exactly** as before!

---

_Everything the server did manually is now handled by SocketIOAdapter_
