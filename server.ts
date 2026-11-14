import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/routes';
import { brainVault } from './src/core/memory/brain-vault';
import { userStore } from './src/core/auth/user-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(cors());
  app.use(express.json());

  // Initialize Users & Brain-Vault Memory
  await userStore.init();
  await brainVault.init();
  console.log('🧠 [Brain-Vault] Memory engine & user authentication initialized.');

  // Mount API Router
  app.use('/api', apiRouter);

  // Mount Frontend
  if (!isProd) {
    // Development mode: Vite dev server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ [Vite] Vue 3 development middleware attached.');
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`
================================================================
🚀 Minimi Search Agent is live!
🌐 URL: http://localhost:${PORT}
🧠 Brain-Vault Memory: Multi-View (Episodic + State + Profiles)
🛡️ AgentBridge Governance: Auto-Pilot & Supervised Modes
🔍 Tool: Web Search (Brave / Tavily / Zero-Key Fallback)
================================================================
    `);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
