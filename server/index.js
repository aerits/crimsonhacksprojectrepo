import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = await loadConfig();
config.simulator = process.argv.includes('--simulate');
const host = config.host || '127.0.0.1';
const port = Number(config.port || 3000);
createApp({ config }).listen(port, host, () => console.log(`Mommy Maps is ready at http://${host}:${port}`));
