const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const appPath = path.join(distDir, 'app.html');
const redirectsPath = path.join(distDir, '_redirects');

if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, appPath);
  fs.unlinkSync(indexPath);
  console.log(`Prepared Cloudflare assets: copied index.html to app.html and removed index.html.`);
} else if (fs.existsSync(appPath)) {
  console.log(`Prepared Cloudflare assets: app.html already exists.`);
} else {
  throw new Error(`Missing expected build artifact: ${indexPath}`);
}

if (fs.existsSync(redirectsPath)) {
  fs.unlinkSync(redirectsPath);
  console.log(`Prepared Cloudflare assets: removed _redirects because Workers Assets uses SPA handling.`);
}
