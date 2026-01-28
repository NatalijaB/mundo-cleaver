# Mundo Cleaver Game Server

A multiplayer game server for Mundo Cleaver, implementing the [@gamerstake/game-core](../docs/README.md) architecture patterns.

## Architecture

This server follows the game-core package patterns:

- **Fixed tick-rate game loop** (20 TPS with drift compensation)
- **Authoritative server architecture** (server is source of truth)
- **Client-server networking** (via Socket.io)
- **State synchronization** (full snapshots + delta updates)
- **Input buffering** (reliable command processing)
- **Entity management** (with dirty flag tracking)

## Project Structure

```
server/
├── src/
│   ├── index.ts           # Server entry point
│   ├── MundoGameRules.ts  # Game rules implementation
│   ├── types.ts           # TypeScript type definitions
│   └── entities/
│       ├── Player.ts      # Player entity
│       ├── Knife.ts       # Knife/projectile entity
│       └── index.ts       # Entity exports
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

### Installation

```bash
cd server
pnpm install
```

### Development

```bash
# Start with hot-reload
pnpm dev
```

### Production

```bash
# Build TypeScript
pnpm build

# Start server
pnpm start
```

## Configuration

The server runs on port 3000 by default. Set the `PORT` environment variable to change:

```bash
PORT=8080 pnpm start
```

## Game Rules Implementation

The `MundoGameRules` class implements the GameRules interface:

```typescript
class MundoGameRules {
  onRoomCreated(room): void;    // Room initialization
  onPlayerJoin(room, player): void;   // Player spawn
  onPlayerLeave(room, playerId): void; // Player cleanup
  onTick(room, delta): void;    // Game loop update
  onCommand(room, playerId, command): void; // Input processing
  shouldEndRoom(room): boolean; // Win condition check
}
```

## Network Protocol

### Client → Server Events

| Event | Description |
|-------|-------------|
| `createRoom` | Create a new game room |
| `joinRoom` | Join an existing room |
| `playerReady` | Mark player as ready |
| `playerLoaded` | Mark player as loaded |
| `startGame` | Start the game (host only) |
| `playerMove` | Player movement command |
| `knifeThrow` | Knife throw command |
| `timeSyncPing` | Time synchronization |

### Server → Client Events

| Event | Description |
|-------|-------------|
| `roomCreated` | Room created confirmation |
| `roomJoined` | Room joined confirmation |
| `roomState` | Current room state |
| `S_INIT` | Initial game state |
| `serverGameState` | Tick update |
| `serverMoveAck` | Movement acknowledgment |
| `serverKnifeSpawn` | Knife spawned |
| `serverKnifeHit` | Knife hit player |
| `serverKnifeDestroy` | Knife removed |
| `serverHealthUpdate` | Health changed |
| `gameOver` | Game ended |

## Custom Entities

### Player Entity

```typescript
class Player {
  id: string;
  x, z: number;           // Position
  health: number;         // Current health (0-5)
  team: 1 | 2;            // Team assignment
  isMoving: boolean;      // Movement state
  targetX, targetZ: number | null; // Movement target
  moveSpeed: number;      // Units per tick
  knifeCooldown: number;  // Cooldown in ms
}
```

### Knife Entity

```typescript
class Knife {
  id: string;
  x, z: number;           // Position
  vx, vz: number;         // Velocity
  throwerId: string;      // Thrower player ID
  throwerTeam: 1 | 2;     // Team (can't hit own team)
  speed: number;          // Movement speed
}
```

## Game Modes

- **1v1**: 2 players (1 per team)
- **3v3**: 6 players (3 per team)

## Integration with Client

The client should connect to the server and use the network events to synchronize state. The existing client networking code in `client/net/` is compatible with this server.

### Example Client Connection

```javascript
const socket = io('http://localhost:3000');

socket.emit('createRoom', { gameMode: '1v1' });

socket.on('roomCreated', (data) => {
  console.log('Room created:', data.roomCode);
});

socket.on('serverGameState', (state) => {
  // Update game with server state
  updatePlayers(state.players);
  updateKnives(state.knives);
});
```

## Performance

- **Tick Rate**: 20 TPS (50ms per tick)
- **Network**: Delta compression for bandwidth optimization
- **Collision**: Distance-based hit detection

## License

Part of the Mundo Cleaver game project.
