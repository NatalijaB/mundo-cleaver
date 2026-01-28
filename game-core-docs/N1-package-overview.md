# N1: @gamerstake/game-core - Package Overview & Requirements

> **Version:** 0.1.0  
> **Status:** Production Ready  
> **Last Updated:** January 2026

---

## 1. Executive Summary

`@gamerstake/game-core` is a **game-agnostic multiplayer game engine** designed for real-time multiplayer games. It provides battle-tested infrastructure for:

- Fixed tick-rate game loops (20 TPS default)
- Authoritative server architecture
- Client-server networking via Socket.io
- Entity management with dirty-flag tracking
- Spatial partitioning for efficient queries
- Input buffering and command processing

**Your responsibility:** Implement the `GameRules` interface to create your game logic.

---

## 2. System Requirements

### 2.1 Runtime Requirements

| Requirement | Minimum | Recommended |
| ----------- | ------- | ----------- |
| Node.js     | 20.0.0+ | 22.x LTS    |
| Memory      | 256 MB  | 512 MB+     |
| CPU         | 1 core  | 2+ cores    |

### 2.2 Dependencies

**Core Dependencies (included):**

- `socket.io` ^4.7.4 - WebSocket communication
- `pino` ^9.0.0 - Structured logging
- `zod` ^3.22.4 - Runtime validation

**Dev Dependencies (for testing):**

- `typescript` ^5.3.3
- `jest` ^29.7.0
- `ts-jest` ^29.1.2

---

## 3. Installation

### 3.1 From NPM Registry

```bash
# Using pnpm (recommended)
pnpm add @gamerstake/game-core socket.io

# Using npm
npm install @gamerstake/game-core socket.io

# Using yarn
yarn add @gamerstake/game-core socket.io
```

### 3.2 From Monorepo (Internal)

```json
{
  "dependencies": {
    "@gamerstake/game-core": "workspace:*"
  }
}
```

---

## 4. Package Exports

The package exports the following modules:

```typescript
// Core Systems
export { GameServer } from './core/GameServer';
export { Room } from './core/Room';
export { GameLoop } from './core/GameLoop';
export type { GameRules } from './core/GameRules';

// Entities
export { Entity } from './entities/Entity';
export { Registry } from './entities/Registry';

// Spatial Partitioning
export { Grid } from './spatial/Grid';

// Physics
export { AABBCollision, type AABB } from './physics/AABB';
export { Movement, type Boundary } from './physics/Movement';

// Input Processing
export { InputQueue } from './input/InputQueue';
export type { Command, MoveCommand, StopCommand, ActionCommand } from './input/Command';

// Networking
export { Network } from './network/Network';
export { Snapshot } from './network/Snapshot';

// Utilities
export { RingBuffer } from './utils/RingBuffer';
export { Logger, logger, setLogger, createChildLogger } from './utils/Logger';

// Types
export * from './types/index';
export * from './types/protocol';
```

---

## 5. Core Concepts

### 5.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        GameServer                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                         Room                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │ │
│  │  │ GameLoop │  │ Registry │  │   Grid   │  │ Network │ │ │
│  │  │ (20 TPS) │  │(Entities)│  │ (Spatial)│  │(Socket) │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │ │
│  │  ┌──────────┐  ┌─────────────────────────────────────┐ │ │
│  │  │InputQueue│  │            GameRules                │ │ │
│  │  │ (Buffer) │  │         (YOUR GAME LOGIC)           │ │ │
│  │  └──────────┘  └─────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│  │ Room 2  │ │ Room 3  │ │ Room N  │ ...                    │
│  └─────────┘ └─────────┘ └─────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow (Per Tick)

```
Client                              Server
   │                                   │
   │  C_MOVE (input)                   │
   │ ─────────────────────────────────>│
   │                                   │ [InputQueue]
   │                                   │      │
   │                                   │ [GameLoop.onTick]
   │                                   │   │
   │                                   │   ├─ Process inputs (onCommand)
   │                                   │   ├─ Update state (onTick)
   │                                   │   ├─ Check end condition
   │                                   │   └─ Broadcast deltas
   │                                   │
   │                  S_UPDATE (state) │
   │ <─────────────────────────────────│
   │                                   │
```

### 5.3 Tick Cycle (50ms @ 20 TPS)

1. **Process Inputs** - Drain InputQueue, call `onCommand` for each
2. **Update State** - Call `onTick` with delta time
3. **Check End** - Call `shouldEndRoom`
4. **Broadcast** - Send delta snapshot to all clients
5. **Sleep** - Wait until next tick

---

## 6. GameRules Interface (Required Implementation)

The `GameRules` interface is the **core abstraction** you must implement:

```typescript
interface GameRules<TEntity extends Entity = Entity> {
  /**
   * Called once when room is created.
   * Use for initialization (spawn items, set boundaries, etc).
   */
  onRoomCreated(room: Room<TEntity>): void;

  /**
   * Called when a player joins the room.
   */
  onPlayerJoin(room: Room<TEntity>, player: TEntity): void;

  /**
   * Called when a player leaves the room.
   */
  onPlayerLeave(room: Room<TEntity>, playerId: string): void;

  /**
   * Called every tick (20 TPS by default).
   * Process inputs, update game state, check win conditions.
   */
  onTick(room: Room<TEntity>, delta: number): void;

  /**
   * Called when a player sends a command.
   */
  onCommand(room: Room<TEntity>, playerId: string, command: Command): void;

  /**
   * Check if the room should be destroyed.
   * Return true for match-based games when match ends.
   * Return false for persistent worlds.
   */
  shouldEndRoom(room: Room<TEntity>): boolean;
}
```

---

## 7. Configuration Options

### 7.1 RoomConfig

```typescript
interface RoomConfig {
  /** Ticks per second (default: 20) */
  tickRate?: number;

  /** Grid cell size in world units (default: 512) */
  cellSize?: number;

  /** Maximum buffered inputs per player (default: 100) */
  maxInputQueueSize?: number;

  /** Maximum entities per room (default: 1000) */
  maxEntities?: number;

  /** Visibility range in grid cells (default: 1 = 3x3 area) */
  visibilityRange?: number;
}
```

### 7.2 Recommended Settings by Game Type

| Game Type   | tickRate | cellSize | maxEntities |
| ----------- | -------- | -------- | ----------- |
| Action/FPS  | 20-30    | 256      | 500         |
| MOBA/Arena  | 20       | 512      | 200         |
| MMO Zone    | 10-15    | 1024     | 1000        |
| Casual/Turn | 5-10     | 512      | 100         |

---

## 8. Performance Guarantees

### 8.1 Benchmarks

| Metric        | Target | Verified |
| ------------- | ------ | -------- |
| Tick Rate     | 20 TPS | Yes      |
| Avg Tick Time | < 40ms | Yes      |
| Max Tick Time | < 50ms | Yes      |
| Entities/Room | 100+   | Yes      |
| Spatial Query | O(1)   | Yes      |

### 8.2 Optimizations Included

- **Dirty Flag Tracking** - Only broadcast changed entities
- **Buffer Reuse** - Zero allocations in hot paths
- **RingBuffer** - O(1) input queue operations
- **Spatial Grid** - Avoid O(n²) collision checks

---

## 9. Support & Resources

### 9.1 Documentation

| Document                    | Purpose                     |
| --------------------------- | --------------------------- |
| N1-package-overview.md      | This document               |
| N2-api-reference.md         | Complete API documentation  |
| N3-implementation-guide.md  | Step-by-step implementation |
| N4-testing-validation.md    | Testing requirements        |
| N5-integration-checklist.md | Verification checklist      |

### 9.2 Examples

- `examples/simple-game/` - Complete working example
- `tests/` - Unit test patterns

### 9.3 Contact

For questions or issues, contact the GamerStake engineering team.

---

## 10. Version History

| Version | Date     | Changes         |
| ------- | -------- | --------------- |
| 0.1.0   | Jan 2026 | Initial release |

---

**Next:** [N2 - API Reference](./N2-api-reference.md)
