import confetti from 'canvas-confetti';

export function createConfetti({ x = 0.5, y = 0.5, count = 50, spread = 90 }) {
  confetti({
    particleCount: count,
    spread: spread,
    origin: { x, y },
    colors: ['#22c55e', '#16a34a', '#15803d'], // Different shades of green
    ticks: 200,
    gravity: 0.8,
    scalar: 1.2,
    shapes: ['circle', 'square'],
    zIndex: 1000
  });
}