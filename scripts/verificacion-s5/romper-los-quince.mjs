// scripts/verificacion-s5/romper-los-quince.mjs — SCRUM-846b · carril de VERIFICACIÓN
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNA SIEMBRA QUE NO HAS VISTO FALLAR NO CUENTA. Esto la hace fallar, y lo deja repetible.
//
// Para cada uno de los quince instrumentos que no tenían caso conocido se aplican DOS roturas
// sobre su propio fuente —«dice que sí a todo» y «dice que no a todo»—, se corre SÓLO su siembra y
// se exige que caiga. Después se restaura el fichero y se comprueba que ha vuelto BYTE A BYTE: una
// rotura que se queda puesta es peor que no haber probado.
//
// ── EL SUELO, Y VA DELANTE ───────────────────────────────────────────────────────────────────
// Antes de romper nada, cada siembra se corre sin tocar y tiene que estar VERDE con al menos un
// test ejecutado. Un rojo encima de algo que ya estaba rojo —o de un patrón que no casa con ningún
// test— no prueba nada.
//
// ── ANCLA CADUCADA ≠ SIEMBRA SANA ────────────────────────────────────────────────────────────
// Si el texto que se rompe ya no está, o está más veces de las declaradas, NO se salta: cuenta
// como fallo con su nombre. «No pude romperlo» y «lo rompí y no cayó» son sucesos distintos, y los
// dos son rojo.
//
// USO: node scripts/verificacion-s5/romper-los-quince.mjs
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ejecutadoDirectamente } from '../_puerta-de-entrada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NL = String.fromCharCode(10);
const SIEMBRAS = 'tests/scrum846b-siembras-a-los-quince.test.mjs';
const T245 = 'tests/scrum245-llamador-declara-merchant.test.mjs';
const T746 = 'tests/scrum746-barrera-y-punto-de-conexion.test.mjs';

/**
 * Las roturas, en el orden de lo que gobierna cada instrumento. `veces` es cuántas veces aparece
 * el texto en el fichero (1 si no se dice) y `cual` cuál de ellas se rompe.
 */
export const ROTURAS = [
  // ── 1 · tenencia
  { instrumento: 'scrum245 · censarLlamadas', fichero: T245, test: T245, patron: 'siembra:245',
    sentido: 'da por declarado todo envío', buscar: "if (k === 'merchantId' || k === 'sinMerchant') declara = true;", cambiar: 'if (true) declara = true;' },
  { instrumento: 'scrum245 · censarLlamadas', fichero: T245, test: T245, patron: 'siembra:245',
    sentido: 'no da por declarado ninguno', buscar: "if (k === 'merchantId' || k === 'sinMerchant') declara = true;", cambiar: 'if (false) declara = true;' },
  // ── 2 · camino fiscal
  { instrumento: '_censo-copy-vs-flag', fichero: 'tests/_censo-copy-vs-flag.mjs', test: SIEMBRAS, patron: 'siembra:copy-vs-flag',
    sentido: 'todo rótulo depende del flag', buscar: 'dependeDelFlag: razones.eligen.length > 0,', cambiar: 'dependeDelFlag: true,' },
  { instrumento: '_censo-copy-vs-flag', fichero: 'tests/_censo-copy-vs-flag.mjs', test: SIEMBRAS, patron: 'siembra:copy-vs-flag',
    sentido: 'ningún rótulo depende del flag', buscar: 'dependeDelFlag: razones.eligen.length > 0,', cambiar: 'dependeDelFlag: false,' },
  // ── 3 · fiscal / dinero
  { instrumento: '_censo-estrechamientos-linea', fichero: 'tests/_censo-estrechamientos-linea.mjs', test: SIEMBRAS, patron: 'siembra:estrechamientos',
    sentido: 'toda línea con concept estrecha', buscar: 'if (!spread && claves.length === FIRMA_LINEA_FACTURA.length', cambiar: 'if (true || claves.length === FIRMA_LINEA_FACTURA.length' },
  { instrumento: '_censo-estrechamientos-linea', fichero: 'tests/_censo-estrechamientos-linea.mjs', test: SIEMBRAS, patron: 'siembra:estrechamientos',
    sentido: 'ninguna línea estrecha', buscar: 'estrechamientos.push({ ruta, linea: nLinea(n), claves });', cambiar: 'void 0;' },
  // ── 4 · barrera de producción
  { instrumento: 'scrum746 · censoDeConexiones', fichero: T746, test: T746, patron: 'siembra:746',
    sentido: 'todo cliente comprueba el destino', buscar: 'guarda: /exigirDestinoCorrecto|', cambiar: 'guarda: true || /exigirDestinoCorrecto|' },
  { instrumento: 'scrum746 · censoDeConexiones', fichero: T746, test: T746, patron: 'siembra:746',
    sentido: 'ningún cliente está acotado', buscar: 'acotado: /DATABASE_URL_(STAGING|DEV|TESTS)/.test(src),', cambiar: 'acotado: false,' },
  // ── 5 · secretos
  { instrumento: '_censo-new-url', fichero: 'tests/_censo-new-url.mjs', test: SIEMBRAS, patron: 'siembra:new-url',
    sentido: 'todo catch es ciego', buscar: 'const ciego = !p.catchClause.variableDeclaration;', cambiar: 'const ciego = true;' },
  { instrumento: '_censo-new-url', fichero: 'tests/_censo-new-url.mjs', test: SIEMBRAS, patron: 'siembra:new-url',
    sentido: 'nada es seguro', buscar: 'seguro: ciego };', cambiar: 'seguro: false };' },
  // ── 6 · documento con importes
  { instrumento: '_puertas-del-presupuesto', fichero: 'tests/_puertas-del-presupuesto.mjs', test: SIEMBRAS, patron: 'siembra:puertas',
    sentido: 'una puerta literal no lleva nada', buscar: 'props: new Set(a.properties.map(nombreDeClave).filter(Boolean)),', cambiar: 'props: new Set(),' },
  { instrumento: '_puertas-del-presupuesto', fichero: 'tests/_puertas-del-presupuesto.mjs', test: SIEMBRAS, patron: 'siembra:puertas',
    sentido: 'una puerta literal lleva también lo del constructor', buscar: 'props: new Set(a.properties.map(nombreDeClave).filter(Boolean)),',
    cambiar: 'props: new Set([...a.properties.map(nombreDeClave).filter(Boolean), ...delConstructor]),' },
  // ── 7 · veredicto de los guards
  { instrumento: 'censo-guards-gateados', fichero: 'scripts/censo-guards-gateados.mjs', test: SIEMBRAS, patron: 'siembra:gateados',
    sentido: 'todo test es saltado', buscar: "return ev.data?.skip ? 'saltado' : 'real';", cambiar: "return 'saltado';" },
  { instrumento: 'censo-guards-gateados', fichero: 'scripts/censo-guards-gateados.mjs', test: SIEMBRAS, patron: 'siembra:gateados',
    sentido: 'ningún test es saltado', buscar: "return ev.data?.skip ? 'saltado' : 'real';", cambiar: "return 'real';" },
  // ── 8 · privacidad
  { instrumento: '_censo-almacenamiento-publico', fichero: 'tests/_censo-almacenamiento-publico.mjs', test: SIEMBRAS, patron: 'siembra:almacenamiento',
    sentido: 'no ve ningún acceso al almacenamiento', buscar: 'if (almacen && OPERACIONES.includes(op)) {', cambiar: 'if (false) {' },
  { instrumento: '_censo-almacenamiento-publico', fichero: 'tests/_censo-almacenamiento-publico.mjs', test: SIEMBRAS, patron: 'siembra:almacenamiento',
    sentido: 'lo del panel pasa por la landing', buscar: 'enElPanel: rel.startsWith(PANEL),', cambiar: 'enElPanel: false,', veces: 2, cual: 0 },
  { instrumento: '_censo-almacenamiento-publico', fichero: 'tests/_censo-almacenamiento-publico.mjs', test: SIEMBRAS, patron: 'siembra:almacenamiento',
    sentido: 'cuenta los enlaces del panel', buscar: 'if (rel.startsWith(PANEL)) continue;', cambiar: 'if (false) continue;' },
  // ── 9 · promesas públicas
  { instrumento: '_texto-fuera-del-censo', fichero: 'scripts/_texto-fuera-del-censo.mjs', test: SIEMBRAS, patron: 'siembra:texto-fuera',
    sentido: 'toda celda es de YaQu', buscar: '/cmp-yaqu/.test(c[1])', cambiar: 'true' },
  { instrumento: '_texto-fuera-del-censo', fichero: 'scripts/_texto-fuera-del-censo.mjs', test: SIEMBRAS, patron: 'siembra:texto-fuera',
    sentido: 'no detecta ninguna capacidad', buscar: 'const salta = (t) => MARCAS_CAPACIDAD.some((re) => re.test(t));', cambiar: 'const salta = () => false;' },
  // ── 10 · corrección
  { instrumento: '_censo-body-apirequest', fichero: 'tests/_censo-body-apirequest.mjs', test: SIEMBRAS, patron: 'siembra:body',
    sentido: 'todo body es objeto', buscar: 'let forma = FORMAS.OTRA;', cambiar: 'let forma = FORMAS.OBJETO;' },
  { instrumento: '_censo-body-apirequest', fichero: 'tests/_censo-body-apirequest.mjs', test: SIEMBRAS, patron: 'siembra:body',
    sentido: 'ningún body es objeto', buscar: 'if (ts.isObjectLiteralExpression(v)) forma = FORMAS.OBJETO;', cambiar: 'if (false) forma = FORMAS.OBJETO;' },
  // ── 11 · resiliencia
  { instrumento: '_censo-peticiones-panel', fichero: 'tests/_censo-peticiones-panel.mjs', test: SIEMBRAS, patron: 'siembra:peticiones',
    sentido: 'no ve ningún fetch a pelo', buscar: 'fetchCrudo.push({ fichero: rel, linea: linea(n) });', cambiar: 'void 0;' },
  { instrumento: '_censo-peticiones-panel', fichero: 'tests/_censo-peticiones-panel.mjs', test: SIEMBRAS, patron: 'siembra:peticiones',
    sentido: 'acusa también al camino común', buscar: "} else if (fn === 'fetch' && nombre !== CAMINO_COMUN) {", cambiar: "} else if (fn === 'fetch') {" },
  // ── 12 · UI
  { instrumento: '_inventario-detalle-trabajo', fichero: 'tests/_inventario-detalle-trabajo.mjs', test: SIEMBRAS, patron: 'siembra:inventario',
    sentido: 'todo nodo es una acción', buscar: ".filter((n) => INTERACTIVOS.has(String(n.tagName || '').toUpperCase()))", cambiar: '.filter(() => true)' },
  { instrumento: '_inventario-detalle-trabajo', fichero: 'tests/_inventario-detalle-trabajo.mjs', test: SIEMBRAS, patron: 'siembra:inventario',
    sentido: 'ningún nodo es una acción', buscar: ".filter((n) => INTERACTIVOS.has(String(n.tagName || '').toUpperCase()))", cambiar: '.filter(() => false)' },
  // ── 13 · UI
  { instrumento: '_censo-superficies-configuracion', fichero: 'tests/_censo-superficies-configuracion.mjs', test: SIEMBRAS, patron: 'siembra:superficies',
    sentido: 'ningún bloque tiene título', buscar: 'if (!titulo) return;', cambiar: 'if (true) return;' },
  { instrumento: '_censo-superficies-configuracion', fichero: 'tests/_censo-superficies-configuracion.mjs', test: SIEMBRAS, patron: 'siembra:superficies',
    sentido: 'cualquier primer parámetro es un contenedor', buscar: 'if (!/^container$/i.test(primerParam)) return;', cambiar: 'if (false) return;' },
  // ── 14 · UI
  { instrumento: '_censo-modal-footer', fichero: 'tests/_censo-modal-footer.mjs', test: SIEMBRAS, patron: 'siembra:modal-footer',
    sentido: 'un pie no tiene botones', buscar: 'interior: html.slice(desde, fin),', cambiar: "interior: ''," },
  { instrumento: '_censo-modal-footer', fichero: 'tests/_censo-modal-footer.mjs', test: SIEMBRAS, patron: 'siembra:modal-footer',
    sentido: 'todo div es un pie', buscar: 'i.test(m[1])) continue;', cambiar: 'i.test(m[1])) {}' },
  // ── 15 · UI, la última
  { instrumento: '_censo-clases-de-boton', fichero: 'tests/_censo-clases-de-boton.mjs', test: SIEMBRAS, patron: 'siembra:botones',
    sentido: 'ningún sitio lleva la base', buscar: "llevaBase: c.clases.includes('btn'),", cambiar: 'llevaBase: false,' },
  { instrumento: '_censo-clases-de-boton', fichero: 'tests/_censo-clases-de-boton.mjs', test: SIEMBRAS, patron: 'siembra:botones',
    sentido: 'todo sitio lleva la base', buscar: "llevaBase: c.clases.includes('btn'),", cambiar: 'llevaBase: true,' },
];

/** Lee el resumen TAP de node:test. Sin resumen, -1: no confundir «no hubo tests» con «cero». */
function resumen(salida, clave) {
  const linea = salida.split(NL).find((l) => l.startsWith(`# ${clave} `) || l.startsWith(`ℹ ${clave} `));
  return linea ? Number(linea.trim().split(' ').pop()) : -1;
}

function correr(r) {
  const res = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-name-pattern', r.patron, r.test],
    { cwd: RAIZ, encoding: 'utf8' });
  const salida = `${res.stdout || ''}${res.stderr || ''}`;
  return { status: res.status, pasan: resumen(salida, 'pass'), fallan: resumen(salida, 'fail') };
}

function romperYCorrer(r) {
  const abs = path.join(RAIZ, r.fichero);
  const original = fs.readFileSync(abs);
  const partes = original.toString('utf8').split(r.buscar);
  const declaradas = r.veces ?? 1;
  if (partes.length - 1 !== declaradas) {
    return { estado: 'ANCLA', detalle: `el texto a romper aparece ${partes.length - 1} veces y se declararon ${declaradas}` };
  }
  const cual = r.cual ?? 0;
  const roto = partes.slice(0, cual + 1).join(r.buscar) + r.cambiar + partes.slice(cual + 1).join(r.buscar);
  try {
    fs.writeFileSync(abs, roto);
    const c = correr(r);
    return { estado: c.status !== 0 && c.fallan > 0 ? 'CAE' : 'NO CAE', ...c };
  } finally {
    fs.writeFileSync(abs, original);
    if (!fs.readFileSync(abs).equals(original)) {
      console.error(`⛔ ${r.fichero} NO HA VUELTO BYTE A BYTE. Para aquí y restáuralo con git antes de nada.`);
      process.exit(3);
    }
  }
}

function principal() {
  const porPatron = [...new Map(ROTURAS.map((r) => [r.patron, r])).values()];
  console.log(`SUELO · cada siembra, sin romper nada, tiene que estar VERDE (${porPatron.length}):`);
  let suelo = true;
  for (const r of porPatron) {
    const c = correr(r);
    const ok = c.status === 0 && c.pasan >= 1 && c.fallan === 0;
    if (!ok) suelo = false;
    console.log(`  ${ok ? '✅' : '🔴'} ${r.patron.padEnd(26)} pasan ${c.pasan} · fallan ${c.fallan}`);
  }
  if (!suelo) {
    console.log('🔴 Hay siembras que no están verdes sin romper nada: un rojo encima no probaría nada.');
    process.exitCode = 2;
    return;
  }

  console.log('');
  console.log(`ROTURAS (${ROTURAS.length}) · cada una tiene que TUMBAR su siembra:`);
  const malas = [];
  for (const r of ROTURAS) {
    const res = romperYCorrer(r);
    const ok = res.estado === 'CAE';
    if (!ok) malas.push(`${r.instrumento} · ${r.sentido} → ${res.estado}${res.detalle ? `: ${res.detalle}` : ''}`);
    console.log(`  ${ok ? '✅ cae    ' : `🔴 ${res.estado.padEnd(7)}`} ${r.instrumento.padEnd(34)} ${r.sentido}`);
  }

  console.log('');
  const instrumentos = new Set(ROTURAS.map((r) => r.instrumento)).size;
  if (malas.length) {
    console.log(`🔴 ${malas.length} rotura(s) sin rojo:`);
    for (const m of malas) console.log(`   ${m}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✅ ${ROTURAS.length} roturas sobre ${instrumentos} instrumentos, y todas tumbaron su siembra. `
    + 'Ficheros restaurados byte a byte.');
}

if (ejecutadoDirectamente(import.meta.url)) principal();
