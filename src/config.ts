/** The source repository (for developers; may be private). */
export const REPO_URL = 'https://github.com/felariop-jpg/relance';

/** Anthropic's public price list (a link the user opens; never fetched). */
export const PRICING_URL = 'https://www.anthropic.com/pricing';

/**
 * The plain-language guides are published inside the site itself
 * (see scripts/docs-plugin.ts), so these links work whether the repository is
 * public or private, on any host.
 */
export function docUrl(name: 'getting-started' | 'api-key' | 'templates' | 'privacy', lang: 'en' | 'fr'): string {
  return `./docs/${name}${lang === 'fr' ? '.fr' : ''}.html`;
}
