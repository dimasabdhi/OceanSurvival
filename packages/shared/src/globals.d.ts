/**
 * Minimal declarations for globals available in BOTH browsers and Node.js.
 * packages/shared intentionally does not include the DOM or Node type libraries,
 * so platform-specific APIs cannot leak into shared code by accident.
 */
declare const performance: { now(): number };
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
