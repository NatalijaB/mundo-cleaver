/**
 * Player Entity
 * Custom player entity for Mundo Cleaver extending game-core Entity
 */

import type { TeamId } from '../types.js';

/**
 * Player entity with game-specific properties
 * Note: Since @gamerstake/game-core may not be installed yet,
 * we implement the Entity interface directly for now
 */
export class Player {
  // Core Entity properties
  readonly id: string;
  x: number;
  y: number;
  z: number;
  vx: number = 0;
  vy: number = 0;
  vz: number = 0;
  dirty: boolean = true;
  lastUpdate: number = Date.now();

  // Mundo Cleaver specific properties
  health: number;
  maxHealth: number;
  team: TeamId;
  facing: number; // 1 = right, -1 = left
  rotation: number = 0;
  isMoving: boolean = false;
  targetX: number | null = null;
  targetZ: number | null = null;
  moveSpeed: number;
  
  // Combat properties
  lastKnifeTime: number = 0;
  knifeCooldown: number;
  canAttack: boolean = true;
  
  // Death state
  isDead: boolean = false;
  
  // Multiplayer state
  socketId: string | null = null;
  isReady: boolean = false;
  isLoaded: boolean = false;
  isHost: boolean = false;
  
  // Index within team
  playerIndex: number;

  constructor(
    id: string,
    x: number,
    z: number,
    team: TeamId,
    playerIndex: number,
    config: {
      health?: number;
      moveSpeed?: number;
      knifeCooldown?: number;
      facing?: number;
    } = {}
  ) {
    this.id = id;
    this.x = x;
    this.y = 0;
    this.z = z;
    this.team = team;
    this.playerIndex = playerIndex;
    
    this.health = config.health ?? 5;
    this.maxHealth = this.health;
    this.moveSpeed = config.moveSpeed ?? 0.39;
    this.knifeCooldown = config.knifeCooldown ?? 4000;
    this.facing = config.facing ?? (team === 1 ? 1 : -1);
  }

  /**
   * Set position (teleport)
   */
  setPosition(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.markDirty();
  }

  /**
   * Set velocity for continuous movement
   */
  setVelocity(vx: number, vz: number): void {
    this.vx = vx;
    this.vz = vz;
    this.markDirty();
  }

  /**
   * Set movement target (click-to-move style)
   */
  setTarget(targetX: number, targetZ: number): void {
    this.targetX = targetX;
    this.targetZ = targetZ;
    this.isMoving = true;
    this.markDirty();
  }

  /**
   * Stop movement
   */
  stop(): void {
    this.targetX = null;
    this.targetZ = null;
    this.isMoving = false;
    this.vx = 0;
    this.vz = 0;
    this.markDirty();
  }

  /**
   * Update position based on velocity (called per tick)
   * @param deltaMs - Delta time in milliseconds
   */
  updatePosition(deltaMs: number): void {
    if (this.isDead) {
      this.isMoving = false;
      this.vx = 0;
      this.vz = 0;
      return;
    }

    // Click-to-move style movement
    if (this.isMoving && this.targetX !== null && this.targetZ !== null) {
      const dx = this.targetX - this.x;
      const dz = this.targetZ - this.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > 0.001) {
        const step = Math.min(distance, this.moveSpeed);
        const stepX = (dx / distance) * step;
        const stepZ = (dz / distance) * step;

        // Store velocity for client interpolation
        this.vx = stepX;
        this.vz = stepZ;

        this.x += stepX;
        this.z += stepZ;
        this.facing = dx > 0 ? 1 : -1;
        this.rotation = -Math.atan2(dz, dx) + Math.PI / 2;

        // Check if arrived at target
        if (distance <= this.moveSpeed) {
          this.x = this.targetX;
          this.z = this.targetZ;
          this.isMoving = false;
          this.targetX = null;
          this.targetZ = null;
          this.vx = 0;
          this.vz = 0;
        }

        this.markDirty();
      } else {
        this.isMoving = false;
        this.targetX = null;
        this.targetZ = null;
        this.vx = 0;
        this.vz = 0;
        this.markDirty();
      }
    } else {
      // Not moving - clear velocity
      this.vx = 0;
      this.vz = 0;
    }
  }

  /**
   * Take damage
   * @param amount - Damage amount
   * @returns true if player died
   */
  takeDamage(amount: number = 1): boolean {
    if (this.isDead) return false;
    
    this.health = Math.max(0, this.health - amount);
    this.markDirty();
    
    if (this.health <= 0) {
      this.isDead = true;
      this.isMoving = false;
      this.canAttack = false;
      return true;
    }
    
    return false;
  }

  /**
   * Heal player
   * @param amount - Heal amount
   */
  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.markDirty();
  }

  /**
   * Reset player for new round
   */
  reset(spawnX: number, spawnZ: number): void {
    this.x = spawnX;
    this.z = spawnZ;
    this.health = this.maxHealth;
    this.isDead = false;
    this.isMoving = false;
    this.targetX = null;
    this.targetZ = null;
    this.lastKnifeTime = 0;
    this.canAttack = true;
    this.markDirty();
  }

  /**
   * Check if player can throw knife
   */
  canThrowKnife(currentTime: number): boolean {
    return (
      !this.isDead &&
      this.canAttack &&
      currentTime - this.lastKnifeTime >= this.knifeCooldown
    );
  }

  /**
   * Record knife throw
   */
  recordKnifeThrow(timestamp: number): void {
    this.lastKnifeTime = timestamp;
  }

  /**
   * Mark entity as dirty (needs broadcast)
   */
  markDirty(): void {
    this.dirty = true;
    this.lastUpdate = Date.now();
  }

  /**
   * Clear dirty flag
   */
  markClean(): void {
    this.dirty = false;
  }

  /**
   * Serialize for network transmission
   */
  toJSON(): Record<string, unknown> {
    return {
      playerId: this.id,
      x: Math.round(this.x * 100) / 100,
      z: Math.round(this.z * 100) / 100,
      vx: Math.round(this.vx * 1000) / 1000, // Client uses for rotation
      vz: Math.round(this.vz * 1000) / 1000,
      health: this.health,
      maxHealth: this.maxHealth,
      team: this.team,
      playerIndex: this.playerIndex, // Client uses for player identification
      facing: this.facing,
      rotation: Math.round(this.rotation * 1000) / 1000,
      isMoving: this.isMoving,
      isDead: this.isDead,
      targetX: this.targetX !== null ? Math.round(this.targetX * 100) / 100 : null,
      targetZ: this.targetZ !== null ? Math.round(this.targetZ * 100) / 100 : null
    };
  }
}
