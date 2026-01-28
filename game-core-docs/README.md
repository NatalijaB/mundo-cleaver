# @gamerstake/game-core - Package Documentation

> **For External Teams**  
> **Version:** 0.1.0  
> **Last Updated:** January 2026

---

## Welcome

This documentation package provides everything you need to integrate `@gamerstake/game-core` into your multiplayer game. The package is a battle-tested, high-performance multiplayer game engine that handles real-time networking, game loops, entity management, and state synchronization.

---

## Document Index

| Document                                                    | Description                                    | Audience      |
| ----------------------------------------------------------- | ---------------------------------------------- | ------------- |
| [N1 - Package Overview](./N1-package-overview.md)           | Executive summary, requirements, core concepts | Everyone      |
| [N2 - API Reference](./N2-api-reference.md)                 | Complete API documentation                     | Developers    |
| [N3 - Implementation Guide](./N3-implementation-guide.md)   | Step-by-step implementation tutorial           | Developers    |
| [N4 - Testing & Validation](./N4-testing-validation.md)     | Testing requirements and patterns              | QA/Developers |
| [N5 - Integration Checklist](./N5-integration-checklist.md) | Verification checklist for integration         | All Teams     |

---

## Quick Navigation

### Just Getting Started?

1. **Read** [N1 - Package Overview](./N1-package-overview.md) to understand what game-core provides
2. **Follow** [N3 - Implementation Guide](./N3-implementation-guide.md) Quick Start section
3. **Use** [N5 - Integration Checklist](./N5-integration-checklist.md) to verify your setup

### Need API Details?

- [N2 - API Reference](./N2-api-reference.md) has complete documentation for all exports

### Setting Up Testing?

- [N4 - Testing & Validation](./N4-testing-validation.md) covers unit tests, integration tests, and performance testing

---

## What game-core Provides

- **Fixed tick-rate game loop** (20 TPS with drift compensation)
- **Authoritative server architecture** (server is source of truth)
- **Client-server networking** (via Socket.io)
- **State synchronization** (full snapshots + delta updates)
- **Input buffering** (reliable command processing)
- **Entity management** (ECS-lite with dirty tracking)
- **Spatial partitioning** (grid-based O(1) queries)
- **Basic 2D physics** (velocity, position, AABB collision)

## What You Provide

- **Game rules** (implement the `GameRules` interface)
- **Game client** (render game state, send inputs)
- **Persistence** (optional - save/load game state)
- **Authentication** (optional - player identity)

---

## Minimum Example

```typescript
// 1. Implement GameRules
import { GameRules, Room, Entity, Command, MoveCommand } from '@gamerstake/game-core';

class MyGameRules implements GameRules {
  onRoomCreated(room: Room): void {}
  onPlayerJoin(room: Room, player: Entity): void {
    player.setPosition(Math.random() * 800, Math.random() * 600);
  }
  onPlayerLeave(room: Room, playerId: string): void {}
  onTick(room: Room, delta: number): void {
    room.getRegistry().forEach((e) => e.updatePosition(delta));
  }
  onCommand(room: Room, playerId: string, command: Command): void {
    const player = room.getRegistry().get(playerId);
    if (!player) return;
    if (command.type === 'move') {
      const { dir } = command as MoveCommand;
      player.setVelocity(dir.x * 200, dir.y * 200);
    }
  }
  shouldEndRoom(room: Room): boolean {
    return false;
  }
}

// 2. Create server
import { Server } from 'socket.io';
import { GameServer, Entity } from '@gamerstake/game-core';

const io = new Server(3000);
const gameServer = new GameServer();
gameServer.setServer(io);

const room = gameServer.createRoom('main', new MyGameRules());

io.on('connection', (socket) => {
  const player = new Entity(socket.id, 0, 0);
  room.addPlayer(player);
  room.getNetwork().registerSocket(socket.id, socket);

  socket.emit('S_INIT', { playerId: socket.id, ...room.getSnapshot() });

  socket.on('C_MOVE', (data) => {
    room.queueInput(socket.id, { ...data, type: 'move', timestamp: Date.now() });
  });

  socket.on('disconnect', () => {
    room.removePlayer(socket.id);
    room.getNetwork().unregisterSocket(socket.id);
  });
});
```

---

## Version History

| Version | Date         | Changes         |
| ------- | ------------ | --------------- |
| 0.1.0   | January 2026 | Initial release |

---

## Support

For questions or issues, contact the GamerStake engineering team.

---

**Start with:** [N1 - Package Overview](./N1-package-overview.md)
