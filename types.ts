// Physics & Movement Types
export interface PhysicsProfile {
  // General
  gravity: number;
  terminalVelocity: number;

  // Horizontal Movement
  runSpeed: number;        // Max horizontal speed
  groundAccel: number;     // How fast to reach max speed on ground
  groundDecel: number;     // How fast to stop on ground
  airAccel: number;        // Control in air
  airDecel: number;        // Friction in air

  // Jumping
  jumpForce: number;
  doubleJumpForce: number;   // NEW: Force for the second jump in air
  jumpCutMultiplier: number; // Multiplier applied when jump button released early (0.0 - 1.0)
  jumpBufferFrames: number;  // How many frames ahead input is registered
  coyoteFrames: number;      // How many frames after leaving ground you can still jump

  // Wall Mechanics
  wallSlideSpeed: number;
  wallJumpForce: { x: number; y: number };

  // Dashing
  dashSpeed: number;
  dashDurationFrames: number;
  dashCooldownFrames: number;

  // Combat
  attackDurationFrames: number;
  attackCooldownFrames: number;
}

// Entity Types
export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayerState {
  position: Vector2;
  velocity: Vector2;
  
  // State Flags
  isGrounded: boolean;
  isDashing: boolean;
  isWallSliding: boolean;
  isJumping: boolean; // Tracks if we are currently in an active jump arc
  canDoubleJump: boolean; // NEW: Tracks availability of mid-air jump
  isAttacking: boolean;   // NEW: Combat state
  facingRight: boolean;
  
  // Timers (Frames)
  dashTimer: number;         // Active dash duration
  dashCooldownTimer: number; // Time until next dash
  attackTimer: number;       // Active hitbox duration
  attackCooldownTimer: number; // Time until next attack
  coyoteTimer: number;       // Frames since left ground
  jumpBufferTimer: number;   // Frames since jump button pressed
  
  // Visuals
  color: string;
  leanAngle: number;
  
  // Input tracking
  lastJumpInput: boolean; // To detect button release
  lastDashInput: boolean; // To detect dash button release
  lastAttackInput: boolean; // To detect attack button release
  wallDir: number; // -1 (Left), 1 (Right), 0 (None)
}

export interface Platform {
  id: string;
  rect: Rect;
  type: 'solid' | 'oneway';
  color: string;
}

export interface Enemy {
  id: string;
  position: Vector2;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  color: string;
  hitTimer: number; // Frames to flash white
}

export interface PointOfInterest {
  id: string;
  position: Vector2;
  range: number;
  zoomTarget: number;
  message: string;
  color: string;
}

export interface Particle {
  id: string;
  position: Vector2;
  velocity: Vector2;
  life: number; // 0 to 1
  decay: number;
  color: string;
  size: number;
}

// Input Types
export enum InputCommand {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  JUMP = 'JUMP',
  DOWN = 'DOWN',
  DASH = 'DASH',
  ATTACK = 'ATTACK'
}

export type InputState = Record<InputCommand, boolean>;

// Game State
export interface GameState {
  player: PlayerState;
  platforms: Platform[];
  enemies: Enemy[]; // NEW: Enemies list
  pois: PointOfInterest[]; 
  particles: Particle[];
  camera: { x: number; y: number; zoom: number }; 
  screenShake: number;
  score: number;
}

// Profiler Types
export interface PerformanceStats {
  fps: number;
  frameTimeMs: number;
  particleCount: number;
  platformCount: number;
  memoryUsage?: number;
}