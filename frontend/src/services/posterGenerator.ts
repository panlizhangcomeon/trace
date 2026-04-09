/**
 * Poster generation service for couple features.
 */

interface PosterConfig {
  width: number;
  height: number;
  backgroundGradient: [string, string];
  primaryColor: string;
  secondaryColor: string;
}

interface TripData {
  name: string;
  destination: string;
  routes: Array<{
    name: string;
    day_number: number;
    pois: Array<{
      poi: {
        name: string;
        type: string;
      };
    }>;
  }>;
}

const DEFAULT_CONFIG: PosterConfig = {
  width: 1080,
  height: 1920,
  backgroundGradient: ['#efebe6', '#fdfbf8'],
  primaryColor: '#8b4513',
  secondaryColor: '#5c7a6e',
};

export function generatePoster(
  canvas: HTMLCanvasElement,
  trip: TripData,
  config: PosterConfig = DEFAULT_CONFIG,
  coupleAvatars?: { avatar1?: string; avatar2?: string }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = config.width;
  canvas.height = config.height;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, config.backgroundGradient[0]);
  gradient.addColorStop(1, config.backgroundGradient[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = config.primaryColor;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(trip.name || '随迹 · 行程', config.width / 2, 200);

  // Destination
  ctx.fillStyle = '#4a4a4a';
  ctx.font = '48px sans-serif';
  ctx.fillText(trip.destination || '', config.width / 2, 280);

  // Divider
  ctx.strokeStyle = config.primaryColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(200, 320);
  ctx.lineTo(config.width - 200, 320);
  ctx.stroke();

  // Routes info
  let y = 450;
  trip.routes?.forEach((route) => {
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(route.name || `Day ${route.day_number}`, 100, y);

    ctx.fillStyle = '#4a4a4a';
    ctx.font = '32px sans-serif';
    ctx.fillText(`${route.pois?.length || 0} 个景点`, 100, y + 50);

    y += 150;
  });

  // Couple avatars
  const avatarY = 1600;
  const avatarSize = 120;

  if (coupleAvatars?.avatar1) {
    const img1 = new Image();
    img1.src = coupleAvatars.avatar1;
    ctx.drawImage(img1, config.width / 2 - avatarSize - 20, avatarY, avatarSize, avatarSize);
  }

  if (coupleAvatars?.avatar2) {
    const img2 = new Image();
    img2.src = coupleAvatars.avatar2;
    ctx.drawImage(img2, config.width / 2 + 20, avatarY, avatarSize, avatarSize);
  }

  // Footer
  ctx.fillStyle = '#6b6560';
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('随迹 Trace · 电子票根与路线', config.width / 2, config.height - 50);
}

export function downloadPoster(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
