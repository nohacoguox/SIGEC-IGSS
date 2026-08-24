/**
 * Recaptura solo Análisis de expedientes — Generales.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'Recorrido_SIGEC_IGSS', 'capturas');
const BASE = process.env.SIGEC_BASE_URL || 'http://localhost:3010';
const MANIFEST = path.join(OUT, 'manifest.json');

const ALL_PERMS = [
  'gestionar-usuarios', 'gestionar-roles', 'gestionar-areas', 'gestionar-puestos',
  'gestionar-unidades-medicas', 'gestionar-correlativos', 'listado-siaf', 'crear-siaf',
  'autorizar-siaf', 'revisar-siaf-direccion-departamental', 'actualizar-codigos-productos',
  'estadisticas-tiempos', 'estadisticas-motivos', 'ver-estadisticas', 'ver-estadisticas-unidad',
  'crear-expediente', 'revisar-expediente-direccion-departamental',
];

function fakeJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId: 1, codigoEmpleado: 'demo', roles: ['super administrador'], permissions: ['*'],
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  })).toString('base64url');
  return `${header}.${payload}.demo`;
}

const cierre = [
  { mes: '2026-06', etiqueta: 'jun 2026', activos: 8, aprobados: 5, rechazadosAlCierre: 2, pendientesCorreccion: 1, pendientesRevisionDaf: 1 },
  { mes: '2026-07', etiqueta: 'jul 2026', activos: 10, aprobados: 6, rechazadosAlCierre: 3, pendientesCorreccion: 2, pendientesRevisionDaf: 2 },
  { mes: '2026-08', etiqueta: 'ago 2026', activos: 12, aprobados: 7, rechazadosAlCierre: 3, pendientesCorreccion: 2, pendientesRevisionDaf: 3 },
];
const tiempos = {
  primeraRespuestaHoras: 4.5, correccionHoras: 18.2, respuestaTrasReenvioHoras: 6.1, cicloCompletoHoras: 48.0,
  muestraPrimeraRespuesta: 9, muestraCorreccion: 7, muestraRespuestaTrasReenvio: 5, muestraCicloCompleto: 6,
};
const motivos = [
  { motivo: 'Documentación incompleta', cantidad: 8 },
  { motivo: 'Inconsistencia presupuestaria', cantidad: 5 },
  { motivo: 'Error en correlativo', cantidad: 3 },
];
const ciclos = [
  { etiqueta: 'Sin devolución', cantidad: 4 },
  { etiqueta: '1 devolución', cantidad: 3 },
  { etiqueta: '2 devoluciones', cantidad: 2 },
  { etiqueta: '3 o más', cantidad: 1 },
];
const analitica = {
  dias: 90,
  desde: '2026-05-17T00:00:00.000Z',
  hasta: '2026-08-15T23:59:59.000Z',
  general: {
    resumen: { total: 12, aprobados: 7, rechazadosAlCierre: 3, pendientesCorreccion: 2, pendientesRevisionDaf: 3 },
    cierreMensual: cierre,
  },
  porExpediente: {
    tiempos, ciclos, motivos,
    casos: [{ id: 5, numeroExpediente: 'EXP-2026-001', titulo: 'Adquisición de insumos', resultadoAlCorte: 'pendiente_correccion', devoluciones: 2, correcciones: 1, aprobado: false }],
    trazabilidad: [],
  },
  cierreMensual: cierre,
  motivos, tiempos, ciclos,
  resumen: { total: 12, aprobados: 7, rechazadosAlCierre: 3, pendientesCorreccion: 2, pendientesRevisionDaf: 3 },
};

async function settle(page, ms = 1500) {
  await page.waitForTimeout(ms);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => {
    document.getElementById('webpack-dev-server-client-overlay')?.remove();
    document.querySelector('iframe#webpack-dev-server-client-overlay')?.remove();
  }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-GT' });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  await page.addInitScript(() => {
    setInterval(() => {
      document.getElementById('webpack-dev-server-client-overlay')?.remove();
      document.querySelector('iframe#webpack-dev-server-client-overlay')?.remove();
    }, 400);
  });

  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('/auth/me')) {
      return json({
        id: 1, nombres: 'Usuario', apellidos: 'Demostración', role: 'super administrador',
        roles: [{ name: 'super administrador', permissions: ALL_PERMS.map((name) => ({ name })) }],
        permissions: ALL_PERMS,
      });
    }
    if (url.includes('expedientes-analitica') || url.includes('daf-analitica')) return json(analitica);
    if (url.includes('filtros-analitica')) {
      return json({
        expedientes: [{ id: 5, etiqueta: 'EXP-2026-001' }],
        siafs: [{ id: 10, etiqueta: 'SIAF-2026-000120' }],
        unidades: [{ id: 1, nombre: 'Hospital General' }],
        usuarios: [{ id: 1, nombre: 'Ana López' }],
        canViewUnidad: true, canPickUnidad: true,
      });
    }
    if (route.request().method() === 'GET') return json([]);
    return json({ ok: true });
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, perms }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', 'super administrador');
    localStorage.setItem('userRoles', JSON.stringify(['super administrador']));
    localStorage.setItem('userName', 'Usuario demostración');
    localStorage.setItem('permissions', JSON.stringify(perms));
  }, { token: fakeJwt(), perms: ALL_PERMS });

  await page.goto(`${BASE}/colaborador-dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);

  // Abrir Estadísticas → Análisis de expedientes
  const est = page.locator('.MuiListItemButton-root', { hasText: 'Estadísticas' }).first();
  if (await est.count()) await est.click({ force: true });
  await settle(page, 800);

  const analExp = page.locator('.MuiListItemButton-root', { hasText: 'Análisis de expedientes' }).first();
  if (await analExp.count()) {
    await analExp.click({ force: true });
  } else {
    await page.getByText('Análisis de expedientes', { exact: true }).first().click({ force: true });
  }
  await settle(page, 3500);

  // Asegurar pestaña Generales
  const tabGen = page.getByRole('tab', { name: /Generales/i });
  if (await tabGen.count()) await tabGen.first().click({ force: true });
  await settle(page, 2500);

  // Esperar contenido visible (KPIs o título)
  await page.getByText('Análisis de expedientes').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.getByText(/Expedientes|Aprobados|Cierre mensual/i).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await settle(page, 2000);

  const file = path.join(OUT, '19_analisis_expedientes_generales.png');
  await page.screenshot({ path: file, fullPage: true });
  const size = fs.statSync(file).size;
  console.log(`OK ${file} (${size} bytes)`);

  if (size < 20000) {
    // Fallback: screenshot del área principal si sigue pequeño
    await page.screenshot({ path: file, fullPage: false });
    console.log(`Retry viewport size=${fs.statSync(file).size}`);
  }

  // Actualizar manifest si existe
  if (fs.existsSync(MANIFEST)) {
    const items = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const idx = items.findIndex((i) => String(i.id) === '19' || (i.file || '').includes('19_analisis_expedientes'));
    const entry = {
      id: '19',
      file,
      titulo: 'Análisis de expedientes — Generales',
      seccion: 'Estadísticas',
      explicacion:
        'Analítica de expedientes con la misma lógica de cierre mensual: aprobados, rechazados al corte, pendientes de corregir y carga en revisión DAF.',
    };
    if (idx >= 0) items[idx] = entry;
    else items.push(entry);
    fs.writeFileSync(MANIFEST, JSON.stringify(items, null, 2), 'utf8');
    console.log('Manifest actualizado');
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
