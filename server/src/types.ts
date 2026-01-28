/**
 * Mundo Cleaver - Type Definitions
 * Custom commands and types for the game
 */

// ==================== Command Types ====================

/**
 * Base command interface (matches game-core Command)
 */
export interface Command {
  seq: number;
  type: string;
  timestamp: number;
}

/**
 * Move command - player movement
 */
export interface MoveCommand extends Command {
  type: 'move';
  targetX: number;
  targetZ: number;
  actionId: number;
}

/**
 * Stop command - player stops moving
 */
export interface StopCommand extends Command {
  type: 'stop';
}

/**
 * Knife throw command
 */
export interface KnifeThrowCommand extends Command {
  type: 'knife_throw';
  targetX: number;
  targetZ: number;
  actionId: number;
  clientTimestamp: number;
}

// ==================== Game State Types ====================

/**
 * Team identifier
 */
export type TeamId = 1 | 2;

/**
 * Game mode
 */
export type GameMode = '1v1' | '3v3';

/**
 * Player spawn position
 */
export interface SpawnPosition {
  x: number;
  z: number;
  facing: number;
}

/**
 * Spawn positions for both teams
 */
export interface SpawnPositions {
  team1: SpawnPosition[];
  team2: SpawnPosition[];
}

/**
 * Knife state for network serialization
 */
export interface KnifeState {
  knifeId: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  throwerId: string;
  throwerTeam: TeamId;
  targetX: number;
  targetZ: number;
}

/**
 * Player state for network serialization
 */
export interface PlayerState {
  playerId: string;
  x: number;
  z: number;
  health: number;
  maxHealth: number;
  team: TeamId;
  isMoving: boolean;
  isDead: boolean;
  facing: number;
  rotation: number;
  targetX: number | null;
  targetZ: number | null;
}

/**
 * Full game state snapshot
 */
export interface GameSnapshot {
  tick: number;
  timestamp: number;
  players: PlayerState[];
  knives: KnifeState[];
  gameMode: GameMode;
  isRunning: boolean;
  winner: TeamId | null;
}

/**
 * Room configuration for Mundo Cleaver
 */
export interface MundoRoomConfig {
  gameMode: GameMode;
  maxPlayersPerTeam: number;
  playerHealth: number;
  knifeCooldownMs: number;
  knifeSpeed: number;
  playerMoveSpeed: number;
  hitRadius: number;
}

// ==================== Network Event Types ====================

/**
 * Server to client events
 */
export interface ServerEvents {
  S_INIT: {
    playerId: string;
    team: TeamId;
    roomCode: string;
    gameMode: GameMode;
    tick: number;
    timestamp: number;
    players: PlayerState[];
  };
  S_UPDATE: {
    tick: number;
    timestamp: number;
    players: PlayerState[];
    knives: KnifeState[];
    deleted?: string[];
  };
  serverGameState: {
    serverTick: number;
    serverTime: number;
    players: PlayerState[];
    knives: KnifeState[];
  };
  serverMoveAck: {
    actionId: number;
    playerId: string;
    x: number;
    z: number;
    targetX: number | null;
    targetZ: number | null;
    serverTime: number;
  };
  serverKnifeSpawn: {
    knifeId: string;
    x: number;
    z: number;
    targetX: number;
    targetZ: number;
    throwerId: string;
    throwerTeam: TeamId;
    serverTime: number;
  };
  serverKnifeHit: {
    knifeId: string;
    targetId: string;
    targetTeam: TeamId;
    newHealth: number;
    serverTime: number;
  };
  serverKnifeDestroy: {
    knifeId: string;
    reason: 'hit' | 'expired' | 'out_of_bounds';
  };
  serverHealthUpdate: {
    playerId: string;
    health: number;
    team: TeamId;
  };
  gameOver: {
    winner: TeamId;
    reason: string;
  };
  roomState: {
    roomCode: string;
    players: Array<{
      playerId: string;
      team: TeamId;
      isReady: boolean;
      isLoaded: boolean;
    }>;
    isHost: boolean;
  };
  allPlayersLoaded: {
    timestamp: number;
  };
  countdownStart: {
    countdownSeconds: number;
  };
  timeSyncPong: {
    clientTime: number;
    serverTime: number;
  };
}

/**
 * Client to server events
 */
export interface ClientEvents {
  createRoom: {
    gameMode: GameMode;
  };
  joinRoom: {
    roomCode: string;
  };
  playerReady: {
    roomCode: string;
  };
  playerLoaded: {
    roomCode: string;
  };
  startGame: {
    roomCode: string;
  };
  playerMove: {
    roomCode: string;
    targetX: number;
    targetZ: number;
    actionId: number;
    seq: number;
    clientTime: number;
  };
  knifeThrow: {
    roomCode: string;
    targetX: number;
    targetZ: number;
    actionId: number;
    clientTimestamp: number;
    clientSendTime: number;
  };
  timeSyncPing: {
    clientTime: number;
  };
  rejoinRoom: {
    roomCode: string;
    playerId: string;
  };
}

// ==================== Constants ====================

/**
 * Default game configuration
 */
export const DEFAULT_CONFIG: MundoRoomConfig = {
  gameMode: '1v1',
  maxPlayersPerTeam: 1,
  playerHealth: 5,
  knifeCooldownMs: 4000,
  knifeSpeed: 0.8,
  playerMoveSpeed: 0.39,
  hitRadius: 8.0
};

/**
 * Spawn positions for different game modes
 */
export const SPAWN_POSITIONS: Record<GameMode, SpawnPositions> = {
  '1v1': {
    team1: [{ x: -30, z: 0, facing: 1 }],
    team2: [{ x: 30, z: 0, facing: -1 }]
  },
  '3v3': {
    team1: [
      { x: -40, z: -20, facing: 1 },
      { x: -40, z: 0, facing: 1 },
      { x: -40, z: 20, facing: 1 }
    ],
    team2: [
      { x: 40, z: -20, facing: -1 },
      { x: 40, z: 0, facing: -1 },
      { x: 40, z: 20, facing: -1 }
    ]
  }
};

/**
 * Map boundaries
 */
export const MAP_BOUNDS = {
  minX: -80,
  maxX: 80,
  minZ: -50,
  maxZ: 50
};
