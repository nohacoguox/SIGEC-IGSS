/**
 * Captura la pantalla de recuperación de contraseña para el recorrido APA.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'Recorrido_SIGEC_IGSS', 'capturas');
const BASE = process.env.SIGEC_BASE_URL || 'http://localhost:3003';

fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.getByText('¿Olvidaste tu contraseña?', { exact: false }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('heading', { name: 'Recuperar contraseña' }).waitFor({ timeout: 10000 });
  const out = path.join(OUT_DIR, '20_recuperar_contrasena.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log(`OK ${out}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
