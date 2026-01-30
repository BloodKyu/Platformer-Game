
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
  doubleJumpForce: number;   // Force for the second jump in air
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
  maxDashes: number;         // NEW: Maximum consecutive dashes allowed

  // Combat
  attackDurationFrames: number;
  attackCooldownFrames: number;
  attackLungeSpeed: number;     // Forward velocity impulse on attack start (Step-in)
  airLaunchForce: number;       // How high Yui launches herself on Up+Attack
  enemyLaunchForce: number;     // How high enemies are launched
  comboWindowFrames: number;    // Time window to chain input for next animation
  comboKeepAliveFrames: number; // Time before combo counter resets (3s rule)
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

// Animation Types
export type AnimationKey = 'IDLE' | 'RUN' | 'JUMP' | 'FALL' | 'DASH' | 'ATTACK' | 'ATTACK_B' | 'ATTACK_C' | 'ATTACK_AIR_A' | 'ATTACK_DASH_A' | 'WALL_SLIDE' | 'VFX_SLASH' | 'VFX_HIT';

export interface Ghost {
  x: number;
  y: number;
  facingRight: boolean;
  alpha: number;
  anim: AnimationKey;
  frame: number;
}

// NEW: For one-shot visual effects like hits/explosions
export interface OneShotAnim {
  id: string;
  position: Vector2;
  anim: AnimationKey;
  frame: number;
  timer: number;
  rotation: number;
  facingRight: boolean;
  hueRotate?: number; // Shift color (e.g., 120deg for Blue -> Red)
}

// NEW: Damage Popups
export interface DamageNumber {
  id: string;
  value: number;
  position: Vector2;
  velocity: Vector2;
  life: number; // 1.0 to 0.0
  color: string;
  scale: number;
  isCrit: boolean;
}

export interface PlayerState {
  position: Vector2;
  velocity: Vector2;
  
  // State Flags
  isGrounded: boolean;
  isDashing: boolean;
  isWallSliding: boolean;
  isJumping: boolean; // Tracks if we are currently in an active jump arc
  canDoubleJump: boolean; // Tracks availability of mid-air jump
  isAttacking: boolean;   // Combat state
  facingRight: boolean;
  
  // Animation State
  activeAnim: AnimationKey;
  animFrame: number;
  animTimer: number; // Counts up to frameDelay

  // Timers (Frames)
  dashTimer: number;         // Active dash duration
  dashCooldownTimer: number; // Time until next dash
  dashCount: number;         // NEW: Current number of dashes used in chain
  dashChainTimer: number;    // NEW: Time before dash chain resets
  attackTimer: number;       // Active hitbox duration
  attackCooldownTimer: number; // Time until next attack
  
  comboStep: number;         // 0, 1, 2 (Animation Cycle)
  comboCount: number;        // Infinite Hit Counter (HUD)
  comboWindowTimer: number;  // Time to input next attack (Animation chaining)
  comboDropTimer: number;    // Time until Hit Counter resets
  
  canChain: boolean;         // Hit confirmation flag
  coyoteTimer: number;       // Frames since left ground
  jumpBufferTimer: number;   // Frames since jump button pressed
  
  // Gameplay Status (Phase 1)
  health: number;
  maxHealth: number;
  isDead: boolean;
  invincibilityTimer: number;
  respawnPosition: Vector2;

  // Visuals
  color: string;
  leanAngle: number;
  
  // Input tracking
  lastJumpInput: boolean; // To detect button release
  lastDashInput: boolean; // To detect dash button release
  lastAttackInput: boolean; // To detect attack button release
  wallDir: number; // -1 (Left), 1 (Right), 0 (None)
}

// COMPANION (DATA POD)
export interface CompanionState {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  glitchIntensity: number;
  trail: Vector2[];
  mode: 'PASSIVE' | 'ATTACK';
  targetOffset: Vector2; // Relative to player
}

export interface Platform {
  id: string;
  rect: Rect;
  type: 'solid' | 'oneway';
  color: string;
}

export type EnemyState = 'IDLE' | 'PATROL' | 'CHASE' | 'ATTACK' | 'HIT';
export type EnemyType = 'WALKER' | 'TURRET' | 'FLYER';

export interface Enemy {
  id: string;
  type: EnemyType; // NEW
  position: Vector2;
  velocity: Vector2; // NEW
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  color: string;
  hitTimer: number; // Frames to flash white
  
  // AI Properties
  state: EnemyState;
  facingRight: boolean;
  patrolOriginX: number; // Center of patrol
  patrolRange: number;   // Distance to roam
  detectionRange: number;
  attackRange: number;
  attackCooldownTimer: number;
  chargeTimer: number;   // NEW: Wind-up time before attack
  attackDurationTimer: number;
  
  // NEW: Turret Specific
  laserData?: {
      targetX: number;
      targetY: number;
      isFiring: boolean;
  };
}

// NEW: Spawner Logic
export interface Spawner {
  id: string;
  zone: Rect; // The boundary. If enemies leave this, they die/respawn.
  maxEnemies: number;
  spawnInterval: number; // Frames between spawns
  spawnTimer: number;
  enemyTemplate: Partial<Enemy>; // Config to copy for new enemies
  activeEnemyIds: string[]; // Track which enemies belong to this spawner
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

// Level Data
export interface LevelData {
  id: string;
  name: string;
  playerStart: Vector2;
  platforms: Platform[];
  enemies: Enemy[];
  spawners: Spawner[]; // NEW
  pois: PointOfInterest[];
  killPlaneY: number;
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
  companion: CompanionState; 
  platforms: Platform[];
  enemies: Enemy[]; 
  spawners: Spawner[]; // NEW
  pois: PointOfInterest[]; 
  particles: Particle[];
  damageNumbers: DamageNumber[]; // NEW: Floating texts
  activeVfx: OneShotAnim[]; 
  ghosts: Ghost[]; 
  camera: { x: number; y: number; zoom: number }; 
  screenShake: number;
  score: number;
  hitStopTimer: number;
  timeScale: number; // 1.0 = Normal, <1.0 = Slow Motion
  slowMoTimer: number; // Milliseconds remaining for slow motion
}

// Profiler Types
export interface PerformanceStats {
  fps: number;
  frameTimeMs: number;
  particleCount: number;
  platformCount: number;
  memoryUsage?: number;
}
