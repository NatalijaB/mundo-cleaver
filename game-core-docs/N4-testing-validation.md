# N4: @gamerstake/game-core - Testing & Validation Guide

> **Version:** 0.1.0  
> **Last Updated:** January 2026

---

## Table of Contents

1. [Testing Overview](#1-testing-overview)
2. [Unit Testing](#2-unit-testing)
3. [Integration Testing](#3-integration-testing)
4. [Manual Testing](#4-manual-testing)
5. [Performance Testing](#5-performance-testing)
6. [Coverage Requirements](#6-coverage-requirements)
7. [Validation Checklist](#7-validation-checklist)

---

## 1. Testing Overview

### 1.1 Testing Stack

| Tool             | Purpose                  |
| ---------------- | ------------------------ |
| Jest             | Test runner & assertions |
| ts-jest          | TypeScript support       |
| socket.io-client | Client mocking           |

### 1.2 Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch

# Type checking
pnpm typecheck
```

---

## 2. Unit Testing

### 2.1 Entity Tests

```typescript
import { describe, it, expect } from '@jest/globals';
import { Entity } from '@gamerstake/game-core';

describe('Entity', () => {
  it('creates entity with initial position', () => {
    const entity = new Entity('test-1', 100, 200);

    expect(entity.id).toBe('test-1');
    expect(entity.x).toBe(100);
    expect(entity.y).toBe(200);
    expect(entity.dirty).toBe(true);
  });

  it('updates position based on velocity', () => {
    const entity = new Entity('test-1', 0, 0);
    entity.setVelocity(100, 50);

    entity.updatePosition(1000); // 1 second

    expect(entity.x).toBe(100);
    expect(entity.y).toBe(50);
  });

  it('marks dirty when position changes', () => {
    const entity = new Entity('test-1', 0, 0);
    entity.markClean();

    entity.setPosition(10, 20);

    expect(entity.dirty).toBe(true);
  });
});
```

### 2.2 Room Tests

```typescript
import { describe, it, expect, jest } from '@jest/globals';
import { Room, Entity, GameRules } from '@gamerstake/game-core';

const createMockRules = (): GameRules<Entity> => ({
  onRoomCreated: jest.fn(),
  onPlayerJoin: jest.fn(),
  onPlayerLeave: jest.fn(),
  onTick: jest.fn(),
  onCommand: jest.fn(),
  shouldEndRoom: jest.fn(() => false),
});

describe('Room', () => {
  it('adds and removes players', () => {
    const rules = createMockRules();
    const room = new Room('room-1', rules);
    const player = new Entity('p1', 0, 0);

    room.addPlayer(player);
    expect(rules.onPlayerJoin).toHaveBeenCalledWith(room, player);
    expect(room.getRegistry().has('p1')).toBe(true);

    room.removePlayer('p1');
    expect(rules.onPlayerLeave).toHaveBeenCalledWith(room, 'p1');
    expect(room.getRegistry().has('p1')).toBe(false);
  });

  it('processes input commands on tick', () => {
    const rules = createMockRules();
    const room = new Room('room-1', rules);
    const player = new Entity('p1', 0, 0);
    room.addPlayer(player);

    room.queueInput('p1', {
      seq: 1,
      type: 'move',
      dir: { x: 1, y: 0 },
      timestamp: Date.now(),
    });

    room.onTick(1, 50);

    expect(rules.onCommand).toHaveBeenCalledTimes(1);
    expect(rules.onTick).toHaveBeenCalledTimes(1);
  });
});
```

### 2.3 Custom Entity Tests

```typescript
describe('Player Entity', () => {
  it('handles damage correctly', () => {
    const player = new Player('p1', 0, 0, 'blue');
    player.health = 100;

    const died = player.takeDamage(30);

    expect(player.health).toBe(70);
    expect(died).toBe(false);
    expect(player.dirty).toBe(true);
  });

  it('detects death', () => {
    const player = new Player('p1', 0, 0, 'blue');
    player.health = 20;

    const died = player.takeDamage(50);

    expect(player.health).toBe(0);
    expect(died).toBe(true);
  });
});
```

---

## 3. Integration Testing

### 3.1 GameServer Integration

```typescript
describe('GameServer Integration', () => {
  it('manages multiple rooms', () => {
    const server = new GameServer();
    const rules = createMockRules();

    const room1 = server.createRoom('room-1', rules);
    const room2 = server.createRoom('room-2', rules);

    expect(server.getRoomCount()).toBe(2);
    expect(server.getRoom('room-1')).toBe(room1);
  });

  it('prevents duplicate room IDs', () => {
    const server = new GameServer();
    const rules = createMockRules();

    server.createRoom('room-1', rules);

    expect(() => server.createRoom('room-1', rules)).toThrow('already exists');
  });

  it('provides aggregated metrics', () => {
    const server = new GameServer();
    const rules = createMockRules();

    const room1 = server.createRoom('room-1', rules);
    room1.addPlayer(new Entity('p1', 0, 0));
    room1.addPlayer(new Entity('p2', 0, 0));

    const metrics = server.getMetrics();

    expect(metrics.roomCount).toBe(1);
    expect(metrics.totalPlayers).toBe(2);
  });
});
```

---

## 4. Manual Testing

### 4.1 Setup

```bash
# Build the package
cd packages/game-core
pnpm build

# Start test server
node examples/simple-game/server.js

# In another terminal, start client
node examples/simple-game/client.js
```

### 4.2 Test Scenarios

| Scenario     | Steps                      | Expected Result               |
| ------------ | -------------------------- | ----------------------------- |
| Connection   | Start server, start client | "Connected! Player ID: xxx"   |
| Movement     | Connect, wait 1s           | Position updates logged       |
| Multi-player | Start 3+ clients           | All clients see each other    |
| Disconnect   | Kill client (Ctrl+C)       | Server logs "Player xxx left" |

### 4.3 Manual Testing Checklist

```markdown
## Connection Tests

- [ ] Single client connects successfully
- [ ] Multiple clients connect simultaneously
- [ ] Client receives S_INIT with player ID

## Movement Tests

- [ ] Player moves when C_MOVE sent
- [ ] Player stops when C_STOP sent
- [ ] Position updates broadcast to all clients

## Disconnection Tests

- [ ] Client disconnect handled gracefully
- [ ] Other clients notified of disconnect
- [ ] Server continues running after disconnect
```

---

## 5. Performance Testing

### 5.1 Benchmark Setup

```typescript
async function runBenchmark(entityCount: number, iterations: number) {
  const room = new Room('benchmark', new BenchmarkRules(), { cellSize: 512 });

  // Spawn entities
  for (let i = 0; i < entityCount; i++) {
    const entity = new Entity(`e${i}`, Math.random() * 1000, Math.random() * 1000);
    entity.setVelocity(Math.random() * 100, Math.random() * 100);
    room.spawnEntity(entity);
  }

  // Benchmark
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    room.onTick(i, 50);
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`Entities: ${entityCount}, Avg tick: ${avg.toFixed(2)}ms`);
}
```

### 5.2 Performance Criteria

| Metric                  | Pass   | Warn     | Fail    |
| ----------------------- | ------ | -------- | ------- |
| Avg tick (100 entities) | < 10ms | 10-30ms  | > 30ms  |
| Avg tick (500 entities) | < 25ms | 25-40ms  | > 40ms  |
| Max tick                | < 50ms | 50-100ms | > 100ms |

---

## 6. Coverage Requirements

### 6.1 Minimum Coverage

```javascript
// jest.config.ts
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

### 6.2 Coverage by Module

| Module     | Target |
| ---------- | ------ |
| Entity     | 90%    |
| Registry   | 85%    |
| Room       | 85%    |
| GameServer | 80%    |
| Grid       | 80%    |
| InputQueue | 85%    |
| Network    | 75%    |

---

## 7. Validation Checklist

### 7.1 Pre-Release Validation

```markdown
## Code Quality

- [ ] All unit tests passing
- [ ] Coverage >= 80%
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Build succeeds

## Integration Tests

- [ ] GameServer manages rooms correctly
- [ ] Room tick cycle works
- [ ] Player join/leave handled
- [ ] Input processing works
- [ ] State broadcasting works

## Manual Testing

- [ ] Connection test passed
- [ ] Movement test passed
- [ ] Multi-player test passed
- [ ] Disconnection test passed

## Performance

- [ ] Avg tick < 40ms (100 entities)
- [ ] Max tick < 50ms
- [ ] No memory leaks
- [ ] 20 TPS maintained under load
```

### 7.2 Integration Validation

```markdown
## Setup Validation

- [ ] Package installed correctly
- [ ] Imports working
- [ ] TypeScript types available

## Implementation Validation

- [ ] GameRules implemented completely
- [ ] All callbacks implemented
- [ ] Custom entities serialize correctly

## Runtime Validation

- [ ] Room starts and ticks
- [ ] Players can join
- [ ] Inputs processed correctly
- [ ] State synchronized
```

---

**Previous:** [N3 - Implementation Guide](./N3-implementation-guide.md)  
**Next:** [N5 - Integration Checklist](./N5-integration-checklist.md)
