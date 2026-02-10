/**
 * Mundo Cleaver Game Server
 * Using @gamerstake/game-core SocketIOAdapter
 */

import { Server as SocketIOServer } from 'socket.io';
import { GameServer, SocketIOAdapter } from '@gamerstake/game-core';
import { Player } from './entities/Player.js';
import { MundoGameRules } from './MundoGameRules.js';
import {
  type GameMode,
  type MundoRoomConfig,
  SPAWN_POSITIONS,
  DEFAULT_CONFIG
} from './types.js';

// ==================== Configuration ====================

const PORT = parseInt(process.env.PORT || '3000', 10);

// ==================== Server Setup ====================

// Create Socket.io server
const io = new SocketIOServer(PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Create Game Server
const gameServer = new GameServer();

// Create and attach adapter
const adapter = new SocketIOAdapter(gameServer, {
  // Create game rules for a room
  createRules: (config: MundoRoomConfig) => {
    return new MundoGameRules(config);
  },

  // Create player entity
  createPlayer: (playerId: string, config: any) => {
    const player = new Player(
      playerId,
      config.spawn.x,
      config.spawn.z,
      config.team,
      config.playerIndex,
      {
        health: config.playerHealth,
        moveSpeed: config.playerMoveSpeed,
        knifeCooldown: config.knifeCooldownMs,
        facing: config.spawn.facing,
      }
    );
    player.socketId = playerId;
    player.isHost = config.isHost || false;
    return player;
  },

  // Create room configuration
  createRoomConfig: (gameMode: string) => {
    return {
      ...DEFAULT_CONFIG,
      gameMode: gameMode as GameMode,
      maxPlayersPerTeam: gameMode === '1v1' ? 1 : 3,
    } as MundoRoomConfig;
  },

  // Assign team and spawn position to player
  assignPlayerTeam: (room, config: MundoRoomConfig & { isHost?: boolean }) => {
    const players = room.getRegistry().getAll() as Player[];
    const team1Count = players.filter((p) => p.team === 1).length;
    const team2Count = players.filter((p) => p.team === 2).length;

    const team = config.isHost ? 1 : (team1Count <= team2Count ? 1 : 2);
    const playerIndex = team === 1 ? team1Count : team2Count;

    const spawnPositions = SPAWN_POSITIONS[config.gameMode];
    const teamSpawns = team === 1 ? spawnPositions.team1 : spawnPositions.team2;
    const spawn = teamSpawns[playerIndex] || teamSpawns[0];

    return { team, playerIndex, spawn };
  },

  // Room options
  roomOptions: {
    tickRate: 60, // 60 TPS = ~16.6ms per tick
    cellSize: 512,
    maxEntities: 100,
  },
});

// Attach adapter to Socket.IO server
adapter.attach(io);

// ==================== Start Server ====================

console.log(`
╔════════════════════════════════════════════════╗
║        MUNDO CLEAVER GAME SERVER               ║
║        Powered by @gamerstake/game-core        ║
║                                                ║
║  Port: ${PORT}                                    ║
║  Tick Rate: 60 TPS                             ║
║  Mode: SocketIOAdapter                         ║
╚════════════════════════════════════════════════╝
`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Terminating...');
  process.exit(0);
});
