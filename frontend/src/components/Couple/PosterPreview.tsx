import React, { useRef, useEffect } from 'react';
import { Modal, Button, Space, message } from 'antd';
import { Trip, RoutePOI } from '../../services/api';

interface PosterPreviewProps {
  open: boolean;
  onCancel: () => void;
  trip: Trip | null;
  coupleAvatars?: { avatar1?: string; avatar2?: string };
}

const WIDTH = 1080;
const MARGIN_X = 72;
const MAX_HEIGHT = 5600;

function measureBlockHeight(
  ctx: CanvasRenderingContext2D,
  font: string,
  text: string,
  maxWidth: number,
  lineHeight: number
): number {
  const t = text.trim();
  if (!t) return 0;
  ctx.font = font;
  let lines = 1;
  let line = '';
  for (const ch of Array.from(t)) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines++;
      line = ch;
    } else {
      line = test;
    }
  }
  return lines * lineHeight;
}

function wrapParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const t = text.trim();
  if (!t) return y;
  const chars = Array.from(t);
  let line = '';
  let py = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, py);
      py += lineHeight;
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, py);
    py += lineHeight;
  }
  return py;
}

function estimateCanvasHeight(trip: Trip, contentW: number): number {
  const scratch = document.createElement('canvas').getContext('2d');
  if (!scratch) return 2200;

  const routes = [...(trip.routes || [])].sort((a, b) => {
    if (a.day_number !== b.day_number) return a.day_number - b.day_number;
    return (a.order_index ?? 0) - (b.order_index ?? 0);
  });

  let est = 360;
  routes.forEach((route) => {
    est += 56 + 72;
    const pois = [...(route.pois || [])].sort((a, b) => a.order_index - b.order_index);
    pois.forEach((rp, i) => {
      if (i > 0 && rp.segment_note?.trim()) {
        est +=
          measureBlockHeight(scratch, 'italic 26px sans-serif', `🚌 ${rp.segment_note}`, contentW - 40, 32) +
          14;
      }
      est += measureBlockHeight(
        scratch,
        'bold 32px sans-serif',
        `${i + 1}. ${rp.poi.name}`,
        contentW,
        38
      );
      if (rp.stop_note?.trim()) {
        est +=
          6 +
          measureBlockHeight(scratch, '26px sans-serif', `📝 ${rp.stop_note}`, contentW - 32, 32);
      }
      est += 18 + 22;
    });
    est += 20;
  });
  est += 220;
  return Math.min(MAX_HEIGHT, Math.max(1920, est));
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function generatePoster(
  canvas: HTMLCanvasElement,
  trip: Trip,
  avatarImgs?: { left?: HTMLImageElement | null; right?: HTMLImageElement | null }
) {
  const contentW = WIDTH - MARGIN_X * 2;
  const height = estimateCanvasHeight(trip, contentW);
  canvas.width = WIDTH;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#f3eee8');
  gradient.addColorStop(0.5, '#faf7f3');
  gradient.addColorStop(1, '#fffcf9');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, height);

  drawRoundedRect(ctx, MARGIN_X - 20, 72, WIDTH - (MARGIN_X - 20) * 2, 246, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();

  ctx.fillStyle = '#8b4513';
  ctx.font = 'bold 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(trip.name || '随迹 · 行程', WIDTH / 2, 165);

  ctx.fillStyle = '#5c534c';
  ctx.font = '36px sans-serif';
  ctx.fillText(trip.destination || '', WIDTH / 2, 230);

  ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X + 40, 278);
  ctx.lineTo(WIDTH - MARGIN_X - 40, 278);
  ctx.stroke();

  const routes = [...(trip.routes || [])].sort((a, b) => {
    if (a.day_number !== b.day_number) return a.day_number - b.day_number;
    return (a.order_index ?? 0) - (b.order_index ?? 0);
  });

  let y = 340;
  const primary = '#5a3d2b';
  const muted = '#6e655c';
  const legColor = '#4d6b5c';

  routes.forEach((route) => {
    const dayLabel = route.name?.trim() ? route.name : `Day ${route.day_number}`;

    ctx.fillStyle = 'rgba(139, 69, 19, 0.12)';
    drawRoundedRect(ctx, MARGIN_X - 12, y - 36, contentW + 24, 96, 16);
    ctx.fill();

    ctx.fillStyle = route.color || primary;
    ctx.fillRect(MARGIN_X - 8, y - 20, 6, 44);

    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = primary;
    ctx.fillText(dayLabel, MARGIN_X + 12, y + 8);

    ctx.fillStyle = muted;
    ctx.font = '24px sans-serif';
    ctx.fillText(`共 ${route.pois?.length ?? 0} 站 · 按游览顺序`, MARGIN_X + 12, y + 44);
    y += 88;

    const pois = [...(route.pois || [])].sort((a, b) => a.order_index - b.order_index);
    pois.forEach((rp: RoutePOI, i) => {
      if (i > 0 && rp.segment_note?.trim()) {
        ctx.fillStyle = legColor;
        ctx.font = 'italic 27px sans-serif';
        y = wrapParagraph(ctx, `🚌 ${rp.segment_note}`, MARGIN_X + 24, y, contentW - 48, 30);
        y += 14;
      }

      ctx.fillStyle = primary;
      ctx.font = 'bold 32px sans-serif';
      y = wrapParagraph(ctx, `${i + 1}. ${rp.poi.name}`, MARGIN_X + 4, y, contentW - 8, 38);
      y += 4;

      if (rp.stop_note?.trim()) {
        ctx.fillStyle = muted;
        ctx.font = '26px sans-serif';
        y = wrapParagraph(ctx, `📝 ${rp.stop_note}`, MARGIN_X + 28, y, contentW - 40, 32);
      }

      y += 22;
    });

    y += 28;
  });

  const avatarY = height - 190;
  const avatarSize = 100;
  const stampAvatar = (img: HTMLImageElement, dx: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(dx + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, dx, avatarY, avatarSize, avatarSize);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(dx + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  };
  if (avatarImgs?.left) stampAvatar(avatarImgs.left, WIDTH / 2 - avatarSize - 16);
  if (avatarImgs?.right) stampAvatar(avatarImgs.right, WIDTH / 2 + 16);

  ctx.fillStyle = '#9a928a';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('随迹 Trace · 电子票根与路线', WIDTH / 2, height - 44);
}

const PosterPreview: React.FC<PosterPreviewProps> = ({ open, onCancel, trip, coupleAvatars }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !trip) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = (imgs?: { left?: HTMLImageElement | null; right?: HTMLImageElement | null }) => {
      generatePoster(canvas, trip, imgs);
    };

    draw({});

    const leftSrc = coupleAvatars?.avatar1;
    const rightSrc = coupleAvatars?.avatar2;
    if (!leftSrc && !rightSrc) return;

    Promise.all([
      leftSrc ? loadImageElement(leftSrc).catch(() => null) : Promise.resolve(null),
      rightSrc ? loadImageElement(rightSrc).catch(() => null) : Promise.resolve(null),
    ]).then(([left, right]) => draw({ left: left ?? undefined, right: right ?? undefined }));
  }, [open, trip, coupleAvatars]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `travel-poster-${trip?.id || 'preview'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    message.success('海报保存成功');
  };

  return (
    <Modal
      title="行程海报预览"
      open={open}
      onCancel={onCancel}
      width={580}
      className="rounded-modal max-h-[90vh]"
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      footer={
        <Space>
          <Button onClick={onCancel}>关闭</Button>
          <Button type="primary" onClick={handleSave}>
            保存到本地
          </Button>
        </Space>
      }
    >
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto rounded-2xl editorial-shadow border border-black/5"
        />
      </div>
    </Modal>
  );
};

export default PosterPreview;
