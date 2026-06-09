const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(process.cwd(), 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error(`Missing expected build artifact: ${indexPath}`);
}

const html = fs.readFileSync(indexPath, 'utf8');

const serviceWorkerVersion = 'scan-runtime-20260528';
const pwaHead = `  <meta name="theme-color" content="#04131F" />
  <link rel="manifest" href="/manifest.json" />
  <script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js?v=${serviceWorkerVersion}', { updateViaCache: 'none' })
      .then(function (registration) {
        registration.update();
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'TAZE_SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'TAZE_SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function () {});
  });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (window.__TAZE_SW_RELOADED__) return;
    window.__TAZE_SW_RELOADED__ = true;
    window.location.reload();
  });
}
  </script>`;

function ensurePwaHead(value) {
  if (value.includes('href="/manifest.json"') && value.includes("navigator.serviceWorker.register('/sw.js?")) {
    return value;
  }

  return value.replace(/<\/head>/i, `\n${pwaHead}\n</head>`);
}

const accessFallback = `<noscript>
      Toegang vereist. Log in met je Taze-account om je bedrijfsomgeving te openen.
    </noscript>
    <div id="root">Toegang vereist. Terug naar taze.to</div>`;

const patched = ensurePwaHead(html)
  .replace(
    /<noscript>[\s\S]*?<\/noscript>\s*<!-- The root element for your Expo app\. -->\s*<div id="root"><\/div>/,
    `${accessFallback}\n    <!-- The root element for your Expo app. -->`
  );

if (patched === html) {
  const alreadyPatched =
    html.includes('href="/manifest.json"') &&
    html.includes("navigator.serviceWorker.register('/sw.js?") &&
    html.includes('Toegang vereist. Terug naar taze.to');

  if (alreadyPatched) {
    console.log(`Web root already patched: ${indexPath}`);
    process.exit(0);
  }

  throw new Error('Could not patch dist/index.html access fallback.');
}

fs.writeFileSync(indexPath, patched, 'utf8');

console.log(`Patched web root access fallback: ${indexPath}`);
