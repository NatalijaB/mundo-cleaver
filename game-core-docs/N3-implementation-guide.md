# N3: @gamerstake/game-core - Implementation Guide

> **Version:** 0.1.0  
> **Last Updated:** January 2026

---

## Table of Contents

1. [Quick Start (5 Minutes)](#1-quick-start-5-minutes)
2. [Project Structure](#2-project-structure)
3. [Implementing GameRules](#3-implementing-gamerules)
4. [Server Setup](#4-server-setup)
5. [Client Integration](#5-client-integration)
6. [Custom Entities](#6-custom-entities)
7. [Custom Commands](#7-custom-commands)
8. [Common Patterns](#8-common-patterns)
9. [Performance Best Practices](#9-performance-best-practices)

---

## 1. Quick Start (5 Minutes)

### Step 1: Install Dependencies

```bash
pnpm add @gamerstake/game-core socket.io
pnpm add -D socket.io-client typescript @types/node tsx
```

### Step 2: Create Game Rules

```typescript
// src/MyGameRules.ts
import { GameRules, Room, Entity, Command, MoveCommand } from '@gamerstake/game-core';

export class MyGameRules implements GameRules {
  onRoomCreated(room: Room): void {
    console.log('Room created!');
  }

  onPlayerJoin(room: Room, player: Entity): void {
    player.setPosition(Math.random() * 800, Math.random() * 600);
    console.log(`Player ${player.id} joined`);
  }

  onPlayerLeave(room: Room, playerId: string): void {
    console.log(`Player ${playerId} left`);
  }

  onTick(room: Room, delta: number): void {
    room.getRegistry().forEach((entity) => {
      entity.updatePosition(delta);
    });
  }

  onCommand(room: Room, playerId: string, command: Command): void {
    const player = room.getRegistry().get(playerId);
    if (!player) return;

    if (command.type === 'move') {
      const { dir } = command as MoveCommand;
      player.setVelocity(dir.x * 200, dir.y * 200);
    } else if (command.type === 'stop') {
      player.setVelocity(0, 0);
    }
  }

  shouldEndRoom(room: Room): boolean {
    return false; // Persistent world
  }
}
```

### Step 3: Create Server

```typescript
// src/server.ts
import { Server } from 'socket.io';
import { GameServer, Entity } from '@gamerstake/game-core';
import { MyGameRules } from './MyGameRules.js';

const io = new Server(3000, { cors: { origin: '*' } });
const gameServer = new GameServer();
gameServer.setServer(io);

const room = gameServer.createRoom('main', new MyGameRules());

io.on('connection', (socket) => {
  const player = new Entity(socket.id, 0, 0);
  room.addPlayer(player);
  room.getNetwork().registerSocket(socket.id, socket);

  socket.emit('S_INIT', { playerId: socket.id, ...room.getSnapshot() });

  socket.on('C_MOVE', (data) => {
    room.queueInput(socket.id, {
      seq: data.seq,
      type: 'move',
      dir: data.dir,
      timestamp: Date.now(),
    });
  });

  socket.on('C_STOP', (data) => {
    room.queueInput(socket.id, {
      seq: data.seq,
      type: 'stop',
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    room.removePlayer(socket.id);
    room.getNetwork().unregisterSocket(socket.id);
  });
});

console.log('Server running on port 3000');
```

### Step 4: Run

```bash
npx tsx src/server.ts
```

---

## 2. Project Structure

### Recommended Layout

```
my-game/
├── src/
│   ├── server/
│   │   ├── index.ts           # Server entry point
│   │   ├── GameRules.ts       # Your game logic
│   │   └── entities/
│   │       ├── Player.ts      # Custom player entity
│   │       └── Projectile.ts  # Projectile entity
│   ├── client/
│   │   ├── index.ts           # Client entry point
│   │   └── GameClient.ts      # Network wrapper
│   └── shared/
│       ├── types.ts           # Shared type definitions
│       └── constants.ts       # Game constants
├── package.json
└── tsconfig.json
```

---

## 3. Implementing GameRules

### 3.1 Basic Template

```typescript
import { GameRules, Room, Entity, Command } from '@gamerstake/game-core';

export class MyGameRules implements GameRules<Entity> {
  // Called once when room is created
  onRoomCreated(room: Room<Entity>): void {
    // Initialize game state
    // Spawn static objects
  }

  // Called when player joins
  onPlayerJoin(room: Room<Entity>, player: Entity): void {
    // Set spawn position
    // Initialize player state
  }

  // Called when player leaves
  onPlayerLeave(room: Room<Entity>, playerId: string): void {
    // Clean up player resources
  }

  // Called every tick (20 TPS = every 50ms)
  onTick(room: Room<Entity>, delta: number): void {
    // Update entity positions
    // Check collisions
    // Process game logic
  }

  // Called when player sends a command
  onCommand(room: Room<Entity>, playerId: string, command: Command): void {
    // Validate command
    // Apply to player/game state
  }

  // Called every tick to check if room should end
  shouldEndRoom(room: Room<Entity>): boolean {
    // For persistent worlds: return false
    // For matches: check win condition
    return false;
  }
}
```

### 3.2 Match-Based Game Example

```typescript
enum GameState {
  WAITING,
  COUNTDOWN,
  PLAYING,
  ENDED,
}

export class MatchRules implements GameRules<Player> {
  private state = GameState.WAITING;
  private countdown = 0;
  private matchTime = 0;
  private readonly MATCH_DURATION = 180000; // 3 minutes

  onPlayerJoin(room: Room<Player>, player: Player): void {
    player.score = 0;

    // Start countdown when we have enough players
    if (this.state === GameState.WAITING && room.getPlayers().size >= 2) {
      this.state = GameState.COUNTDOWN;
      this.countdown = 5000;
      room.broadcast({ op: 'COUNTDOWN_START', seconds: 5 });
    }
  }

  onTick(room: Room<Player>, delta: number): void {
    switch (this.state) {
      case GameState.COUNTDOWN:
        this.countdown -= delta;
        if (this.countdown <= 0) {
          this.state = GameState.PLAYING;
          room.broadcast({ op: 'MATCH_START' });
        }
        break;

      case GameState.PLAYING:
        this.matchTime += delta;
        this.updateGame(room, delta);

        if (this.matchTime >= this.MATCH_DURATION) {
          this.state = GameState.ENDED;
        }
        break;
    }
  }

  shouldEndRoom(room: Room<Player>): boolean {
    return this.state === GameState.ENDED;
  }
}
```

---

## 4. Server Setup

### 4.1 Basic Server

```typescript
import { Server } from 'socket.io';
import { GameServer, Entity, MoveCommand } from '@gamerstake/game-core';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const io = new Server(PORT, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const gameServer = new GameServer();
gameServer.setServer(io);

const room = gameServer.createRoom('lobby', new MyGameRules(), {
  tickRate: 20,
  cellSize: 512,
  maxEntities: 1000,
});

io.on('connection', (socket) => {
  const playerId = socket.id;

  // Create and add player
  const player = new Entity(playerId, 0, 0);
  room.addPlayer(player);
  room.getNetwork().registerSocket(playerId, socket);

  // Send initial state
  socket.emit('S_INIT', {
    op: 'S_INIT',
    playerId,
    ...room.getSnapshot(),
  });

  // Register input handlers
  socket.on('C_MOVE', (data) => {
    room.queueInput(playerId, {
      seq: data.seq,
      type: 'move',
      dir: data.dir,
      timestamp: Date.now(),
    } as MoveCommand);
  });

  socket.on('C_STOP', (data) => {
    room.queueInput(playerId, {
      seq: data.seq,
      type: 'stop',
      timestamp: Date.now(),
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    room.removePlayer(playerId);
    room.getNetwork().unregisterSocket(playerId);
  });
});

console.log(`Server running on port ${PORT}`);
```

---

## 5. Client Integration

### 5.1 Basic Client

```typescript
import { io, Socket } from 'socket.io-client';

class GameClient {
  private socket: Socket;
  private seq = 0;
  private playerId: string | null = null;
  private entities = new Map<string, EntityState>();

  constructor(url: string) {
    this.socket = io(url);
    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on('S_INIT', (data) => {
      this.playerId = data.playerId;
      data.entities.forEach((e: EntityState) => {
        this.entities.set(e.id, e);
      });
    });

    this.socket.on('S_UPDATE', (data) => {
      data.entities?.forEach((e: EntityState) => {
        this.entities.set(e.id, e);
      });
      data.deleted?.forEach((id: string) => {
        this.entities.delete(id);
      });
    });
  }

  move(dirX: number, dirY: number): void {
    this.socket.emit('C_MOVE', {
      seq: ++this.seq,
      dir: { x: dirX, y: dirY },
    });
  }

  stop(): void {
    this.socket.emit('C_STOP', { seq: ++this.seq });
  }
}
```

---

## 6. Custom Entities

### 6.1 Extended Player Entity

```typescript
import { Entity } from '@gamerstake/game-core';

export class Player extends Entity {
  health: number = 100;
  maxHealth: number = 100;
  score: number = 0;
  team: string;

  constructor(id: string, x: number, y: number, team: string = 'neutral') {
    super(id, x, y);
    this.team = team;
  }

  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.markDirty();
    return this.health <= 0; // Return true if died
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.markDirty();
  }

  isDead(): boolean {
    return this.health <= 0;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      health: this.health,
      score: this.score,
      team: this.team,
    };
  }
}
```

---

## 7. Custom Commands

### 7.1 Define Commands

```typescript
import type { Command } from '@gamerstake/game-core';

export interface ShootCommand extends Command {
  type: 'shoot';
  targetX: number;
  targetY: number;
}

export interface UseAbilityCommand extends Command {
  type: 'ability';
  abilityId: string;
  targetId?: string;
}
```

### 7.2 Handle Commands

```typescript
onCommand(room: Room<Player>, playerId: string, command: Command): void {
  const player = room.getRegistry().get(playerId);
  if (!player || player.isDead()) return;

  switch (command.type) {
    case 'move':
      this.handleMove(player, command as MoveCommand);
      break;

    case 'stop':
      player.setVelocity(0, 0);
      break;

    case 'shoot':
      this.handleShoot(room, player, command as ShootCommand);
      break;
  }
}
```

---

## 8. Common Patterns

### 8.1 Collision Detection

```typescript
import { AABBCollision, type AABB } from '@gamerstake/game-core';

class CollisionSystem {
  private collision = new AABBCollision();

  checkCollision(a: Entity, b: Entity): boolean {
    const aBox: AABB = { x: a.x - 16, y: a.y - 16, width: 32, height: 32 };
    const bBox: AABB = { x: b.x - 16, y: b.y - 16, width: 32, height: 32 };
    return this.collision.check(aBox, bBox);
  }
}
```

### 8.2 Using Spatial Grid

```typescript
onTick(room: Room, delta: number): void {
  room.getRegistry().forEach((player) => {
    // Find nearby entities efficiently
    const nearby = room.getGrid().getNearbyEntities(player.x, player.y, 200);

    nearby.forEach(id => {
      if (id === player.id) return;
      const other = room.getRegistry().get(id);
      if (other && this.checkCollision(player, other)) {
        // Handle collision
      }
    });
  });
}
```

---

## 9. Performance Best Practices

### 9.1 DO

```typescript
// Use forEach instead of Array.from
room.getRegistry().forEach((entity) => {
  // Process entity
});

// Use dirty flags
entity.setPosition(x, y); // Automatically marks dirty

// Use spatial grid for nearby queries
const nearby = room.getGrid().getNearbyEntities(x, y, range);
```

### 9.2 DON'T

```typescript
// DON'T allocate in hot paths
onTick(room: Room, delta: number): void {
  // BAD: Creates new array every tick
  const players = Array.from(room.getPlayers().values());
}

// DON'T do O(n²) every tick
for (const a of entities) {
  for (const b of entities) {
    // BAD: Check all pairs
  }
}

// DON'T forget to mark dirty
player.health -= damage; // BAD: Won't broadcast
player.markDirty();      // Need this!
```

---

**Previous:** [N2 - API Reference](./N2-api-reference.md)  
**Next:** [N4 - Testing & Validation](./N4-testing-validation.md)
