// src/types/istextorbinary.d.ts
declare module 'istextorbinary' {
  export function isBinary(
    file: string | Buffer,
    opts: unknown,
    cb: (err: unknown, result?: boolean) => void,
  ): void;

  const _default: {
    isBinary: typeof isBinary;
  };
  export default _default;
}
