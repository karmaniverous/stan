// src/types/keypress.d.ts
// Minimal type for the "keypress" library (CommonJS) to enable ESM default import
declare module 'keypress' {
  export default function keypress(stream: NodeJS.ReadableStream): void;
}
