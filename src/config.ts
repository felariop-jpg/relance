/** Where the project lives; used for links to the plain-language guides. */
export const REPO_URL = 'https://github.com/felariop-jpg/relance';

export function docUrl(name: string, lang: 'en' | 'fr'): string {
  const file = lang === 'fr' ? `${name}.fr.md` : `${name}.md`;
  return `${REPO_URL}/blob/main/docs/${file}`;
}
