import { PhysicsProfile, AnimationKey } from './types';

// THE PHYSICS PROFILE
// Tuned for "Fluid Precision".
export const DEFAULT_PHYSICS_PROFILE: PhysicsProfile = {
  gravity: 0.9,            // Snappy falling
  terminalVelocity: 18.0,  // Fast fall speed limit

  // Running
  runSpeed: 9.0,           // Fast movement
  groundAccel: 1.2,        // Responsive start
  groundDecel: 1.5,        // Quick stop (tight control)
  airAccel: 0.8,           // Good air control
  airDecel: 0.2,           // Low air friction (maintain momentum)

  // Jumping
  jumpForce: 18.0,
  doubleJumpForce: 16.0,   // NEW: Slightly weaker than main jump
  jumpCutMultiplier: 0.4,  // Variable jump height (release to drop)
  jumpBufferFrames: 5,     // 5 frames (~80ms) forgiveness
  coyoteFrames: 6,         // 6 frames (~100ms) ledge forgiveness

  // Wall
  wallSlideSpeed: 4.0,
  wallJumpForce: { x: 10, y: 16 },

  // Dashing
  dashSpeed: 24.0,
  dashDurationFrames: 8,   // Short, punchy dash
  dashCooldownFrames: 30,  // Half second cooldown

  // Combat
  attackDurationFrames: 12,
  attackCooldownFrames: 18,
};

export const GAME_CONFIG = {
  FPS: 60,
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
  PLAYER_SIZE: { width: 32, height: 64 }, 
  DEBUG_MODE: true,
};

export const COLORS = {
  YUI_BODY: '#1e293b', 
  YUI_ACCENT: '#3b82f6', 
  YUI_WEAPON: '#0ea5e9', 
  PLATFORM_SURFACE: '#334155', 
  PLATFORM_SIDE: '#0f172a', 
  BACKGROUND_NEAR: '#1e1b4b', 
  BACKGROUND_FAR: '#020617', 
  PARTICLE_SPARK: '#f59e0b', 
  PARTICLE_ENERGY: '#60a5fa', 
};

// ------------------------------------------------------------------
// SPRITE ASSET CONFIGURATION
// ------------------------------------------------------------------
export const ANIMATION_MANIFEST: Record<AnimationKey, { 
  folder: string; 
  prefix: string; 
  count: number; 
  frameDelay: number; 
  loop: boolean;
  pad?: number;      // Number of digits for zero-padding (e.g., 3 for '001')
  startAt?: number;  // Starting index number (e.g., 1 for '001')
}> = {
  // Configured to match: run/YuiRun_001.png
  RUN: { 
    folder: 'run', 
    prefix: 'YuiRun_', 
    count: 1, 
    frameDelay: 4, 
    loop: true, 
    pad: 3, 
    startAt: 1 
  },
  
  // Standard configs for others (will fallback to procedural if files missing)
  IDLE: { folder: 'idle', prefix: 'idle_', count: 6, frameDelay: 8, loop: true },
  JUMP: { folder: 'jump', prefix: 'jump_', count: 4, frameDelay: 4, loop: false },
  FALL: { folder: 'fall', prefix: 'fall_', count: 4, frameDelay: 4, loop: true },
  DASH: { folder: 'dash', prefix: 'dash_', count: 4, frameDelay: 2, loop: true },
  ATTACK: { folder: 'attack', prefix: 'attack_', count: 6, frameDelay: 2, loop: false },
  WALL_SLIDE: { folder: 'wall', prefix: 'wall_', count: 2, frameDelay: 10, loop: true },
};

// Use Raw GitHub User Content directly
export const ASSET_ROOT = 'https://raw.githubusercontent.com/BloodKyu/Platformer-Game/main/public/assets/animations';