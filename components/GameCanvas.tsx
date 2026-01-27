import React, { useEffect, useRef } from 'react';
import { PhysicsProfile, GameState, InputCommand, PlayerState, Platform, Vector2, PerformanceStats, PointOfInterest, Enemy } from '../types';
import { InputSystem } from '../services/inputSystem';
import { GAME_CONFIG, COLORS } from '../constants';

interface GameCanvasProps {
  physicsProfile: PhysicsProfile;
  fpsLimit: number | 'max';
  onStatsUpdate?: (stats: PerformanceStats) => void;
}

// Math Helpers for Fluidity
const approach = (val: number, target: number, maxMove: number): number => {
  return val > target ? Math.max(val - maxMove, target) : Math.min(val + maxMove, target);
};

const dist = (v1: Vector2, v2: Vector2) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

export const GameCanvas: React.FC<GameCanvasProps> = ({ physicsProfile, fpsLimit, onStatsUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputSystem = useRef<InputSystem>(new InputSystem());
  
  // Game State (Mutable for loop performance)
  const gameState = useRef<GameState>({
    player: {
      position: { x: 100, y: 300 },
      velocity: { x: 0, y: 0 },
      isGrounded: false,
      isDashing: false,
      isWallSliding: false,
      isJumping: false,
      canDoubleJump: true,
      isAttacking: false,
      facingRight: true,
      dashTimer: 0,
      dashCooldownTimer: 0,
      attackTimer: 0,
      attackCooldownTimer: 0,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      wallDir: 0,
      color: COLORS.YUI_BODY,
      leanAngle: 0,
      lastJumpInput: false,
      lastDashInput: false,
      lastAttackInput: false
    },
    platforms: [
      { id: 'floor', rect: { x: -1000, y: 600, width: 4000, height: 200 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      { id: 'p1', rect: { x: 300, y: 450, width: 200, height: 20 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      { id: 'p2', rect: { x: 600, y: 350, width: 200, height: 20 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      { id: 'p3', rect: { x: 900, y: 250, width: 150, height: 20 }, type: 'solid', color: COLORS.PLATFORM_SURFACE },
      { id: 'wall', rect: { x: 1200, y: 100, width: 100, height: 500 }, type: 'solid', color: COLORS.PLATFORM_SIDE },
      { id: 'wall2', rect: { x: -200, y: 100, width: 100, height: 500 }, type: 'solid', color: COLORS.PLATFORM_SIDE },
    ],
    enemies: [
       { 
           id: 'dummy1', 
           position: { x: 750, y: 290 }, // Standing on platform p2
           width: 40, 
           height: 60, 
           health: 100, 
           maxHealth: 100, 
           isDead: false, 
           color: '#ef4444',
           hitTimer: 0
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
      }
    ],
    particles: [],
    camera: { x: 0, y: 0, zoom: 1.0 },
    screenShake: 0,
    score: 0
  });

  const perfRef = useRef({ 
      lastTime: 0, 
      frameCount: 0, 
      lastStatsUpdate: 0,
      accumulator: 0, // For fixed timestep physics
      lastDrawTime: 0 
  });

  // ----------------------------------------------------------------------
  // PHYSICS ENGINE (FLUID UPDATE - FIXED 60HZ)
  // ----------------------------------------------------------------------
  const updatePhysics = (profile: PhysicsProfile) => {
    const state = gameState.current;
    const player = state.player;
    const input = inputSystem.current.getState();

    // --- 1. State Management & Timers ---
    if (player.dashTimer > 0) player.dashTimer--;
    if (player.dashCooldownTimer > 0) player.dashCooldownTimer--;
    if (player.attackTimer > 0) player.attackTimer--;
    if (player.attackCooldownTimer > 0) player.attackCooldownTimer--;
    if (player.coyoteTimer > 0) player.coyoteTimer--;
    if (player.jumpBufferTimer > 0) player.jumpBufferTimer--;

    // Input Buffering
    if (input[InputCommand.JUMP] && !player.lastJumpInput) {
      player.jumpBufferTimer = profile.jumpBufferFrames;
    }
    player.lastJumpInput = input[InputCommand.JUMP];

    const moveInput = (input[InputCommand.RIGHT] ? 1 : 0) - (input[InputCommand.LEFT] ? 1 : 0);

    // --- 2. Combat (Attack & Hit Detection) ---
    if (input[InputCommand.ATTACK] && !player.lastAttackInput && player.attackCooldownTimer === 0) {
        player.isAttacking = true;
        player.attackTimer = profile.attackDurationFrames;
        player.attackCooldownTimer = profile.attackCooldownFrames;
        
        // Visuals
        const offset = player.facingRight ? 40 : -40;
        spawnParticles({x: player.position.x + 16 + offset, y: player.position.y + 32}, 5, COLORS.YUI_WEAPON, 8);

        // HIT DETECTION
        const attackHitbox = {
            x: player.facingRight ? player.position.x + 32 : player.position.x - 64,
            y: player.position.y,
            width: 64,
            height: 64
        };

        state.enemies.forEach(enemy => {
            if (enemy.isDead) return;
            
            // Simple AABB overlap
            if (attackHitbox.x < enemy.position.x + enemy.width &&
                attackHitbox.x + attackHitbox.width > enemy.position.x &&
                attackHitbox.y < enemy.position.y + enemy.height &&
                attackHitbox.y + attackHitbox.height > enemy.position.y) {
                
                // HIT!
                enemy.health -= 25;
                enemy.hitTimer = 10;
                state.screenShake = 3;
                
                // Knockback
                enemy.position.x += player.facingRight ? 10 : -10;

                // Hit Particles
                spawnParticles({
                    x: enemy.position.x + enemy.width/2, 
                    y: enemy.position.y + enemy.height/2
                }, 10, '#ffffff', 5);

                if (enemy.health <= 0) {
                    enemy.isDead = true;
                    spawnParticles({
                        x: enemy.position.x + enemy.width/2, 
                        y: enemy.position.y + enemy.height/2
                    }, 30, enemy.color, 8);
                }
            }
        });
    }
    player.lastAttackInput = input[InputCommand.ATTACK];

    if (player.attackTimer <= 0) player.isAttacking = false;

    // --- 3. Dash Mechanic ---
    if (input[InputCommand.DASH] && !player.lastDashInput && player.dashCooldownTimer === 0 && !player.isDashing) {
      player.isDashing = true;
      player.dashTimer = profile.dashDurationFrames;
      player.dashCooldownTimer = profile.dashCooldownFrames;
      
      // Dash Direction (Input priority > Facing)
      const dashDir = moveInput !== 0 ? moveInput : (player.facingRight ? 1 : -1);
      player.velocity.x = dashDir * profile.dashSpeed;
      player.velocity.y = 0; // Float
      
      state.screenShake = 5;
      spawnParticles(player.position, 10, COLORS.YUI_ACCENT, 6);
    }
    player.lastDashInput = input[InputCommand.DASH];

    if (player.isDashing) {
      if (player.dashTimer <= 0) {
        player.isDashing = false;
        player.velocity.x *= 0.6; // Brake after dash
      } else {
        // While dashing, maintain high velocity and ignore gravity
        movePlayer(player, state.platforms, true); 
        return; 
      }
    }

    // --- 4. Horizontal Movement (Fluid Approach) ---
    const targetSpeed = moveInput * profile.runSpeed;
    
    if (player.isGrounded) {
       // Ground Physics
       if (moveInput !== 0) {
         player.velocity.x = approach(player.velocity.x, targetSpeed, profile.groundAccel);
       } else {
         player.velocity.x = approach(player.velocity.x, 0, profile.groundDecel);
       }
    } else {
       // Air Physics
       if (moveInput !== 0) {
         player.velocity.x = approach(player.velocity.x, targetSpeed, profile.airAccel);
       } else {
         player.velocity.x = approach(player.velocity.x, 0, profile.airDecel);
       }
    }
    
    // Facing Direction (Only if moving and not dashing)
    if (moveInput !== 0 && !player.isDashing) player.facingRight = moveInput > 0;

    // --- 5. Wall Detection ---
    player.wallDir = 0;
    // Check Left
    if (checkWallOverlap(player, state.platforms, -1)) player.wallDir = -1;
    // Check Right
    if (checkWallOverlap(player, state.platforms, 1)) player.wallDir = 1;

    // --- 6. Vertical Movement & Gravity ---
    
    // Wall Slide
    player.isWallSliding = false;
    if (player.wallDir !== 0 && !player.isGrounded && player.velocity.y > 0) {
        // Only slide if moving INTO the wall or Neutral
        if ((player.wallDir === 1 && moveInput >= 0) || (player.wallDir === -1 && moveInput <= 0)) {
           player.isWallSliding = true;
           if (player.velocity.y > profile.wallSlideSpeed) {
             player.velocity.y = approach(player.velocity.y, profile.wallSlideSpeed, 0.5);
           }
        }
    }

    // Gravity
    if (!player.isWallSliding) {
        player.velocity.y += profile.gravity;
        if (player.velocity.y > profile.terminalVelocity) player.velocity.y = profile.terminalVelocity;
    }

    // --- 7. Jumping Mechanics ---

    // A. Wall Jump
    if (player.jumpBufferTimer > 0 && player.isWallSliding) {
        player.jumpBufferTimer = 0;
        player.isWallSliding = false;
        player.canDoubleJump = true; // Reset double jump
        // Kick off
        const jumpDir = -player.wallDir;
        player.velocity.x = jumpDir * profile.wallJumpForce.x;
        player.velocity.y = -profile.wallJumpForce.y;
        player.facingRight = jumpDir > 0;
        spawnParticles(player.position, 5, '#ffffff', 3);
    }
    // B. Ground Jump (with Coyote & Buffer)
    else if (player.jumpBufferTimer > 0 && (player.isGrounded || player.coyoteTimer > 0)) {
        player.jumpBufferTimer = 0;
        player.coyoteTimer = 0;
        player.isGrounded = false;
        player.isJumping = true;
        player.canDoubleJump = true; // Ensure double jump is available
        player.velocity.y = -profile.jumpForce;
        spawnParticles({x: player.position.x, y: player.position.y + 64}, 8, '#ffffff', 2);
    }
    // C. Double Jump
    else if (player.jumpBufferTimer > 0 && player.canDoubleJump && !player.isGrounded && !player.isWallSliding) {
        player.jumpBufferTimer = 0;
        player.canDoubleJump = false; // Consume jump
        player.isJumping = true;
        player.velocity.y = -profile.doubleJumpForce;
        // Visuals: Different color for air jump (Blue spark)
        spawnParticles({x: player.position.x, y: player.position.y + 64}, 8, COLORS.YUI_ACCENT, 4);
    }

    // D. Variable Jump Height (Jump Cut)
    if (!input[InputCommand.JUMP] && player.isJumping && player.velocity.y < 0) {
        player.velocity.y *= profile.jumpCutMultiplier;
        player.isJumping = false;
    }

    // --- 8. Apply Movement & Collisions ---
    movePlayer(player, state.platforms, false);

    // --- 9. Post-Move State Updates ---
    if (player.isGrounded) {
      player.coyoteTimer = profile.coyoteFrames;
      player.isJumping = false;
      player.isWallSliding = false;
      player.canDoubleJump = true; // Reset double jump on ground
    }

    // Update Enemies
    state.enemies.forEach(enemy => {
        if (enemy.hitTimer > 0) enemy.hitTimer--;
    });

    // --- 10. Visuals (Lean & Camera) ---
    const targetLean = (player.velocity.x / profile.runSpeed) * 0.3;
    player.leanAngle += (targetLean - player.leanAngle) * 0.2;

    // Shake Decay
    if (state.screenShake > 0) state.screenShake *= 0.9;
    if (state.screenShake < 0.5) state.screenShake = 0;
    
    // Camera Position Tracking
    const camTargetX = player.position.x - GAME_CONFIG.CANVAS_WIDTH / 2;
    const camTargetY = player.position.y - GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // Adjusted Lerp Factor: 0.05 for stronger lag
    state.camera.x += (camTargetX - state.camera.x) * 0.05;
    state.camera.y += (camTargetY - state.camera.y) * 0.05;

    // Camera Zoom Tracking (Dynamic 3D Camera)
    let targetZoom = 1.0;
    for (const poi of state.pois) {
        if (dist(player.position, poi.position) < poi.range) {
            targetZoom = poi.zoomTarget;
            break;
        }
    }
    state.camera.zoom += (targetZoom - state.camera.zoom) * 0.05;

    updateParticles(state.particles);
  };

  // ----------------------------------------------------------------------
  // COLLISION & MOVEMENT (Sub-stepping)
  // ----------------------------------------------------------------------
  const movePlayer = (player: PlayerState, platforms: Platform[], isDashing: boolean) => {
      // Decompose movement into steps to prevent tunneling at high speeds
      const stepSize = 10; // Pixel steps
      const totalDist = Math.sqrt(player.velocity.x**2 + player.velocity.y**2);
      const steps = Math.ceil(totalDist / stepSize);
      
      const stepVel = {
          x: player.velocity.x / steps,
          y: player.velocity.y / steps
      };

      player.isGrounded = false; // Assume false, prove true

      for (let i = 0; i < steps; i++) {
          // X Axis
          player.position.x += stepVel.x;
          for (const plat of platforms) {
              if (checkAABB(player, plat)) {
                  // Resolve X
                  if (stepVel.x > 0) { // Right
                      player.position.x = plat.rect.x - GAME_CONFIG.PLAYER_SIZE.width;
                      player.velocity.x = 0;
                  } else if (stepVel.x < 0) { // Left
                      player.position.x = plat.rect.x + plat.rect.width;
                      player.velocity.x = 0;
                  }
              }
          }

          // Y Axis
          player.position.y += stepVel.y;
          for (const plat of platforms) {
              if (checkAABB(player, plat)) {
                  // Resolve Y
                  if (stepVel.y > 0) { // Down (Landing)
                      player.position.y = plat.rect.y - GAME_CONFIG.PLAYER_SIZE.height;
                      player.velocity.y = 0;
                      player.isGrounded = true;
                  } else if (stepVel.y < 0) { // Up (Head bonk)
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

  const checkWallOverlap = (player: PlayerState, platforms: Platform[], dir: number): boolean => {
     const checkDist = 2;
     const testRect = {
         x: dir > 0 ? player.position.x + GAME_CONFIG.PLAYER_SIZE.width : player.position.x - checkDist,
         y: player.position.y + 4, // Inset slightly to avoid floor issues
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

  // ----------------------------------------------------------------------
  // VISUALS
  // ----------------------------------------------------------------------
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

  // ----------------------------------------------------------------------
  // REACT LOOP
  // ----------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    inputSystem.current.init();
    
    const FIXED_TIMESTEP = 1000 / 60; // Logic always runs at 60Hz
    let animationId: number;

    const loop = (timestamp: number) => {
       const pr = perfRef.current;
       if (!pr.lastTime) pr.lastTime = timestamp;
       
       const deltaTime = timestamp - pr.lastTime;
       pr.lastTime = timestamp;

       // Accumulate time for physics
       // Cap deltaTime to avoid spiral of death on lag spikes (e.g. tab switch)
       pr.accumulator += Math.min(deltaTime, 200);

       // Update Physics in fixed steps (60Hz)
       while (pr.accumulator >= FIXED_TIMESTEP) {
           updatePhysics(physicsProfile);
           pr.accumulator -= FIXED_TIMESTEP;
       }
       
       // Render Throttling
       const renderInterval = fpsLimit === 'max' ? 0 : 1000 / fpsLimit;
       const timeSinceDraw = timestamp - pr.lastDrawTime;

       if (timeSinceDraw >= renderInterval) {
           draw(ctx, timestamp);
           // Adjust lastDrawTime to be a multiple of interval for steady frame pacing
           pr.lastDrawTime = timestamp - (timeSinceDraw % (renderInterval || 1));
           pr.frameCount++;
       }
       
       // Stats Update (every 500ms)
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
  }, [physicsProfile, fpsLimit]); // Re-init loop if FPS limit changes

  // ----------------------------------------------------------------------
  // RENDER PIPELINE (PARALLAX)
  // ----------------------------------------------------------------------
  const draw = (ctx: CanvasRenderingContext2D, timestamp: number) => {
      const state = gameState.current;
      const width = GAME_CONFIG.CANVAS_WIDTH;
      const height = GAME_CONFIG.CANVAS_HEIGHT;
      const camX = state.camera.x;
      const camY = state.camera.y;
      const zoom = state.camera.zoom;

      // Reset Matrix
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // --- Layer 4: Far Background (0.1x) ---
      // Not Zoomed or only slightly zoomed? Let's just zoom everything for cinematic consistency.
      // But we need to handle the fillRect logic so edges don't show.
      
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#020617'); 
      gradient.addColorStop(1, '#1e1b4b'); 
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height); // This covers screen 1:1

      // BEGIN ZOOM TRANSFORM
      // Pivot around center of screen
      ctx.translate(width/2, height/2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width/2, -height/2);

      // --- Layer 4.5: Far Objects ---
      ctx.save();
      const farFactor = 0.1;
      const farOffset = -(camX * farFactor) % 800; 
      ctx.translate(farOffset, -(camY * 0.05)); 

      ctx.fillStyle = '#1e293b'; 
      for (let i = -2; i < Math.ceil(width / 800) + 3; i++) { // Render extra for zoom coverage
          const xBase = i * 800;
          ctx.fillRect(xBase + 100, 200, 100, 800);
          ctx.fillRect(xBase + 300, 100, 150, 900);
          ctx.fillRect(xBase + 600, 300, 80, 700);
      }
      ctx.restore();


      // --- Layer 3: Mid Background (0.5x) ---
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


      // --- Layer 2: Game Plane (1.0x) ---
      ctx.save();
      const shakeX = (Math.random()-0.5) * state.screenShake;
      const shakeY = (Math.random()-0.5) * state.screenShake;
      ctx.translate(-camX + shakeX, -camY + shakeY);

      // Points of Interest (Signs)
      for(const poi of state.pois) {
          ctx.fillStyle = '#334155'; // Pole
          ctx.fillRect(poi.position.x - 2, poi.position.y - 40, 4, 40);
          
          // Panel
          ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
          ctx.strokeStyle = poi.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(poi.position.x - 20, poi.position.y - 70, 40, 30, 4);
          ctx.fill();
          ctx.stroke();

          // Hologram effect
          ctx.shadowBlur = 10;
          ctx.shadowColor = poi.color;
          ctx.fillStyle = poi.color;
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText("INFO", poi.position.x, poi.position.y - 52);
          ctx.shadowBlur = 0;
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

      // Enemies
      for(const enemy of state.enemies) {
          if (enemy.isDead) continue;
          
          ctx.save();
          // Hit flash
          if (enemy.hitTimer > 0) {
              ctx.globalCompositeOperation = 'source-over';
              ctx.fillStyle = 'white';
          } else {
              ctx.fillStyle = enemy.color;
          }
          
          // Draw Enemy Body
          ctx.fillRect(enemy.position.x, enemy.position.y, enemy.width, enemy.height);
          
          // Outline
          ctx.strokeStyle = '#991b1b';
          ctx.lineWidth = 2;
          ctx.strokeRect(enemy.position.x, enemy.position.y, enemy.width, enemy.height);

          // Health Bar
          const hpPercent = enemy.health / enemy.maxHealth;
          ctx.fillStyle = '#374151';
          ctx.fillRect(enemy.position.x, enemy.position.y - 12, enemy.width, 6);
          ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : '#ef4444';
          ctx.fillRect(enemy.position.x, enemy.position.y - 12, enemy.width * hpPercent, 6);
          
          ctx.restore();
      }

      // Player
      const p = state.player;
      const pW = GAME_CONFIG.PLAYER_SIZE.width;
      const pH = GAME_CONFIG.PLAYER_SIZE.height;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(p.position.x + pW/2, p.position.y + pH + 5, pW/2, 5, 0, 0, Math.PI*2);
      ctx.fill();

      // Rotation & Drawing Player Context Setup
      ctx.save();
      ctx.translate(p.position.x + pW/2, p.position.y + pH);
      ctx.rotate(p.leanAngle);
      ctx.translate(-(p.position.x + pW/2), -(p.position.y + pH));

      // 1. Draw Stowed Weapon (Behind Body)
      if (!p.isAttacking) {
          ctx.save();
          const weaponX = p.position.x + pW/2;
          const weaponY = p.position.y + 32; // Mid-back
          ctx.translate(weaponX, weaponY);
          // Diagonal angle
          ctx.rotate(p.facingRight ? -0.5 : 0.5); 
          ctx.fillStyle = COLORS.YUI_WEAPON;
          ctx.shadowBlur = 5;
          ctx.shadowColor = COLORS.YUI_WEAPON;
          // The weapon stick
          ctx.fillRect(-2, -35, 4, 70); 
          ctx.restore();
      }

      // 2. Draw Player Body
      if(p.isDashing) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = COLORS.YUI_ACCENT;
          ctx.fillRect(p.position.x - p.velocity.x, p.position.y, pW, pH);
          ctx.globalAlpha = 1.0;
      }

      ctx.fillStyle = p.color;
      ctx.fillRect(p.position.x, p.position.y, pW, pH);

      // Body Accents
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.YUI_ACCENT;
      ctx.fillStyle = COLORS.YUI_ACCENT;
      ctx.fillRect(p.position.x + (p.facingRight ? 18 : 6), p.position.y + 40, 6, 6);
      ctx.fillRect(p.position.x + (p.facingRight ? 16 : 4), p.position.y + 10, 12, 4);
      ctx.shadowBlur = 0;


      // 3. Draw Attacking Weapon (In Front of Body)
      if(p.isAttacking) {
          ctx.save();
          // Position relative to player center
          const centerX = p.position.x + pW/2;
          const centerY = p.position.y + pH/2;
          
          ctx.translate(centerX, centerY);
          if (!p.facingRight) ctx.scale(-1, 1);

          const progress = 1 - (p.attackTimer / physicsProfile.attackDurationFrames);
          
          // --- DRAW SWORD ---
          ctx.save();
          // Arc calculation
          const startAngle = -Math.PI / 2.0; 
          const endAngle = Math.PI / 3.0;
          const currentAngle = startAngle + (endAngle - startAngle) * progress;

          ctx.rotate(currentAngle);
          
          // Blade
          ctx.fillStyle = COLORS.YUI_WEAPON;
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.YUI_WEAPON;
          
          // Draw Handle
          ctx.fillRect(0, -4, 20, 8);
          // Draw Blade (Longer)
          ctx.fillRect(20, -2, 70, 4); 
          
          // Crossguard
          ctx.fillStyle = '#cbd5e1'; 
          ctx.fillRect(18, -10, 4, 20);
          
          ctx.restore();

          // Slash VFX
          ctx.shadowBlur = 15;
          ctx.shadowColor = COLORS.YUI_WEAPON;
          ctx.strokeStyle = COLORS.YUI_WEAPON;
          ctx.lineWidth = 4;
          
          ctx.beginPath();
          ctx.arc(0, 0, 80, currentAngle - 0.5, currentAngle + 0.1); 
          ctx.stroke();

          // Inner fill
          ctx.globalAlpha = 0.3 * (1-progress);
          ctx.fillStyle = COLORS.YUI_WEAPON;
          ctx.fill();
          
          ctx.restore();
      }

      ctx.restore(); // End Player Transform

      // Particles
      for(const part of state.particles) {
          ctx.globalAlpha = part.life;
          ctx.fillStyle = part.color;
          ctx.beginPath();
          ctx.arc(part.position.x, part.position.y, part.size, 0, Math.PI*2);
          ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // End Game Plane


      // --- Layer 1: Foreground (1.4x) ---
      ctx.save();
      const foreFactor = 1.4;
      const foreOffset = -(camX * foreFactor) % 1500;
      ctx.translate(foreOffset, -(camY * 1.2)); 

      ctx.fillStyle = '#020617'; 
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'black';
      
      for (let i = -2; i < Math.ceil(width / 1500) + 3; i++) {
          const xBase = i * 1500;
          ctx.beginPath();
          ctx.moveTo(xBase + 200, -100);
          ctx.quadraticCurveTo(xBase + 250, 400, xBase + 500, -100);
          ctx.lineWidth = 12;
          ctx.strokeStyle = '#020617';
          ctx.stroke();

          ctx.fillRect(xBase + 900, -100, 150, height + 400);
      }
      ctx.restore();
  };

  // Helper: Procedural Gear
  const drawGear = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, rotation: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation); 
      ctx.fillStyle = color;
      ctx.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
          const angle = (Math.PI * 2 * i) / (teeth * 2);
          const r = (i % 2 === 0) ? radius : radius * 0.85;
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

  return <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain bg-black shadow-2xl rounded-lg" />;
};