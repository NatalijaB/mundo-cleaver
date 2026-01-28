/**
 * Mundo Cleaver Game Rules
 * Implements the GameRules interface from @gamerstake/game-core
 */

import { Player } from './entities/Player.js';
import { Knife } from './entities/Knife.js';
import {
  type TeamId,
  type GameMode,
  type MundoRoomConfig,
  type Command,
  type MoveCommand,
  type KnifeThrowCommand,
  SPAWN_POSITIONS,
  MAP_BOUNDS,
  DEFAULT_CONFIG
} from './types.js';

/**
 * Room interface (simplified for standalone server)
 * This matches the game-core Room API
 */
export interface MundoRoom {
  id: string;
  getRegistry(): Map<string, Player>;
  getPlayers(): Map<string, Player>;
  broadcast(event: { op: string; [key: string]: unknown }): void;
  sendTo(playerId: string, event: { op: string; [key: string]: unknown }): void;
  getTickCount(): number;
  getConfig(): MundoRoomConfig;
}

/**
 * Mundo Cleaver Game Rules Implementation
 */
export class MundoGameRules {
  private config: MundoRoomConfig;
  private gameMode: GameMode;
  
  // Game state
  private isRunning: boolean = false;
  private winner: TeamId | null = null;
  private countdownActive: boolean = false;
  private countdownStartTime: number = 0;
  private tickCounter: number = 0;
  private stateBroadcastInterval: number = 3; // Broadcast state every N ticks (60 TPS / 3 = 20 state updates/sec)
  
  // Entity storage
  private knives: Map<string, Knife> = new Map();
  private knifeIdCounter: number = 0;
  
  // Team tracking
  private team1Players: string[] = [];
  private team2Players: string[] = [];

  constructor(config: Partial<MundoRoomConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gameMode = this.config.gameMode;
  }

  // ==================== GameRules Interface ====================

  /**
   * Called once when room is created
   */
  onRoomCreated(room: MundoRoom): void {
    console.log(`[MundoRules] Room ${room.id} created with mode: ${this.gameMode}`);
    this.knives.clear();
    this.winner = null;
    this.isRunning = false;
  }

  /**
   * Called when a player joins the room
   */
  onPlayerJoin(room: MundoRoom, player: Player): void {
    // Assign player to a team
    const team = this.assignTeam(player);
    
    // Set spawn position
    const spawnPositions = SPAWN_POSITIONS[this.gameMode];
    const teamPositions = team === 1 ? spawnPositions.team1 : spawnPositions.team2;
    const teamPlayers = team === 1 ? this.team1Players : this.team2Players;
    const playerIndex = teamPlayers.length;
    
    if (playerIndex < teamPositions.length) {
      const spawn = teamPositions[playerIndex];
      player.setPosition(spawn.x, spawn.z);
      player.facing = spawn.facing;
    }
    
    player.team = team;
    player.playerIndex = playerIndex;
    
    // Track in team list
    if (team === 1) {
      this.team1Players.push(player.id);
    } else {
      this.team2Players.push(player.id);
    }
    
    console.log(`[MundoRules] Player ${player.id} joined Team ${team} at position ${playerIndex}`);
    
    // Broadcast player join to all
    room.broadcast({
      op: 'playerJoined',
      playerId: player.id,
      team: team,
      ...player.toJSON()
    });
  }

  /**
   * Called when a player leaves the room
   */
  onPlayerLeave(room: MundoRoom, playerId: string): void {
    console.log(`[MundoRules] Player ${playerId} left`);
    
    // Remove from team tracking
    this.team1Players = this.team1Players.filter(id => id !== playerId);
    this.team2Players = this.team2Players.filter(id => id !== playerId);
    
    // Check if game should end due to player leaving
    if (this.isRunning) {
      this.checkWinCondition(room);
    }
    
    // Broadcast player leave
    room.broadcast({
      op: 'playerLeft',
      playerId
    });
  }

  /**
   * Called every tick (20 TPS = every 50ms)
   */
  onTick(room: MundoRoom, delta: number): void {
    if (!this.isRunning) {
      // Handle countdown
      if (this.countdownActive) {
        const elapsed = Date.now() - this.countdownStartTime;
        if (elapsed >= 5000) { // 5 second countdown
          this.countdownActive = false;
          this.isRunning = true;
          room.broadcast({
            op: 'gameStart',
            timestamp: Date.now()
          });
        }
      }
      return;
    }

    const players = room.getPlayers();
    
    // Update player positions (runs at full 60 TPS)
    players.forEach(player => {
      player.updatePosition(delta);
    });
    
    // Update knives (runs at full 60 TPS)
    this.updateKnives(room, delta);
    
    // Check collisions (runs at full 60 TPS for accurate hit detection)
    this.checkKnifeCollisions(room);
    
    // Check win condition
    this.checkWinCondition(room);
    
    // Throttle state broadcasts to reduce network load (20 updates/sec)
    this.tickCounter++;
    if (this.tickCounter >= this.stateBroadcastInterval) {
      this.tickCounter = 0;
      this.broadcastGameState(room);
    }
  }

  /**
   * Called when a player sends a command
   */
  onCommand(room: MundoRoom, playerId: string, command: Command): void {
    const player = room.getPlayers().get(playerId);
    if (!player || player.isDead) return;

    switch (command.type) {
      case 'move':
        this.handleMoveCommand(room, player, command as MoveCommand);
        break;
      case 'stop':
        this.handleStopCommand(room, player);
        break;
      case 'knife_throw':
        this.handleKnifeThrowCommand(room, player, command as KnifeThrowCommand);
        break;
    }
  }

  /**
   * Check if the room should end
   */
  shouldEndRoom(room: MundoRoom): boolean {
    return this.winner !== null;
  }

  // ==================== Command Handlers ====================

  private handleMoveCommand(room: MundoRoom, player: Player, command: MoveCommand): void {
    // Clamp target to map bounds
    const targetX = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, command.targetX));
    const targetZ = Math.max(MAP_BOUNDS.minZ, Math.min(MAP_BOUNDS.maxZ, command.targetZ));
    
    player.setTarget(targetX, targetZ);
    
    // Send acknowledgment
    room.sendTo(player.id, {
      op: 'serverMoveAck',
      actionId: command.actionId,
      playerId: player.id,
      x: player.x,
      z: player.z,
      targetX: player.targetX,
      targetZ: player.targetZ,
      serverTime: Date.now()
    });
    
    // Broadcast to others
    room.broadcast({
      op: 'opponentMove',
      playerId: player.id,
      x: player.x,
      z: player.z,
      targetX: player.targetX,
      targetZ: player.targetZ,
      isMoving: true,
      timestamp: Date.now()
    });
  }

  private handleStopCommand(room: MundoRoom, player: Player): void {
    player.stop();
    
    room.broadcast({
      op: 'opponentMove',
      playerId: player.id,
      x: player.x,
      z: player.z,
      targetX: null,
      targetZ: null,
      isMoving: false,
      timestamp: Date.now()
    });
  }

  private handleKnifeThrowCommand(room: MundoRoom, player: Player, command: KnifeThrowCommand): void {
    const now = Date.now();
    
    if (!player.canThrowKnife(now)) {
      return; // Still on cooldown
    }
    
    // Create knife
    const knife = new Knife(
      `knife_${this.knifeIdCounter++}`,
      player.x,
      player.z,
      command.targetX,
      command.targetZ,
      player.id,
      player.team,
      this.config.knifeSpeed
    );
    
    this.knives.set(knife.id, knife);
    player.recordKnifeThrow(now);
    
    // Broadcast knife spawn (match client expected format)
    room.broadcast({
      op: 'serverKnifeSpawn',
      knifeId: knife.id,
      x: knife.x,
      z: knife.z,
      targetX: knife.targetX,
      targetZ: knife.targetZ,
      velocityX: knife.vx,
      velocityZ: knife.vz,
      throwerId: player.id,
      ownerTeam: player.team, // Client expects 'ownerTeam' not 'throwerTeam'
      actionId: command.actionId, // For client-side prediction matching
      serverTime: now
    });
    
    console.log(`[MundoRules] Player ${player.id} threw knife ${knife.id} towards (${command.targetX}, ${command.targetZ})`);
  }

  // ==================== Game Logic ====================

  private updateKnives(room: MundoRoom, delta: number): void {
    const now = Date.now();
    const toRemove: string[] = [];
    
    this.knives.forEach((knife, id) => {
      // Update position
      knife.updatePosition(delta);
      
      // Check expiration
      if (knife.isExpired(now) || knife.isOutOfBounds(MAP_BOUNDS)) {
        toRemove.push(id);
        room.broadcast({
          op: 'serverKnifeDestroy',
          knifeId: id,
          reason: knife.isExpired(now) ? 'expired' : 'out_of_bounds'
        });
      }
    });
    
    // Remove expired/out-of-bounds knives
    toRemove.forEach(id => this.knives.delete(id));
  }

  private checkKnifeCollisions(room: MundoRoom): void {
    const players = room.getPlayers();
    const toRemove: string[] = [];
    
    this.knives.forEach((knife, id) => {
      if (knife.hasHit) return;
      
      players.forEach(player => {
        // Can't hit own team
        if (player.team === knife.throwerTeam) return;
        if (player.isDead) return;
        
        // Check distance (hit radius)
        const dx = knife.x - player.x;
        const dz = knife.z - player.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < this.config.hitRadius) {
          // Hit!
          knife.markHit();
          const died = player.takeDamage(1);
          
          console.log(`[MundoRules] Knife ${id} hit Player ${player.id}! Health: ${player.health}`);
          
          // Broadcast hit event (match client expected format)
          room.broadcast({
            op: 'serverKnifeHit',
            knifeId: id,
            targetId: player.id,
            targetTeam: player.team,
            newHealth: player.health,
            hitX: player.x, // Client uses these for blood effect
            hitZ: player.z,
            serverTime: Date.now()
          });
          
          // Broadcast health update (match client expected format)
          room.broadcast({
            op: 'serverHealthUpdate',
            targetPlayerId: player.id, // Client looks for targetPlayerId
            playerId: player.id,
            health: player.health,
            targetTeam: player.team, // Client expects 'targetTeam' not 'team'
            isDead: player.isDead,
            serverTick: room.getTickCount()
          });
          
          toRemove.push(id);
          
          if (died) {
            console.log(`[MundoRules] Player ${player.id} died!`);
            room.broadcast({
              op: 'playerDeath',
              playerId: player.id,
              team: player.team
            });
          }
        }
      });
    });
    
    // Remove hit knives
    toRemove.forEach(id => {
      this.knives.delete(id);
      room.broadcast({
        op: 'serverKnifeDestroy',
        knifeId: id,
        reason: 'hit'
      });
    });
  }

  private checkWinCondition(room: MundoRoom): void {
    if (this.winner !== null) return;
    
    const players = room.getPlayers();
    let team1Alive = 0;
    let team2Alive = 0;
    
    players.forEach(player => {
      if (!player.isDead) {
        if (player.team === 1) team1Alive++;
        else team2Alive++;
      }
    });
    
    if (team1Alive === 0 && team2Alive > 0) {
      this.winner = 2;
    } else if (team2Alive === 0 && team1Alive > 0) {
      this.winner = 1;
    }
    
    if (this.winner !== null) {
      this.isRunning = false;
      console.log(`[MundoRules] Game Over! Team ${this.winner} wins!`);
      
      room.broadcast({
        op: 'gameOver',
        winner: this.winner,
        reason: 'Team eliminated'
      });
    }
  }

  private broadcastGameState(room: MundoRoom): void {
    const players = room.getPlayers();
    const playerStates = Array.from(players.values()).map(p => p.toJSON());
    const knifeStates = Array.from(this.knives.values()).map(k => k.toJSON());
    
    room.broadcast({
      op: 'serverGameState',
      serverTick: room.getTickCount(),
      serverTime: Date.now(),
      players: playerStates,
      knives: knifeStates
    });
  }

  // ==================== Utility Methods ====================

  private assignTeam(player: Player): TeamId {
    const maxPerTeam = this.config.maxPlayersPerTeam;
    
    if (this.team1Players.length < maxPerTeam) {
      return 1;
    } else if (this.team2Players.length < maxPerTeam) {
      return 2;
    }
    
    // Both teams full, assign to smaller team
    return this.team1Players.length <= this.team2Players.length ? 1 : 2;
  }

  // ==================== Public API ====================

  /**
   * Start the countdown to game start
   */
  startCountdown(): void {
    if (!this.countdownActive && !this.isRunning) {
      this.countdownActive = true;
      this.countdownStartTime = Date.now();
      console.log('[MundoRules] Countdown started');
    }
  }

  /**
   * Force start the game (skip countdown)
   */
  forceStart(): void {
    this.countdownActive = false;
    this.isRunning = true;
  }

  /**
   * Get current game state
   */
  getState(): { isRunning: boolean; winner: TeamId | null; countdownActive: boolean } {
    return {
      isRunning: this.isRunning,
      winner: this.winner,
      countdownActive: this.countdownActive
    };
  }

  /**
   * Get all knives
   */
  getKnives(): Map<string, Knife> {
    return this.knives;
  }

  /**
   * Get team players
   */
  getTeamPlayers(): { team1: string[]; team2: string[] } {
    return {
      team1: [...this.team1Players],
      team2: [...this.team2Players]
    };
  }

  /**
   * Check if room is full
   */
  isRoomFull(): boolean {
    const maxPlayers = this.gameMode === '1v1' ? 2 : 6;
    return this.team1Players.length + this.team2Players.length >= maxPlayers;
  }

  /**
   * Get required players count
   */
  getRequiredPlayers(): number {
    return this.gameMode === '1v1' ? 2 : 6;
  }
}
