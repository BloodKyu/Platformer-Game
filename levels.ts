
import { LevelData, Platform, Enemy, PointOfInterest } from './types';
import { COLORS, AI_CONFIG, GAME_CONFIG } from './constants';

export const TUTORIAL_LEVEL: LevelData = {
  id: 'tutorial',
  name: 'SIMULATION: BASIC TRAINING',
  playerStart: { x: 100, y: 500 },
  killPlaneY: 1000,
  platforms: [
    // 1. Walk
    { id: 'floor1', rect: { x: 0, y: 600, width: 600, height: 200 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
    
    // 2. Jump
    { id: 'floor2', rect: { x: 750, y: 600, width: 400, height: 200 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
    
    // 3. Double Jump (High platform)
    { id: 'floor3', rect: { x: 1300, y: 450, width: 400, height: 350 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
    
    // 4. Dash (Long gap)
    { id: 'floor4', rect: { x: 2000, y: 450, width: 400, height: 350 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },

    // 5. Wall Slide (Tall wall)
    { id: 'wall_base', rect: { x: 2600, y: 600, width: 200, height: 200 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
    { id: 'wall_tower', rect: { x: 2600, y: 100, width: 100, height: 500 }, type: 'solid', color: COLORS.PLATFORM_SIDE },
    { id: 'wall_top', rect: { x: 2600, y: 100, width: 400, height: 50 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },

    // 6. Combat Arena
    { id: 'arena', rect: { x: 3200, y: 600, width: 800, height: 200 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
  ],
  enemies: [
    { 
        id: 'dummy1', 
        type: 'WALKER',
        position: { x: 3600, y: 540 }, 
        velocity: { x: 0, y: 0 },
        width: 40, height: 60, 
        health: 100, maxHealth: 100, isDead: false, 
        color: COLORS.ENEMY_PATROL, hitTimer: 0,
        state: 'IDLE', facingRight: false,
        patrolOriginX: 3600, patrolRange: 0, // Stationary dummy
        detectionRange: 0, attackRange: 0, // Doesn't fight back initially
        attackCooldownTimer: 0, attackDurationTimer: 0, chargeTimer: 0
    }
  ],
  spawners: [], // No dynamic spawners in tutorial
  pois: [
    { id: 'txt_move', position: { x: 300, y: 500 }, range: 200, zoomTarget: 1.2, message: 'A / D to MOVE', color: '#60a5fa' },
    { id: 'txt_jump', position: { x: 675, y: 500 }, range: 200, zoomTarget: 1.2, message: 'W or SPACE to JUMP', color: '#60a5fa' },
    { id: 'txt_dbljump', position: { x: 1200, y: 400 }, range: 200, zoomTarget: 1.2, message: 'W in-air to DOUBLE JUMP', color: '#60a5fa' },
    { id: 'txt_dash', position: { x: 1850, y: 400 }, range: 200, zoomTarget: 1.1, message: 'SHIFT to DASH', color: '#60a5fa' },
    { id: 'txt_wall', position: { x: 2500, y: 300 }, range: 250, zoomTarget: 1.0, message: 'Jump to Wall to SLIDE / CLIMB', color: '#60a5fa' },
    { id: 'txt_atk', position: { x: 3300, y: 500 }, range: 300, zoomTarget: 1.2, message: 'SPACE to ATTACK', color: '#ef4444' },
    { id: 'txt_end', position: { x: 3900, y: 500 }, range: 200, zoomTarget: 1.5, message: 'TRAINING COMPLETE', color: '#22c55e' },
  ]
};

export const SANDBOX_LEVEL: LevelData = {
  id: 'sandbox',
  name: 'SECTOR 4: FOUNDRY',
  playerStart: { x: 100, y: 300 },
  killPlaneY: 1500,
  platforms: [
      { id: 'floor', rect: { x: -1000, y: 600, width: 2500, height: 200 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      { id: 'p1', rect: { x: 300, y: 450, width: 200, height: 20 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      { id: 'p2', rect: { x: 600, y: 350, width: 200, height: 20 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      { id: 'p3', rect: { x: 900, y: 250, width: 150, height: 20 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      { id: 'wall', rect: { x: 1200, y: 100, width: 100, height: 500 }, type: 'solid', color: COLORS.PLATFORM_SIDE },
      { id: 'wall2', rect: { x: -200, y: 100, width: 100, height: 500 }, type: 'solid', color: COLORS.PLATFORM_SIDE },
      
      // NEW ARENA FLOOR
      { id: 'arena_floor', rect: { x: 1600, y: 600, width: 1200, height: 200 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      // Optional: Arena "Walls" to discourage leaving visually, though logic handles kill
      { id: 'arena_wall_L', rect: { x: 1580, y: 400, width: 20, height: 400 }, type: 'solid', color: COLORS.PLATFORM_SIDE },
      { id: 'arena_wall_R', rect: { x: 2800, y: 400, width: 20, height: 400 }, type: 'solid', color: COLORS.PLATFORM_SIDE },

  ],
  enemies: [
       { 
           id: 'drone1', 
           type: 'WALKER',
           position: { x: 700, y: 290 }, 
           velocity: { x: 0, y: 0 },
           width: 40, height: 60, 
           health: 100, maxHealth: 100, isDead: false, 
           color: COLORS.ENEMY_PATROL, hitTimer: 0,
           state: 'PATROL', facingRight: true,
           patrolOriginX: 700, patrolRange: 150,
           detectionRange: AI_CONFIG.DETECTION_RANGE, attackRange: AI_CONFIG.ATTACK_RANGE,
           attackCooldownTimer: 0, attackDurationTimer: 0, chargeTimer: 0
       },
       // TRAINING DUMMY 1
       { 
           id: 'training_dummy_1', 
           type: 'WALKER',
           position: { x: 100, y: 540 }, // Near start
           velocity: { x: 0, y: 0 },
           width: 40, height: 60, 
           health: 9999, maxHealth: 9999, isDead: false, 
           color: '#a3a3a3', hitTimer: 0,
           state: 'IDLE', facingRight: false,
           patrolOriginX: 100, patrolRange: 0, // Stationary
           detectionRange: 0, attackRange: 0, // Passive
           attackCooldownTimer: 0, attackDurationTimer: 0, chargeTimer: 0
       }
  ],
  spawners: [
      {
        id: 'arena_spawner',
        zone: { x: 1600, y: -500, width: 1200, height: 1500 }, // Expanded vertical range for flying
        maxEnemies: 10,
        spawnInterval: 120, // 2 Seconds
        spawnTimer: 0,
        activeEnemyIds: [],
        enemyTemplate: {
           width: 40, height: 60,
           health: 60, maxHealth: 60,
           color: '#ef4444', // Red
           state: 'CHASE', // Aggressive
           patrolRange: 300,
           detectionRange: 800,
           attackRange: 60,
        }
      }
  ],
  pois: [
    { 
      id: 'sign1', 
      position: { x: 700, y: 350 }, // On platform p2
      range: 150, 
      zoomTarget: 1.5, 
      message: 'SECTOR 4: FOUNDRY',
      color: '#facc15'
    },
    { 
      id: 'sign_dummy', 
      position: { x: 200, y: 500 }, 
      range: 250, 
      zoomTarget: 1.2, 
      message: 'COMBAT DRILL: 2 TARGETS',
      color: '#ffffff'
    },
    { 
      id: 'sign_arena', 
      position: { x: 2200, y: 500 }, 
      range: 600, 
      zoomTarget: 0.8, 
      message: 'WARNING: LIVE COMBAT ZONE',
      color: '#ef4444'
    }
  ]
};
