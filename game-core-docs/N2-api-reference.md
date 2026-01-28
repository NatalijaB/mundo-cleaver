# N2: @gamerstake/game-core - API Reference

> **Version:** 0.1.0  
> **Last Updated:** January 2026

---

## Table of Contents

1. [Core Systems](#1-core-systems)
2. [Entity System](#2-entity-system)
3. [Spatial System](#3-spatial-system)
4. [Physics System](#4-physics-system)
5. [Input System](#5-input-system)
6. [Network System](#6-network-system)
7. [Utilities](#7-utilities)
8. [Types](#8-types)

---

## 1. Core Systems

### 1.1 GameServer

Multi-room server manager. Handles room lifecycle and provides aggregated metrics.

```typescript
import { GameServer } from '@gamerstake/game-core';

const gameServer = new GameServer();
```

#### Methods

| Method         | Signature                                                   | Description                      |
| -------------- | ----------------------------------------------------------- | -------------------------------- |
| `setServer`    | `(io: SocketServer): void`                                  | Attach Socket.io server instance |
| `createRoom`   | `(id: string, rules: GameRules, config?: RoomConfig): Room` | Create a new room                |
| `destroyRoom`  | `(id: string): boolean`                                     | Destroy a room and cleanup       |
| `getRoom`      | `(id: string): Room \| undefined`                           | Get room by ID                   |
| `hasRoom`      | `(id: string): boolean`                                     | Check if room exists             |
| `getRoomCount` | `(): number`                                                | Get total room count             |
| `getMetrics`   | `(): ServerMetrics`                                         | Get aggregated server metrics    |

#### Example

```typescript
const io = new Server(3000);
const gameServer = new GameServer();
gameServer.setServer(io);

const room = gameServer.createRoom('lobby', new LobbyRules(), {
  tickRate: 20,
  cellSize: 512,
});

// Later...
gameServer.destroyRoom('lobby');
```

---

### 1.2 Room

A single game instance (match, level, world). Orchestrates all game systems.

#### Constructor

```typescript
constructor(id: string, rules: GameRules<TEntity>, config?: RoomConfig)
```

#### Properties

| Property | Type        | Description                       |
| -------- | ----------- | --------------------------------- |
| `id`     | `string`    | Unique room identifier (readonly) |
| `rules`  | `GameRules` | Game-specific logic (readonly)    |

#### Lifecycle Methods

| Method      | Signature     | Description             |
| ----------- | ------------- | ----------------------- |
| `start`     | `(): void`    | Start the tick loop     |
| `stop`      | `(): void`    | Stop the tick loop      |
| `isRunning` | `(): boolean` | Check if room is active |

#### Player Management

| Method         | Signature                  | Description             |
| -------------- | -------------------------- | ----------------------- |
| `addPlayer`    | `(entity: TEntity): void`  | Add player to room      |
| `removePlayer` | `(playerId: string): void` | Remove player from room |
| `getPlayers`   | `(): Map<string, TEntity>` | Get all players         |

#### Entity Management

| Method          | Signature                  | Description           |
| --------------- | -------------------------- | --------------------- |
| `spawnEntity`   | `(entity: TEntity): void`  | Add non-player entity |
| `destroyEntity` | `(entityId: string): void` | Remove any entity     |
| `getRegistry`   | `(): Registry<TEntity>`    | Get entity registry   |

#### Input & Networking

| Method       | Signature                                       | Description              |
| ------------ | ----------------------------------------------- | ------------------------ |
| `queueInput` | `(playerId: string, command: Command): void`    | Queue player input       |
| `broadcast`  | `(event: NetworkEvent): void`                   | Broadcast to all players |
| `sendTo`     | `(playerId: string, event: NetworkEvent): void` | Send to specific player  |
| `getNetwork` | `(): Network`                                   | Get network layer        |

#### State & Metrics

| Method             | Signature                  | Description             |
| ------------------ | -------------------------- | ----------------------- |
| `getSnapshot`      | `(): StateSnapshot`        | Get full state snapshot |
| `getDeltaSnapshot` | `(): DeltaSnapshot`        | Get dirty entities only |
| `getGrid`          | `(): Grid`                 | Get spatial grid        |
| `getTickCount`     | `(): number`               | Get current tick number |
| `getUptime`        | `(): number`               | Get uptime in ms        |
| `getConfig`        | `(): Required<RoomConfig>` | Get room configuration  |
| `getMetrics`       | `(): RoomMetrics`          | Get room metrics        |

---

### 1.3 GameLoop

Fixed tick-rate game loop with drift compensation.

```typescript
import { GameLoop } from '@gamerstake/game-core';

const loop = new GameLoop(20); // 20 TPS
```

#### Methods

| Method          | Signature                      | Description             |
| --------------- | ------------------------------ | ----------------------- |
| `addHandler`    | `(handler: TickHandler): void` | Register tick handler   |
| `removeHandler` | `(handler: TickHandler): void` | Unregister tick handler |
| `start`         | `(): void`                     | Start the loop          |
| `stop`          | `(): void`                     | Stop the loop           |
| `isRunning`     | `(): boolean`                  | Check if running        |
| `getMetrics`    | `(): LoopMetrics`              | Get performance metrics |

---

### 1.4 GameRules Interface

The interface you must implement for your game logic.

```typescript
interface GameRules<TEntity extends Entity = Entity> {
  onRoomCreated(room: Room<TEntity>): void;
  onPlayerJoin(room: Room<TEntity>, player: TEntity): void;
  onPlayerLeave(room: Room<TEntity>, playerId: string): void;
  onTick(room: Room<TEntity>, delta: number): void;
  onCommand(room: Room<TEntity>, playerId: string, command: Command): void;
  shouldEndRoom(room: Room<TEntity>): boolean;
}
```

---

## 2. Entity System

### 2.1 Entity

Base class for all game objects.

```typescript
import { Entity } from '@gamerstake/game-core';

const entity = new Entity('player-1', 100, 200);
```

#### Constructor

```typescript
constructor(id: string, x: number, y: number)
```

#### Properties

| Property     | Type      | Description                  |
| ------------ | --------- | ---------------------------- |
| `id`         | `string`  | Unique identifier (readonly) |
| `x`          | `number`  | World X position             |
| `y`          | `number`  | World Y position             |
| `vx`         | `number`  | Velocity X (units/second)    |
| `vy`         | `number`  | Velocity Y (units/second)    |
| `dirty`      | `boolean` | Needs broadcast flag         |
| `lastUpdate` | `number`  | Last update timestamp        |

#### Methods

| Method           | Signature                        | Description           |
| ---------------- | -------------------------------- | --------------------- |
| `setPosition`    | `(x: number, y: number): void`   | Teleport to position  |
| `setVelocity`    | `(vx: number, vy: number): void` | Set velocity          |
| `updatePosition` | `(deltaMs: number): void`        | Integrate velocity    |
| `markDirty`      | `(): void`                       | Mark for broadcast    |
| `markClean`      | `(): void`                       | Clear dirty flag      |
| `toJSON`         | `(): object`                     | Serialize for network |

#### Extending Entity

```typescript
class Player extends Entity {
  health = 100;
  score = 0;
  team: string;

  constructor(id: string, x: number, y: number, team: string) {
    super(id, x, y);
    this.team = team;
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.markDirty(); // Important!
  }

  toJSON(): object {
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

### 2.2 Registry

Entity lifecycle management with dirty tracking.

```typescript
const registry = room.getRegistry();
```

#### Methods

| Method       | Signature                               | Description           |
| ------------ | --------------------------------------- | --------------------- |
| `add`        | `(entity: TEntity): void`               | Add entity            |
| `remove`     | `(id: string): boolean`                 | Remove entity         |
| `get`        | `(id: string): TEntity \| undefined`    | Get by ID             |
| `has`        | `(id: string): boolean`                 | Check exists          |
| `forEach`    | `(fn: (entity: TEntity) => void): void` | Iterate all           |
| `size`       | `(): number`                            | Total count           |
| `getDirty`   | `(): TEntity[]`                         | Get dirty entities    |
| `dirtyCount` | `(): number`                            | Count dirty           |
| `clearDirty` | `(): void`                              | Clear all dirty flags |

---

## 3. Spatial System

### 3.1 Grid

Spatial partitioning for efficient queries.

```typescript
const grid = room.getGrid();
```

#### Methods

| Method              | Signature                                  | Description        |
| ------------------- | ------------------------------------------ | ------------------ |
| `addEntity`         | `(id: string, x: number, y: number): void` | Add to grid        |
| `removeEntity`      | `(id: string): void`                       | Remove from grid   |
| `moveEntity`        | `(id, oldX, oldY, newX, newY): void`       | Update position    |
| `getNearbyEntities` | `(x, y, range): Set<string>`               | Query nearby IDs   |
| `getEntitiesInCell` | `(cellX, cellY): Set<string>`              | Get cell contents  |
| `getCellCount`      | `(): number`                               | Active cells count |
| `getEntityCount`    | `(): number`                               | Total entities     |
| `clear`             | `(): void`                                 | Clear all          |

---

## 4. Physics System

### 4.1 AABBCollision

Axis-Aligned Bounding Box collision detection.

```typescript
import { AABBCollision, type AABB } from '@gamerstake/game-core';

const collision = new AABBCollision();
```

#### AABB Interface

```typescript
interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

#### Methods

| Method       | Signature                            | Description        |
| ------------ | ------------------------------------ | ------------------ |
| `check`      | `(a: AABB, b: AABB): boolean`        | Check intersection |
| `getOverlap` | `(a: AABB, b: AABB): {x, y} \| null` | Get overlap vector |

---

### 4.2 Movement

Velocity integration with boundary constraints.

```typescript
import { Movement, type Boundary } from '@gamerstake/game-core';

const movement = new Movement();
```

#### Methods

| Method                | Signature                           | Description        |
| --------------------- | ----------------------------------- | ------------------ |
| `integrate`           | `(entity, deltaMs): void`           | Apply velocity     |
| `clamp`               | `(entity, boundary): void`          | Constrain position |
| `integrateWithBounds` | `(entity, deltaMs, boundary): void` | Both               |

---

## 5. Input System

### 5.1 Command Types

```typescript
// Base command
interface Command {
  seq: number; // Sequence number
  type: string; // Command type
  timestamp: number; // Creation time
}

// Movement command
interface MoveCommand extends Command {
  type: 'move';
  dir: { x: number; y: number };
}

// Stop command
interface StopCommand extends Command {
  type: 'stop';
}

// Generic action
interface ActionCommand extends Command {
  type: 'action';
  action: string;
  data?: Record<string, unknown>;
}
```

### 5.2 InputQueue

Buffered input processing.

#### Methods

| Method         | Signature                      | Description          |
| -------------- | ------------------------------ | -------------------- |
| `push`         | `(playerId, command): boolean` | Queue input          |
| `drain`        | `(playerId): Command[]`        | Get and clear inputs |
| `drainAll`     | `(): Map<string, Command[]>`   | Get all inputs       |
| `clear`        | `(playerId): void`             | Clear player queue   |
| `clearAll`     | `(): void`                     | Clear all queues     |
| `getSize`      | `(playerId): number`           | Queue size           |
| `getTotalSize` | `(): number`                   | Total queued         |

---

## 6. Network System

### 6.1 Network

Socket.io abstraction layer.

#### Methods

| Method             | Signature                         | Description       |
| ------------------ | --------------------------------- | ----------------- |
| `registerSocket`   | `(playerId, socket): void`        | Register socket   |
| `unregisterSocket` | `(playerId): void`                | Unregister socket |
| `broadcast`        | `(event): void`                   | Send to all       |
| `sendTo`           | `(playerId, event): void`         | Send to one       |
| `getSocket`        | `(playerId): Socket \| undefined` | Get socket        |
| `getPlayerCount`   | `(): number`                      | Connected count   |

---

### 6.2 Snapshot

State serialization for network sync.

#### Static Methods

| Method        | Signature                              | Description   |
| ------------- | -------------------------------------- | ------------- |
| `createFull`  | `(tick, entities): StateSnapshot`      | Full snapshot |
| `createDelta` | `(tick, dirtyEntities): DeltaSnapshot` | Delta only    |

---

## 7. Utilities

### 7.1 Logger

```typescript
import { logger, createChildLogger } from '@gamerstake/game-core';

logger.info('Game started');
logger.error({ err }, 'Connection failed');

const roomLogger = createChildLogger({ roomId: 'room-1' });
```

### 7.2 RingBuffer

Fixed-size circular buffer.

```typescript
import { RingBuffer } from '@gamerstake/game-core';

const buffer = new RingBuffer<Command>(100);
buffer.push(command);
const items = buffer.drain();
```

---

## 8. Types

### 8.1 Configuration Types

```typescript
interface RoomConfig {
  tickRate?: number; // Default: 20
  cellSize?: number; // Default: 512
  maxInputQueueSize?: number; // Default: 100
  maxEntities?: number; // Default: 1000
  visibilityRange?: number; // Default: 1
}
```

### 8.2 Metrics Types

```typescript
interface ServerMetrics {
  roomCount: number;
  totalPlayers: number;
  rooms: RoomMetrics[];
}

interface RoomMetrics {
  id: string;
  playerCount: number;
  entityCount: number;
  tickCount: number;
  isRunning: boolean;
  avgTickTime?: number;
  ticksPerSecond?: number;
}
```

### 8.3 Network Types

```typescript
interface NetworkEvent {
  op: string;
  [key: string]: unknown;
}

interface StateSnapshot {
  tick: number;
  entities: EntitySnapshot[];
  timestamp: number;
}
```

---

**Previous:** [N1 - Package Overview](./N1-package-overview.md)  
**Next:** [N3 - Implementation Guide](./N3-implementation-guide.md)
