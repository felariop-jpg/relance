import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { docsPages } from './scripts/docs-plugin';

/**
 * Where the site lives, relative to the domain. './' (relative) works both on
 * GitHub Pages (https://<user>.github.io/relance/) and at the root of another
 * host such as Cloudflare Pages. Changing hosts is this one line, if ever needed.
 */
const BASE_PATH = './';

// The browser enforces the "only outbound call is the Anthropic API" promise.
// Production only: the dev server needs inline scripts and a websocket.
const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://api.anthropic.com",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'relance-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      ),
  };
}

export default defineConfig({
  base: BASE_PATH,
  // One app bundle (~170 kB gzipped) plus the lazily loaded AI SDK. Fine for a tool.
  build: { chunkSizeWarningLimit: 700 },
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), docsPages()],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
