declare module 'fs-native-extensions' {
  /** Attempt a nonblocking exclusive lock covering the whole file. */
  export function tryLock(fd: number, options?: { shared?: boolean }): boolean;
}
