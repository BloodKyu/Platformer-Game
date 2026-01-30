import React, { useEffect, useRef } from 'react';
import { PhysicsProfile, GameState, InputCommand, PlayerState, Platform, Vector2, PerformanceStats, PointOfInterest, Enemy, AnimationKey, Ghost, LevelData, CompanionState, OneShotAnim, Spawner, DamageNumber, EnemyType } from '../types';
import { InputSystem } from '../services/inputSystem';
import { AssetManager } from '../services/assetManager';
import { GAME_CONFIG, COLORS, ANIMATION_MANIFEST, AI_CONFIG } from '../constants';

interface GameCanvasProps {
  level: LevelData; 
  physicsProfile: PhysicsProfile;
  fpsLimit: number | 'max';
  spriteScale: number;
  debugHitboxes: boolean; 
  isPaused: boolean; // NEW PROP
  onStatsUpdate?: (stats: PerformanceStats) => void;
  onExit?: () => void; 
}

// --- 1. Math Helpers ---
const approach = (val: number, target: number, maxMove: number): number => {
  return val > target ? Math.max(val - maxMove, target) : Math.min(val + maxMove, target);
};

const dist = (v1: Vector2, v2: Vector2) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

// Helper: Point to Line Segment distance
const distToSegment = (p: Vector2, v: Vector2, w: Vector2) => {
  const l2 = dist(v, w) ** 2;
  if (l2 === 0) return dist(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

// --- 2. Drawing Systems ---
const drawGear = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, rotation: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  
  ctx.beginPath();
  const teeth = 10;
  const outerRadius = radius;
  const innerRadius = radius * 0.85;
  
  for (let i = 0; i < teeth * 2; i++) {
      const angle = (Math.PI * 2 * i) / (teeth * 2);
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ level, physicsProfile, fpsLimit, spriteScale, debugHitboxes, isPaused, onStatsUpdate, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputSystem = useRef<InputSystem>(new InputSystem());
  
  // Use a ref for pause state to avoid restarting the game loop effect on toggle
  const isPausedRef = useRef(isPaused);
  
  // Stores current opacity for foreground objects to allow smooth fading
  const foregroundOpacities = useRef<Map<string, number>>(new Map());
  
  // Initialize Game State from Level Prop
  const gameState = useRef<GameState>({
    player: {
      position: { ...level.playerStart },
      velocity: { x: 0, y: 0 },
      isGrounded: false,
      isDashing: false,
      isWallSliding: false,
      isJumping: false,
      canDoubleJump: true,
      isAttacking: false,
      facingRight: true,
      activeAnim: 'IDLE',
      animFrame: 0,
      animTimer: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
      dashCount: 0,
      dashChainTimer: 0,
      attackTimer: 0,
      attackCooldownTimer: 0,
      
      comboStep: 0,
      comboCount: 0,
      comboWindowTimer: 0,
      comboDropTimer: 0,

      canChain: false,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      wallDir: 0,
      color: COLORS.YUI_BODY,
      leanAngle: 0,
      lastJumpInput: false,
      lastDashInput: false,
      lastAttackInput: false,
      health: GAME_CONFIG.PLAYER_MAX_HEALTH,
      maxHealth: GAME_CONFIG.PLAYER_MAX_HEALTH,
      isDead: false,
      invincibilityTimer: 0,
      respawnPosition: { ...level.playerStart },
    },
    companion: {
        position: { x: level.playerStart.x - 40, y: level.playerStart.y - 40 },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        glitchIntensity: 0,
        trail: [],
        mode: 'PASSIVE',
        targetOffset: { x: 0, y: 0 }
    },
    platforms: JSON.parse(JSON.stringify(level.platforms)),
    enemies: JSON.parse(JSON.stringify(level.enemies)),
    spawners: JSON.parse(JSON.stringify(level.spawners || [])),
    pois: JSON.parse(JSON.stringify(level.pois)),
    particles: [],
    damageNumbers: [], // Init empty
    activeVfx: [],
    ghosts: [],
    camera: { x: 0, y: 0, zoom: 1.0 },
    screenShake: 0,
    score: 0,
    hitStopTimer: 0,
    timeScale: 1.0,
    slowMoTimer: 0
  });

  const perfRef = useRef({ 
      lastTime: 0, 
      frameCount: 0, 
      lastStatsUpdate: 0,
      accumulator: 0,
      lastDrawTime: 0 
  });

  // Sync ref with prop
  useEffect(() => {
      isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    // This loads all assets defined in ANIMATION_MANIFEST, including VFX_SLASH now.
    AssetManager.init();
    
    // Reset state when level prop changes
    gameState.current.platforms = JSON.parse(JSON.stringify(level.platforms));
    gameState.current.enemies = JSON.parse(JSON.stringify(level.enemies));
    gameState.current.spawners = JSON.parse(JSON.stringify(level.spawners || []));
    gameState.current.pois = JSON.parse(JSON.stringify(level.pois));
    gameState.current.player.position = { ...level.playerStart };
    gameState.current.player.respawnPosition = { ...level.playerStart };
    gameState.current.player.velocity = { x: 0, y: 0 };
    gameState.current.companion.position = { x: level.playerStart.x - 40, y: level.playerStart.y - 40 };
    gameState.current.particles = [];
    gameState.current.damageNumbers = [];
    gameState.current.activeVfx = [];
    foregroundOpacities.current.clear(); // Reset fade states
    gameState.current.hitStopTimer = 0;
    gameState.current.timeScale = 1.0;
    gameState.current.slowMoTimer = 0;
    
  }, [level]); 

  // ----------------------------------------------------------------------
  // PHYSICS ENGINE (FLUID UPDATE - FIXED 60HZ)
  // ----------------------------------------------------------------------
  const updatePhysics = (profile: PhysicsProfile) => {
    const state = gameState.current;
    
    // 0. HIT STOP / IMPACT FREEZE
    if (state.hitStopTimer > 0) {
        state.hitStopTimer--;
        return;
    }

    const player = state.player;
    const input = inputSystem.current.getState();

    // 0.5 DEATH CHECK
    if (player.health <= 0 || player.position.y > level.killPlaneY) {
        if (!player.isDead) {
            player.isDead = true;
            state.screenShake = 10;
            spawnParticles(player.position, 20, '#ef4444', 8);
            setTimeout(() => {
                player.isDead = false;
                player.health = player.maxHealth;
                player.position = { ...player.respawnPosition };
                player.velocity = { x: 0, y: 0 };
                player.invincibilityTimer = 60; 
                state.companion.position = { x: player.position.x, y: player.position.y - 50 }; // Snap companion
            }, 1000);
        }
        return; 
    }

    // --- 1. State Management & Timers ---
    if (player.dashTimer > 0) player.dashTimer--;
    
    if (player.dashCooldownTimer > 0) {
        player.dashCooldownTimer--;
        // RECHARGE LOGIC: If the long cooldown finishes (reached max dashes), reset count
        if (player.dashCooldownTimer === 0 && player.dashCount >= profile.maxDashes) {
            player.dashCount = 0;
        }
    }

    if (player.attackTimer > 0) player.attackTimer--;
    if (player.attackCooldownTimer > 0) player.attackCooldownTimer--;
    
    // Dash Chain Reset Logic (For non-maxed states)
    if (player.dashChainTimer > 0) {
        player.dashChainTimer--;
        // Only reset if we are NOT in the penalty cooldown (meaning we just stopped dashing)
        if (player.dashChainTimer === 0 && player.dashCount < profile.maxDashes) {
            player.dashCount = 0; 
        }
    }
    
    // Chaining timers
    if (player.comboWindowTimer > 0) player.comboWindowTimer--;
    
    // Combo Keep Alive (The 3 Second Rule)
    if (player.comboDropTimer > 0) {
        player.comboDropTimer--;
        if (player.comboDropTimer === 0) {
            // Timer expired, reset the infinite count
            player.comboCount = 0;
        }
    }

    if (player.coyoteTimer > 0) player.coyoteTimer--;
    if (player.jumpBufferTimer > 0) player.jumpBufferTimer--;
    if (player.invincibilityTimer > 0) player.invincibilityTimer--;

    // Input Buffering
    if (input[InputCommand.JUMP] && !player.lastJumpInput) {
      player.jumpBufferTimer = profile.jumpBufferFrames;
    }
    player.lastJumpInput = input[InputCommand.JUMP];

    const moveInput = (input[InputCommand.RIGHT] ? 1 : 0) - (input[InputCommand.LEFT] ? 1 : 0);

    // --- 2. Combat (Player Attack - Infinite Combo Logic) ---
    if (input[InputCommand.ATTACK] && !player.lastAttackInput) {
        
        // --- CHECK 1: DASH ATTACK (Priority) ---
        // Trigger condition: Is dashing. Removed timer check to ensure consistent dash attacks.
        if (player.isDashing) {
             player.isDashing = false; // CANCEL DASH
             player.isAttacking = true;
             player.attackTimer = profile.attackDurationFrames;
             player.attackCooldownTimer = profile.attackCooldownFrames;
             
             player.activeAnim = 'ATTACK_DASH_A';
             player.animFrame = 0;
             player.animTimer = 0;
             
             // Maintain high velocity
             const dashDir = player.facingRight ? 1 : -1;
             player.velocity.x = dashDir * profile.dashSpeed * 0.8;
             
             spawnParticles(player.position, 10, COLORS.YUI_WEAPON, 12);
        }
        // --- CHECK 2: Standard Attack ---
        else if (player.attackCooldownTimer === 0) {
            
            // --- NEW: AIR LAUNCHER CHECK (Hold UP + Attack) ---
            const isUpHeld = input[InputCommand.JUMP]; // W/UP is mapped to JUMP input
            if (isUpHeld) {
                player.jumpBufferTimer = 0; 
                
                player.isAttacking = true;
                player.attackTimer = profile.attackDurationFrames;
                player.attackCooldownTimer = profile.attackCooldownFrames * 1.5; 
                
                player.activeAnim = 'ATTACK_AIR_A';
                player.animFrame = 0;
                player.animTimer = 0;

                // LAUNCH SELF
                player.velocity.y = -profile.airLaunchForce;
                player.isGrounded = false;
                player.canDoubleJump = true; 
            } 
            else {
                // ... STANDARD COMBO LOGIC ...
                if (player.comboWindowTimer > 0) {
                    player.comboStep = (player.comboStep + 1) % 3;
                } else {
                    player.comboStep = 0;
                }

                player.isAttacking = true;
                player.attackTimer = profile.attackDurationFrames;
                player.attackCooldownTimer = profile.attackCooldownFrames;
                
                // Set Animation based on Step
                if (player.comboStep === 0) player.activeAnim = 'ATTACK';
                else if (player.comboStep === 1) player.activeAnim = 'ATTACK_B';
                else player.activeAnim = 'ATTACK_C';
                
                player.animFrame = 0;
                player.animTimer = 0;

                // GAP CLOSER MECHANIC
                const startDir = player.facingRight ? 1 : -1;
                player.velocity.x = startDir * profile.attackLungeSpeed * 0.4;
                
                // Open window for next animation chain input
                player.comboWindowTimer = profile.attackCooldownFrames + profile.comboWindowFrames;
            }
        }
        
        // --- HIT DETECTION (RUNS FOR ALL ATTACKS) ---
        if (player.isAttacking) {
            const isLauncher = player.activeAnim === 'ATTACK_AIR_A';
            const isDashAttack = player.activeAnim === 'ATTACK_DASH_A';
            const baseDamage = 25 + (Math.min(player.comboCount, 10) * 5); 
            
            let hbY = player.position.y - 10;
            let hbH = 64;
            let hbW = 64 + (player.comboStep * 10);

            if (isLauncher) {
                hbY = player.position.y - 40;
                hbH = 100;
            } else if (isDashAttack) {
                hbY = player.position.y; // Lower
                hbH = 40; // Wide and low
                hbW = 100;
            }

            const attackHitbox = {
                x: player.facingRight ? player.position.x + 32 : player.position.x - hbW,
                y: hbY,
                width: hbW, 
                height: hbH
            };

            let hitLanded = false;
            let knockbackForceApplied = 0;

            state.enemies.forEach(enemy => {
                if (enemy.isDead) return;
                
                if (attackHitbox.x < enemy.position.x + enemy.width &&
                    attackHitbox.x + attackHitbox.width > enemy.position.x &&
                    attackHitbox.y < enemy.position.y + enemy.height &&
                    attackHitbox.y + attackHitbox.height > enemy.position.y) {
                    
                    hitLanded = true;

                    // --- CRITICAL HIT LOGIC ---
                    // Crit if: Combo finisher (25%), Air Launcher, or Dash Attack
                    const isCrit = (player.comboStep === 2 && Math.random() < 0.25) || isLauncher || isDashAttack;
                    
                    // APPLY MULTIPLIER
                    const finalDamage = isCrit ? Math.floor(baseDamage * 1.5) : baseDamage;

                    enemy.health -= finalDamage;
                    enemy.hitTimer = 15; 
                    
                    if (enemy.health > 5000) enemy.health = enemy.maxHealth;

                    // --- SPAWN DAMAGE NUMBER ---
                    const centerX = enemy.position.x + enemy.width / 2;
                    const topY = enemy.position.y;
                    
                    spawnDamageNumber({ x: centerX, y: topY }, finalDamage, isCrit ? '#fbbf24' : '#ffffff', isCrit);

                    // --- KNOCKBACK & LAUNCH LOGIC ---
                    const knockbackDir = player.facingRight ? 1 : -1;
                    
                    if (isLauncher) {
                         // LAUNCH ENEMY UP
                         enemy.velocity.y = -profile.enemyLaunchForce;
                         enemy.velocity.x = knockbackDir * 2; 
                         spawnParticles({ x: centerX, y: topY + 20 }, 15, COLORS.YUI_ACCENT, 8);
                    } else if (isDashAttack) {
                         // KNOCK ENEMY AWAY FAST
                         enemy.velocity.x = knockbackDir * 20;
                         enemy.velocity.y = -2;
                    } else {
                         // STANDARD PUSH BACK
                         const baseKB = 12 + (player.comboCount * 0.5); 
                         knockbackForceApplied = Math.max(knockbackForceApplied, baseKB);
                         enemy.velocity.x = knockbackDir * baseKB;
                         enemy.velocity.y = -4; 
                    }
                    
                    if (enemy.maxHealth < 5000) enemy.state = 'HIT'; 
                    
                    spawnVfx({ x: centerX, y: topY + 30 }, 'VFX_HIT', player.facingRight);
                    spawnParticles({ x: centerX, y: topY + 30 }, 10, '#ffffff', 5);

                    if (enemy.health <= 0) {
                        enemy.isDead = true;
                        spawnParticles({ x: centerX, y: topY + 30 }, 30, enemy.color, 8);
                    }
                }
            });

            if (hitLanded) {
                player.comboCount++; 
                player.comboDropTimer = profile.comboKeepAliveFrames; 
                state.screenShake = (isLauncher || isDashAttack) ? 8 : 3 + (Math.min(player.comboCount, 10) * 0.5); 
                
                if (!isLauncher && !isDashAttack) {
                    // HIT CONFIRMATION & CHASE LOGIC (Standard only)
                    const lungeDir = player.facingRight ? 1 : -1;
                    const chaseSpeed = Math.max(Math.abs(player.velocity.x), profile.attackLungeSpeed, knockbackForceApplied * 1.05);
                    player.velocity.x = lungeDir * chaseSpeed;
                }

                const freezeFrames = (isLauncher || isDashAttack) ? 8 : (player.comboStep === 2 ? 10 : 3);
                state.hitStopTimer = freezeFrames;

                // --- DASH ATTACK SLOW MOTION ---
                if (isDashAttack) {
                    state.timeScale = 0.2; // 20% speed
                    state.slowMoTimer = 1000; // 1 second duration
                }
            }
        }
    }
    player.lastAttackInput = input[InputCommand.ATTACK];

    if (player.attackTimer <= 0) player.isAttacking = false;

    // --- 3. Dash Mechanic (UPDATED: MULTI-DASH) ---
    if (input[InputCommand.DASH] && !player.lastDashInput && !player.isDashing) {
      // Check cooldown and count
      if (player.dashCooldownTimer === 0) {
          if (player.dashCount < profile.maxDashes) {
              player.isDashing = true;
              player.dashTimer = profile.dashDurationFrames;
              player.invincibilityTimer = profile.dashDurationFrames;
              
              // Increment Dash Chain
              player.dashCount++;
              
              if (player.dashCount >= profile.maxDashes) {
                  player.dashCooldownTimer = 120; // Long cooldown after 3rd dash
              } else {
                  player.dashCooldownTimer = 15; // Short cooldown between dashes
              }
              player.dashChainTimer = 60; // Reset chain if not used within 1 sec

              const dashDir = moveInput !== 0 ? moveInput : (player.facingRight ? 1 : -1);
              player.velocity.x = dashDir * profile.dashSpeed;
              player.velocity.y = 0; 
              
              state.screenShake = 5;
              spawnParticles(player.position, 10, COLORS.YUI_ACCENT, 6);
          }
      }
    }
    player.lastDashInput = input[InputCommand.DASH];

    if (player.isDashing) {
      if (player.dashTimer <= 0) {
        player.isDashing = false;
        player.velocity.x *= 0.6; 
      } else {
        movePlayer(player, state.platforms, true); 
        if (player.dashTimer % 3 === 0) {
             state.ghosts.push({
                 x: player.position.x,
                 y: player.position.y,
                 facingRight: player.facingRight,
                 alpha: 0.8,
                 anim: player.activeAnim,
                 frame: player.animFrame
             });
        }
        return; 
      }
    }

    // --- 3.5 Ghost Management ---
    for (let i = state.ghosts.length - 1; i >= 0; i--) {
        state.ghosts[i].alpha -= 0.08;
        if (state.ghosts[i].alpha <= 0) {
            state.ghosts.splice(i, 1);
        }
    }


    // --- 4. Horizontal Movement ---
    if (player.isAttacking && player.isGrounded) {
        player.velocity.x = approach(player.velocity.x, 0, profile.groundDecel * 0.5); // Slide a bit
    } else {
        const targetSpeed = moveInput * profile.runSpeed;
        if (player.isGrounded) {
           if (moveInput !== 0) player.velocity.x = approach(player.velocity.x, targetSpeed, profile.groundAccel);
           else player.velocity.x = approach(player.velocity.x, 0, profile.groundDecel);
        } else {
           if (moveInput !== 0) player.velocity.x = approach(player.velocity.x, targetSpeed, profile.airAccel);
           else player.velocity.x = approach(player.velocity.x, 0, profile.airDecel);
        }
        if (moveInput !== 0 && !player.isDashing) player.facingRight = moveInput > 0;
    }

    // --- 5. Wall & Gravity ---
    player.wallDir = 0;
    if (checkWallOverlap(player, state.platforms, -1)) player.wallDir = -1;
    if (checkWallOverlap(player, state.platforms, 1)) player.wallDir = 1;

    player.isWallSliding = false;
    if (player.wallDir !== 0 && !player.isGrounded && player.velocity.y > 0) {
        if ((player.wallDir === 1 && moveInput >= 0) || (player.wallDir === -1 && moveInput <= 0)) {
           player.isWallSliding = true;
           if (player.velocity.y > profile.wallSlideSpeed) {
             player.velocity.y = approach(player.velocity.y, profile.wallSlideSpeed, 0.5);
           }
        }
    }

    if (!player.isWallSliding) {
        let appliedGravity = profile.gravity;
        let appliedTerminal = profile.terminalVelocity;

        if (input[InputCommand.DOWN] && player.velocity.y > -5) { 
            appliedGravity *= 2.5;
            appliedTerminal *= 1.5;
        }

        player.velocity.y += appliedGravity;
        if (player.velocity.y > appliedTerminal) player.velocity.y = appliedTerminal;
    }

    // --- 6. Jumping ---
    if (player.jumpBufferTimer > 0 && player.isWallSliding) {
        player.jumpBufferTimer = 0;
        player.isWallSliding = false;
        player.canDoubleJump = true; 
        const jumpDir = -player.wallDir;
        player.velocity.x = jumpDir * profile.wallJumpForce.x;
        player.velocity.y = -profile.wallJumpForce.y;
        player.facingRight = jumpDir > 0;
        spawnParticles(player.position, 5, '#ffffff', 3);
    }
    else if (player.jumpBufferTimer > 0 && (player.isGrounded || player.coyoteTimer > 0)) {
        player.jumpBufferTimer = 0;
        player.coyoteTimer = 0;
        player.isGrounded = false;
        player.isJumping = true;
        player.canDoubleJump = true; 
        player.velocity.y = -profile.jumpForce;
        spawnParticles({x: player.position.x, y: player.position.y + 64}, 8, '#ffffff', 2);
    }
    else if (player.jumpBufferTimer > 0 && player.canDoubleJump && !player.isGrounded && !player.isWallSliding) {
        player.jumpBufferTimer = 0;
        player.canDoubleJump = false; 
        player.isJumping = true;
        player.velocity.y = -profile.doubleJumpForce;
        spawnParticles({x: player.position.x, y: player.position.y + 64}, 8, COLORS.YUI_ACCENT, 4);
    }

    if (!input[InputCommand.JUMP] && player.isJumping && player.velocity.y < 0) {
        player.velocity.y *= profile.jumpCutMultiplier;
        player.isJumping = false;
    }

    // --- 7. Movement & Collision ---
    movePlayer(player, state.platforms, false);

    if (player.isGrounded) {
      player.coyoteTimer = profile.coyoteFrames;
      player.isJumping = false;
      player.isWallSliding = false;
      player.canDoubleJump = true; 
      if (Math.abs(player.velocity.x) < 0.1) {
          player.respawnPosition = { x: player.position.x, y: player.position.y };
      }
    }

    // --- 8. UPDATE COMPANION (DATA POD) ---
    updateCompanion(state, player);

    // --- 8.5 UPDATE SPAWNERS (Endless Arena Logic) ---
    updateSpawners(state);

    // --- 8.6 AI & ENEMY UPDATE ---
    updateEnemies(state, profile);

    // --- 8.7 ENTITY COLLISION RESOLUTION (Body Blocking) ---
    // This happens AFTER all movement to prevent entities from being inside each other
    resolveEntityCollisions(state);

    // --- 8.8 UPDATE VFX & DAMAGE NUMBERS ---
    updateVfx(state.activeVfx);
    updateDamageNumbers(state.damageNumbers);

    // --- 9. ANIMATION & VISUALS ---
    let nextAnim: AnimationKey = 'IDLE';

    if (player.isAttacking) {
        if (player.activeAnim === 'ATTACK_AIR_A') nextAnim = 'ATTACK_AIR_A'; 
        else if (player.activeAnim === 'ATTACK_DASH_A') nextAnim = 'ATTACK_DASH_A';
        else if (player.comboStep === 0) nextAnim = 'ATTACK';
        else if (player.comboStep === 1) nextAnim = 'ATTACK_B';
        else nextAnim = 'ATTACK_C';
    }
    else if (player.isDashing) nextAnim = 'DASH';
    else if (player.isWallSliding) nextAnim = 'WALL_SLIDE';
    else if (!player.isGrounded) nextAnim = player.velocity.y < 0 ? 'JUMP' : 'FALL';
    else if (Math.abs(player.velocity.x) > 0.5) nextAnim = 'RUN';

    if (nextAnim !== player.activeAnim) {
        player.activeAnim = nextAnim;
        player.animFrame = 0;
        player.animTimer = 0;
    } else {
        const config = ANIMATION_MANIFEST[player.activeAnim];
        player.animTimer++;
        if (player.animTimer >= config.frameDelay) {
            player.animTimer = 0;
            player.animFrame++;
            if (player.animFrame >= config.count) {
                if (config.loop) player.animFrame = 0;
                else player.animFrame = config.count - 1; 
            }
        }
    }

    const targetLean = (player.velocity.x / profile.runSpeed) * 0.3;
    player.leanAngle += (targetLean - player.leanAngle) * 0.2;

    if (state.screenShake > 0) state.screenShake *= 0.9;
    if (state.screenShake < 0.5) state.screenShake = 0;
    
    // --- CAMERA LOGIC (DYNAMIC FRAMING) ---
    const pCenter = { 
        x: player.position.x + GAME_CONFIG.PLAYER_SIZE.width / 2,
        y: player.position.y + GAME_CONFIG.PLAYER_SIZE.height / 2
    };

    const activeTargets = [pCenter];
    let inCombat = false;
    
    state.enemies.forEach(enemy => {
        if (enemy.isDead) return;
        const eCenter = { x: enemy.position.x + enemy.width / 2, y: enemy.position.y + enemy.height / 2 };
        
        const effectiveRange = Math.max(enemy.detectionRange * 1.2, 350); 
        
        if (dist(player.position, enemy.position) < effectiveRange) {
            activeTargets.push(eCenter);
            inCombat = true;
        }
    });

    let targetZoom = 1.0;
    let camTargetX = 0;
    let camTargetY = 0;

    if (inCombat && activeTargets.length > 1) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        activeTargets.forEach(t => {
            if (t.x < minX) minX = t.x;
            if (t.x > maxX) maxX = t.x;
            if (t.y < minY) minY = t.y;
            if (t.y > maxY) maxY = t.y;
        });

        const comboFactor = Math.min(player.comboCount, 20);
        
        const paddingX = 300 - (comboFactor * 12); 
        const paddingY = 200 - (comboFactor * 8); 
        
        const reqW = (maxX - minX) + paddingX;
        const reqH = (maxY - minY) + paddingY;

        const zoomX = GAME_CONFIG.CANVAS_WIDTH / reqW;
        const zoomY = GAME_CONFIG.CANVAS_HEIGHT / reqH;
        
        targetZoom = Math.min(zoomX, zoomY);
        
        const maxZoomLimit = 1.3 + (comboFactor * 0.025); 
        
        targetZoom = Math.max(0.6, Math.min(targetZoom, maxZoomLimit)); 

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        camTargetX = centerX - GAME_CONFIG.CANVAS_WIDTH / 2;
        camTargetY = centerY - GAME_CONFIG.CANVAS_HEIGHT / 2;

    } else {
        let lookAheadX = 0;
        let lookAheadY = 0;

        if (Math.abs(player.velocity.x) > 1.0) {
            lookAheadX = player.velocity.x * 20; 
        } else {
            lookAheadX = player.facingRight ? 120 : -120;
        }

        if (player.velocity.y > 8) {
            lookAheadY = player.velocity.y * 10;
        }

        lookAheadX = Math.max(-300, Math.min(300, lookAheadX));
        lookAheadY = Math.max(-100, Math.min(200, lookAheadY));

        camTargetX = (player.position.x + lookAheadX) - GAME_CONFIG.CANVAS_WIDTH / 2;
        camTargetY = (player.position.y + lookAheadY - 50) - GAME_CONFIG.CANVAS_HEIGHT / 2;

        for (const poi of state.pois) {
            if (dist(player.position, poi.position) < poi.range) {
                targetZoom = poi.zoomTarget;
                break;
            }
        }
    }

    state.camera.x += (camTargetX - state.camera.x) * 0.08; 
    state.camera.y += (camTargetY - state.camera.y) * 0.08;
    state.camera.zoom += (targetZoom - state.camera.zoom) * 0.05;

    updateParticles(state.particles);
  };

  // --- COLLISION RESOLUTION ---
  const resolveEntityCollisions = (state: GameState) => {
      const entities = [...state.enemies.filter(e => !e.isDead)];
      
      // 1. Enemy vs Enemy
      for (let i = 0; i < entities.length; i++) {
          const e1 = entities[i];
          for (let j = i + 1; j < entities.length; j++) {
              const e2 = entities[j];
              solveOverlap(e1, e1.width, e1.height, e2, e2.width, e2.height, 0.5); // 0.5 = push both equally
          }
      }

      // 2. Player vs Enemies
      const p = state.player;
      const pW = GAME_CONFIG.PLAYER_SIZE.width;
      const pH = GAME_CONFIG.PLAYER_SIZE.height;
      
      for (const e of entities) {
          // Push player and enemy apart. 0.5 weight means they shove each other equally.
          solveOverlap(p, pW, pH, e, e.width, e.height, 0.5);
      }
  };

  const solveOverlap = (e1: any, w1: number, h1: number, e2: any, w2: number, h2: number, weight: number) => {
      const c1 = { x: e1.position.x + w1/2, y: e1.position.y + h1/2 };
      const c2 = { x: e2.position.x + w2/2, y: e2.position.y + h2/2 };
      
      const dx = c1.x - c2.x;
      const dy = c1.y - c2.y;
      
      const minDistX = (w1 + w2) / 2;
      const minDistY = (h1 + h2) / 2;
      
      if (Math.abs(dx) < minDistX && Math.abs(dy) < minDistY) {
          const overlapX = minDistX - Math.abs(dx);
          const overlapY = minDistY - Math.abs(dy);
          
          // Resolve along shallowest axis
          if (overlapX < overlapY) {
              const separation = overlapX;
              const dir = dx > 0 ? 1 : -1;
              
              e1.position.x += separation * weight * dir;
              e2.position.x -= separation * (1-weight) * dir;
              
              // Kill velocity into the collision to prevent stickiness
              e1.velocity.x *= 0.5;
              e2.velocity.x *= 0.5;
          } else {
              const separation = overlapY;
              const dir = dy > 0 ? 1 : -1;
              
              e1.position.y += separation * weight * dir;
              e2.position.y -= separation * (1-weight) * dir;

              e1.velocity.y = 0;
              e2.velocity.y = 0;
          }
      }
  };

  const updateSpawners = (state: GameState) => {
    state.spawners.forEach(spawner => {
        // 1. Cleanup & Boundary Check
        for (let i = spawner.activeEnemyIds.length - 1; i >= 0; i--) {
            const id = spawner.activeEnemyIds[i];
            const enemy = state.enemies.find(e => e.id === id);

            if (!enemy || enemy.isDead) {
                // Remove tracked ID if dead or missing
                spawner.activeEnemyIds.splice(i, 1);
                continue;
            }

            // Check Bounds
            const cx = enemy.position.x + enemy.width / 2;
            const cy = enemy.position.y + enemy.height / 2;
            
            const inBounds = (
                cx >= spawner.zone.x && 
                cx <= spawner.zone.x + spawner.zone.width &&
                // Relaxed TOP check to allow high flying
                // cy >= spawner.zone.y && 
                cy <= spawner.zone.y + spawner.zone.height
            );

            if (!inBounds) {
                // Kill enemy if outside arena
                enemy.isDead = true;
                enemy.health = 0;
                spawnParticles({x: cx, y: cy}, 10, '#ef4444', 5);
                spawner.activeEnemyIds.splice(i, 1);
            }
        }

        // 2. Spawn Logic
        if (spawner.activeEnemyIds.length < spawner.maxEnemies) {
            spawner.spawnTimer--;
            if (spawner.spawnTimer <= 0) {
                // Spawn
                const newId = `spawn_${spawner.id}_${Date.now()}_${Math.random()}`;
                const spawnX = spawner.zone.x + Math.random() * (spawner.zone.width - 40);
                const spawnY = spawner.zone.y + 50; 
                
                // RANDOMIZE ENEMY TYPE
                const rand = Math.random();
                let type: EnemyType = 'WALKER';
                let color = COLORS.ENEMY_CHASE;
                let maxHealth = 60;
                let attackRange = 60;
                let width = 40;
                let height = 60;

                if (rand > 0.7) {
                    type = 'FLYER';
                    color = COLORS.ENEMY_FLYER;
                    maxHealth = 40; // Fragile but mobile
                    attackRange = 400; // Trigger charge from far
                    width = 40;
                    height = 40;
                } else if (rand > 0.4) {
                    type = 'TURRET';
                    color = COLORS.ENEMY_TURRET;
                    maxHealth = 80; // Tanky
                    attackRange = 500; // Long range laser
                    width = 50;
                    height = 50;
                }

                const newEnemy: Enemy = {
                    id: newId,
                    type: type,
                    position: { x: spawnX, y: spawnY },
                    velocity: { x: 0, y: 0 },
                    width: width, height: height,
                    health: maxHealth, maxHealth: maxHealth, isDead: false,
                    color: color,
                    hitTimer: 0,
                    state: 'CHASE',
                    facingRight: Math.random() > 0.5,
                    patrolOriginX: spawnX,
                    patrolRange: 0,
                    detectionRange: 600,
                    attackRange: attackRange,
                    attackCooldownTimer: 0,
                    attackDurationTimer: 0,
                    chargeTimer: 0, 
                    ...spawner.enemyTemplate // Allows overrides if spawner forces specific props
                };
                
                state.enemies.push(newEnemy);
                spawner.activeEnemyIds.push(newId);
                spawner.spawnTimer = spawner.spawnInterval;
                
                // Spawn Effect
                spawnParticles(newEnemy.position, 15, '#ffffff', 3);
            }
        }
    });
  };

  const updateCompanion = (state: GameState, player: PlayerState) => {
      const comp = state.companion;
      const time = Date.now() / 200; // For bobbing

      if (Math.random() < 0.02) { 
          comp.glitchIntensity = Math.random() * 0.8;
      }
      comp.glitchIntensity *= 0.85; 
      if(comp.glitchIntensity < 0.01) comp.glitchIntensity = 0;

      let targetPos = { x: 0, y: 0 };
      
      if (player.isAttacking) {
          comp.mode = 'ATTACK';
          comp.glitchIntensity = 1.0; 
          
          const offset = player.facingRight ? 40 : -10;
          targetPos.x = player.position.x + offset + 16; 
          targetPos.y = player.position.y + 20; 
      } else {
          comp.mode = 'PASSIVE';
          const lagOffset = player.facingRight ? -40 : 40; 
          const bobY = Math.sin(time) * 5;
          targetPos.x = player.position.x + lagOffset;
          targetPos.y = player.position.y - 20 + bobY; 
      }

      const stiffness = comp.mode === 'ATTACK' ? 0.6 : 0.02; 
      const damping = comp.mode === 'ATTACK' ? 0.5 : 0.90; 

      const ax = (targetPos.x - comp.position.x) * stiffness;
      const ay = (targetPos.y - comp.position.y) * stiffness;

      comp.velocity.x += ax;
      comp.velocity.y += ay;
      comp.velocity.x *= damping;
      comp.velocity.y *= damping;

      comp.position.x += comp.velocity.x;
      comp.position.y += comp.velocity.y;

      comp.rotation += (comp.mode === 'ATTACK' ? 0.5 : 0.02) + (comp.glitchIntensity * 0.5);

      if (Math.abs(comp.velocity.x) > 1 || Math.abs(comp.velocity.y) > 1) {
          comp.trail.push({ ...comp.position });
          if (comp.trail.length > 5) comp.trail.shift();
      } else if (comp.trail.length > 0) {
          comp.trail.shift(); 
      }
  };

  // ----------------------------------------------------------------------
  // AI LOGIC
  // ----------------------------------------------------------------------
  const updateEnemies = (state: GameState, profile: PhysicsProfile) => {
      const player = state.player;
      state.enemies.forEach(enemy => {
          if (enemy.isDead) return;
          if (enemy.hitTimer > 0) enemy.hitTimer--;
          if (enemy.attackCooldownTimer > 0) enemy.attackCooldownTimer--;
          if (enemy.attackDurationTimer > 0) enemy.attackDurationTimer--;

          // Training Dummy Physics
          if (enemy.maxHealth > 5000) {
              enemy.velocity.x *= 0.85; 
              if(Math.abs(enemy.velocity.x) < 0.1) enemy.velocity.x = 0;
              enemy.velocity.y += profile.gravity;
              enemy.position.y += enemy.velocity.y;
              for (const plat of state.platforms) {
                  if (checkEntityAABB(enemy, plat, 0, 0)) {
                      if (enemy.velocity.y > 0) {
                          enemy.position.y = plat.rect.y - enemy.height;
                          enemy.velocity.y = 0;
                      }
                  }
              }
              enemy.position.x += enemy.velocity.x;
              return; 
          }

          const distanceToPlayer = dist(enemy.position, player.position);
          
          // --- TYPE SPECIFIC AI ---
          if (enemy.type === 'FLYER') {
              // FLYER AI: No gravity, hover, kamikaze
              switch(enemy.state) {
                  case 'CHASE': // Hovering near player
                      const targetX = player.position.x + (Math.sin(Date.now()/500) * 100);
                      const targetY = player.position.y - 150 + (Math.cos(Date.now()/300) * 50);
                      
                      const dx = targetX - enemy.position.x;
                      const dy = targetY - enemy.position.y;
                      
                      enemy.velocity.x += dx * 0.005;
                      enemy.velocity.y += dy * 0.005;
                      
                      // Air friction
                      enemy.velocity.x *= 0.95;
                      enemy.velocity.y *= 0.95;

                      if (enemy.attackCooldownTimer <= 0 && distanceToPlayer < enemy.attackRange) {
                          enemy.state = 'ATTACK';
                          enemy.chargeTimer = 60; // 1 Second windup
                          enemy.velocity.x = 0;
                          enemy.velocity.y = 0;
                      }
                      break;
                  case 'ATTACK':
                      if (enemy.chargeTimer > 0) {
                          // Tracking player during charge (slowly)
                          const pdx = player.position.x - enemy.position.x;
                          const pdy = player.position.y - enemy.position.y;
                          const angle = Math.atan2(pdy, pdx);
                          
                          // Store attack vector for the dive
                          enemy.velocity.x = Math.cos(angle) * 15; // Fast dive speed
                          enemy.velocity.y = Math.sin(angle) * 15;
                          
                          enemy.chargeTimer--;
                          if (enemy.chargeTimer === 0) {
                              enemy.attackDurationTimer = 30; // Dive duration
                          }
                      } else if (enemy.attackDurationTimer > 0) {
                          // DIVE PHASE - No friction, straight line
                          // Logic handled in movement application below
                          
                          // Hit detection
                          if (player.invincibilityTimer === 0 && !player.isDead) {
                              if (checkRectOverlap(player.position, GAME_CONFIG.PLAYER_SIZE, enemy.position, { width: enemy.width, height: enemy.height })) {
                                  damagePlayer(player, 20, enemy.position.x);
                                  enemy.attackDurationTimer = 0; // Stop dive on hit
                              }
                          }
                          
                          if (enemy.attackDurationTimer === 1) {
                              enemy.state = 'CHASE';
                              enemy.attackCooldownTimer = 120;
                          }
                      }
                      break;
                  case 'HIT':
                      enemy.velocity.x *= 0.9;
                      enemy.velocity.y *= 0.9;
                      if (enemy.hitTimer <= 0) enemy.state = 'CHASE';
                      break;
              }
              
              // Move Flyer with COLLISION
              // X Axis
              enemy.position.x += enemy.velocity.x;
              for (const plat of state.platforms) {
                  // Only interact with SOLID platforms
                  if (plat.type === 'solid' && checkEntityAABB(enemy, plat, 0, 0)) {
                      // Resolve X Overlap
                      if (enemy.velocity.x > 0) {
                          enemy.position.x = plat.rect.x - enemy.width;
                      } else if (enemy.velocity.x < 0) {
                          enemy.position.x = plat.rect.x + plat.rect.width;
                      }
                      enemy.velocity.x = 0;
                      
                      // CRASH LOGIC
                      if (enemy.state === 'ATTACK' && enemy.attackDurationTimer > 0) {
                           enemy.state = 'CHASE'; 
                           enemy.attackDurationTimer = 0;
                           enemy.attackCooldownTimer = 60; // Dazed
                           gameState.current.screenShake = 3;
                           // Impact VFX
                           spawnParticles(enemy.position, 8, '#ffffff', 4);
                      }
                  }
              }

              // Y Axis
              enemy.position.y += enemy.velocity.y;
              for (const plat of state.platforms) {
                  if (plat.type === 'solid' && checkEntityAABB(enemy, plat, 0, 0)) {
                      // Resolve Y Overlap
                      if (enemy.velocity.y > 0) {
                          enemy.position.y = plat.rect.y - enemy.height;
                      } else if (enemy.velocity.y < 0) {
                          enemy.position.y = plat.rect.y + plat.rect.height;
                      }
                      enemy.velocity.y = 0;

                      // CRASH LOGIC
                      if (enemy.state === 'ATTACK' && enemy.attackDurationTimer > 0) {
                           enemy.state = 'CHASE'; 
                           enemy.attackDurationTimer = 0;
                           enemy.attackCooldownTimer = 60;
                           gameState.current.screenShake = 3;
                           spawnParticles(enemy.position, 8, '#ffffff', 4);
                      }
                  }
              }

          } 
          else if (enemy.type === 'TURRET') {
              // TURRET AI: Grounded, stops to shoot
              
              // Apply Gravity first
              enemy.velocity.y += profile.gravity;
              
              switch(enemy.state) {
                  case 'CHASE':
                      // Move towards player until in range
                      if (distanceToPlayer < enemy.attackRange && Math.abs(enemy.position.y - player.position.y) < 100) {
                          enemy.velocity.x = 0;
                          if (enemy.attackCooldownTimer <= 0) {
                              enemy.state = 'ATTACK';
                              enemy.chargeTimer = 90; // 1.5s charge
                              // Init laser data
                              enemy.laserData = {
                                  targetX: player.position.x + GAME_CONFIG.PLAYER_SIZE.width/2,
                                  targetY: player.position.y + GAME_CONFIG.PLAYER_SIZE.height/2,
                                  isFiring: false
                              };
                          }
                      } else {
                          const dir = player.position.x > enemy.position.x ? 1 : -1;
                          enemy.velocity.x = dir * AI_CONFIG.PATROL_SPEED * 0.5; // Slow walker
                          enemy.facingRight = dir > 0;
                      }
                      break;
                  case 'ATTACK':
                      enemy.velocity.x = 0;
                      if (enemy.chargeTimer > 0) {
                          enemy.chargeTimer--;
                          // Track player loosely
                          if (enemy.chargeTimer > 30 && enemy.laserData) {
                              const targetX = player.position.x + GAME_CONFIG.PLAYER_SIZE.width/2;
                              const targetY = player.position.y + GAME_CONFIG.PLAYER_SIZE.height/2;
                              // Lerp aim
                              enemy.laserData.targetX += (targetX - enemy.laserData.targetX) * 0.1;
                              enemy.laserData.targetY += (targetY - enemy.laserData.targetY) * 0.1;
                          }
                          if (enemy.chargeTimer === 0) {
                              enemy.attackDurationTimer = 10; // Instant beam burst
                              if(enemy.laserData) enemy.laserData.isFiring = true;
                              gameState.current.screenShake = 5;
                          }
                      } else if (enemy.attackDurationTimer > 0) {
                          // FIRING LASER
                          if (player.invincibilityTimer === 0 && !player.isDead && enemy.laserData) {
                              // Raycast check
                              const origin = { x: enemy.position.x + enemy.width/2, y: enemy.position.y + 10 };
                              const target = { x: enemy.laserData.targetX, y: enemy.laserData.targetY };
                              // Extend beam past target for visual/logic
                              const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
                              const beamEnd = { 
                                  x: origin.x + Math.cos(angle) * 1000, 
                                  y: origin.y + Math.sin(angle) * 1000 
                              };
                              
                              const pCenter = { 
                                  x: player.position.x + GAME_CONFIG.PLAYER_SIZE.width/2,
                                  y: player.position.y + GAME_CONFIG.PLAYER_SIZE.height/2
                              };
                              
                              const dist = distToSegment(pCenter, origin, beamEnd);
                              if (dist < 30) { // Beam width tolerance
                                  damagePlayer(player, 25, enemy.position.x);
                              }
                          }
                          if (enemy.attackDurationTimer === 1) {
                              enemy.state = 'CHASE';
                              enemy.attackCooldownTimer = 180;
                              enemy.laserData = undefined;
                          }
                      }
                      break;
                  case 'HIT':
                      if(enemy.hitTimer <= 0) enemy.state = 'CHASE';
                      break;
              }

              // Physics Application (Ground only)
              enemy.position.y += enemy.velocity.y;
              for (const plat of state.platforms) {
                  if (checkEntityAABB(enemy, plat, 0, 0)) {
                      if (enemy.velocity.y > 0) {
                          enemy.position.y = plat.rect.y - enemy.height;
                          enemy.velocity.y = 0;
                      }
                  }
              }
              enemy.position.x += enemy.velocity.x;

          }
          else { 
              // WALKER AI (Standard)
              switch(enemy.state) {
                  case 'PATROL':
                      enemy.color = COLORS.ENEMY_PATROL;
                      if (enemy.detectionRange > 0 && distanceToPlayer < enemy.detectionRange) {
                          enemy.state = 'CHASE'; 
                      }
                      break;
                  case 'CHASE':
                      enemy.color = COLORS.ENEMY_CHASE;
                      if (distanceToPlayer > enemy.detectionRange * 1.5) {
                          enemy.state = 'PATROL'; 
                      } else if (enemy.attackRange > 0 && distanceToPlayer < enemy.attackRange && enemy.attackCooldownTimer <= 0) { 
                          // START ATTACK SEQUENCE
                          enemy.state = 'ATTACK'; 
                          enemy.velocity.x = 0; 
                          // NEW: Start Charge Phase
                          enemy.chargeTimer = AI_CONFIG.ATTACK_CHARGE; 
                          enemy.attackDurationTimer = 0; // Wait until charge finishes
                      }
                      break;
                  case 'ATTACK':
                      enemy.color = COLORS.ENEMY_ATTACK;
                      // NEW: CHARGE LOGIC
                      if (enemy.chargeTimer > 0) {
                          enemy.chargeTimer--;
                          if (enemy.chargeTimer === 0) {
                              // CHARGE COMPLETE -> SWING
                              enemy.attackDurationTimer = AI_CONFIG.ATTACK_DURATION;
                              // SPAWN SLASH VFX (RED)
                              const cx = enemy.position.x + enemy.width/2 + (enemy.facingRight ? 20 : -20);
                              const cy = enemy.position.y + enemy.height/2;
                              spawnVfx({ x: cx, y: cy }, 'VFX_SLASH', enemy.facingRight, 130);
                          }
                      }
                      else if (enemy.attackDurationTimer <= 0) { 
                          enemy.state = 'CHASE'; 
                          enemy.attackCooldownTimer = Math.floor(60 + Math.random() * 120); 
                      }
                      break;
                  case 'HIT':
                      if (enemy.hitTimer <= 0) {
                          enemy.state = 'CHASE';
                      }
                      break;
              }

              if (enemy.state === 'PATROL' && enemy.patrolRange > 0) {
                  if (enemy.facingRight) {
                      enemy.velocity.x = AI_CONFIG.PATROL_SPEED;
                      if (enemy.position.x > enemy.patrolOriginX + enemy.patrolRange) enemy.facingRight = false;
                  } else {
                      enemy.velocity.x = -AI_CONFIG.PATROL_SPEED;
                      if (enemy.position.x < enemy.patrolOriginX - enemy.patrolRange) enemy.facingRight = true;
                  }
              } 
              else if (enemy.state === 'CHASE') {
                  const dir = player.position.x > enemy.position.x ? 1 : -1;
                  enemy.velocity.x = dir * AI_CONFIG.CHASE_SPEED;
                  enemy.facingRight = dir > 0;
              }
              else if (enemy.state === 'ATTACK' || (enemy.state === 'IDLE' && enemy.patrolRange === 0)) {
                  enemy.velocity.x = 0; 
              }
              else if (enemy.state === 'HIT') {
                  enemy.velocity.x *= 0.9;
              }

              // Gravity & Collision
              enemy.velocity.y += profile.gravity;
              enemy.position.y += enemy.velocity.y;
              for (const plat of state.platforms) {
                  if (checkEntityAABB(enemy, plat, 0, 0)) {
                      if (enemy.velocity.y > 0) {
                          enemy.position.y = plat.rect.y - enemy.height;
                          enemy.velocity.y = 0;
                      }
                  }
              }
              enemy.position.x += enemy.velocity.x;

              // Melee Damage Check
              if (player.invincibilityTimer === 0 && !player.isDead) {
                  const attackActive = enemy.state === 'ATTACK' &&
                                        enemy.chargeTimer === 0 &&
                                        enemy.attackDurationTimer < 18 &&
                                        enemy.attackDurationTimer > 5;

                  if (attackActive) {
                        const reach = 50;
                        const attackBox = {
                            x: enemy.facingRight ? enemy.position.x + enemy.width : enemy.position.x - reach,
                            y: enemy.position.y,
                            width: reach,
                            height: enemy.height
                        };
                        if (checkRectOverlap(player.position, GAME_CONFIG.PLAYER_SIZE, attackBox, { width: attackBox.width, height: attackBox.height })) {
                            damagePlayer(player, 15, enemy.position.x);
                        }
                  }
              }
          }
      });
  };

  const damagePlayer = (player: PlayerState, amount: number, sourceX: number) => {
      player.health -= amount;
      player.invincibilityTimer = GAME_CONFIG.PLAYER_I_FRAMES;
      
      // NEW: Reset combo on hit
      player.comboCount = 0;

      // SPAWN DAMAGE TEXT ON PLAYER
      spawnDamageNumber(
        { x: player.position.x + 16, y: player.position.y },
        amount,
        '#ef4444',
        true
      );
      
      gameState.current.screenShake = 10;
      player.velocity.x = player.position.x > sourceX ? 10 : -10;
      player.velocity.y = -5;
      spawnParticles(player.position, 15, '#ef4444', 5);
  };

  const movePlayer = (player: PlayerState, platforms: Platform[], isDashing: boolean) => {
      const stepSize = 10; 
      const totalDist = Math.sqrt(player.velocity.x**2 + player.velocity.y**2);
      const steps = Math.ceil(totalDist / stepSize);
      const stepVel = { x: player.velocity.x / steps, y: player.velocity.y / steps };

      player.isGrounded = false; 

      for (let i = 0; i < steps; i++) {
          player.position.x += stepVel.x;
          for (const plat of platforms) {
              if (checkAABB(player, plat)) {
                  if (stepVel.x > 0) { 
                      player.position.x = plat.rect.x - GAME_CONFIG.PLAYER_SIZE.width;
                      player.velocity.x = 0;
                  } else if (stepVel.x < 0) { 
                      player.position.x = plat.rect.x + plat.rect.width;
                      player.velocity.x = 0;
                  }
              }
          }
          player.position.y += stepVel.y;
          for (const plat of platforms) {
              if (checkAABB(player, plat)) {
                  if (stepVel.y > 0) { 
                      player.position.y = plat.rect.y - GAME_CONFIG.PLAYER_SIZE.height;
                      player.velocity.y = 0;
                      player.isGrounded = true;
                  } else if (stepVel.y < 0) { 
                      player.position.y = plat.rect.y + plat.rect.height;
                      player.velocity.y = 0;
                  }
              }
          }
      }
  };

  const checkAABB = (player: PlayerState, plat: Platform) => {
     return (
         player.position.x < plat.rect.x + plat.rect.width &&
         player.position.x + GAME_CONFIG.PLAYER_SIZE.width > plat.rect.x &&
         player.position.y < plat.rect.y + plat.rect.height &&
         player.position.y + GAME_CONFIG.PLAYER_SIZE.height > plat.rect.y
     );
  };

  const checkEntityAABB = (entity: any, plat: Platform, offsetX: number, offsetY: number) => {
      return (
          entity.position.x + offsetX < plat.rect.x + plat.rect.width &&
          entity.position.x + offsetX + entity.width > plat.rect.x &&
          entity.position.y + offsetY < plat.rect.y + plat.rect.height &&
          entity.position.y + offsetY + entity.height > plat.rect.y
      );
  };

  const checkRectOverlap = (p1: Vector2, s1: {width: number, height: number}, p2: Vector2, s2: {width: number, height: number}) => {
      return (
          p1.x < p2.x + s2.width &&
          p1.x + s1.width > p2.x &&
          p1.y < p2.y + s2.height &&
          p1.y + s1.height > p2.y
      );
  };

  const checkWallOverlap = (player: PlayerState, platforms: Platform[], dir: number): boolean => {
     const checkDist = 2;
     const testRect = {
         x: dir > 0 ? player.position.x + GAME_CONFIG.PLAYER_SIZE.width : player.position.x - checkDist,
         y: player.position.y + 4,
         width: checkDist,
         height: GAME_CONFIG.PLAYER_SIZE.height - 8
     };

     for (const plat of platforms) {
         if (testRect.x < plat.rect.x + plat.rect.width &&
             testRect.x + testRect.width > plat.rect.x &&
             testRect.y < plat.rect.y + plat.rect.height &&
             testRect.y + testRect.height > plat.rect.y) {
             return true;
         }
     }
     return false;
  };

  const spawnParticles = (pos: Vector2, count: number, color: string, speed: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = { x: Math.cos(angle) * Math.random() * speed, y: Math.sin(angle) * Math.random() * speed };
      gameState.current.particles.push({
        id: Math.random().toString(), position: { ...pos }, velocity: vel,
        life: 1.0, decay: 0.05 + Math.random() * 0.05, color, size: 2 + Math.random() * 2
      });
    }
  };

  const updateParticles = (particles: typeof gameState.current.particles) => {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.x += p.velocity.x;
        p.position.y += p.velocity.y;
        p.life -= p.decay;
        if(p.life <= 0) particles.splice(i, 1);
    }
  };

  // --- VFX HELPERS ---
  const spawnVfx = (pos: Vector2, anim: AnimationKey, facingRight: boolean, hueRotate: number = 0) => {
    gameState.current.activeVfx.push({
        id: Math.random().toString(),
        position: { ...pos },
        anim: anim,
        frame: 0,
        timer: 0,
        facingRight: facingRight,
        rotation: Math.random() * 0.5 - 0.25, // Slight random rotation for variety
        hueRotate: hueRotate
    });
  };

  const updateVfx = (vfxList: OneShotAnim[]) => {
      for (let i = vfxList.length - 1; i >= 0; i--) {
          const vfx = vfxList[i];
          const config = ANIMATION_MANIFEST[vfx.anim];
          if (!config) {
              vfxList.splice(i, 1);
              continue;
          }
          
          vfx.timer++;
          if (vfx.timer >= config.frameDelay) {
              vfx.timer = 0;
              vfx.frame++;
              if (vfx.frame >= config.count) {
                  // Animation finished
                  vfxList.splice(i, 1);
              }
          }
      }
  };

  // --- DAMAGE NUMBERS LOGIC ---
  const spawnDamageNumber = (pos: Vector2, value: number, color: string, isCrit: boolean) => {
      gameState.current.damageNumbers.push({
          id: Math.random().toString(),
          value: Math.floor(value),
          position: { ...pos },
          velocity: { x: (Math.random() - 0.5) * 2, y: -4 - Math.random() * 2 },
          life: 1.0,
          color,
          scale: isCrit ? 1.5 : 1.0,
          isCrit
      });
  };

  const updateDamageNumbers = (list: DamageNumber[]) => {
      for (let i = list.length - 1; i >= 0; i--) {
          const d = list[i];
          d.position.x += d.velocity.x;
          d.position.y += d.velocity.y;
          d.velocity.y += 0.1; // Gravity on text
          d.life -= 0.02;
          
          if (d.life <= 0) {
              list.splice(i, 1);
          }
      }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    inputSystem.current.init();
    
    const FIXED_TIMESTEP = 1000 / 60;
    let animationId: number;

    const loop = (timestamp: number) => {
       const pr = perfRef.current;
       if (!pr.lastTime) pr.lastTime = timestamp;
       const deltaTime = timestamp - pr.lastTime;
       pr.lastTime = timestamp;
       
       // ONLY UPDATE PHYSICS IF NOT PAUSED
       if (!isPausedRef.current) {
           
           // Manage Time Dilation Timer (using REAL time)
           if (gameState.current.slowMoTimer > 0) {
               gameState.current.slowMoTimer -= deltaTime;
               if (gameState.current.slowMoTimer <= 0) {
                   gameState.current.timeScale = 1.0;
               }
           }

           // Scale physics updates by timeScale
           pr.accumulator += Math.min(deltaTime, 200) * gameState.current.timeScale;

           while (pr.accumulator >= FIXED_TIMESTEP) {
               updatePhysics(physicsProfile);
               pr.accumulator -= FIXED_TIMESTEP;
           }
       }
       
       const renderInterval = fpsLimit === 'max' ? 0 : 1000 / fpsLimit;
       const timeSinceDraw = timestamp - pr.lastDrawTime;

       if (timeSinceDraw >= renderInterval) {
           draw(ctx, timestamp);
           pr.lastDrawTime = timestamp - (timeSinceDraw % (renderInterval || 1));
           pr.frameCount++;
       }
       
       if (timestamp - pr.lastStatsUpdate > 500) {
           const fps = Math.round((pr.frameCount * 1000) / (timestamp - pr.lastStatsUpdate));
           onStatsUpdate?.({ fps, frameTimeMs: deltaTime, particleCount: gameState.current.particles.length, platformCount: gameState.current.platforms.length });
           pr.lastStatsUpdate = timestamp;
           pr.frameCount = 0;
       }
       animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animationId); inputSystem.current.cleanup(); };
  }, [physicsProfile, fpsLimit, spriteScale, level]); 

  // RENDER PIPELINE
  const draw = (ctx: CanvasRenderingContext2D, timestamp: number) => {
      const state = gameState.current;
      const width = GAME_CONFIG.CANVAS_WIDTH;
      const height = GAME_CONFIG.CANVAS_HEIGHT;
      const camX = state.camera.x;
      const camY = state.camera.y;
      const zoom = state.camera.zoom;

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // --- Layer 4: Far Background ---
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#020617'); 
      gradient.addColorStop(1, '#1e1b4b'); 
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height); 

      ctx.translate(width/2, height/2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width/2, -height/2);

      // --- Layer 4.5: Far Objects ---
      ctx.save();
      const farFactor = 0.1;
      const farOffset = -(camX * farFactor) % 800; 
      ctx.translate(farOffset, -(camY * 0.05)); 
      ctx.fillStyle = '#1e293b'; 
      for (let i = -2; i < Math.ceil(width / 800) + 3; i++) {
          const xBase = i * 800;
          ctx.fillRect(xBase + 100, 200, 100, 800);
          ctx.fillRect(xBase + 300, 100, 150, 900);
          ctx.fillRect(xBase + 600, 300, 80, 700);
      }
      ctx.restore();

      // --- Layer 3: Mid Background ---
      ctx.save();
      const midFactor = 0.5;
      const midOffset = -(camX * midFactor) % 1200;
      ctx.translate(midOffset, -(camY * 0.2)); 
      ctx.fillStyle = '#334155'; 
      for (let i = -2; i < Math.ceil(width / 1200) + 3; i++) {
           const xBase = i * 1200;
           ctx.beginPath();
           ctx.moveTo(xBase, height);
           ctx.lineTo(xBase + 100, height - 400);
           ctx.lineTo(xBase + 300, height - 400);
           ctx.lineTo(xBase + 400, height);
           ctx.fill();
           drawGear(ctx, xBase + 800, height - 300, 120, '#475569', timestamp * 0.0005);
           drawGear(ctx, xBase + 910, height - 200, 80, '#64748b', -timestamp * 0.0008);
      }
      ctx.restore();

      // --- Layer 2: Game Plane ---
      ctx.save();
      const shakeX = (Math.random()-0.5) * state.screenShake;
      const shakeY = (Math.random()-0.5) * state.screenShake;
      ctx.translate(-camX + shakeX, -camY + shakeY);

      // POIs
      for(const poi of state.pois) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(poi.position.x - 2, poi.position.y - 40, 4, 40);
          ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
          ctx.strokeStyle = poi.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(poi.position.x - 20, poi.position.y - 70, 40, 30, 4);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 10;
          ctx.shadowColor = poi.color;
          ctx.fillStyle = poi.color;
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText("INFO", poi.position.x, poi.position.y - 52);
          ctx.shadowBlur = 0;
          
          // Show message if close
          if (dist(state.player.position, poi.position) < poi.range) {
              ctx.fillStyle = 'white';
              ctx.font = 'bold 16px monospace';
              ctx.fillText(poi.message, poi.position.x, poi.position.y - 100);
          }
      }

      // Platforms
      for(const p of state.platforms) {
          ctx.fillStyle = COLORS.PLATFORM_SIDE;
          ctx.fillRect(p.rect.x, p.rect.y + 10, p.rect.width + 10, p.rect.height);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.rect.x, p.rect.y, p.rect.width, p.rect.height);
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.strokeRect(p.rect.x, p.rect.y, p.rect.width, p.rect.height);
          ctx.fillStyle = '#1e293b';
          for(let dx = 20; dx < p.rect.width; dx += 40) {
              ctx.fillRect(p.rect.x + dx, p.rect.y + 5, 4, 4);
          }
      }

      // --------------------- NEW SHADOW HELPER -----------------------
      const drawShadow = (ctx: CanvasRenderingContext2D, pos: Vector2, width: number, height: number, platforms: Platform[]) => {
          const centerX = pos.x + width / 2;
          const footY = pos.y + height;
          const MAX_DIST = 300;
          
          let groundY = Infinity;
          
          for (const plat of platforms) {
              // Check horizontal bounds with slight padding for overhang forgiveness
              if (centerX >= plat.rect.x - 10 && centerX <= plat.rect.x + plat.rect.width + 10) {
                  // Check vertical: must be below (or at) feet
                  // Tolerance of 5px allows for slight embedding or floating point noise
                  if (plat.rect.y >= footY - 5) {
                      if (plat.rect.y < groundY) {
                          groundY = plat.rect.y;
                      }
                  }
              }
          }
    
          if (groundY !== Infinity) {
              const dist = groundY - footY;
              if (dist < MAX_DIST) {
                   // Non-linear fade for better feel
                   const ratio = 1 - (dist / MAX_DIST);
                   const scale = Math.max(0, ratio * ratio); // Quadratic falloff
    
                   const alpha = 0.5 * scale;
                   const rX = (width * 0.6) * (0.4 + 0.6 * scale); // Width shrinks but not to zero
                   const rY = 6 * scale; // Height flattens more
    
                   ctx.fillStyle = `rgba(0,0,0,${alpha})`;
                   ctx.beginPath();
                   ctx.ellipse(centerX, groundY, rX, rY, 0, 0, Math.PI * 2);
                   ctx.fill();
              }
          }
      };
      // -------------------------------------------------------------

      // Enemies
      for(const enemy of state.enemies) {
          if (enemy.isDead) continue;
          
          // DRAW SHADOW (Only if grounded walker or Turret, but helper handles dist check so it's fine)
          drawShadow(ctx, enemy.position, enemy.width, enemy.height, state.platforms);

          ctx.save();
          if (enemy.hitTimer > 0) {
              ctx.globalCompositeOperation = 'source-over';
              ctx.fillStyle = 'white';
          } else {
              ctx.fillStyle = enemy.color;
          }

          // --- DRAW BY TYPE ---
          if (enemy.type === 'FLYER') {
              ctx.save(); // ISOLATE TRANSFORM
              // Draw Diamond Shape
              ctx.translate(enemy.position.x + enemy.width/2, enemy.position.y + enemy.height/2);
              if (enemy.state === 'ATTACK' && enemy.chargeTimer <= 0) {
                  // DIVE STATE: Stretch
                  ctx.rotate(Math.atan2(enemy.velocity.y, enemy.velocity.x) + Math.PI/2);
                  ctx.scale(0.7, 1.5);
              } else {
                  // Hover shake
                  ctx.rotate(Math.sin(timestamp * 0.005) * 0.1);
              }
              
              ctx.beginPath();
              ctx.moveTo(0, -enemy.height/2);
              ctx.lineTo(enemy.width/2, 0);
              ctx.lineTo(0, enemy.height/2);
              ctx.lineTo(-enemy.width/2, 0);
              ctx.fill();
              
              // Eye
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-5, -5, 10, 10);
              ctx.restore(); // RESTORE TRANSFORM

          } else if (enemy.type === 'TURRET') {
              // Draw Box with Cannon
              ctx.fillRect(enemy.position.x, enemy.position.y, enemy.width, enemy.height);
              
              // Cannon
              const cannonOrigin = { x: enemy.position.x + enemy.width/2, y: enemy.position.y + 10 };
              
              // Draw Laser Warning / Beam
              if (enemy.laserData && enemy.state === 'ATTACK') {
                  const target = { x: enemy.laserData.targetX, y: enemy.laserData.targetY };
                  const angle = Math.atan2(target.y - cannonOrigin.y, target.x - cannonOrigin.x);
                  const distToT = dist(cannonOrigin, target);
                  
                  ctx.save();
                  ctx.translate(cannonOrigin.x, cannonOrigin.y);
                  ctx.rotate(angle);
                  
                  // BEAM LOGIC
                  if (enemy.attackDurationTimer > 0 && enemy.chargeTimer === 0) {
                      // FIRING
                      ctx.fillStyle = '#ffffff';
                      ctx.shadowBlur = 20;
                      ctx.shadowColor = COLORS.ENEMY_TURRET;
                      ctx.fillRect(0, -5, 1000, 10); // Infinite length visual
                  } else {
                      // CHARGING (Thin line)
                      ctx.globalAlpha = 0.5;
                      ctx.strokeStyle = COLORS.ENEMY_TURRET;
                      ctx.setLineDash([5, 5]);
                      ctx.lineWidth = 1;
                      ctx.beginPath();
                      ctx.moveTo(0, 0);
                      ctx.lineTo(distToT, 0); // Point to target
                      ctx.stroke();
                      
                      // Lock-on circle
                      if (enemy.chargeTimer < 30) {
                          ctx.strokeStyle = 'red';
                          ctx.setLineDash([]);
                          ctx.beginPath();
                          ctx.arc(distToT, 0, 10 * (enemy.chargeTimer/30), 0, Math.PI*2);
                          ctx.stroke();
                      }
                  }
                  ctx.restore();
              }

          } else {
              // WALKER (Default Box)
              ctx.fillRect(enemy.position.x, enemy.position.y, enemy.width, enemy.height);
              ctx.strokeStyle = '#7f1d1d';
              ctx.lineWidth = 2;
              ctx.strokeRect(enemy.position.x, enemy.position.y, enemy.width, enemy.height);
              const eyeX = enemy.facingRight ? enemy.position.x + 25 : enemy.position.x + 5;
              ctx.fillStyle = '#fef08a';
              ctx.shadowBlur = 5;
              ctx.shadowColor = 'red';
              ctx.fillRect(eyeX, enemy.position.y + 10, 10, 5);
              ctx.shadowBlur = 0;
          }

          // Common HUD (HP Bar, Alert Icon)
          if (enemy.type !== 'FLYER') { // Flyer drew its own shape center-aligned
             // Icons
             if (enemy.state === 'CHASE') {
                  ctx.fillStyle = 'red';
                  ctx.font = '12px monospace';
                  ctx.fillText("!", enemy.position.x + 15, enemy.position.y - 10);
              } else if (enemy.state === 'PATROL') {
                  ctx.fillStyle = '#94a3b8';
                  ctx.font = '12px monospace';
                  ctx.fillText("?", enemy.position.x + 15, enemy.position.y - 10);
              }
              // HP Bar
              const hpPercent = enemy.health / enemy.maxHealth;
              ctx.fillStyle = '#374151';
              ctx.fillRect(enemy.position.x, enemy.position.y - 12, enemy.width, 6);
              ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : '#ef4444';
              ctx.fillRect(enemy.position.x, enemy.position.y - 12, enemy.width * hpPercent, 6);
          } else {
              // Flyer HP Bar
              const hpPercent = enemy.health / enemy.maxHealth;
              // Context is clean now, so we draw absolute
              const barX = enemy.position.x;
              const barY = enemy.position.y - 20;
              ctx.fillStyle = '#374151';
              ctx.fillRect(barX, barY, enemy.width, 6);
              ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : '#ef4444';
              ctx.fillRect(barX, barY, enemy.width * hpPercent, 6);
          }
          
          // TELEGRAPH STAR (CHARGE VFX) - Shared
          if (enemy.chargeTimer > 0) {
              const cx = enemy.position.x + enemy.width / 2;
              const cy = enemy.position.y - 25;
              const size = 15 + Math.sin(timestamp * 0.02) * 5; 
              
              ctx.translate(cx, cy);
              ctx.rotate(timestamp * 0.01);
              ctx.fillStyle = '#f472b6'; // Pinkish-Red warning
              ctx.shadowColor = '#f472b6';
              ctx.shadowBlur = 15;
              
              ctx.beginPath();
              // Draw 4-point star (Diamond style)
              ctx.moveTo(0, -size);
              ctx.quadraticCurveTo(0, 0, size, 0);
              ctx.quadraticCurveTo(0, 0, 0, size);
              ctx.quadraticCurveTo(0, 0, -size, 0);
              ctx.quadraticCurveTo(0, 0, 0, -size);
              ctx.fill();
              
              ctx.shadowBlur = 0;
              ctx.rotate(-timestamp * 0.01); // Reset rotation
              ctx.translate(-cx, -cy);
          }

          ctx.restore();
      }

      // Player & Ghosts
      const p = state.player;
      const pW = GAME_CONFIG.PLAYER_SIZE.width;
      const pH = GAME_CONFIG.PLAYER_SIZE.height;

      state.ghosts.forEach(g => {
          ctx.save();
          const centerX = g.x + pW/2;
          const bottomY = g.y + pH + 14; 
          ctx.translate(centerX, bottomY);
          ctx.scale(g.facingRight ? 1 : -1, 1);
          ctx.globalAlpha = g.alpha;
          const sprite = AssetManager.getFrame(g.anim, g.frame);
          if (sprite) {
               let autoScale = 1.0;
               if (sprite.height > 150) {
                   const TARGET_VISUAL_HEIGHT = 100;
                   autoScale = TARGET_VISUAL_HEIGHT / sprite.height;
               }
               const finalScale = autoScale * spriteScale;
               ctx.filter = 'grayscale(100%) sepia(100%) hue-rotate(170deg) saturate(400%) brightness(1.2)'; 
               ctx.drawImage(sprite, -sprite.width/2 * finalScale, -sprite.height * finalScale, sprite.width * finalScale, sprite.height * finalScale);
          } else {
             ctx.fillStyle = COLORS.YUI_ACCENT;
             ctx.fillRect(-pW/2, -pH, pW, pH);
          }
          ctx.restore();
      });

      // --- RENDER COMPANION (UNDER PLAYER IF BEHIND, OVER IF ATTACKING) ---
      // Actually, standard layering is fine. Let's render it here.
      const comp = state.companion;
      ctx.save();
      
      // Glitch Shake
      let gx = 0, gy = 0;
      if (comp.glitchIntensity > 0) {
          gx = (Math.random() - 0.5) * (comp.glitchIntensity * 20);
          gy = (Math.random() - 0.5) * (comp.glitchIntensity * 20);
      }
      
      ctx.translate(comp.position.x + gx, comp.position.y + gy);
      
      // Trail
      if (comp.trail.length > 0) {
          ctx.strokeStyle = COLORS.YUI_WEAPON;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(comp.trail[0].x - comp.position.x, comp.trail[0].y - comp.position.y);
          for(let i=1; i<comp.trail.length; i++) {
              ctx.lineTo(comp.trail[i].x - comp.position.x, comp.trail[i].y - comp.position.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1.0;
      }

      // Main Shape (Rotating Diamond / Data Cubes)
      ctx.rotate(comp.rotation);
      
      const sz = 12;

      // Glitch RGB Split
      if (comp.glitchIntensity > 0.1) {
          // Red Channel Offset
          ctx.save();
          ctx.translate(5 * comp.glitchIntensity, 0);
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#ff0000';
          // Draw shape
          ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz, 0); ctx.fill();
          ctx.restore();

          // Blue Channel Offset
          ctx.save();
          ctx.translate(-5 * comp.glitchIntensity, 0);
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#00ffff';
          // Draw shape
          ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz, 0); ctx.fill();
          ctx.restore();
      }

      // Outer shell
      ctx.strokeStyle = COLORS.YUI_WEAPON;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      ctx.moveTo(0, -sz);
      ctx.lineTo(sz, 0);
      ctx.lineTo(0, sz);
      ctx.lineTo(-sz, 0);
      ctx.closePath();
      ctx.stroke();
      
      // Inner core
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.YUI_WEAPON;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.shadowBlur = 0;

      // Glitch Artifacts
      if (comp.glitchIntensity > 0.2) {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.fillRect(10, -5, 10, 2);
          ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
          ctx.fillRect(-15, 5, 8, 3);
      }
      
      ctx.restore();

      const isVisible = p.invincibilityTimer === 0 || Math.floor(timestamp / 50) % 2 === 0;

      if (isVisible && !p.isDead) {
          // DRAW SHADOW
          drawShadow(ctx, p.position, pW, pH, state.platforms);

          const sprite = AssetManager.getFrame(p.activeAnim, p.animFrame);
          const hasAssets = AssetManager.hasAssets(p.activeAnim);

          if (hasAssets && sprite) {
              ctx.save();
              const centerX = p.position.x + pW/2;
              const bottomY = p.position.y + pH + 14; 
              ctx.translate(centerX, bottomY);
              
              // Standard direction check
              let scaleX = p.facingRight ? 1 : -1;
              
              // EXCEPTION: Wall Slide sprite needs to be mirrored to face the wall correctly
              if (p.activeAnim === 'WALL_SLIDE') {
                  scaleX *= -1;
              }
              
              ctx.scale(scaleX, 1);
              
              let autoScale = 1.0;
              if (sprite.height > 150) {
                  const TARGET_VISUAL_HEIGHT = 100; 
                  autoScale = TARGET_VISUAL_HEIGHT / sprite.height;
              }
              const finalScale = autoScale * spriteScale;
              if (p.invincibilityTimer > 0) {
                  ctx.globalAlpha = 0.7; 
                  ctx.filter = 'brightness(2) saturate(0)'; 
              }
              ctx.drawImage(sprite, -sprite.width/2 * finalScale, -sprite.height * finalScale, sprite.width * finalScale, sprite.height * finalScale);
              ctx.restore();
          } else {
              ctx.save();
              ctx.translate(p.position.x + pW/2, p.position.y + pH);
              ctx.rotate(p.leanAngle);
              ctx.translate(-(p.position.x + pW/2), -(p.position.y + pH));
              
              // NOTE: REMOVED WEAPON FROM PLAYER RENDER (COMPANION HAS IT)
              // if (!p.isAttacking) { ... } 
              
              if(p.isDashing) {
                  ctx.globalAlpha = 0.5;
                  ctx.fillStyle = COLORS.YUI_ACCENT;
                  ctx.fillRect(p.position.x - p.velocity.x, p.position.y, pW, pH);
                  ctx.globalAlpha = 1.0;
              }
              
              // FALLBACK COLOR LOGIC
              let fillColor = p.color;
              if (p.invincibilityTimer > 0) fillColor = '#ef4444';
              else if (p.activeAnim === 'ATTACK_DASH_A') fillColor = '#a855f7'; // Purple fallback for Dash Attack if asset missing

              ctx.fillStyle = fillColor; 
              ctx.fillRect(p.position.x, p.position.y, pW, pH);
              ctx.shadowBlur = 10;
              ctx.shadowColor = COLORS.YUI_ACCENT;
              ctx.fillStyle = COLORS.YUI_ACCENT;
              ctx.fillRect(p.position.x + (p.facingRight ? 18 : 6), p.position.y + 40, 6, 6);
              ctx.fillRect(p.position.x + (p.facingRight ? 16 : 4), p.position.y + 10, 12, 4);
              ctx.shadowBlur = 0;
              ctx.restore();
          }

          if(p.isAttacking) {
               // Calculate progress (0.0 to 1.0)
               // attackTimer counts DOWN from duration to 0
               const duration = physicsProfile.attackDurationFrames;
               const progress = 1 - (p.attackTimer / duration);

               // VFX Sequence Frame Calculation
               const totalFrames = 12;
               let frameIndex = Math.floor(progress * totalFrames);
               if (frameIndex >= totalFrames) frameIndex = totalFrames - 1;
               if (frameIndex < 0) frameIndex = 0;

               // USE ASSET MANAGER (Same as other sprites)
               const img = AssetManager.getFrame('VFX_SLASH', frameIndex);
               
               const cx = p.position.x + pW/2 + (p.facingRight ? 16 : -16);
               const cy = p.position.y + pH/2;

               ctx.save();
               ctx.translate(cx, cy);
               if (!p.facingRight) ctx.scale(-1, 1);
               
               let rotation = 0;
               if (p.comboStep === 1) rotation = -0.2;
               if (p.comboStep === 2) rotation = 0.2;
               ctx.rotate(rotation);

               // BLEND MODE: SCREEN (Hides black background)
               ctx.globalCompositeOperation = 'screen';

               if (img && img.complete && img.naturalWidth > 0) {
                   const scale = 0.4; // SET TO 0.4 AS REQUESTED
                   ctx.drawImage(img, -img.width/2 * scale, -img.height/2 * scale, img.width * scale, img.height * scale);
               } else if (debugHitboxes) {
                   // Fallback Debug Box - ONLY SHOW IF DEBUG ENABLED
                   ctx.globalCompositeOperation = 'source-over';
                   ctx.fillStyle = '#ff00ff';
                   ctx.globalAlpha = 0.6;
                   ctx.fillRect(-40, -40, 80, 80);
                   ctx.fillStyle = 'white';
                   ctx.font = '10px monospace';
                   ctx.fillText(`F:${frameIndex}`, -10, 0);
               }
               ctx.restore();
          }
      }

      // --- RENDER ACTIVE VFX (One-Shots) ---
      state.activeVfx.forEach(vfx => {
          const vfxImg = AssetManager.getFrame(vfx.anim, vfx.frame);
          if (vfxImg) {
              ctx.save();
              ctx.translate(vfx.position.x, vfx.position.y);
              ctx.rotate(vfx.rotation);
              if (!vfx.facingRight) ctx.scale(-1, 1);
              
              ctx.globalCompositeOperation = 'screen'; // Additive blending for glow

              // NEW: Apply Hue Rotate
              if (vfx.hueRotate) {
                  ctx.filter = `hue-rotate(${vfx.hueRotate}deg)`;
              }
              
              const scale = 0.5; // Slightly larger for hits
              ctx.drawImage(vfxImg, -vfxImg.width/2 * scale, -vfxImg.height/2 * scale, vfxImg.width * scale, vfxImg.height * scale);
              
              ctx.restore();
          }
      });


      for(const part of state.particles) {
          ctx.globalAlpha = part.life;
          ctx.fillStyle = part.color;
          ctx.beginPath();
          ctx.arc(part.position.x, part.position.y, part.size, 0, Math.PI*2);
          ctx.fill();
      }
      ctx.globalAlpha = 1;

      // --- RENDER DAMAGE NUMBERS ---
      state.damageNumbers.forEach(d => {
          ctx.save();
          ctx.translate(d.position.x, d.position.y);
          ctx.globalAlpha = d.life;
          ctx.fillStyle = d.color;
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 4;
          
          const fontSize = d.isCrit ? 32 : 20;
          const fontScale = d.scale * (0.8 + (1 - d.life) * 0.2); // Slight grow effect

          ctx.font = `bold italic ${fontSize * fontScale}px monospace`;
          ctx.textAlign = 'center';
          
          if (d.isCrit) {
             ctx.strokeStyle = '#b45309'; // Dark orange outline
             ctx.lineWidth = 3;
             ctx.strokeText(`${d.value}`, 0, 0);
          }
          
          ctx.fillText(`${d.value}`, 0, 0);
          
          if (d.isCrit) {
              ctx.font = `bold ${10 * fontScale}px monospace`;
              ctx.fillStyle = '#fcd34d';
              ctx.fillText("CRITICAL", 0, -20);
          }

          ctx.restore();
      });

      // --- DEBUG HITBOX OVERLAYS ---
      if (debugHitboxes) {
          ctx.lineWidth = 1;

          // Platforms
          ctx.strokeStyle = '#00ffff'; // Cyan
          for (const p of state.platforms) {
              ctx.strokeRect(p.rect.x, p.rect.y, p.rect.width, p.rect.height);
          }

          // Enemies
          for (const enemy of state.enemies) {
               if (enemy.isDead) continue;
               ctx.strokeStyle = '#ff0000'; // Red
               ctx.strokeRect(enemy.position.x, enemy.position.y, enemy.width, enemy.height);

               // Detection Range
               ctx.beginPath();
               ctx.arc(enemy.position.x + enemy.width/2, enemy.position.y + enemy.height/2, enemy.detectionRange, 0, Math.PI*2);
               ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
               ctx.stroke();

               // Attack Range
               ctx.beginPath();
               ctx.arc(enemy.position.x + enemy.width/2, enemy.position.y + enemy.height/2, enemy.attackRange, 0, Math.PI*2);
               ctx.strokeStyle = 'rgba(255, 100, 0, 0.5)';
               ctx.stroke();
          }

          // Player
          ctx.strokeStyle = '#00ff00'; // Green
          ctx.strokeRect(state.player.position.x, state.player.position.y, GAME_CONFIG.PLAYER_SIZE.width, GAME_CONFIG.PLAYER_SIZE.height);

          // Player Attack Hitbox (Visualized dynamically if attacking)
          if (state.player.isAttacking) {
              const p = state.player;
              const attackHitbox = {
                  x: p.facingRight ? p.position.x + 32 : p.position.x - 64,
                  y: p.position.y - 10,
                  width: 64 + (p.comboStep * 10),
                  height: 64
              };
              ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Yellow semi-transparent
              ctx.fillRect(attackHitbox.x, attackHitbox.y, attackHitbox.width, attackHitbox.height);
              ctx.strokeStyle = '#ffff00';
              ctx.strokeRect(attackHitbox.x, attackHitbox.y, attackHitbox.width, attackHitbox.height);
          }
      }

      ctx.restore(); 

      // --- Layer 1: Foreground ---
      ctx.save();
      const foreFactor = 1.4;
      const totalScroll = camX * foreFactor;
      const foreOffset = -totalScroll % 1500;
      const chunkShift = Math.floor(totalScroll / 1500);

      ctx.translate(foreOffset, -(camY * 1.2)); 
      
      const yuiScreenX = p.position.x - camX;
      const yuiScreenY = p.position.y - camY;

      ctx.fillStyle = '#020617'; 
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'black';
      
      // Cleanup old opacity keys
      if (foregroundOpacities.current.size > 200) {
          const minVisible = chunkShift - 2;
          const maxVisible = chunkShift + Math.ceil(width / 1500) + 3;
          for (const key of foregroundOpacities.current.keys()) {
               const idx = parseInt(key.split('_')[0]);
               if (!isNaN(idx) && (idx < minVisible || idx > maxVisible)) {
                   foregroundOpacities.current.delete(key);
               }
          }
      }

      for (let i = -2; i < Math.ceil(width / 1500) + 3; i++) {
          const xBase = i * 1500;
          const stableIndex = chunkShift + i;
          
          // Check Object 1: Hanging Cable Structure
          const obj1ScreenX = xBase + 200 + foreOffset;
          const obj1ScreenY = -100 - (camY * 1.2);
          const obj1W = 300;
          const obj1H = 500;

          const overlapsObj1 = (
              yuiScreenX < obj1ScreenX + obj1W &&
              yuiScreenX + pW > obj1ScreenX &&
              yuiScreenY < obj1ScreenY + obj1H &&
              yuiScreenY + pH > obj1ScreenY
          );
          
          const key1 = `${stableIndex}_cables`;
          const target1 = overlapsObj1 ? 0.3 : 1.0;
          let alpha1 = foregroundOpacities.current.get(key1) ?? 1.0;
          alpha1 += (target1 - alpha1) * 0.05; // 5% blend per frame
          foregroundOpacities.current.set(key1, alpha1);

          ctx.globalAlpha = alpha1;
          
          ctx.beginPath();
          ctx.moveTo(xBase + 200, -100);
          ctx.quadraticCurveTo(xBase + 250, 400, xBase + 500, -100);
          ctx.lineWidth = 12;
          ctx.strokeStyle = '#020617';
          ctx.stroke();
          
          // Check Object 2: Pillar
          const obj2ScreenX = xBase + 900 + foreOffset;
          const obj2W = 150;
          
          const overlapsObj2 = (
              yuiScreenX < obj2ScreenX + obj2W &&
              yuiScreenX + pW > obj2ScreenX
          );

          const key2 = `${stableIndex}_pillar`;
          const target2 = overlapsObj2 ? 0.3 : 1.0;
          let alpha2 = foregroundOpacities.current.get(key2) ?? 1.0;
          alpha2 += (target2 - alpha2) * 0.05;
          foregroundOpacities.current.set(key2, alpha2);

          ctx.globalAlpha = alpha2;
          ctx.fillRect(xBase + 900, -100, 150, height + 400);
      }
      ctx.restore();

      // --- HUD LAYER ---
      ctx.setTransform(1, 0, 0, 1, 0, 0); 
      const hpPercent = Math.max(0, p.health / p.maxHealth);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.moveTo(20, 20);
      ctx.lineTo(220, 20);
      ctx.lineTo(200, 50);
      ctx.lineTo(20, 50);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 20);
      ctx.lineTo(220, 20);
      ctx.lineTo(200, 50);
      ctx.lineTo(20, 50);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      const barWidth = 180 * hpPercent;
      ctx.fillStyle = hpPercent > 0.3 ? '#3b82f6' : '#ef4444'; 
      ctx.beginPath();
      ctx.moveTo(22, 22);
      ctx.lineTo(22 + barWidth, 22);
      ctx.lineTo(22 + barWidth - 10, 48);
      ctx.lineTo(22, 48);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`HP: ${Math.ceil(p.health)}`, 30, 40);

      // Combo Counter HUD
      if (p.comboCount > 0) {
          ctx.fillStyle = COLORS.YUI_ACCENT;
          ctx.font = 'bold italic 24px monospace';
          ctx.fillText(`COMBO x${p.comboCount}`, 240, 40);
          
          // Combo timer bar (Based on drop timer now, NOT window timer)
          const timerPct = p.comboDropTimer / physicsProfile.comboKeepAliveFrames;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
          ctx.fillRect(240, 45, 100 * timerPct, 4);
      }

      // DASH GAUGE HUD
      const dashWidth = 15;
      for(let i=0; i<physicsProfile.maxDashes; i++) {
          const filled = i < (physicsProfile.maxDashes - p.dashCount);
          ctx.fillStyle = filled ? '#3b82f6' : '#1e293b';
          if (!filled && p.dashCooldownTimer > 0 && p.dashCount >= physicsProfile.maxDashes) {
              ctx.fillStyle = '#ef4444'; // Red if in long cooldown
          }
          
          // Skewed dash bars
          ctx.beginPath();
          const dx = 30 + (i * 20);
          const dy = 60;
          ctx.moveTo(dx, dy);
          ctx.lineTo(dx + dashWidth, dy);
          ctx.lineTo(dx + dashWidth - 5, dy + 8);
          ctx.lineTo(dx - 5, dy + 8);
          ctx.fill();
      }


      if (p.isDead) {
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 48px monospace';
          ctx.textAlign = 'center';
          ctx.fillText("CRITICAL FAILURE", width/2, height/2);
          ctx.fillStyle = 'white';
          ctx.font = '24px monospace';
          ctx.fillText("REBOOTING SYSTEM...", width/2, height/2 + 50);
      }

      // --- PAUSED OVERLAY ---
      if (isPausedRef.current) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(0, 0, width, height);
          
          ctx.save();
          ctx.translate(width/2, height/2);
          
          // Glitchy Text Effect
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 20;
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 64px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText("SYSTEM PAUSED", 0, 0);
          
          ctx.shadowBlur = 0;
          ctx.font = '20px monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText("PRESS BUTTON TO RESUME", 0, 50);
          
          ctx.restore();
      }
  };

  return <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain bg-black shadow-2xl rounded-lg" />;
};