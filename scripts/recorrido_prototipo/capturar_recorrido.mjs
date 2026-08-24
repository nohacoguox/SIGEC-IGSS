/**
 * Captura el recorrido visual de SIGEC-IGSS para documentación de prototipo.
 * Usa una sesión de demostración en localStorage (validación client-side del JWT)
 * para recorrer pantallas privadas sin exponer credenciales.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'Recorrido_SIGEC_IGSS', 'capturas');
const BASE = process.env.SIGEC_BASE_URL || 'http://localhost:3010';
const VIEWPORT = { width: 1440, height: 900 };

fs.mkdirSync(OUT_DIR, { recursive: true });

function fakeJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId: 1,
    codigoEmpleado: 'demo',
    roles: ['super administrador'],
    permissions: ['*'],
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  })).toString('base64url');
  return `${header}.${payload}.demo`;
}

const ALL_PERMS = [
  'gestionar-usuarios', 'gestionar-roles', 'gestionar-areas', 'gestionar-puestos',
  'gestionar-unidades-medicas', 'gestionar-correlativos', 'listado-siaf', 'crear-siaf',
  'autorizar-siaf', 'revisar-siaf-direccion-departamental', 'actualizar-codigos-productos',
  'estadisticas-tiempos', 'estadisticas-motivos', 'ver-estadisticas', 'ver-estadisticas-unidad',
  'crear-expediente', 'revisar-expediente-direccion-departamental',
];

async function settle(page, ms = 1200) {
  await page.waitForTimeout(ms);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => {
    document.getElementById('webpack-dev-server-client-overlay')?.remove();
    document.querySelector('iframe#webpack-dev-server-client-overlay')?.remove();
    document.querySelectorAll('iframe[src="about:blank"]').forEach((el) => {
      if (el.id?.includes('webpack') || el.id?.includes('overlay')) el.remove();
    });
    document.querySelectorAll('.MuiAlert-root .MuiIconButton-root, .MuiSnackbar-root .MuiIconButton-root').forEach((btn) => {
      try { btn.click(); } catch {}
    });
  }).catch(() => {});
}

async function shot(page, name, fullPage = true) {
  await settle(page, 400);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`OK ${name}`);
  return file;
}

async function clickText(page, text, exact = false) {
  await settle(page, 200);
  const loc = page.getByText(text, { exact });
  if (await loc.count()) {
    await loc.first().click({ timeout: 5000, force: true });
    return true;
  }
  return false;
}

async function clickSidebar(page, label) {
  await settle(page, 200);
  const item = page.locator('.MuiListItemButton-root', { hasText: label }).first();
  if (await item.count()) {
    try {
      await item.click({ timeout: 8000, force: true });
      await settle(page);
      return true;
    } catch (err) {
      console.warn(`clickSidebar(${label}): ${err.message}`);
      return false;
    }
  }
  return false;
}

function loadSession() {
  const sessionPath = path.join(__dirname, '.demo-session.json');
  if (!fs.existsSync(sessionPath)) return null;
  return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
}

async function ensureDemoSession(page) {
  const session = loadSession();
  const perms = session?.permissions?.length ? session.permissions : ALL_PERMS;
  const token = session?.token || fakeJwt();
  const userName = session?.userName || 'Usuario demostración';
  const role = session?.role || 'super administrador';
  const roles = session?.roles?.length ? session.roles : [role];

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, perms, userName, role, roles }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', role || '');
    localStorage.setItem('userRoles', JSON.stringify(roles || []));
    localStorage.setItem('userName', userName);
    localStorage.setItem('permissions', JSON.stringify(perms));
  }, { token, perms, userName, role, roles });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'es-GT',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.addInitScript(() => {
    const killOverlay = () => {
      document.getElementById('webpack-dev-server-client-overlay')?.remove();
      document.querySelector('iframe#webpack-dev-server-client-overlay')?.remove();
    };
    setInterval(killOverlay, 500);
    window.addEventListener('DOMContentLoaded', killOverlay);
  });

  // Respuestas de demostración para que las pantallas rendericen datos sin autenticación real.
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (url.includes('/auth/login') && method === 'POST') {
      return json({ message: 'ok', token: fakeJwt(), nombres: 'Usuario', apellidos: 'Demostración', role: 'super administrador', roles: ['super administrador'], permissions: ALL_PERMS, isTempPassword: false });
    }
    if (url.includes('/auth/me')) {
      return json({
        id: 1,
        nombres: 'Usuario',
        apellidos: 'Demostración',
        role: 'super administrador',
        roles: [{ name: 'super administrador', permissions: ALL_PERMS.map((name) => ({ name })) }],
        permissions: ALL_PERMS,
      });
    }
    if (url.includes('/dashboard/stats')) {
      return json({ totalUsers: 24, totalRoles: 12, totalReports: 3 });
    }
    if (url.includes('/users') && method === 'GET') {
      return json([{ id: 1, nombres: 'Ana', apellidos: 'López', codigoEmpleado: 'E001', correoInstitucional: 'ana.lopez@igss.gt', roles: [{ name: 'crear-siaf' }] }, { id: 2, nombres: 'Carlos', apellidos: 'Méndez', codigoEmpleado: 'E002', correoInstitucional: 'carlos.mendez@igss.gt', roles: [{ name: 'super administrador' }] }]);
    }
    if (url.includes('/roles') && method === 'GET') {
      return json([{ id: 1, name: 'super administrador', permissions: ALL_PERMS.map((p, i) => ({ id: i + 1, name: p })) }, { id: 2, name: 'crear-siaf', permissions: [{ id: 1, name: 'crear-siaf' }, { id: 2, name: 'listado-siaf' }] }]);
    }
    if (url.includes('/permissions')) {
      return json(ALL_PERMS.map((name, i) => ({ id: i + 1, name })));
    }
    if (url.includes('/areas') && method === 'GET') {
      return json([{ id: 1, nombre: 'Administración', descripcion: 'Área administrativa' }, { id: 2, nombre: 'Finanzas', descripcion: 'Área financiera' }]);
    }
    if (url.includes('/puestos') && method === 'GET') {
      return json([{ id: 1, nombre: 'Analista', descripcion: 'Analista DAF' }, { id: 2, nombre: 'Director', descripcion: 'Director de unidad' }]);
    }
    if (url.includes('/unidades-medicas') || url.includes('/unidad-medica')) {
      return json([{ id: 1, nombre: 'Hospital General', codigo: 'HG-01' }, { id: 2, nombre: 'Clínica Periférica', codigo: 'CP-02' }]);
    }
    if (url.includes('/correlativos')) {
      return json({ config: { prefijo: 'SIAF', anio: 2026, siguiente: 125 }, reservas: [] });
    }
    if (url.includes('/siaf') && method === 'GET' && !url.includes('analitica') && !url.includes('estadisticas')) {
      return json([{ id: 10, correlativo: 'SIAF-2026-000120', estado: 'pendiente', createdAt: '2026-08-01T10:00:00.000Z' }, { id: 11, correlativo: 'SIAF-2026-000121', estado: 'aprobado', createdAt: '2026-08-05T12:00:00.000Z' }]);
    }
    if (url.includes('/expedientes') && method === 'GET') {
      return json([{ id: 5, numeroExpediente: 'EXP-2026-001', titulo: 'Adquisición de insumos', estado: 'en_revision', createdAt: '2026-07-20T09:00:00.000Z' }, { id: 6, numeroExpediente: 'EXP-2026-002', titulo: 'Servicios de mantenimiento', estado: 'aprobado', createdAt: '2026-08-02T11:00:00.000Z' }]);
    }
    if (url.includes('expedientes-analitica') || url.includes('daf-analitica')) {
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
      return json({
        dias: 90,
        desde: '2026-05-17T00:00:00.000Z',
        hasta: '2026-08-15T23:59:59.000Z',
        general: {
          resumen: { total: 12, aprobados: 7, rechazadosAlCierre: 3, pendientesCorreccion: 2, pendientesRevisionDaf: 3 },
          cierreMensual: cierre,
        },
        porExpediente: { tiempos, ciclos, motivos, casos: [{ id: 5, numeroExpediente: 'EXP-2026-001', titulo: 'Adquisición de insumos', resultadoAlCorte: 'pendiente_correccion', devoluciones: 2, correcciones: 1, aprobado: false }], trazabilidad: [] },
        porSiaf: { tiempos, ciclos, motivos, casos: [{ id: 10, correlativo: 'SIAF-2026-000120', estado: 'rechazado', resultadoAlCorte: 'pendiente_correccion', devoluciones: 1, correcciones: 0, aprobado: false }], trazabilidad: [] },
        cierreMensual: cierre,
        motivos,
        tiempos,
        ciclos,
        resumen: { total: 12, aprobados: 7, rechazadosAlCierre: 3, pendientesCorreccion: 2, pendientesRevisionDaf: 3 },
      });
    }
    if (url.includes('filtros-analitica')) {
      return json({
        expedientes: [{ id: 5, etiqueta: 'EXP-2026-001' }],
        siafs: [{ id: 10, etiqueta: 'SIAF-2026-000120' }],
        unidades: [{ id: 1, nombre: 'Hospital General' }],
        usuarios: [{ id: 1, nombre: 'Ana López' }],
        canViewUnidad: true,
        canPickUnidad: true,
      });
    }
    if (url.includes('/producto') || url.includes('/catalogo') || url.includes('/codigos')) {
      return json({ ok: true, total: 1200, actualizados: 35, message: 'Catálogo listo para actualización' });
    }

    // Resto: respuesta vacía exitosa para no romper UI
    if (method === 'GET') return json([]);
    return json({ ok: true });
  });

  // Silenciar errores de red esperables con sesión demo (API 401).
  page.on('pageerror', () => {});
  page.on('console', () => {});

  const manifest = [];
  const safe = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn(`WARN ${label}: ${err.message}`);
    }
  };

  // 01 Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(async () => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  });
  await settle(page, 1500);
  manifest.push({
    id: '01',
    file: await shot(page, '01_inicio_sesion'),
    titulo: 'Inicio de sesión',
    seccion: 'Acceso al sistema',
    explicacion:
      'Pantalla pública de autenticación. El usuario ingresa su código de empleado y contraseña institucional para obtener un token de sesión y acceder a los paneles autorizados según roles y permisos.',
  });

  // Sesión demo
  await ensureDemoSession(page);
  await page.goto(`${BASE}/admin-dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(page, 3500); // espera refresh de /auth/me y menú Gestiones

  // 02 Admin dashboard
  manifest.push({
    id: '02',
    file: await shot(page, '02_panel_administracion'),
    titulo: 'Panel de administración',
    seccion: 'Administración',
    explicacion:
      'Vista inicial del panel administrativo. Resume indicadores institucionales (usuarios, roles e informes) y ofrece navegación lateral hacia las gestiones maestras del sistema.',
  });

  const adminViews = [
    ['Usuarios', '03_gestion_usuarios', 'Gestión de usuarios', 'Administración del padrón de usuarios: alta, edición, asignación de puestos/unidad y control de acceso operativo.'],
    ['Roles', '04_gestion_roles', 'Gestión de roles', 'Configuración de roles y permisos por pantalla. Define qué módulos puede utilizar cada perfil institucional.'],
    ['Áreas', '05_gestion_areas', 'Gestión de áreas', 'Catálogo de áreas organizacionales utilizadas para clasificar la estructura administrativa del IGSS.'],
    ['Puestos', '06_gestion_puestos', 'Gestión de puestos', 'Administración de puestos de trabajo vinculados a usuarios y a la estructura funcional de la institución.'],
    ['Unidades Médicas', '07_gestion_unidades_medicas', 'Gestión de unidades médicas', 'Mantenimiento del catálogo de unidades médicas, base para la trazabilidad organizacional de las operaciones.'],
    ['Correlativos', '08_gestion_correlativos', 'Gestión de correlativos', 'Configuración de la secuencia de correlativos SIAF, reservas activas y control de numeración institucional.'],
  ];

  // Expand Gestiones if collapsed
  await clickSidebar(page, 'Gestiones');
  await settle(page, 1000);
  // Si el menú aún no aparece, forzar expansión por texto
  await page.locator('text=Gestiones').first().click({ force: true }).catch(() => {});
  await settle(page, 800);

  for (const [label, slug, titulo, explicacion] of adminViews) {
    await safe(slug, async () => {
      await clickSidebar(page, 'Gestiones');
      await settle(page, 500);
      const ok = await clickSidebar(page, label);
      if (!ok) {
        await page.getByText(label, { exact: true }).first().click({ force: true }).catch(() => {});
      }
      await settle(page, 2200);
      manifest.push({
        id: slug.split('_')[0],
        file: await shot(page, slug),
        titulo,
        seccion: 'Administración',
        explicacion,
      });
    });
  }

  // 09 Colaborador dashboard
  await page.goto(`${BASE}/colaborador-dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  manifest.push({
    id: '09',
    file: await shot(page, '09_panel_colaborador'),
    titulo: 'Panel de control del colaborador',
    seccion: 'Operación',
    explicacion:
      'Punto de entrada operativo. Presenta accesos rápidos a Libro SIAF, expedientes, bandeja DAF, actualización de catálogos y analítica, según los permisos del usuario autenticado.',
  });

  // 10 Listado SIAF
  await page.goto(`${BASE}/siaf-book`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  manifest.push({
    id: '10',
    file: await shot(page, '10_listado_siaf'),
    titulo: 'Listado de solicitudes SIAF',
    seccion: 'Libro SIAF',
    explicacion:
      'Consulta del inventario de solicitudes SIAF. Permite filtrar, revisar estados, abrir detalle y continuar el ciclo de creación, corrección o autorización.',
  });

  // 11 Crear SIAF
  await page.goto(`${BASE}/siaf-book/crear`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  manifest.push({
    id: '11',
    file: await shot(page, '11_crear_siaf'),
    titulo: 'Creación de solicitud SIAF',
    seccion: 'Libro SIAF',
    explicacion:
      'Formulario de captura de una nueva solicitud SIAF. Integra datos del solicitante, ítems, validaciones y generación documental alineada al formato institucional.',
  });

  // 12 Expedientes
  await page.goto(`${BASE}/expedientes`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  manifest.push({
    id: '12',
    file: await shot(page, '12_expedientes_compras'),
    titulo: 'Expedientes de compras',
    seccion: 'Expedientes',
    explicacion:
      'Módulo de gestión de expedientes de compras: creación, adjuntos, versiones documentales, bitácora y seguimiento del ciclo de revisión ante DAF.',
  });

  // 13 Actualizar códigos
  await page.goto(`${BASE}/actualizar-codigos-productos`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  manifest.push({
    id: '13',
    file: await shot(page, '13_actualizar_codigos_productos'),
    titulo: 'Actualización de códigos y productos',
    seccion: 'Catálogos',
    explicacion:
      'Herramienta de mantenimiento del catálogo de productos a partir de archivos Excel oficiales, asegurando consistencia de códigos y descripciones en SIAF.',
  });

  // Volver a colaborador para vistas internas
  await page.goto(`${BASE}/colaborador-dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1800);

  // Expand bandeja / estadísticas
  await clickSidebar(page, 'Bandeja de Revisiones DAF');
  await settle(page, 600);
  const clickedBandeja = await clickSidebar(page, 'SIAF') || await clickText(page, 'Bandeja de Revisiones DAF');
  if (!clickedBandeja) {
    // Intentar tarjeta o ítem genérico
    await page.locator('text=Bandeja').first().click({ timeout: 3000 }).catch(() => {});
  }
  await settle(page, 2000);
  manifest.push({
    id: '14',
    file: await shot(page, '14_bandeja_revisiones_daf'),
    titulo: 'Bandeja de revisiones DAF',
    seccion: 'Dirección Administrativa Financiera',
    explicacion:
      'Bandeja unificada para analistas DAF. Concentra solicitudes SIAF y expedientes pendientes de revisión, aprobación o devolución con observación.',
  });

  // Tabs SIAF / Expedientes en bandeja si existen
  const tabExp = page.getByRole('tab', { name: /Expedientes/i });
  if (await tabExp.count()) {
    await tabExp.first().click();
    await settle(page, 1500);
    manifest.push({
      id: '15',
      file: await shot(page, '15_bandeja_daf_expedientes'),
      titulo: 'Bandeja DAF — Expedientes',
      seccion: 'Dirección Administrativa Financiera',
      explicacion:
        'Vista específica de expedientes en revisión DAF. Facilita la evaluación documental, el dictamen y el registro de motivos de rechazo cuando corresponde.',
    });
  }

  await clickSidebar(page, 'Estadísticas');
  await settle(page, 700);
  let okSiaf = await clickSidebar(page, 'Análisis SIAF');
  if (!okSiaf) {
    await page.getByText('Análisis SIAF', { exact: true }).first().click({ force: true }).catch(() => {});
  }
  await settle(page, 2800);
  manifest.push({
    id: '16',
    file: await shot(page, '16_analisis_siaf_generales'),
    titulo: 'Análisis SIAF — Generales',
    seccion: 'Estadísticas',
    explicacion:
      'Tablero analítico de SIAF con cierre mensual, aprobados, rechazados al cierre y pendientes de corrección. Soporta la evidencia operativa del prototipo funcional.',
  });

  const tabPorSiaf = page.getByRole('tab', { name: /Por SIAF/i });
  if (await tabPorSiaf.count()) {
    await tabPorSiaf.first().click({ force: true });
    await settle(page, 2000);
    manifest.push({
      id: '17',
      file: await shot(page, '17_analisis_siaf_por_caso'),
      titulo: 'Análisis SIAF — Por SIAF',
      seccion: 'Estadísticas',
      explicacion:
        'Desglose por caso: tiempos de respuesta DAF, correcciones, trazabilidad de devoluciones y distribución de ciclos de ida y vuelta.',
    });
  }

  const tabMotivosSiaf = page.getByRole('tab', { name: /Motivos de rechazo/i });
  if (await tabMotivosSiaf.count()) {
    await tabMotivosSiaf.first().click({ force: true });
    await settle(page, 2000);
    manifest.push({
      id: '18',
      file: await shot(page, '18_analisis_siaf_motivos'),
      titulo: 'Análisis SIAF — Motivos de rechazo',
      seccion: 'Estadísticas',
      explicacion:
        'Clasificación de motivos de rechazo registrados en el período. Permite identificar causas recurrentes y priorizar mejoras de calidad documental.',
    });
  }

  let okExp = await clickSidebar(page, 'Análisis de expedientes');
  if (!okExp) {
    await page.getByText('Análisis de expedientes', { exact: true }).first().click({ force: true }).catch(() => {});
  }
  await settle(page, 2800);
  manifest.push({
    id: '19',
    file: await shot(page, '19_analisis_expedientes_generales'),
    titulo: 'Análisis de expedientes — Generales',
    seccion: 'Estadísticas',
    explicacion:
      'Analítica de expedientes con la misma lógica de cierre mensual: aprobados, rechazados al corte, pendientes de corregir y carga en revisión DAF.',
  });

  const tabPorExp = page.getByRole('tab', { name: /Por expediente/i });
  if (await tabPorExp.count()) {
    await tabPorExp.first().click({ force: true });
    await settle(page, 2000);
    manifest.push({
      id: '20',
      file: await shot(page, '20_analisis_expedientes_por_caso'),
      titulo: 'Análisis de expedientes — Por expediente',
      seccion: 'Estadísticas',
      explicacion:
        'Vista de trazabilidad y tiempos por expediente, incluyendo devoluciones, correcciones y distribución de ciclos de revisión.',
    });
  }

  const tabMotivosExp = page.getByRole('tab', { name: /Motivos de rechazo/i });
  if (await tabMotivosExp.count()) {
    await tabMotivosExp.first().click({ force: true });
    await settle(page, 2000);
    manifest.push({
      id: '21',
      file: await shot(page, '21_analisis_expedientes_motivos'),
      titulo: 'Análisis de expedientes — Motivos de rechazo',
      seccion: 'Estadísticas',
      explicacion:
        'Frecuencia y participación de motivos de rechazo en expedientes, como evidencia cuantitativa para la mejora continua del proceso.',
    });
  }

  // Cambio de contraseña (pública)
  await page.goto(`${BASE}/change-password`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  manifest.push({
    id: '22',
    file: await shot(page, '22_cambio_contrasena'),
    titulo: 'Cambio de contraseña',
    seccion: 'Seguridad',
    explicacion:
      'Flujo de seguridad para actualizar la credencial de acceso, particularmente cuando el sistema exige cambio por contraseña temporal.',
  });

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Manifest: ${manifestPath} (${manifest.length} capturas)`);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
