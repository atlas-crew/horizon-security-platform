import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('index.css accessibility affordances', () => {
  it('shows .copy-btn when code block wrapper has keyboard focus within', () => {
    // Vitest runs with cwd set to the app root (apps/signal-horizon/ui).
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain('.code-block-wrapper:focus-within .copy-btn');
  });
});
