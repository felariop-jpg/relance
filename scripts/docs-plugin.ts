import { readdirSync, readFileSync } from 'node:fs';
import { marked } from 'marked';
import type { Plugin } from 'vite';

/**
 * Publishes the plain-language guides as static pages inside the site
 * (dist/docs/*.html), so the in-app help links work whatever the repository's
 * visibility or the host. Build time only: nothing here ships as JavaScript.
 */
export const PAGES: [source: string, page: string][] = [
  ['docs/README.md', 'index'],
  ['docs/handover.md', 'handover'],
  ['docs/handover.fr.md', 'handover.fr'],
  ['docs/getting-started.md', 'getting-started'],
  ['docs/getting-started.fr.md', 'getting-started.fr'],
  ['docs/api-key.md', 'api-key'],
  ['docs/api-key.fr.md', 'api-key.fr'],
  ['docs/templates.md', 'templates'],
  ['docs/templates.fr.md', 'templates.fr'],
  ['docs/eml-compatibility.md', 'eml-compatibility'],
  ['docs/deployment.md', 'deployment'],
  ['PRIVACY.md', 'privacy'],
  ['PRIVACY.fr.md', 'privacy.fr'],
];

const pageFor = (name: string) => (name === 'PRIVACY' ? 'privacy' : name === 'PRIVACY.fr' ? 'privacy.fr' : name);

/** Links between guides point at .md files in the repo; on the site they become .html pages. */
export function rewriteLinks(markdown: string): string {
  return markdown.replace(
    /\]\((?:\.\.\/)?(?:docs\/)?([A-Za-z.-]+?)\.md(#[^)]*)?\)/g,
    (_match, name: string, hash = '') => `](${pageFor(name)}.html${hash})`,
  );
}

function page(title: string, lang: string, body: string): string {
  const back = lang === 'fr' ? '← Retour à Relance' : '← Back to Relance';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'">
<meta name="referrer" content="no-referrer">
<title>${title} · Relance</title>
<style>
body{font:17px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1c1917;background:#fafaf9;margin:0}
main{max-width:46rem;margin:0 auto;padding:1.5rem 1rem 4rem}
a{color:#0f766e}img{max-width:100%;height:auto;border:1px solid #e7e5e4;border-radius:8px}
code{background:#f5f5f4;padding:.1em .3em;border-radius:4px;font-size:.9em}pre{background:#1c1917;color:#f5f5f4;padding:1rem;border-radius:8px;overflow:auto}pre code{background:none;color:inherit}
table{border-collapse:collapse;width:100%;font-size:.95em}th,td{border:1px solid #e7e5e4;padding:.4rem .6rem;text-align:left;vertical-align:top}
blockquote{margin:1rem 0;padding:.5rem 1rem;background:#fffbeb;border-left:4px solid #f59e0b}
.back{display:inline-block;margin-bottom:1rem}
@page{size:A4;margin:12mm 14mm}
@media print{body{font-size:10pt;line-height:1.38;background:none}main{max-width:none;padding:0}.back{display:none}a{color:inherit;text-decoration:none}h1{font-size:16pt;margin:0 0 .4em}h2{font-size:11.5pt;margin:.9em 0 .25em}p,ul,ol{margin:.3em 0}li{margin:.1em 0}ul,ol{padding-left:1.4em}img{display:none}}
</style>
</head>
<body><main><a class="back" href="../">${back}</a>
${body}
</main></body>
</html>
`;
}

export function docsPages(): Plugin {
  return {
    name: 'relance-docs-pages',
    apply: 'build',
    generateBundle() {
      for (const [source, name] of PAGES) {
        const markdown = rewriteLinks(readFileSync(source, 'utf8'));
        const title = /^#\s+(.+)$/m.exec(markdown)?.[1] ?? 'Relance';
        const lang = name.endsWith('.fr') ? 'fr' : 'en';
        this.emitFile({ type: 'asset', fileName: `docs/${name}.html`, source: page(title, lang, marked.parse(markdown, { async: false })) });
      }
      for (const file of readdirSync('docs/screenshots')) {
        this.emitFile({ type: 'asset', fileName: `docs/screenshots/${file}`, source: readFileSync(`docs/screenshots/${file}`) });
      }
    },
  };
}
