import React, { useEffect, useRef, memo } from 'react';
import { Entity, GameState, Point, Player } from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  PLAYER_SIZE, 
  ENEMY_SIZE, 
  BULLET_SIZE, 
  BULLET_SPEED, 
  ENEMY_BASE_SPEED, 
  COLORS,
  SPAWN_RATE_MS,
  SHOOT_COOLDOWN_MS
} from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  missionName: string;
}

const GameCanvas: React.FC<GameCanvasProps> = memo(({ gameState, setGameState, setScore, missionName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs (to avoid re-renders during loop)
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  const lastShotTimeRef = useRef<number>(0);
  const lastScoreSyncTimeRef = useRef<number>(0);
  const lastSyncedScoreRef = useRef<number>(0);
  
  const playerRef = useRef<Player>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 100,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    speed: 0,
    color: COLORS.PLAYER,
    id: 0,
    hp: 3,
    score: 0
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const enemiesRef = useRef<Entity[]>([]);
  const bulletsRef = useRef<Entity[]>([]);
  const particlesRef = useRef<(Entity & { life: number; maxLife: number; vx: number; vy: number })[]>([]);
  const mousePos = useRef<Point | null>(null);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mousePos.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };
    const handleTouchMove = (e: TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mousePos.current = {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Reset Game
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      playerRef.current = {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT - 100,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        speed: 0,
        color: COLORS.PLAYER,
        id: 0,
        hp: 3,
        score: 0
      };
      enemiesRef.current = [];
      bulletsRef.current = [];
      particlesRef.current = [];
      mousePos.current = null; // Reset mouse pos to prevent jumping
      setScore(0);
      lastSyncedScoreRef.current = 0;
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const spawnEnemy = (now: number) => {
    if (now - lastSpawnTimeRef.current > SPAWN_RATE_MS) {
      const x = Math.random() * (CANVAS_WIDTH - ENEMY_SIZE);
      enemiesRef.current.push({
        x,
        y: -ENEMY_SIZE,
        width: ENEMY_SIZE,
        height: ENEMY_SIZE,
        speed: ENEMY_BASE_SPEED + Math.random() * 3, // variable speed
        color: COLORS.ENEMY,
        id: Math.random(),
        hp: 1
      });
      lastSpawnTimeRef.current = now;
    }
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        x,
        y,
        width: 4,
        height: 4,
        color,
        speed: 0,
        id: Math.random(),
        hp: 1,
        life: 1.0,
        maxLife: 1.0,
        vx: (Math.random() - 0.5) * 15, // Faster explosion
        vy: (Math.random() - 0.5) * 15
      });
    }
  };

  const update = (dt: number, now: number) => {
    const player = playerRef.current;
    
    // Player Movement (Mouse/Touch Priority, then Keyboard)
    if (mousePos.current) {
      // Increased lerp factor from 0.2 to 0.5 for snappier response
      player.x += (mousePos.current.x - player.width / 2 - player.x) * 0.5;
      player.y += (mousePos.current.y - player.height / 2 - player.y) * 0.5;
    } else {
      // Keyboard fallback
      const speed = 10;
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) player.x -= speed;
      if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) player.x += speed;
      if (keysPressed.current['ArrowUp'] || keysPressed.current['KeyW']) player.y -= speed;
      if (keysPressed.current['ArrowDown'] || keysPressed.current['KeyS']) player.y += speed;
    }

    // Clamp Player
    player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, player.x));
    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.height, player.y));

    // Shooting (Auto-fire)
    if (now - lastShotTimeRef.current > SHOOT_COOLDOWN_MS) {
      bulletsRef.current.push({
        x: player.x + player.width / 2 - BULLET_SIZE / 2,
        y: player.y,
        width: BULLET_SIZE,
        height: BULLET_SIZE * 3, // Longer bullets for speed effect
        speed: BULLET_SPEED,
        color: COLORS.BULLET,
        id: Math.random(),
        hp: 1
      });
      lastShotTimeRef.current = now;
    }

    // Update Bullets
    bulletsRef.current.forEach(b => b.y -= b.speed);
    bulletsRef.current = bulletsRef.current.filter(b => b.y > -50);

    // Update Enemies
    enemiesRef.current.forEach(e => e.y += e.speed);
    
    // Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.08; // Fade faster
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Collisions: Bullet vs Enemy
    bulletsRef.current.forEach(bullet => {
      enemiesRef.current.forEach(enemy => {
        if (enemy.hp > 0 && 
            bullet.x < enemy.x + enemy.width &&
            bullet.x + bullet.width > enemy.x &&
            bullet.y < enemy.y + enemy.height &&
            bullet.y + bullet.height > enemy.y) {
          
          enemy.hp = 0; // Mark dead
          bullet.y = -100; // Remove bullet
          
          createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, COLORS.ENEMY);
          player.score += 100;
          // Note: We don't call setScore here directly anymore to avoid spamming re-renders
        }
      });
    });

    // Score Sync Throttling (Update UI at most 10 times per second)
    if (player.score !== lastSyncedScoreRef.current && now - lastScoreSyncTimeRef.current > 100) {
      setScore(player.score);
      lastSyncedScoreRef.current = player.score;
      lastScoreSyncTimeRef.current = now;
    }

    // Collisions: Enemy vs Player
    enemiesRef.current.forEach(enemy => {
      if (enemy.hp > 0 &&
          player.x < enemy.x + enemy.width &&
          player.x + player.width > enemy.x &&
          player.y < enemy.y + enemy.height &&
          player.y + player.height > enemy.y) {
        
        enemy.hp = 0;
        player.hp -= 1;
        createExplosion(player.x + player.width/2, player.y + player.height/2, COLORS.PLAYER);
        
        if (player.hp <= 0) {
          setGameState(GameState.GAME_OVER);
        }
      }
    });

    // Cleanup Dead Enemies
    enemiesRef.current = enemiesRef.current.filter(e => e.y <= CANVAS_HEIGHT && e.hp > 0);
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    // Clear Screen
    ctx.fillStyle = '#1e293b'; // Slate-800
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid Effect (Pseudo-3D) - Faster movement
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    const timeOffset = (Date.now() / 20) % 50; // Faster grid scrolling
    for(let i=0; i<CANVAS_WIDTH; i+=50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for(let i=0; i<CANVAS_HEIGHT; i+=50) {
        ctx.beginPath(); ctx.moveTo(0, i + timeOffset); ctx.lineTo(CANVAS_WIDTH, i + timeOffset); ctx.stroke();
    }

    // Draw Player
    const p = playerRef.current;
    if (p.hp > 0 || (Math.floor(Date.now() / 100) % 2 === 0)) {
      ctx.fillStyle = p.color;
      // Simple Triangle Ship
      ctx.beginPath();
      ctx.moveTo(p.x + p.width / 2, p.y);
      ctx.lineTo(p.x + p.width, p.y + p.height);
      ctx.lineTo(p.x + p.width / 2, p.y + p.height - 10);
      ctx.lineTo(p.x, p.y + p.height);
      ctx.closePath();
      ctx.fill();
      
      // Engine Glow
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(p.x + p.width / 2, p.y + p.height - 5, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Enemies
    enemiesRef.current.forEach(e => {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.width, e.y);
      ctx.lineTo(e.x + e.width / 2, e.y + e.height);
      ctx.closePath();
      ctx.fill();
    });

    // Draw Bullets
    ctx.fillStyle = COLORS.BULLET;
    bulletsRef.current.forEach(b => {
      ctx.fillRect(b.x, b.y, b.width, b.height);
    });

    // Draw Particles
    particlesRef.current.forEach(pt => {
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.width, pt.height);
      ctx.globalAlpha = 1.0;
    });

    // Draw Mission Name
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '16px Rajdhani';
    ctx.fillText(`CURRENT OBJECTIVE: ${missionName}`, 20, CANVAS_HEIGHT - 20);
    
    // Draw Health
    ctx.fillStyle = '#ef4444';
    for(let i=0; i<playerRef.current.hp; i++) {
        ctx.fillRect(20 + (i * 25), 20, 20, 20);
    }
  };

  const gameLoop = (time: number) => {
    const dt = 16;
    lastTimeRef.current = time;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        spawnEnemy(time);
        update(dt, time);
        draw(ctx);
      }
    }

    if (gameState === GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden shadow-2xl border-4 border-slate-700">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block bg-slate-900 cursor-none touch-none w-full max-w-[100vw]"
        style={{ maxWidth: '100%', maxHeight: '80vh', aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
      />
    </div>
  );
});

export default GameCanvas;