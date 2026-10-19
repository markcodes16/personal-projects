import { BOTTOM_RAIL, TOP_RAIL, WORLD_HEIGHT } from './game';
import type { GameState } from './game';

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
}

export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, time: number, reducedMotion: boolean) {
  ctx.save();
  const scale = height / WORLD_HEIGHT;
  ctx.scale(scale, scale);
  const w = width / scale;
  const playerX = Math.min(115, w * 0.2);
  const clock = reducedMotion || state.phase === 'paused' ? state.elapsed : time;
  const scrolling = state.phase === 'ready' ? (reducedMotion ? 0 : time * 18) : state.distance;
  const gradient = ctx.createLinearGradient(0, 0, w, WORLD_HEIGHT);
  gradient.addColorStop(0, '#171a2c'); gradient.addColorStop(0.55, '#111b27'); gradient.addColorStop(1, '#152b29');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, WORLD_HEIGHT);

  // Original vector scenery: a quiet industrial tunnel with parallax circuitry.
  ctx.lineWidth = 1; ctx.strokeStyle = '#b1c7dc0b';
  for (let x = -(scrolling * 0.18 % 64); x < w; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, TOP_RAIL); ctx.lineTo(x, BOTTOM_RAIL); ctx.stroke();
  }
  for (let y = TOP_RAIL + 30; y < BOTTOM_RAIL; y += 52) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let x = -(scrolling * 0.32 % 400) - 100; x < w + 150; x += 400) {
    ctx.strokeStyle = '#abc9df0c'; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(x, TOP_RAIL + 1); ctx.lineTo(x + 64, TOP_RAIL + 80); ctx.lineTo(x + 64, BOTTOM_RAIL - 80); ctx.lineTo(x, BOTTOM_RAIL); ctx.stroke();
    ctx.strokeStyle = '#a6b4dd15'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 16, 245); ctx.lineTo(x + 16, 280); ctx.lineTo(x + 45, 280); ctx.stroke();
  }
  for (let i = 0; i < 28; i++) {
    const x = ((i * 107.3 - scrolling * (0.08 + i % 3 * 0.05)) % w + w) % w;
    const y = TOP_RAIL + 28 + (i * 71.7 % (BOTTOM_RAIL - TOP_RAIL - 60));
    ctx.fillStyle = i % 3 ? '#a5c0cb30' : '#caff9440';
    ctx.fillRect(x, y, i % 3 ? 1.5 : 2.5, i % 3 ? 1.5 : 2.5);
  }
  ctx.fillStyle = '#c2d2e10b'; ctx.font = '800 55px Arial';
  ctx.fillText('SECTOR 01', w * 0.43 - scrolling * 0.04 % 90, 315);
  ctx.font = '10px monospace'; ctx.fillStyle = '#b0c2cb38';
  ctx.fillText('M A G N E T I C   T R A N S I T', w * 0.48 - scrolling * 0.04 % 90, 339);

  // The two rails have distinct color and position cues, rather than color alone.
  for (const side of [-1, 1]) {
    const y = side === -1 ? TOP_RAIL : BOTTOM_RAIL;
    ctx.fillStyle = side === -1 ? '#211d36' : '#1e2e29';
    ctx.fillRect(0, side === -1 ? 0 : y, w, side === -1 ? y : WORLD_HEIGHT - y);
    ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = side === -1 ? '#a796ff' : '#caff94';
    ctx.fillStyle = side === -1 ? '#a796ff' : '#caff94'; ctx.fillRect(0, y - 1, w, 2); ctx.restore();
    for (let x = -(scrolling % 72); x < w; x += 72) {
      rect(ctx, x, side === -1 ? y - 19 : y + 9, 39, 5, 2, side === -1 ? '#66598a' : '#63815a');
      ctx.fillStyle = side === -1 ? '#afa0d31c' : '#a8d98d19';
      ctx.fillRect(x, side === -1 ? y - 36 : y + 28, 1, 10);
    }
  }

  let obstacles = state.obstacles;
  let orbs = state.orbs;
  let robotY = state.y;
  if (state.phase === 'ready') {
    obstacles = [{ id: 0, x: w * 0.72 - playerX, width: 66, height: 95, side: -1 }, { id: 1, x: w * 0.9 - playerX, width: 72, height: 110, side: 1 }];
    orbs = [0, 1, 2].map((i) => ({ id: i, x: w * 0.62 + i * 40 - playerX, y: BOTTOM_RAIL - 33, collected: false }));
    robotY = BOTTOM_RAIL - 17;
  }
  const offset = state.phase === 'ready' ? 0 : state.distance;
  for (const obstacle of obstacles) {
    const x = playerX + obstacle.x - offset;
    if (x < -120 || x > w + 100) continue;
    const y = obstacle.side === 1 ? BOTTOM_RAIL - obstacle.height : obstacle.side === -1 ? TOP_RAIL : (TOP_RAIL + BOTTOM_RAIL - obstacle.height) / 2;
    const obGradient = ctx.createLinearGradient(x, y, x + obstacle.width, y + obstacle.height);
    obGradient.addColorStop(0, '#d67e80'); obGradient.addColorStop(1, '#9d425e');
    ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = '#ee7c8c30';
    ctx.beginPath(); ctx.roundRect(x, y, obstacle.width, obstacle.height, 6); ctx.fillStyle = obGradient; ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#ffb1a980'; ctx.lineWidth = 1; ctx.stroke();
    rect(ctx, x + 6, y + 6, obstacle.width - 12, obstacle.height - 12, 3, '#2e203530');
    ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + (obstacle.side === 1 ? 4 : obstacle.height - 14), obstacle.width - 4, 10); ctx.clip();
    ctx.strokeStyle = '#f6c4a27a'; ctx.lineWidth = 5;
    for (let stripe = -20; stripe < obstacle.width + 20; stripe += 15) {
      const stripeY = y + (obstacle.side === 1 ? 4 : obstacle.height - 14);
      ctx.beginPath(); ctx.moveTo(x + stripe, stripeY + 10); ctx.lineTo(x + stripe + 10, stripeY); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#fff0dbb0'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText('×', x + obstacle.width / 2, y + obstacle.height / 2 + 7); ctx.textAlign = 'start';
  }
  for (const orb of orbs) {
    const x = playerX + orb.x - offset;
    if (orb.collected || x < -20 || x > w + 20) continue;
    const y = orb.y + (reducedMotion ? 0 : Math.sin(clock * 3 + orb.id) * 2);
    ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = '#b7f7b0';
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.strokeStyle = '#d6ffae'; ctx.lineWidth = 2; ctx.stroke();
    ctx.translate(x, y); ctx.rotate(Math.PI / 4); rect(ctx, -3, -3, 6, 6, 1, '#d6ffae'); ctx.restore();
  }

  if (state.phase !== 'over') {
    const accent = state.gravity === -1 ? '#baaaff' : '#ceff8b';
    ctx.save();
    for (let i = 7; i > 0; i--) {
      ctx.globalAlpha = (1 - i / 8) * 0.13;
      rect(ctx, playerX - 17 - i * 9, robotY - 8 + Math.sin(clock * 6 - i) * (reducedMotion ? 0 : 3), 18, 16, 5, accent);
    }
    ctx.restore();
    if (state.shield > 0) {
      ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = '#caff94';
      ctx.beginPath(); ctx.arc(playerX, robotY, 33 + (reducedMotion ? 0 : Math.sin(clock * 9) * 2), 0, Math.PI * 2);
      ctx.strokeStyle = '#d4ffa7b0'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#baff8e12'; ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(playerX, robotY); ctx.scale(1, state.gravity);
    ctx.shadowBlur = 15; ctx.shadowColor = '#cfff7f4a';
    rect(ctx, -18, -18, 36, 31, 8, '#e7efdc'); ctx.shadowBlur = 0;
    rect(ctx, -13, -11, 26, 15, 5, '#223334');
    rect(ctx, -8, -7, 4, 6, 1.5, accent); rect(ctx, 4, -7, 4, 6, 1.5, accent);
    rect(ctx, -12, 14, 8, 4, 1, '#caff94'); rect(ctx, 4, 14, 8, 4, 1, '#caff94');
    rect(ctx, -23, -8, 5, 13, 2, '#99ac9a'); rect(ctx, 18, -8, 5, 13, 2, '#99ac9a');
    ctx.fillStyle = '#caff94'; ctx.fillRect(-1, -24, 2, 6); ctx.beginPath(); ctx.arc(0, -25, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (!reducedMotion) {
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2;
      rect(ctx, playerX + Math.cos(angle) * 30 - 3, state.y + Math.sin(angle) * 30 - 3, 6, 6, 2, i % 2 ? '#d6ff96' : '#eea6a7');
    }
  }
  ctx.restore();
}
