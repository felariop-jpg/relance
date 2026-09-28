import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(path) && !path.endsWith('.test.ts') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

const sources = files('src').map((path) => ({ path, text: readFileSync(path, 'utf8') }));

describe('hard constraint 2: the app cannot send email', () => {
  it('has no mail-sending code or services anywhere', () => {
    const forbidden = /smtp|nodemailer|sendmail|mailto:|sendgrid|mailgun|postmark|sendinblue|api\.brevo\.com|mandrill|ses\.amazonaws|gmail\.googleapis|graph\.microsoft/i;
    const hits = sources.filter((s) => forbidden.test(s.text)).map((s) => s.path);
    expect(hits).toEqual([]);
  });

  it('has no dependency that can send email', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /mail|smtp|brevo|sendinblue|postmark|resend/i.test(d))).toEqual([]);
  });
});

describe('hard constraint 3: the only outbound call is the Anthropic API', () => {
  it('ships a Content-Security-Policy that only allows the app itself and api.anthropic.com', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain(`"connect-src 'self' https://api.anthropic.com"`);
    expect(config).toContain(`"default-src 'self'"`);
  });

  it('never calls fetch; the only network use is the Anthropic SDK', () => {
    const fetchers = sources.filter((s) => /\bfetch\(/.test(s.text)).map((s) => s.path);
    expect(fetchers).toEqual([]);
    const sdkUsers = sources.filter((s) => s.text.includes("@anthropic-ai/sdk")).map((s) => s.path);
    expect(sdkUsers).toEqual(['src/ai/anthropic.ts']);
  });
});

describe('hard constraint 1: static site, no backend', () => {
  it('has no server code or server dependencies', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const deps = Object.keys(pkg.dependencies);
    expect(deps.filter((d) => /^(express|fastify|koa|@hapi\/.*|next|nuxt|firebase|@supabase\/.*|mongoose|pg|prisma|@prisma\/.*)$/.test(d))).toEqual([]);
  });
});
