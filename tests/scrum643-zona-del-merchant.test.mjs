// tests/scrum643-zona-del-merchant.test.mjs — SCRUM-643 (fase ③)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS TRES CÁLCULOS FISCALES DEJAN DE LEER EL RELOJ DE LA MÁQUINA
//
// Medido en SCRUM-640: con el servidor en UTC (Railway, sin variable `TZ`) y el pro en la
// península, un albarán del 1 de abril a las 00:30 hora española caía en la recapitulativa del
// MES ANTERIOR, el semáforo decía ÁMBAR con el plazo YA VENCIDO, y el corte «hasta el 31 de
// marzo» se lo tragaba. Tres síntomas, una causa: `getFullYear()`/`setHours()`, o sea el reloj
// del proceso.
//
// 🔴 ESTE FICHERO FIJA LA ZONA A MANO, SIEMPRE. Un test de fechas que hereda la zona del proceso
// mide la máquina donde corre y no el producto — es lo que cazó SCRUM-640 en cinco ficheros, y
// lo que hizo que el de SCRUM-630 sólo pasara en UNA zona del planeta.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import {
  ZONA_POR_DEFECTO, zonaDelMerchant, zonaValida,
  diaNaturalEn, mesNaturalEn, inicioDelDiaEn, finDelDiaEn, diasEntre,
} from '../dist/core/zonaDelMerchant.js';
import { mesNaturalKey } from '../dist/modules/jobs/domain/albaran.service.js';
import {
  calcularSemaforo, fechaLimiteRecapitulativa,
} from '../dist/modules/jobs/domain/pendientesFacturar.service.js';
import { seleccionarConsolidablesDeCliente } from '../dist/modules/jobs/domain/consolidacionCliente.service.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const MADRID = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · SUELO: la primitiva responde, y el instrumento sabe distinguir zonas', () => {
  for (const [n, f] of Object.entries({ zonaDelMerchant, diaNaturalEn, mesNaturalEn, inicioDelDiaEn, finDelDiaEn, diasEntre })) {
    assert.equal(typeof f, 'function', `🔴 CIEGO: falta \`${n}\``);
  }
  // Ida y vuelta: el instante de un día, leído en la misma zona, devuelve ese día.
  assert.equal(diaNaturalEn(inicioDelDiaEn('2026-04-01', MADRID), MADRID), '2026-04-01');
  assert.equal(diaNaturalEn(finDelDiaEn('2026-03-31', CANARIAS), CANARIAS), '2026-03-31');
  // Y que la zona CAMBIA algo: si no, todo lo de abajo pasaría sin medir nada.
  const t = new Date('2026-03-31T22:30:00Z');
  assert.notEqual(diaNaturalEn(t, MADRID), diaNaturalEn(t, CANARIAS),
    '🔴 Madrid y Canarias dan el mismo día en un instante donde NO deben: la zona no se está aplicando');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUÉ PASA CUANDO NADIE LO HA DECLARADO — y por qué NO es Madrid
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · 🔴 sin declarar cae a UTC, NUNCA a la península', () => {
  assert.equal(ZONA_POR_DEFECTO, 'UTC');
  for (const m of [null, undefined, {}, { timezone: null }, { timezone: '' }, { timezone: '   ' }]) {
    assert.equal(zonaDelMerchant(m), 'UTC',
      `🔴 ${JSON.stringify(m)} no cae a UTC. Caer a \`Europe/Madrid\` declararía PENINSULAR a un `
      + 'canario sin que nadie lo haya dicho, y Canarias es mercado. UTC es lo que el sistema '
      + 'hacía ANTES de existir esta columna: un merchant sin declarar no ve ningún cambio.');
  }
  assert.notEqual(zonaDelMerchant({ timezone: null }), MADRID, '🔴 el defecto no puede ser la península');
  // Una zona declarada SÍ manda.
  assert.equal(zonaDelMerchant({ timezone: MADRID }), MADRID);
  assert.equal(zonaDelMerchant({ timezone: CANARIAS }), CANARIAS);
  // Y una zona corrupta no tumba la bandeja: se comporta como si no constara.
  assert.equal(zonaDelMerchant({ timezone: 'Marte/Olympus' }), 'UTC');
  assert.equal(zonaValida('Marte/Olympus'), false);
  assert.equal(zonaValida(MADRID), true);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CONTROL · el albarán del 1-abr 00:30, con la zona del merchant fijada
// ─────────────────────────────────────────────────────────────────────────────────────────
const CLIENTE = 7;
const alb = (fecha) => ({
  id: 1, numero: 'ALB-2026-001', fecha, estado: 'firmado',
  modoValoracion: 'VALORADO', invoiceId: null, customerId: CLIENTE, jobId: 100,
  tipoOperacion: 'MANTENIMIENTO',
});

/** El instante en que `zona` marca ese reloj de pared. Se usa el propio módulo, ya probado arriba. */
const aLasCeroTreinta = (zona) => new Date(inicioDelDiaEn('2026-04-01', zona).getTime() + 30 * 60_000);

const ESCENARIOS = [
  { zona: MADRID, quien: 'península', mes: '2026-04', semaforo: 'rojo', enRango: false },
  { zona: CANARIAS, quien: 'Canarias', mes: '2026-04', semaforo: 'rojo', enRango: false },
  // 🔴 UTC es «el comportamiento de hoy», y se afirma como resultado ESPERADO, no como fallo:
  // un merchant declarado en UTC —o sin declarar— debe seguir viendo exactamente lo de ahora.
  { zona: 'UTC', quien: 'como hoy', mes: '2026-04', semaforo: 'rojo', enRango: false },
];

for (const e of ESCENARIOS) {
  test(`SCRUM-643 · 🔴 ${e.quien}: el albarán del 1-abr 00:30 EN SU ZONA es de ABRIL`, () => {
    const f = aLasCeroTreinta(e.zona);

    // ① la rotura por mes natural (art. 13)
    assert.equal(mesNaturalKey(f, e.zona), e.mes,
      `🔴 el albarán se atribuye a ${mesNaturalKey(f, e.zona)} y es de ${e.mes}. Eso lo mete en la `
      + 'recapitulativa del mes que no toca — una factura EMITIDA con un parte que no le corresponde.');

    // ② el semáforo del plazo del art. 13.2, con el plazo de MARZO ya vencido
    const limite = fechaLimiteRecapitulativa('2026-03', 'PARTICULAR');
    assert.equal(limite, '2026-03-31', '🔴 el plazo legal de marzo ha cambiado');
    assert.equal(calcularSemaforo(limite, f, e.zona), e.semaforo,
      '🔴 el semáforo dice que el plazo NO ha vencido cuando en el calendario del merchant SÍ. '
      + 'Deja de avisar justo cuando más falta, y el plazo del art. 13.2 es LEY.');

    // ③ el corte «hasta el 31 de marzo»
    const r = seleccionarConsolidablesDeCliente([alb(f)], CLIENTE, { desde: '2026-03-01', hasta: '2026-03-31' }, e.zona);
    assert.equal(r.elegibles.length === 1, e.enRango,
      '🔴 un albarán del 1 de abril entra en el rango «hasta el 31 de marzo»');
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUE DISTINGUE LAS ZONAS · el MISMO instante, tres merchants
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · 🔴 CADA PAR de zonas se separa en algún instante', () => {
  // ⚠️ NO se afirma que las TRES den tres calendarios distintos, y no es una rebaja: con
  // desfases +2, +1 y 0 la separación máxima son DOS HORAS, así que los tres nunca pueden dar
  // tres días distintos a la vez — como mucho dos grupos. Exigirlo sería pedir un rojo imposible.
  const PARES = [
    ['2026-03-31T22:30:00Z', MADRID, CANARIAS, 'verano: separa la península de Canarias'],
    ['2026-03-31T23:30:00Z', CANARIAS, 'UTC', 'verano: separa Canarias de UTC'],
    ['2026-01-31T23:30:00Z', MADRID, 'UTC', 'invierno: separa la península de UTC'],
  ];
  for (const [iso, a, b, que] of PARES) {
    const t = new Date(iso);
    assert.notEqual(diaNaturalEn(t, a), diaNaturalEn(t, b),
      `🔴 ${a} y ${b} dan el MISMO día en ${iso} (${que}). Si no se separan, esto vuelve a medir `
      + 'una sola zona y da igual cuál sea la del merchant.');
    // Y lo que de verdad importa: el MES del art. 13 también cambia según el merchant.
    assert.notEqual(mesNaturalEn(t, a), mesNaturalEn(t, b),
      `🔴 el mes natural coincide entre ${a} y ${b}: el reparto en recapitulativas no distingue`);
  }
  // El contraste que hace que lo de arriba signifique algo: a mediodía NADIE se separa.
  const mediodia = new Date('2026-04-15T12:00:00Z');
  for (const z of [MADRID, CANARIAS, 'UTC']) {
    assert.equal(diaNaturalEn(mediodia, z), '2026-04-15',
      `🔴 a mediodía ${z} da otro día: entonces las separaciones de arriba no prueban nada`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ EL CONTROL NEGATIVO, QUE ES EL QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · ✅ un merchant peninsular con un albarán de MEDIODÍA se comporta como hoy', () => {
  const f = new Date(inicioDelDiaEn('2026-04-15', MADRID).getTime() + 12 * 3600_000);
  assert.equal(mesNaturalKey(f, MADRID), '2026-04', '🔴 el mes ha cambiado en un caso que no debía');
  const r = seleccionarConsolidablesDeCliente([alb(f)], CLIENTE, { desde: '2026-04-01', hasta: '2026-04-30' }, MADRID);
  assert.equal(r.elegibles.length, 1, '🔴 un albarán de mediodía dentro de su mes se ha quedado fuera del rango');
  const limite = fechaLimiteRecapitulativa('2026-04', 'PARTICULAR');
  assert.equal(calcularSemaforo(limite, f, MADRID), 'verde',
    '🔴 el semáforo de un caso holgado ha cambiado: se ha movido el criterio, no tapado el hueco');
  // Y el «hasta el 31 entero» sigue incluyendo el 31: es lo que SCRUM-70 protege.
  const finDeMes = new Date(finDelDiaEn('2026-04-30', MADRID).getTime() - 30 * 60_000);
  const r2 = seleccionarConsolidablesDeCliente([alb(finDeMes)], CLIENTE, { desde: '2026-04-01', hasta: '2026-04-30' }, MADRID);
  assert.equal(r2.elegibles.length, 1, '🔴 el último día del rango ha dejado de entrar entero');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL COMPROMISO ESCRITO: DE AQUÍ NO SALE EL IMPUESTO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · 🔴 la primitiva NO sabe de impuestos, y no debe aprenderlo', () => {
  // `timezone` responde «¿en qué calendario vive este merchant?». El régimen —IVA / IGIC canario
  // / IPSI de Ceuta y Melilla— es SCRUM-646 y es OTRO dato. Coinciden geográficamente en
  // Canarias, que es lo que los hace fáciles de confundir; pero la relación NO es biyectiva:
  // Ceuta y Melilla llevan IPSI con el huso de la PENÍNSULA. Un campo que sirviera para las dos
  // cosas nace roto en dos territorios españoles.
  const fuente = leer('src/core/zonaDelMerchant.ts');
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const nombres = [];
  (function rec(n) {
    if ((ts.isFunctionDeclaration(n) || ts.isVariableStatement(n))
        && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(n) && n.name) nombres.push(n.name.text);
      if (ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) nombres.push(d.name.text);
    }
    ts.forEachChild(n, rec);
  })(sf);
  assert.ok(nombres.length >= 5, `🔴 CIEGO: sólo veo ${nombres.length} exports; el detector no está leyendo`);
  const FISCAL = /iva|igic|ipsi|impuesto|vat|tax|regimen|régimen|canarias/i;
  const sospechosos = nombres.filter((n) => FISCAL.test(n));
  assert.deepEqual(sospechosos, [],
    `🔴 \`zonaDelMerchant.ts\` exporta ${JSON.stringify(sospechosos)}. El impuesto NO sale de la zona: `
    + 'Ceuta y Melilla llevan IPSI con el huso de la península, así que derivarlo de aquí nace roto. '
    + 'Es SCRUM-646 y va por su cuenta.');
  // Control del detector: sobre una fuente con un export fiscal, SÍ lo ve.
  const sfMalo = ts.createSourceFile('y.ts', 'export function tipoDeIvaDelMerchant() {}', ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let visto = null;
  ts.forEachChild(sfMalo, (n) => { if (ts.isFunctionDeclaration(n) && n.name) visto = n.name.text; });
  assert.equal(FISCAL.test(visto), true, '🔴 el detector no reconocería un export fiscal aunque estuviera');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UN SOLO SITIO · nadie resuelve la zona por su cuenta
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-643 · 🔴 la DECISIÓN de qué zona usar vive en UN sitio', () => {
  // Leer `merchant.timezone` de la BD puede hacerlo quien lo necesite; lo que NO puede repetirse
  // es DECIDIR qué hacer cuando falta. Un segundo `timezone || 'algo'` sería la copia que este
  // módulo existe para impedir — y en este caso «la copia» acabaría siendo el reloj del proceso.
  const FUERA = new Set(['node_modules', 'dist', '.git', 'coverage', 'tests', '.claude', '.agents']);
  const culpables = [];
  let ficheros = 0;
  (function anda(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (FUERA.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { anda(p); continue; }
      if (!['.ts', '.js', '.mjs'].includes(path.extname(e.name)) || e.name.includes('.min.')) continue;
      const rel = path.relative(RAIZ, p).split(path.sep).join('/');
      if (rel === 'src/core/zonaDelMerchant.ts') continue; // el sitio único
      ficheros++;
      const src = fs.readFileSync(p, 'utf8');
      const sf2 = ts.createSourceFile(e.name, src, ts.ScriptTarget.Latest, true,
        e.name.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
      (function rec(n) {
        if (ts.isBinaryExpression(n)
            && (n.operatorToken.kind === ts.SyntaxKind.BarBarToken
                || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
          const izq = n.left.getText(sf2);
          if (/\btimezone\b/i.test(izq)) {
            culpables.push(`${rel}:${sf2.getLineAndCharacterOfPosition(n.getStart(sf2)).line + 1}  ${n.getText(sf2).replace(/\s+/g, ' ').slice(0, 70)}`);
          }
        }
        ts.forEachChild(n, rec);
      })(sf2);
    }
  })(RAIZ);
  assert.ok(ficheros > 300, `🔴 CIEGO: sólo he barrido ${ficheros} ficheros`);
  assert.deepEqual(culpables, [],
    '🔴 alguien resuelve la zona por su cuenta en vez de llamar a `zonaDelMerchant`. Si la '
    + 'decisión no vive en un sitio, el siguiente la copia o la inventa — y aquí «la inventa» '
    + `significa volver al reloj del proceso: ${JSON.stringify(culpables)}`);
});

test('SCRUM-643 · CONTROL del detector del sitio único', () => {
  // Sin esto, un detector que devolviera siempre `[]` pasaría el test de arriba.
  const ve = (src) => {
    const sf2 = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let n = 0;
    (function rec(x) {
      if (ts.isBinaryExpression(x)
          && (x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
          && /\btimezone\b/i.test(x.left.getText(sf2))) n++;
      ts.forEachChild(x, rec);
    })(sf2);
    return n;
  };
  assert.equal(ve("const z = m.timezone || 'Europe/Madrid';"), 1, '🔴 no ve un `||` sobre timezone');
  assert.equal(ve("const z = m.timezone ?? 'UTC';"), 1, '🔴 no ve un `??` sobre timezone');
  assert.equal(ve("// const z = m.timezone || 'UTC';\nconst x = 1;"), 0, '🔴 cuenta un COMENTARIO');
  assert.equal(ve("const z = m.pais || 'ES';"), 0, '🔴 cuenta un `||` que no es de zona');
});
