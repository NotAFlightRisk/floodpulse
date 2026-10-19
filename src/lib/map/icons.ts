import type { Severity, State, Trend } from '#lib/types.js';

export const RATIO = 2;
export const STATES: State[] = ['high', 'normal', 'low', 'unknown'];
export const TRENDS: Trend[] = ['rising', 'falling', 'steady', 'unknown'];
export const SEVERITIES: Severity[] = [1, 2, 3];

function canvas(size: number) {
  const element = document.createElement('canvas');
  element.width = element.height = size * RATIO;
  const context = element.getContext('2d')!;
  context.scale(RATIO, RATIO);
  return context;
}

const pixels = (context: CanvasRenderingContext2D) =>
  context.getImageData(0, 0, context.canvas.width, context.canvas.height);

/** An OS benchmark arrow for rising and falling, its bar for steady, a dot for no idea yet */
export function gauge(trend: Trend, fill: string, halo: string) {
  const size = 18;
  const context = canvas(size);
  context.beginPath();
  if (trend === 'rising' || trend === 'falling') {
    const [tip, base] = trend === 'rising' ? [3, 15] : [15, 3];
    context.moveTo(9, tip);
    context.lineTo(16, base);
    context.lineTo(2, base);
    context.closePath();
  } else if (trend === 'steady') {
    context.roundRect(2, 6.5, 14, 5, 1.5);
  } else {
    context.arc(9, 9, 4, 0, Math.PI * 2);
  }
  context.lineJoin = 'round';
  context.lineWidth = 2.5;
  context.strokeStyle = halo;
  context.stroke();
  context.fillStyle = fill;
  context.fill();
  return pixels(context);
}

/** The enamel plaque every warning wears, doubled up when it's a severe one */
export function plaque(severity: Severity, fill: string, ink: string) {
  const size = 24;
  const context = canvas(size);
  context.fillStyle = fill;
  context.strokeStyle = ink;
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(2, 2, 20, 20, 3);
  context.fill();
  context.stroke();
  if (severity === 1) {
    context.beginPath();
    context.roundRect(4.5, 4.5, 15, 15, 2);
    context.stroke();
  }
  context.fillStyle = ink;
  context.fillRect(10.75, 7, 2.5, 7);
  context.fillRect(10.75, 15.5, 2.5, 2.5);
  return pixels(context);
}
