# N5: Integration Checklist

> Version: 0.1.0

## Phase 1: Environment Setup

### Prerequisites

- [ ] Node.js 20+ installed
- [ ] pnpm available
- [ ] TypeScript installed

### Installation

```bash
pnpm add @gamerstake/game-core socket.io
pnpm add -D typescript @types/node tsx
```

## Phase 2: Implementation

### GameRules Checklist

- [ ] onRoomCreated implemented
- [ ] onPlayerJoin implemented
- [ ] onPlayerLeave implemented
- [ ] onTick implemented
- [ ] onCommand implemented
- [ ] shouldEndRoom implemented

### Server Checklist

- [ ] Socket.io server created
- [ ] GameServer instance created
- [ ] Room created with config
- [ ] Connection handler with addPlayer
- [ ] C_MOVE and C_STOP handlers
- [ ] Disconnect handler with removePlayer

## Phase 3: Testing

### Unit Tests

- [ ] Entity tests passing
- [ ] Room tests passing
- [ ] GameRules tests passing

### Manual Tests

- [ ] Server starts
- [ ] Client connects
- [ ] Movement works
- [ ] Multiple players work
- [ ] Disconnect handled

## Phase 4: Verification

| Feature               | Pass |
| --------------------- | ---- |
| S_INIT received       | [ ]  |
| S_UPDATE received     | [ ]  |
| Movement works        | [ ]  |
| Other players visible | [ ]  |

### Performance

- [ ] Avg tick < 40ms
- [ ] Max tick < 50ms
- [ ] 20 TPS maintained

## Phase 5: Production

- [ ] Error handling added
- [ ] Graceful shutdown
- [ ] Input validation
- [ ] Logging configured

## Sign-Off

| Phase          | Complete |
| -------------- | -------- |
| Environment    | [ ]      |
| Implementation | [ ]      |
| Testing        | [ ]      |
| Verification   | [ ]      |
| Production     | [ ]      |

---

**Previous:** [N4 - Testing](./N4-testing-validation.md)
