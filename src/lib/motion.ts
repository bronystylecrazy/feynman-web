export function motion(duration: number) {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : duration;
}
