/**
 * Mundo Cleaver Game Server
 * Main entry point implementing @gamerstake/game-core patterns
 */

import { Server, Socket } from 'socket.io';
import { Player } from './entities/Player.js';
import { MundoGameRules, type MundoRoom } from './MundoGameRules.js';
import {
  type GameMode,
  type TeamId,
  type MundoRoomConfig,
  SPAWN_POSITIONS,
  DEFAULT_CONFIG
} from './types.js';

// ==================== Configuration ====================

const PORT = parseInt(process.env.PORT || '3000', 10);
const TICK_RATE = 60; // 60 TPS = ~16.6ms per tick (smoother gameplay)
const TICK_INTERVAL = 1000 / TICK_RATE;

// ==================== Room Implementation ====================

/**
 * Room class that manages a single game instance
 * Follows the game-core Room API
 */
class Room implements MundoRoom {
  readonly id: string;
  private players: Map<string, Player> = new Map();
  private sockets: Map<string, Socket> = new Map();
  private rules: MundoGameRules;
  private config: MundoRoomConfig;
  private tickCount: number = 0;
  private tickInterval: NodeJS.Timeout | null = null;
  private running: boolean = false;

  // Room state
  private hostId: string | null = null;
  private readyPlayers: Set<string> = new Set();
  private loadedPlayers: Set<string> = new Set();

  constructor(id: string, config: Partial<MundoRoomConfig> = {}) {
    this.id = id;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = new MundoGameRules(this.config);
    this.rules.onRoomCreated(this);
    console.log(`[Room ${id}] Created with mode: ${this.config.gameMode}`);
  }

  // ==================== Player Management ====================

  addPlayer(socket: Socket, isHost: boolean = false): Player {
    const playerId = socket.id;
    
    // Determine team and spawn position
    const teamPlayers = this.rules.getTeamPlayers();
    let team: TeamId;
    let playerIndex: number;
    
    if (teamPlayers.team1.length <= teamPlayers.team2.length && teamPlayers.team1.length < this.config.maxPlayersPerTeam) {
      team = 1;
      playerIndex = teamPlayers.team1.length;
    } else {
      team = 2;
      playerIndex = teamPlayers.team2.length;
    }
    
    const spawnPositions = SPAWN_POSITIONS[this.config.gameMode];
    const teamSpawns = team === 1 ? spawnPositions.team1 : spawnPositions.team2;
    const spawn = teamSpawns[playerIndex] || teamSpawns[0];
    
    // Create player entity
    const player = new Player(
      playerId,
      spawn.x,
      spawn.z,
      team,
      playerIndex,
      {
        health: this.config.playerHealth,
        moveSpeed: this.config.playerMoveSpeed,
        knifeCooldown: this.config.knifeCooldownMs,
        facing: spawn.facing
      }
    );
    
    player.socketId = playerId;
    player.isHost = isHost;
    
    if (isHost) {
      this.hostId = playerId;
    }
    
    // Register player
    this.players.set(playerId, player);
    this.sockets.set(playerId, socket);
    
    // Notify game rules
    this.rules.onPlayerJoin(this, player);
    
    console.log(`[Room ${this.id}] Player ${playerId} joined as Team ${team}`);
    
    return player;
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    this.rules.onPlayerLeave(this, playerId);
    this.players.delete(playerId);
    this.sockets.delete(playerId);
    this.readyPlayers.delete(playerId);
    this.loadedPlayers.delete(playerId);
    
    // If host left, assign new host
    if (this.hostId === playerId && this.players.size > 0) {
      this.hostId = this.players.keys().next().value ?? null;
      if (this.hostId) {
        const newHost = this.players.get(this.hostId);
        if (newHost) newHost.isHost = true;
      }
    }
    
    console.log(`[Room ${this.id}] Player ${playerId} removed`);
  }

  // ==================== Game Loop ====================

  start(): void {
    if (this.running) return;
    
    this.running = true;
    this.tickCount = 0;
    
    console.log(`[Room ${this.id}] Starting game loop at ${TICK_RATE} TPS`);
    
    this.tickInterval = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL);
  }

  stop(): void {
    if (!this.running) return;
    
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    
    console.log(`[Room ${this.id}] Game loop stopped`);
  }

  private tick(): void {
    this.tickCount++;
    this.rules.onTick(this, TICK_INTERVAL);
    
    // Check if game should end
    if (this.rules.shouldEndRoom(this)) {
      this.stop();
    }
  }

  // ==================== Input Processing ====================

  queueInput(playerId: string, command: { type: string; [key: string]: unknown }): void {
    this.rules.onCommand(this, playerId, command as any);
  }

  // ==================== Network ====================

  broadcast(event: { op: string; [key: string]: unknown }): void {
    if (event.op === 'serverKnifeSpawn' || event.op === 'serverKnifeHit') {
      console.log(`[Room ${this.id}] Broadcasting ${event.op} to ${this.sockets.size} sockets:`, event.op === 'serverKnifeSpawn' ? { knifeId: event.knifeId, ownerTeam: event.ownerTeam } : { knifeId: event.knifeId, targetTeam: event.targetTeam });
    }
    this.sockets.forEach((socket, socketId) => {
      socket.emit(event.op, event);
    });
  }

  sendTo(playerId: string, event: { op: string; [key: string]: unknown }): void {
    const socket = this.sockets.get(playerId);
    if (socket) {
      socket.emit(event.op, event);
    }
  }

  // ==================== State Accessors ====================

  getRegistry(): Map<string, Player> {
    return this.players;
  }

  getPlayers(): Map<string, Player> {
    return this.players;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  getConfig(): MundoRoomConfig {
    return this.config;
  }

  isRunning(): boolean {
    return this.running;
  }

  // ==================== Ready/Load State ====================

  setPlayerReady(playerId: string, ready: boolean): void {
    if (ready) {
      this.readyPlayers.add(playerId);
    } else {
      this.readyPlayers.delete(playerId);
    }
    
    // Broadcast playerReadyUpdate to all players
    this.broadcast({
      op: 'playerReadyUpdate',
      socketId: playerId,
      ready: ready
    });
    
    this.broadcastRoomState();
  }
  
  togglePlayerReady(playerId: string): boolean {
    const isCurrentlyReady = this.readyPlayers.has(playerId);
    this.setPlayerReady(playerId, !isCurrentlyReady);
    return !isCurrentlyReady;
  }

  setPlayerLoaded(playerId: string): void {
    this.loadedPlayers.add(playerId);
    
    // Check if all players loaded
    if (this.loadedPlayers.size === this.players.size && this.players.size >= 2) {
      this.broadcast({
        op: 'allPlayersLoaded',
        timestamp: Date.now()
      });
    }
  }

  allPlayersReady(): boolean {
    return this.readyPlayers.size === this.players.size && this.players.size >= 2;
  }

  allPlayersLoaded(): boolean {
    return this.loadedPlayers.size === this.players.size && this.players.size >= 2;
  }

  broadcastRoomState(): void {
    // Build teams object: { 1: [socketId1, ...], 2: [socketId2, ...] }
    const teams: { [key: number]: string[] } = { 1: [], 2: [] };
    // Build players object keyed by socket ID
    const playersObj: { [key: string]: object } = {};
    
    this.players.forEach((p, socketId) => {
      teams[p.team].push(socketId);
      playersObj[socketId] = {
        playerId: p.playerIndex + 1, // 1-indexed for display
        team: p.team,
        ready: this.readyPlayers.has(socketId),
        loaded: this.loadedPlayers.has(socketId),
        isHost: p.isHost,
        x: p.x,
        z: p.z
      };
    });
    
    this.sockets.forEach((socket, playerId) => {
      socket.emit('roomState', {
        op: 'roomState',
        roomCode: this.id,
        teams,
        players: playersObj,
        hostSocket: this.hostId,
        isHost: playerId === this.hostId,
        gameMode: this.config.gameMode
      });
    });
  }

  getSnapshot(): object {
    const playerStates = Array.from(this.players.values()).map(p => p.toJSON());
    const knifeStates = Array.from(this.rules.getKnives().values()).map(k => k.toJSON());
    
    return {
      tick: this.tickCount,
      timestamp: Date.now(),
      players: playerStates,
      knives: knifeStates,
      gameMode: this.config.gameMode,
      ...this.rules.getState()
    };
  }

  startCountdown(): void {
    this.rules.startCountdown();
    this.start();
    this.broadcast({
      op: 'countdownStart',
      countdownSeconds: 5
    });
  }
}

// ==================== Server Manager ====================

class GameServer {
  private io: Server;
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomId

  constructor(port: number) {
    this.io = new Server(port, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      pingInterval: 10000,
      pingTimeout: 5000
    });
    
    this.setupListeners();
    console.log(`[Server] Mundo Cleaver server running on port ${port}`);
  }

  private setupListeners(): void {
    this.io.on('connection', (socket) => {
      console.log(`[Server] Client connected: ${socket.id}`);
      
      // ==================== Room Management ====================
      
      socket.on('createRoom', (data: { gameMode: GameMode }) => {
        const roomCode = this.generateRoomCode();
        const config: Partial<MundoRoomConfig> = {
          gameMode: data.gameMode,
          maxPlayersPerTeam: data.gameMode === '1v1' ? 1 : 3
        };
        
        const room = new Room(roomCode, config);
        this.rooms.set(roomCode, room);
        
        const player = room.addPlayer(socket, true); // Host
        this.playerRooms.set(socket.id, roomCode);
        
        socket.join(roomCode);
        
        socket.emit('roomCreated', {
          op: 'roomCreated',
          roomCode,
          playerId: socket.id,
          team: player.team,
          isHost: true,
          gameMode: data.gameMode
        });
        
        room.broadcastRoomState();
        console.log(`[Server] Room ${roomCode} created by ${socket.id}`);
      });
      
      socket.on('joinRoom', (data: { roomCode: string }) => {
        console.log(`[Server] joinRoom request - code: "${data.roomCode}", available rooms:`, Array.from(this.rooms.keys()));
        
        const room = this.rooms.get(data.roomCode);
        
        if (!room) {
          console.log(`[Server] Room "${data.roomCode}" not found!`);
          socket.emit('joinError', { error: 'Room not found' });
          return;
        }
        
        if (room.isRunning()) {
          socket.emit('joinError', { error: 'Game already in progress' });
          return;
        }
        
        if (room.getPlayers().size >= (room.getConfig().gameMode === '1v1' ? 2 : 6)) {
          socket.emit('joinError', { error: 'Room is full' });
          return;
        }
        
        const player = room.addPlayer(socket, false);
        this.playerRooms.set(socket.id, data.roomCode);
        
        socket.join(data.roomCode);
        
        // Client expects 'joinSuccess' event
        socket.emit('joinSuccess', {
          op: 'joinSuccess',
          roomCode: data.roomCode,
          playerId: socket.id,
          team: player.team,
          isHost: false,
          gameMode: room.getConfig().gameMode
        });
        
        room.broadcastRoomState();
        console.log(`[Server] Player ${socket.id} joined room ${data.roomCode}`);
      });
      
      // ==================== Ready/Load State ====================
      
      socket.on('playerReady', (data: { roomCode: string }) => {
        const room = this.rooms.get(data.roomCode);
        if (!room) return;
        
        const newState = room.togglePlayerReady(socket.id);
        console.log(`[Server] Player ${socket.id} ready=${newState} in room ${data.roomCode}`);
      });
      
      socket.on('playerLoaded', (data: { roomCode: string }) => {
        const room = this.rooms.get(data.roomCode);
        if (!room) return;
        
        room.setPlayerLoaded(socket.id);
        console.log(`[Server] Player ${socket.id} loaded in room ${data.roomCode}`);
      });
      
      socket.on('startGame', (data: { roomCode: string }) => {
        const room = this.rooms.get(data.roomCode);
        if (!room) return;
        
        // Only host can start
        const player = room.getPlayers().get(socket.id);
        if (!player?.isHost) {
          socket.emit('error', { error: 'Only host can start game' });
          return;
        }
        
        if (!room.allPlayersReady()) {
          socket.emit('error', { error: 'Not all players ready' });
          return;
        }
        
        // Emit gameStart FIRST to trigger client game initialization
        room.broadcast({
          op: 'gameStart'
        });
        
        // Then send init data to all players
        room.getPlayers().forEach((p, pid) => {
          const playerSocket = this.io.sockets.sockets.get(pid);
          if (playerSocket) {
            playerSocket.emit('S_INIT', {
              op: 'S_INIT',
              playerId: pid,
              team: p.team,
              roomCode: data.roomCode,
              ...room.getSnapshot()
            });
          }
        });
        
        room.startCountdown();
        console.log(`[Server] Game started in room ${data.roomCode}`);
      });
      
      // ==================== Game Input ====================
      
      socket.on('playerMove', (data: {
        roomCode: string;
        targetX: number;
        targetZ: number;
        actionId: number;
        seq: number;
        clientTime: number;
      }) => {
        const room = this.rooms.get(data.roomCode);
        if (!room) return;
        
        room.queueInput(socket.id, {
          type: 'move',
          targetX: data.targetX,
          targetZ: data.targetZ,
          actionId: data.actionId,
          seq: data.seq,
          timestamp: data.clientTime
        });
      });
      
      socket.on('knifeThrow', (data: {
        roomCode: string;
        targetX: number;
        targetZ: number;
        actionId: number;
        clientTimestamp: number;
        clientSendTime: number;
      }) => {
        const room = this.rooms.get(data.roomCode);
        if (!room) return;
        
        room.queueInput(socket.id, {
          type: 'knife_throw',
          targetX: data.targetX,
          targetZ: data.targetZ,
          actionId: data.actionId,
          clientTimestamp: data.clientTimestamp,
          seq: data.actionId,
          timestamp: data.clientSendTime
        });
      });
      
      // ==================== Time Sync ====================
      
      socket.on('timeSyncPing', (data: { clientTime: number }) => {
        socket.emit('timeSyncPong', {
          clientTime: data.clientTime,
          serverTime: Date.now()
        });
      });
      
      // ==================== Disconnect ====================
      
      socket.on('disconnect', () => {
        const roomCode = this.playerRooms.get(socket.id);
        if (roomCode) {
          const room = this.rooms.get(roomCode);
          if (room) {
            room.removePlayer(socket.id);
            
            // Clean up empty rooms
            if (room.getPlayers().size === 0) {
              room.stop();
              this.rooms.delete(roomCode);
              console.log(`[Server] Room ${roomCode} deleted (empty)`);
            } else {
              room.broadcastRoomState();
            }
          }
          this.playerRooms.delete(socket.id);
        }
        console.log(`[Server] Client disconnected: ${socket.id}`);
      });
    });
  }

  private generateRoomCode(): string {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure unique
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  getMetrics(): object {
    return {
      roomCount: this.rooms.size,
      totalPlayers: this.playerRooms.size,
      rooms: Array.from(this.rooms.values()).map(room => ({
        id: room.id,
        playerCount: room.getPlayers().size,
        isRunning: room.isRunning(),
        tick: room.getTickCount()
      }))
    };
  }
}

// ==================== Start Server ====================

const server = new GameServer(PORT);

console.log(`
╔════════════════════════════════════════════════╗
║        MUNDO CLEAVER GAME SERVER               ║
║                                                ║
║  Port: ${PORT}                                    ║
║  Tick Rate: ${TICK_RATE} TPS                            ║
║  Pattern: @gamerstake/game-core                ║
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
