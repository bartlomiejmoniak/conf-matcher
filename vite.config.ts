import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, mkdirSync, copyFileSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * `data/` stays where CLAUDE.md says it lives — at the repo root, hand-edited, the source
 * of truth. This serves it over HTTP in dev and copies it into the build, so it is never
 * duplicated into `public/`. The design system is imported through the bundler instead,
 * so its path survives a non-root `base`.
 */
function serveRootDirs(dirs: string[]): Plugin {
  const copyDir = (from: string, to: string) => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) {
      const src = join(from, entry);
      if (statSync(src).isDirectory()) copyDir(src, join(to, entry));
      else copyFileSync(src, join(to, entry));
    }
  };
  return {
    name: 'confgraph:serve-root-dirs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? '';
        const dir = dirs.find((d) => url.startsWith(`/${d}/`));
        if (!dir) return next();
        try {
          const body = readFileSync('.' + decodeURIComponent(url));
          res.setHeader('Content-Type', extname(url) === '.json' ? 'application/json' : 'text/plain');
          res.end(body);
        } catch {
          next();
        }
      });
    },
    closeBundle() {
      for (const d of dirs) copyDir(d, join('dist', d));
    },
  };
}

export default defineConfig({
  // Overridden to '/<repo>/' for a GitHub Pages project site; '/' suits Cloudflare,
  // Netlify, Vercel and a Pages *user* site. See docs/DEPLOYMENT.md.
  base: process.env.CONFGRAPH_BASE ?? '/',
  plugins: [react(), serveRootDirs(['data'])],
  build: { outDir: 'dist', sourcemap: false },
});
