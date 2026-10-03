export function named<F extends (...args: never[]) => unknown>(fn: F, name: string): F {
  return Object.defineProperty(fn, 'name', { value: name, configurable: true });
}
