const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(process.cwd(), 'dist');
const outputPath = path.join(process.cwd(), 'lib', 'generated-root-html.mjs');
const fallbackRootPath = path.join(distDir, 'app.html');

if (!fs.existsSync(fallbackRootPath)) {
  throw new Error(`Missing expected fallback root html artifact: ${fallbackRootPath}`);
}

const baseHtml = fs.readFileSync(fallbackRootPath, 'utf8');

function toModuleString(value) {
  return JSON.stringify(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textBlock(items) {
  return items.map((item) => `<p>${escapeHtml(item)}</p>`).join('');
}

function replaceTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function upsertMeta(html, name, content) {
  const escapedName = escapeHtml(name);
  const escapedContent = escapeHtml(content);
  const meta = `<meta name="${escapedName}" content="${escapedContent}" />`;
  const pattern = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');

  if (pattern.test(html)) {
    return html.replace(pattern, meta);
  }

  return html.replace(/<\/head>/i, `  ${meta}\n</head>`);
}

function setRootFallback(html, items) {
  const fallback = textBlock(items);
  const noscript = `<noscript>${fallback}</noscript>`;
  const root = `<div id="root">${fallback}</div>`;

  return html
    .replace(/<noscript>[\s\S]*?<\/noscript>/i, noscript)
    .replace(/<div id="root"[^>]*>[\s\S]*?<\/div>/i, root);
}

function buildHtml({ title, description, items, extraHead = '' }) {
  let html = replaceTitle(baseHtml, title);
  html = upsertMeta(html, 'description', description);

  if (extraHead) {
    html = html.replace(/<\/head>/i, `${extraHead}\n</head>`);
  }

  return setRootFallback(html, items);
}

const publicItems = [
  'Taze brengt scan, transport, facturatie en data in één duidelijke bedrijfsflow.',
  'Van werkvloer tot management: observaties, bewijs, metrics en AI/RIA-advies binnen bevoegdheid.',
  'Bekijk de demo',
  'Plan gecontroleerde demo',
  'Van scan tot rapport',
  'Data en metrics',
  'AI/RIA als advieslaag',
  'Waarom Google, teams en groei dit begrijpen',
];

const demoItems = [
  'Taze Proof Pakket',
  '15 producten, één volledige bedrijfsflow.',
  '15 proof-producten die de volledige keten laten zien',
  '15 producten in 7 stappen',
  'Frisdrank krat',
  'Product met schadegevoeligheid',
  'Na het proof-pakket kies je het juiste Taze-pakket.',
  'Startpakket',
  'Groeipakket',
  'Bedrijfspakket',
  'Van scan tot rapport, binnen bevoegdheid en zonder echte data.',
  'Geen echte data. Geen echte impact. Klaar om pakket te kiezen.',
];

const accountItems = [
  'Toegang vereist',
  'Ga naar login',
  'Log in met je Taze-account om je bedrijfsomgeving te openen.',
];

const scanItems = [
  'Taze | Scan product of barcode',
  'Scan producten of barcode',
  'Scan producten en optimaliseer je workflow met Taze. Log in om direct aan de slag te gaan in jouw beveiligde omgeving.',
];

const roots = [
  [
    'PUBLIC_ROOT_HTML',
    buildHtml({
      title: 'Taze | Scan, transport, facturatie, data en metrics',
      description:
        'Taze helpt bedrijven met scan, transport, facturatie, rollen/bevoegdheden, bewijs, rapportage, data en metrics. AI/RIA adviseert binnen bevoegdheid; mensen bevestigen de actie.',
      items: publicItems,
    }),
  ],
  [
    'DEMO_ROOT_HTML',
    buildHtml({
      title: 'Taze | Proof Pakket',
      description:
        'Ontdek het Taze Proof Pakket met 15 producten, volledige ketenwaarde en read-only AI/RIA advies binnen bevoegdheid.',
      items: demoItems,
      extraHead: '  <meta name="robots" content="noindex, nofollow" />',
    }),
  ],
  [
    'ACCOUNT_ROOT_HTML',
    buildHtml({
      title: 'Taze | Account en login',
      description: 'Log in met Google, Microsoft, Apple of e-mail en beheer rollen en toegang.',
      items: accountItems,
    }),
  ],
  [
    'SCAN_ROOT_HTML',
    buildHtml({
      title: 'Taze | Scan product of barcode',
      description: 'Scan producten en optimaliseer je workflow met Taze. Log in om direct aan de slag te gaan in jouw beveiligde omgeving.',
      items: scanItems,
      extraHead: '  <meta property="og:url" content="https://app.taze.to/scan" />',
    }),
  ],
];

const body = roots.map(([name, html]) => `export const ${name} = ${toModuleString(html)};`).join('\n\n');

fs.writeFileSync(
  outputPath,
  `${body}\n`,
  'utf8'
);

console.log(`Generated root html module: ${outputPath}`);
