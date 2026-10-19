import { BOTTOM_RAIL, TOP_RAIL, WORLD_HEIGHT, difficultyAt, obstacleRects } from './game';
import type { GameState } from './game';

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
}

export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, time: number, reducedMotion: boolean) {
  ctx.save();
  const scale = height / WORLD_HEIGHT;
  ctx.scale(scale, scale);
  // Keep at least 680 world units visible on narrow phones for a fair warning window.
  const horizontalZoom = Math.min(1, width / scale / 680);
  ctx.scale(horizontalZoom, 1);
  const w = width / scale / horizontalZoom;
  if (!reducedMotion) {
    const impact = state.effects.find(e => (e.kind === 'crash' || e.kind === 'break' || e.kind === 'near') && e.age < 0.13);
    if (impact) { const strength = (1 - impact.age / 0.13) * (impact.kind === 'crash' ? 6 : 3); ctx.translate(Math.sin(time * 110) * strength, Math.cos(time * 93) * strength * 0.5); }
  }
  const playerX = Math.min(115, w * 0.2);
  const clock = reducedMotion || state.phase === 'paused' ? state.elapsed : time;
  const scrolling = state.phase === 'ready' ? (reducedMotion ? 0 : time * 18) : state.distance;
  const gradient = ctx.createLinearGradient(0, 0, w, WORLD_HEIGHT);
  gradient.addColorStop(0, '#171a2c'); gradient.addColorStop(0.55, '#111b27'); gradient.addColorStop(1, '#152b29');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, WORLD_HEIGHT);

  // Tunnel parallax and speed streaks respond to the actual run speed.
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
  ctx.fillText('SECTOR ' + difficultyAt(state.distance).sector.toString().padStart(2, '0'), w * 0.43 - scrolling * 0.04 % 90, 315);
  ctx.font = '10px monospace'; ctx.fillStyle = '#b0c2cb38';
  ctx.fillText('M A G N E T I C   T R A N S I T', w * 0.48 - scrolling * 0.04 % 90, 339);
  if (!reducedMotion && state.phase === 'playing') {
    ctx.strokeStyle = '#c9e8d528'; ctx.lineWidth = 1;
    for (let i = 0; i < 13; i++) {
      const x = ((i * 197 - scrolling * 1.3) % w + w) % w;
      const y = TOP_RAIL + 18 + i * 57 % 350;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 15 + state.speed / 16, y); ctx.stroke();
    }
  }

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
    obstacles = [{ id: 0, x: w * 0.78 - playerX, width: 18, height: 0, side: 1, kind: 'squeeze', gap: { center: 280, size: 210 }, passed: false, broken: false, closest: Infinity }, { id: 1, x: w * 0.96 - playerX, width: 66, height: 230, side: -1, kind: 'wall', passed: false, broken: false, closest: Infinity }];
    orbs = [0, 1, 2, 3].map((i) => ({ id: i, x: w * 0.71 + i * 30 - playerX, y: 418 - i * 82, collected: false }));
    robotY = BOTTOM_RAIL - 17;
  }
  const offset = state.phase === 'ready' ? 0 : state.distance;
  for (const obstacle of obstacles) {
    const x = playerX + obstacle.x - offset;
    if (obstacle.broken || x < -120 || x > w + 100) continue;
    const squeeze = obstacle.kind === 'squeeze';
    for (const segment of obstacleRects(obstacle)) {
      const { top: y, height: segmentHeight, side } = segment;
      const obGradient = ctx.createLinearGradient(x, y, x + obstacle.width, y + segmentHeight);
      obGradient.addColorStop(0, squeeze ? '#ffc17d' : obstacle.kind === 'laser' ? '#ff728d' : '#e88c85'); obGradient.addColorStop(1, squeeze ? '#a05048' : '#913e66');
      ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = '#ee7c8c30';
      ctx.beginPath(); ctx.roundRect(x, y, obstacle.width, segmentHeight, squeeze ? 3 : 6); ctx.fillStyle = obGradient; ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#ffb1a980'; ctx.lineWidth = 1; ctx.stroke();
      rect(ctx, x + 6, y + 6, obstacle.width - 12, segmentHeight - 12, 2, '#2e203530');
      ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + (side === 1 ? 4 : segmentHeight - 14), obstacle.width - 4, 10); ctx.clip();
      ctx.strokeStyle = '#f6c4a27a'; ctx.lineWidth = 5;
      for (let stripe = -20; stripe < obstacle.width + 20; stripe += 15) {
        const stripeY = y + (side === 1 ? 4 : segmentHeight - 14);
        ctx.beginPath(); ctx.moveTo(x + stripe, stripeY + 10); ctx.lineTo(x + stripe + 10, stripeY); ctx.stroke();
      }
      ctx.restore();
      if (obstacle.kind === 'laser') {
        ctx.save(); ctx.shadowBlur = 22; ctx.shadowColor = '#ff83b4';
        rect(ctx, x + obstacle.width / 2 - 3, y + 9, 6, segmentHeight - 18, 3, '#ffe0e9'); ctx.restore();
      }
      if (!squeeze) { ctx.fillStyle = '#fff0dbb0'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText('×', x + obstacle.width / 2, y + segmentHeight / 2 + 7); ctx.textAlign = 'start'; }
    }
    if (obstacle.gap) {
      const { center, size } = obstacle.gap;
      // Bright lips mark the passage; the opening itself stays visually clear.
      ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = '#ffd39a';
      rect(ctx, x - 4, center - size / 2 - 3, obstacle.width + 8, 4, 2, '#ffe1a9');
      rect(ctx, x - 4, center + size / 2 - 1, obstacle.width + 8, 4, 2, '#ffe1a9');
      ctx.restore();
    }
  }
  for (const orb of orbs) {
    const x = playerX + orb.x - offset;
    if (orb.collected || x < -20 || x > w + 20) continue;
    const y = orb.y + (reducedMotion ? 0 : Math.sin(clock * 3 + orb.id) * 2);
    ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = '#b7f7b0';
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.strokeStyle = '#d6ffae'; ctx.lineWidth = 2; ctx.stroke();
    ctx.translate(x, y); ctx.rotate(Math.PI / 4); rect(ctx, -3, -3, 6, 6, 1, '#d6ffae'); ctx.restore();
  }

  for (const pickup of state.pickups) {
    const x = playerX + pickup.x - offset;
    if (pickup.collected || x < -30 || x > w + 30) continue;
    const y = pickup.y;
    ctx.save(); ctx.translate(x, y); ctx.shadowBlur = 25; ctx.shadowColor = '#72e8ff';
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(18, -10); ctx.lineTo(15, 11); ctx.lineTo(0, 23); ctx.lineTo(-15, 11); ctx.lineTo(-18, -10); ctx.closePath();
    ctx.fillStyle = '#174f62'; ctx.fill(); ctx.strokeStyle = '#8df1ff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#d1fcff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(0, -8); ctx.lineTo(7, -4); ctx.lineTo(5, 6); ctx.lineTo(0, 10); ctx.lineTo(-5, 6); ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  for (const effect of state.effects) {
    const x = playerX + effect.x - offset, y = effect.y, age = effect.age;
    const color = effect.kind === 'shield' || effect.kind === 'break' ? '#91efff' : effect.kind === 'flip' ? '#c9baff' : '#d7ff91';
    if (!reducedMotion) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 0.55); ctx.fillStyle = color; ctx.strokeStyle = color;
      if (effect.kind === 'land') {
        ctx.beginPath(); ctx.ellipse(x, y + state.gravity * 15, 12 + age * 110, 3 + age * 4, 0, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke();
      } else if (effect.kind !== 'combo' && effect.kind !== 'near') {
        const count = effect.kind === 'crash' || effect.kind === 'break' ? 15 : 7;
        for (let i = 0; i < count; i++) {
          const angle = i / count * Math.PI * 2 + effect.id;
          const spread = age * (effect.kind === 'break' ? 230 : 140);
          rect(ctx, x + Math.cos(angle) * spread - 2, y + Math.sin(angle) * spread + age * age * 90 - 2, effect.kind === 'break' ? 7 : 4, effect.kind === 'break' ? 7 : 4, 1, color);
        }
      }
      ctx.restore();
    }
    if (effect.kind === 'near' || effect.kind === 'combo' || effect.kind === 'shield' || effect.kind === 'break' || effect.kind === 'coin') {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 0.85); ctx.fillStyle = color;
      const callout = effect.kind === 'coin' ? '+' + effect.value : effect.kind === 'near' ? 'CLOSE CALL +' + effect.value : effect.kind === 'combo' ? 'FLOW x' + effect.value : effect.kind === 'shield' ? 'SHIELD READY' : 'SMASH +50';
      ctx.font = effect.kind === 'coin' ? 'bold 13px monospace' : 'bold 16px monospace'; ctx.textAlign = 'center';
      ctx.fillText(callout, Math.max(90, Math.min(w - 100, x)), Math.max(135, Math.min(425, y - 28 - (reducedMotion ? 0 : age * 55)))); ctx.restore();
    }
  }

  if (state.phase !== 'over') {
    const accent = state.gravity === -1 ? '#baaaff' : '#ceff8b';
    ctx.save();
    if (!reducedMotion) for (let i = 0; i < state.trail.length; i++) {
      const point = state.trail[i]; ctx.globalAlpha = i / state.trail.length * 0.25;
      rect(ctx, playerX + point.x - state.distance - 13, point.y - 11, 26, 22, 6, accent);
    }
    ctx.restore();
    if (state.shield > 0) {
      ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = '#8befff';
      ctx.beginPath(); ctx.arc(playerX, robotY, 33 + (reducedMotion ? 0 : Math.sin(clock * 9) * 2), 0, Math.PI * 2);
      ctx.strokeStyle = '#9ef3ffdd'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#8ff3ff18'; ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(playerX, robotY); ctx.rotate(state.angle);
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
