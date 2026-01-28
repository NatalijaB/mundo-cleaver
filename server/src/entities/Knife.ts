/**
 * Knife Entity
 * Projectile entity for Mundo Cleaver
 */

import type { TeamId } from '../types.js';

/**
 * Knife projectile entity
 */
export class Knife {
  readonly id: string;
  x: number;
  y: number;
  z: number;
  
  // Velocity
  vx: number;
  vz: number;
  
  // Target position (for direction calculation)
  targetX: number;
  targetZ: number;
  
  // Thrower info
  throwerId: string;
  throwerTeam: TeamId;
  
  // State
  dirty: boolean = true;
  lastUpdate: number = Date.now();
  
  // Lifecycle
  createdAt: number;
  lifetime: number = 5000; // 5 seconds max
  hasHit: boolean = false;
  
  // Speed
  speed: number;

  constructor(
    id: string,
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
    throwerId: string,
    throwerTeam: TeamId,
    speed: number = 0.8
  ) {
    this.id = id;
    this.x = startX;
    this.y = 0;
    this.z = startZ;
    this.targetX = targetX;
    this.targetZ = targetZ;
    this.throwerId = throwerId;
    this.throwerTeam = throwerTeam;
    this.speed = speed;
    this.createdAt = Date.now();
    
    // Calculate velocity direction
    const dx = targetX - startX;
    const dz = targetZ - startZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance > 0) {
      this.vx = (dx / distance) * speed;
      this.vz = (dz / distance) * speed;
    } else {
      this.vx = 0;
      this.vz = 0;
    }
  }

  /**
   * Update position based on velocity
   * @param deltaMs - Delta time in milliseconds (not used for fixed-speed movement)
   */
  updatePosition(deltaMs?: number): void {
    if (this.hasHit) return;
    
    this.x += this.vx;
    this.z += this.vz;
    this.markDirty();
  }

  /**
   * Check if knife has expired
   */
  isExpired(currentTime: number = Date.now()): boolean {
    return currentTime - this.createdAt > this.lifetime;
  }

  /**
   * Check if knife is out of bounds
   */
  isOutOfBounds(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean {
    return (
      this.x < bounds.minX ||
      this.x > bounds.maxX ||
      this.z < bounds.minZ ||
      this.z > bounds.maxZ
    );
  }

  /**
   * Mark knife as having hit a target
   */
  markHit(): void {
    this.hasHit = true;
    this.markDirty();
  }

  /**
   * Mark entity as dirty
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
      knifeId: this.id,
      x: Math.round(this.x * 100) / 100,
      z: Math.round(this.z * 100) / 100,
      vx: Math.round(this.vx * 1000) / 1000,
      vz: Math.round(this.vz * 1000) / 1000,
      targetX: Math.round(this.targetX * 100) / 100,
      targetZ: Math.round(this.targetZ * 100) / 100,
      throwerId: this.throwerId,
      throwerTeam: this.throwerTeam
    };
  }
}
