import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

async function readJson(filename, required) {
  try {
    return JSON.parse(await readFile(resolve(ROOT, filename), 'utf8'));
  } catch (error) {
    if (!required && error.code === 'ENOENT') return {};
    throw new Error(`Could not load ${filename}: ${error.message}`);
  }
}

export async function loadConfig() {
  const defaults = await readJson('config.json', true);
  const local = await readJson('config.local.json', false);
  return {
    ...defaults,
    ...local,
    fish: {
      ...defaults.fish,
      ...local.fish,
      voices: { ...defaults.fish?.voices, ...local.fish?.voices },
    },
  };
}
