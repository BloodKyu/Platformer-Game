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
  doubleJumpForce: 16.0,   // Slightly weaker than main jump
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
  maxDashes: 3,            // NEW: Triple Dash enabled

  // Combat
  attackDurationFrames: 12,
  attackCooldownFrames: 14, // Slightly faster to allow combos
  attackLungeSpeed: 12.0,   // Forward velocity impulse on attack start (Step-in)
  airLaunchForce: 14.0,     // Self-launch velocity
  enemyLaunchForce: 18.0,   // Enemy launch velocity
  comboWindowFrames: 45,    // ~0.75 seconds to input next animation
  comboKeepAliveFrames: 60, // ~1 Second to keep the hit counter alive
};

export const GAME_CONFIG = {
  FPS: 60,
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
  PLAYER_SIZE: { width: 32, height: 64 }, 
  DEBUG_MODE: true,
  
  // Phase 1: Gameplay Config
  PLAYER_MAX_HEALTH: 100,
  PLAYER_I_FRAMES: 90, // 1.5 seconds of invincibility
  KILL_PLANE_Y: 1500,  // Y position where player dies
};

export const AI_CONFIG = {
  PATROL_SPEED: 2.0,
  CHASE_SPEED: 4.5,
  DETECTION_RANGE: 300,
  ATTACK_RANGE: 60,
  ATTACK_CHARGE: 40,    // NEW: 0.66s telegraph before swing
  ATTACK_COOLDOWN: 60,
  ATTACK_DURATION: 20,
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
  ENEMY_PATROL: '#ef4444',
  ENEMY_CHASE: '#dc2626',
  ENEMY_ATTACK: '#991b1b',
  
  // NEW ENEMY COLORS
  ENEMY_TURRET: '#f97316', // Orange
  ENEMY_FLYER: '#a855f7',  // Purple
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
  // 8 Frame Run Cycle (Yui_Run_0001.png to Yui_Run_0008.png)
  RUN: { 
    folder: 'run',      
    prefix: 'Yui_Run_',  
    count: 8,          
    frameDelay: 4, 
    loop: true, 
    pad: 4, 
    startAt: 1 
  },
  
  // Standardized IDLE (Yui_Idle_0001.png)
  IDLE: { 
    folder: 'idle', 
    prefix: 'Yui_Idle_', 
    count: 1, 
    frameDelay: 8, 
    loop: true,
    pad: 4,
    startAt: 1 
  },

  // UPDATED: Jump (Yui_Jump_0001.png)
  JUMP: { 
    folder: 'jump', 
    prefix: 'Yui_Jump_', 
    count: 1, 
    frameDelay: 4, 
    loop: false,
    pad: 4,
    startAt: 1 
  },

  // UPDATED: Fall (Expects Yui_Falling_0001.png in 'falling' folder)
  FALL: { 
    folder: 'falling', 
    prefix: 'Yui_Falling_', 
    count: 1, 
    frameDelay: 4, 
    loop: true,
    pad: 4,
    startAt: 1 
  },

  // UPDATED: Dash (Uses Run Frame 5 as placeholder)
  DASH: { 
    folder: 'run', 
    prefix: 'Yui_Run_', 
    count: 1, 
    frameDelay: 4, 
    loop: true,
    pad: 4,
    startAt: 5
  },

  // Combo 1: Attack A (Yui_Attack_A_0001.png)
  ATTACK: { 
    folder: 'attack_a', 
    prefix: 'Yui_Attack_A_', 
    count: 1, 
    frameDelay: 4, 
    loop: false,
    pad: 4,
    startAt: 1 
  },

  // Combo 2: Attack B (Inside attack_b folder)
  ATTACK_B: { 
    folder: 'attack_b', 
    prefix: 'Yui_Attack_B_', 
    count: 1, 
    frameDelay: 4, 
    loop: false,
    pad: 4,
    startAt: 1 
  },

  // Combo 3: Attack C (Inside attack_c folder)
  ATTACK_C: { 
    folder: 'attack_c', 
    prefix: 'Yui_Attack_C_', 
    count: 1, 
    frameDelay: 4, 
    loop: false,
    pad: 4,
    startAt: 1 
  },

  // Air Launcher (Up+Attack)
  ATTACK_AIR_A: {
    folder: 'attack_air_a',
    prefix: 'Yui_Attack_Air_A_',
    count: 1,
    frameDelay: 4,
    loop: false,
    pad: 4,
    startAt: 1
  },

  // NEW: Dash Attack (Dash + Attack)
  ATTACK_DASH_A: {
    folder: 'attack_dash_a',
    prefix: 'Yui_Attack_Dash_A_',
    count: 1,
    frameDelay: 4,
    loop: false,
    pad: 4,
    startAt: 1
  },

  // VFX: Blue Slash Energy
  // Path on Repo: public/assets/vfx/Slash_A/Slash_001.png
  VFX_SLASH: {
    folder: '../vfx/Slash_A', 
    prefix: 'Slash_',
    count: 12,
    frameDelay: 1,
    loop: false,
    pad: 3, 
    startAt: 1
  },

  // NEW VFX: Hit Impact
  // Path on Repo: public/assets/vfx/Hit_A/Hit_001.png
  VFX_HIT: {
    folder: '../vfx/Hit_A',
    prefix: 'Hit_',
    count: 6,
    frameDelay: 2,
    loop: false,
    pad: 3,
    startAt: 1
  },

  // Wall Slide / Idle
  // Path on Repo: public/assets/animations/idle_wall/Yui_IdleWall_0001.png
  WALL_SLIDE: { 
    folder: 'idle_wall', 
    prefix: 'Yui_IdleWall_', 
    count: 1, 
    frameDelay: 10, 
    loop: true, 
    pad: 4,
    startAt: 1
  },
};

// DIRECT GITHUB RAW LINK (Bypasses CDN Cache)
export const ASSET_ROOT = `https://raw.githubusercontent.com/BloodKyu/Platformer-Game/main/public/assets/animations`;