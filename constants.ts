import { PhysicsProfile } from './types';

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