#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const { applyRuntimeEnv, createApp } = require('../server-app');

function parseDotEnv(raw) {
  const data = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return data;
}

function loadEnvMap() {
  const merged = { ...process.env };
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return merged;
  }

  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    const parsed = parseDotEnv(raw);
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof merged[key] !== 'string' || merged[key].length === 0) {
        merged[key] = value;
      }
    }
  } catch {
    // Keep the existing environment if .env parsing fails.
  }

  return merged;
}

function isApiPath(routePath) {
  return (
    routePath === '/health' ||
    routePath === '/ai-test' ||
    routePath === '/recognize' ||
    routePath.startsWith('/newsletter/subscribe') ||
    routePath.startsWith('/api/')
  );
}

async function main() {
  const env = loadEnvMap();
  if (typeof env.FORCE_NODE_ENV === 'string' && env.FORCE_NODE_ENV.trim()) {
    env.NODE_ENV = env.FORCE_NODE_ENV.trim();
  }
  applyRuntimeEnv(env);

  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.error(`Missing build output: ${distDir}`);
    process.exitCode = 1;
    return;
  }

  const apiApp = createApp({ runtime: 'node', serveWebUi: true });
  const app = express();
  const webUiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use((req, res, next) => {
    if (isApiPath(req.path)) {
      return apiApp(req, res, next);
    }
    return next();
  });

  app.use(express.static(distDir, { extensions: ['html'] }));

  app.use((req, res, next) => {
    if (isApiPath(req.path)) {
      return next();
    }
    webUiLimiter(req, res, (rateLimitError) => {
      if (rateLimitError) {
        next(rateLimitError);
        return;
      }

      const preferredRootPath = fs.existsSync(path.join(distDir, 'index.html'))
        ? path.join(distDir, 'index.html')
        : path.join(distDir, 'app.html');
      res.sendFile(preferredRootPath, (error) => {
        if (error) {
          next(error);
        }
      });
    });
  });

  const port = Number(env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Production simulator draait op http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
