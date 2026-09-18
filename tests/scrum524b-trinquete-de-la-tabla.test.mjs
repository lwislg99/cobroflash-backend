// tests/scrum524b-trinquete-de-la-tabla.test.mjs — SCRUM-524b · EL TRINQUETE DE LA TABLA DE VERI*FACTU.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUÉ IMPIDE
//
// Que «N de 41 comprobadas» BAJE sin que nadie lo diga. La cifra no la escribe nadie: la calcula
// `scripts/tabla-verifactu.mjs` contra `src/` en cada tanda, con las anclas del catálogo
// (`scripts/_tabla-verifactu-catalogo.mjs`). Este fichero guarda el SUELO —el CONJUNTO de códigos
// comprobados hoy, no su número— y se pone en rojo:
//
//   · si una del suelo deja de estar viva — nombrando CUÁL y QUÉ ancla falla;
//   · si el catálogo declara una comprobada que no está en el suelo — el trinquete SUBIÓ, y el
//     suelo se sube en el mismo PR (si no, la próxima bajada volvería a la cifra vieja en silencio).
//
// Compara CONJUNTOS, no cuentas: el 17-sep la tabla decía «8 comprobadas» y medido código a código
// el número seguía siendo 8 con un conjunto DISTINTO. Un número igual deja pasar «he perdido una y
// he ganado otra».
//
// ── SI ESTO SE PONE EN ROJO ────────────────────────────────────────────────────────────────────
// Si una comprobación se quitó, el arreglo es devolverla. Bajar el SUELO para ponerlo en verde es
// relajar un guard (regla 41), y quitar una comprobación del camino de emisión es STOP (regla 38).
// Si fue un refactor que CONSERVA la comprobación, se reescribe su ANCLA en el catálogo; el suelo
// no se toca.
//
// ── LOS CONTROLES ──────────────────────────────────────────────────────────────────────────────
//   🔴 EL QUE DECIDE — sobre una COPIA de `src/`, se quita una comprobación de las que HOY existen
//      y el trinquete tiene que CAER y NOMBRAR exactamente cuál. Una por mecanismo.
//   🟢 LOS NEGATIVOS — un reformateo y un comentario NO pueden tumbar nada.
//   ✅ EL POSITIVO — 1189/1190 (la exclusión de la factura sin NIF) se sigue contando.
//   ⚫ EL SUELO DE CEGUERA — sobre un árbol vacío o ajeno el instrumento dice CIEGO, no «0».
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';
import { evaluarTabla, validarCatalogo, informe, RAIZ_REPO } from '../scripts/tabla-verifactu.mjs';
import { CATALOGO, POBLACION, FUERA_DEL_CATALOGO } from '../scripts/_tabla-verifactu-catalogo.mjs';

const CLI = path.join(RAIZ_REPO, 'scripts', 'tabla-verifactu.mjs');

/**
 * EL SUELO. Medido el 18-sep-2026 sobre `origin/main` 41bad7c83d84ba2cddcf267480bbd7bcd9bc0b2c.
 * Sólo se toca para SUBIRLO, en el mismo PR que añade la comprobación y su ancla.
 */
const SUELO = Object.freeze([
  '1114', '1115', '1117', '1130', '1152', '1177', '1189', '1190', '1195', '1207', '1212', '1213', '1223', '1226',
]);

/** Las que el árbol comprueba y NO son códigos del catálogo del ticket. Mismo trato, aparte. */
const SUELO_FUERA_DEL_CATALOGO = Object.freeze(['1118-1119', '1124', 'tipo-huella-01', 'tipos-declarables', 'tope-1000']);

const NO_BAJAR = '\n\nSi la comprobación se quitó, se devuelve: bajar el suelo para ponerlo en verde es relajar un guard '
  + '(regla 41), y quitarla del camino de emisión es STOP (regla 38). Si fue un refactor que la conserva, se '
  + 'reescribe su ANCLA en scripts/_tabla-verifactu-catalogo.mjs y el suelo no se toca.';

// El árbol se lee UNA vez: las mutaciones lo reutilizan en memoria.
const DISCO = new Map();
const leerReal = (rel) => {
  if (!DISCO.has(rel)) {
    try { DISCO.set(rel, fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8')); } catch { DISCO.set(rel, null); }
  }
  return DISCO.get(rel);
};

let _real;
const real = () => (_real ??= evaluarTabla({ leer: leerReal }));

const caidas = (r) => [...r.rotas.map((x) => x.codigo), ...r.fueraRotas.map((x) => x.id)].sort();
const detalle = (r) => [...r.rotas.map((x) => `${x.codigo}: ${x.fallos.join(' · ')}`),
  ...r.fueraRotas.map((x) => `${x.id}: ${x.fallos.join(' · ')}`)].join('\n');

// ── LA POBLACIÓN ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-524b · el catálogo ES la población del ticket: 41 códigos, cada uno con UNA categoría', () => {
  assert.equal(POBLACION.length, 41, 'la población declarada no son 41 códigos');
  assert.equal(new Set(POBLACION).size, 41, 'hay códigos repetidos en la población');
  assert.deepEqual(validarCatalogo(), [], 'el catálogo no casa con la población del ticket');
  const porCategoria = CATALOGO.reduce((m, e) => ({ ...m, [e.categoria]: (m[e.categoria] ?? 0) + 1 }), {});
  assert.equal(Object.values(porCategoria).reduce((a, b) => a + b, 0), 41, JSON.stringify(porCategoria));
});

test('SCRUM-524b · el instrumento DECLARA su población: sobre qué ficheros midió, no sólo qué salió', () => {
  const r = real();
  assert.equal(r.ciego, null, `el instrumento se declara ciego sobre el árbol real: ${r.ciego}`);
  assert.equal(r.poblacion.declarada, 41);
  const anclados = [...new Set([...CATALOGO, ...FUERA_DEL_CATALOGO].flatMap((e) => (e.anclas ?? []).map((a) => a.fichero)))];
  assert.equal(r.poblacion.ficherosAnclados, anclados.length);
  for (const f of anclados) assert.ok(leerReal(f) != null, `un ancla apunta a un fichero que no existe: ${f}`);
  // El barrido lee el DISCO, así que ve también lo no seguido: nunca menos que lo que git sigue.
  const seguidos = execFileSync('git', ['ls-files', 'src'], { cwd: RAIZ_REPO, encoding: 'utf8' })
    .split('\n').filter((l) => l.endsWith('.ts')).length;
  assert.ok(seguidos > 0, 'git ls-files no devuelve ningún .ts: el control no mide nada');
  assert.ok(r.poblacion.ficherosTs >= seguidos,
    `el barrido leyó ${r.poblacion.ficherosTs} .ts y git sigue ${seguidos}: se está dejando parte de src/`);
});

// ── EL POSITIVO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-524b · POSITIVO: 1189/1190 —la factura sin NIF se excluye y se reporta— se siguen contando', () => {
  const r = real();
  for (const codigo of ['1189', '1190']) {
    const c = r.comprobadas.find((x) => x.codigo === codigo);
    assert.ok(c, `${codigo} ya no está declarada comprobada`);
    assert.ok(c.viva, `${codigo} ya no está viva:\n${c.anclas.filter((x) => x.fallo).map((x) => x.fallo).join('\n')}`);
  }
});

// ── EL TRINQUETE ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-524b · EL TRINQUETE no baja: todas las del suelo siguen comprobadas en el árbol de hoy', () => {
  const r = real();
  const perdidas = SUELO.filter((c) => !r.vivas.includes(c));
  assert.deepEqual(perdidas, [],
    `🔴 LA TABLA HA BAJADO: ${perdidas.length} comprobación(es) del suelo ya no están.\n`
    + perdidas.map((c) => {
      const rota = r.rotas.find((x) => x.codigo === c);
      return `   ${c} — ${rota ? rota.fallos.join(' · ') : 'el catálogo ya no la declara comprobada'}`;
    }).join('\n') + NO_BAJAR);
});

test('SCRUM-524b · EL TRINQUETE sólo sube: el suelo y el catálogo dicen lo mismo, como CONJUNTOS', () => {
  const declaradas = CATALOGO.filter((e) => e.categoria === 'comprobada').map((e) => e.codigo).sort();
  const retiradas = SUELO.filter((c) => !declaradas.includes(c));
  assert.deepEqual(retiradas, [], `🔴 BAJÓ POR RECLASIFICACIÓN: ${retiradas.join(', ')} están en el suelo y el catálogo ya no las da por comprobadas.${NO_BAJAR}`);
  const nuevas = declaradas.filter((c) => !SUELO.includes(c));
  assert.deepEqual(nuevas, [],
    `🟢 EL TRINQUETE HA SUBIDO: ${nuevas.join(', ')}. Añádelas al SUELO de este fichero en el mismo PR, o la `
    + 'próxima bajada volverá a la cifra vieja sin que nada lo diga.');
});

test('SCRUM-524b · FUERA DEL CATÁLOGO: las cinco comprobaciones que no son del ticket, con el mismo trinquete', () => {
  const r = real();
  const perdidas = SUELO_FUERA_DEL_CATALOGO.filter((id) => !r.fueraDelCatalogo.some((c) => c.id === id && c.viva));
  assert.deepEqual(perdidas, [], `🔴 ${perdidas.map((id) => `${id}: ${r.fueraRotas.find((x) => x.id === id)?.fallos.join(' · ') ?? 'ya no está en el catálogo'}`).join('\n')}${NO_BAJAR}`);
  const nuevas = FUERA_DEL_CATALOGO.map((e) => e.id).filter((id) => !SUELO_FUERA_DEL_CATALOGO.includes(id));
  assert.deepEqual(nuevas, [], `🟢 subió: añade ${nuevas.join(', ')} a SUELO_FUERA_DEL_CATALOGO`);
});

test('SCRUM-524b · LAS AUSENCIAS: lo que la tabla da por «no se escribe nunca» sigue sin escribirse, y el canario se ve', () => {
  const r = real();
  assert.ok(r.canario.apariciones > 0, `el canario «${r.canario.elemento}» no aparece: los ceros de abajo no valen nada`);
  assert.ok(r.ausencias.length > 0, 'no hay ninguna ausencia declarada: el control no mide nada');
  assert.deepEqual(r.ausenciasRotas.map((a) => a.codigo), [],
    r.ausenciasRotas.map((a) => `${a.codigo}: «${a.elemento}» YA SE ESCRIBE en ${a.apariciones.join(', ')}. `
      + 'La tabla lo da por ausente: decide si ahora se COMPRUEBA (a comprobada, con su ancla) o no.').join('\n'));
});

test('SCRUM-524b · se publican JUNTAS: los 41 salen en el informe, cada uno en UNA de las tres categorías', () => {
  const texto = informe(real());
  const secciones = texto.split(/\n(?=✅ COMPROBADAS|🔴 NO COMPROBADAS|⬜ FUERA DE ALCANCE|➕ FUERA DEL CATÁLOGO)/);
  const titulos = ['✅ COMPROBADAS', '🔴 NO COMPROBADAS', '⬜ FUERA DE ALCANCE'];
  const vistos = new Map();
  for (const t of titulos) {
    const s = secciones.find((x) => x.startsWith(t));
    assert.ok(s, `el informe no publica la sección «${t}»`);
    for (const m of s.matchAll(/^\s+(?:[✓✗] )?(\d{4}) {2}/gm)) vistos.set(m[1], [...(vistos.get(m[1]) ?? []), t]);
  }
  const mal = POBLACION.filter((c) => (vistos.get(c) ?? []).length !== 1);
  assert.deepEqual(mal, [], mal.map((c) => `${c}: aparece en ${JSON.stringify(vistos.get(c) ?? [])}`).join('\n'));
});

// ── 🔴 EL QUE DECIDE ───────────────────────────────────────────────────────────────────────────

const F = {
  esquemas: 'src/core/validation/schemas.ts',
  entrada: 'src/core/validation/fiscalInput.ts',
  app: 'src/app.ts',
  exports: 'src/modules/exports/app/routes/exports.routes.ts',
  servicio: 'src/modules/invoicing/domain/verifactu.service.ts',
  builder: 'src/modules/fiscal/verifactu/registro.builder.ts',
  env: 'src/core/config/env.ts',
  arranque: 'src/index.ts',
};

/**
 * Una mutación por mecanismo. `de` tiene que aparecer EXACTAMENTE `apariciones` veces en el árbol
 * real (si no, la cobaya no existe y el resultado no significa nada: A21); se sustituye la PRIMERA.
 * `caen` es lo que el trinquete tiene que nombrar, ni más ni menos.
 */
const MUTACIONES = [
  { que: '1130 · la validación de la serie sale del esquema', fichero: F.esquemas,
    de: 'const motivo = invalidPrefijoSerie(v);', a: 'const motivo = null;', caen: ['1130'] },
  { que: '1130 · y de la otra puerta (app.ts)', fichero: F.app,
    de: 'const malPrefijo = invalidPrefijoSerie(prefijoPedido);', a: 'const malPrefijo = null;', caen: ['1130'] },
  { que: '1152 · /verifactu.xml deja de mirar el año', fichero: F.exports,
    de: 'const motivoAnio = invalidAnioFiscal(year);', a: 'const motivoAnio = null;', caen: ['1152'] },
  { que: '1189 · la factura sin NIF deja de pasar por el resolvedor', fichero: F.servicio,
    de: '? resolverSinDestinatario(tipoBase, inv.number, opts.modoSinDestinatario ?? MODO_SIN_DESTINATARIO)',
    a: '? null', caen: ['1189'] },
  { que: '1189 · el resolvedor deja de excluir sin dictamen', fichero: F.builder,
    de: "if (modo === 'SIN_DICTAMEN') {", a: 'if (false) {', caen: ['1189'] },
  { que: '1190 · `Destinatarios` se escribe siempre', fichero: F.servicio,
    de: 'const destinatarios = destinatario.taxId ? `', a: 'const destinatarios = true ? `', caen: ['1190'] },
  { que: '1190 · la F2 nace por importe, con NIF', fichero: F.servicio,
    de: 'const tipoFactura = sinDestinatario ? sinDestinatario.tipoFactura : tipoBase;',
    a: "const tipoFactura = Number(inv.total) < 400 ? 'F2' : tipoBase;", caen: ['1190'] },
  { que: '1114/1115/1117 · «es rectificativa» deja de mirar el tipo (un mecanismo, tres códigos)', fichero: F.servicio,
    de: "const esRectificativa = inv.type === 'R1' && !!inv.rectifies;", a: 'const esRectificativa = !!inv.rectifies;',
    caen: ['1114', '1115', '1117'] },
  { que: '1114 · la R1 deja de resolver su `TipoRectificativa`', fichero: F.servicio,
    de: '? resolverTipoRectificativa(', a: '? omitirTipoRectificativa(', caen: ['1114'] },
  { que: '1115 · una no rectificativa también resuelve `TipoRectificativa`', fichero: F.servicio,
    de: ": { tipoXml: '', importeXml: '' };", a: ': resolverTipoRectificativa(inv.number, null);', caen: ['1115'] },
  { que: '1117 · `FacturasRectificadas` se escribe siempre', fichero: F.servicio,
    de: 'const rectificadas = esRectificativa ? `', a: 'const rectificadas = true ? `', caen: ['1117'] },
  { que: '1195 · `CalificacionOperacion` pasa a ser opcional', fichero: F.builder,
    de: '<sum1:CalificacionOperacion>${esc(d.calificacion)}</sum1:CalificacionOperacion>',
    a: '${d.calificacion ? `<sum1:CalificacionOperacion>${esc(d.calificacion)}</sum1:CalificacionOperacion>` : \'\'}',
    caen: ['1195'] },
  { que: '1207 · aparece una calificación que no es S1', fichero: F.builder,
    de: 'calificacion: CALIFICACION_SUJETA_NO_EXENTA,',
    a: "calificacion: entrada.rate > 0 ? CALIFICACION_SUJETA_NO_EXENTA : 'N1',", caen: ['1207'] },
  { que: '1177 · el arranque deja de comprobar el id del sistema', fichero: F.arranque,
    de: 'assertVerifactuIdSistema();', a: '', caen: ['1177'] },
  { que: '1177 · el validador deja de exigir 2 posiciones', fichero: F.env,
    de: 'if (v.length !== 2) return', a: 'if (v.length > 99) return', caen: ['1177'] },
  { que: '1212 · UNA de las dos apariciones deja de ser fija', fichero: F.servicio, apariciones: 2,
    de: '<sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>',
    a: '<sum1:TipoUsoPosibleSoloVerifactu>${productor.soloVerifactu}</sum1:TipoUsoPosibleSoloVerifactu>', caen: ['1212'] },
  { que: '1213 · ídem', fichero: F.servicio, apariciones: 2,
    de: '<sum1:TipoUsoPosibleMultiOT>S</sum1:TipoUsoPosibleMultiOT>',
    a: '<sum1:TipoUsoPosibleMultiOT>${productor.multiOT}</sum1:TipoUsoPosibleMultiOT>', caen: ['1213'] },
  { que: '1226 · ídem', fichero: F.servicio, apariciones: 2,
    de: '<sum1:IndicadorMultiplesOT>S</sum1:IndicadorMultiplesOT>',
    a: '<sum1:IndicadorMultiplesOT>${productor.multiplesOT}</sum1:IndicadorMultiplesOT>', caen: ['1226'] },
  { que: '1223 · el emisor deja de exigir el NIF del productor', fichero: F.servicio,
    de: '!productor.nif || ', a: '', caen: ['1223'] },
  // Fuera del catálogo del ticket, mismo trato.
  { que: '1124 · el esquema deja de validar el tipo de IVA', fichero: F.esquemas,
    de: 'const motivo = invalidTipoIva(v);', a: 'const motivo = null;', caen: ['1124'] },
  { que: '1124 · entra un tipo de IVA que no existe (15 %)', fichero: F.entrada,
    de: 'new Set([0, 200, 400, 500, 750, 1000, 2100])', a: 'new Set([0, 200, 400, 500, 750, 1000, 1500, 2100])', caen: ['1124'] },
  { que: 'tipos · el paquete anual deja de filtrar por tipo', fichero: F.servicio,
    de: 'const veredicto = declarabilidadDe(inv.type);',
    a: "const veredicto = { declara: true as const, tipoAeat: 'F1' as const };", caen: ['tipos-declarables'] },
  { que: 'TipoHuella · el alta del builder deja de fijar 01', fichero: F.builder, apariciones: 2,
    de: '<sum1:TipoHuella>01</sum1:TipoHuella>', a: '<sum1:TipoHuella>${p.tipoHuella}</sum1:TipoHuella>', caen: ['tipo-huella-01'] },
  { que: '1118 · la sustitutiva sale sin `ImporteRectificacion`', fichero: F.builder,
    de: 'if (!importeRectificado) {', a: 'if (false) {', caen: ['1118-1119'] },
  { que: 'tope · el paquete deja de cortar a 1.000', fichero: F.servicio,
    de: 'if (invoices.length > MAX_REGISTROS_POR_ENVIO) {', a: 'if (false) {', caen: ['tope-1000'] },
  { que: 'tope · la constante deja de ser la del XSD', fichero: F.builder,
    de: 'export const MAX_REGISTROS_POR_ENVIO = 1000;', a: 'export const MAX_REGISTROS_POR_ENVIO = 10000;', caen: ['tope-1000'] },
  // 🟢 LOS NEGATIVOS: nada de esto quita una comprobación, y nada puede caer.
  { que: 'NEGATIVO · un reformateo no es quitar una comprobación', fichero: F.servicio,
    de: "const esRectificativa = inv.type === 'R1' && !!inv.rectifies;",
    a: "const esRectificativa =\n      inv.type==='R1'   &&   !!inv.rectifies ; // reformateado", caen: [] },
  { que: 'NEGATIVO · un comentario que nombra `OperacionExenta` no la escribe', fichero: F.servicio,
    de: 'const veredicto = declarabilidadDe(inv.type);',
    a: '// algún día: <sum1:OperacionExenta>\n    const veredicto = declarabilidadDe(inv.type);', caen: [] },
  // Y el reverso: escribirla DE VERDAD sí tumba la ausencia que declara 1196.
  { que: 'AUSENCIA · alguien empieza a escribir `OperacionExenta`', fichero: F.builder,
    de: '<sum1:Impuesto>01</sum1:Impuesto>', a: '<sum1:Impuesto>01</sum1:Impuesto><sum1:OperacionExenta>E1</sum1:OperacionExenta>',
    caen: [], ausenciasCaen: ['1196'] },
];

for (const m of MUTACIONES) {
  test(`SCRUM-524b · 🔴 EL QUE DECIDE · ${m.que} → cae ${m.caen.length ? m.caen.join(', ') : 'NADA'}`, () => {
    const original = leerReal(m.fichero);
    assert.ok(original != null, `no existe ${m.fichero}`);
    const veces = original.split(m.de).length - 1;
    assert.equal(veces, m.apariciones ?? 1,
      `la cobaya no existe: «${m.de}» aparece ${veces} veces en ${m.fichero}. Sin ella, este control no mide nada.`);
    const mutado = original.replace(m.de, () => m.a);
    assert.notEqual(mutado, original, 'la mutación no cambió nada');
    const r = evaluarTabla({ leer: (rel) => (rel === m.fichero ? mutado : leerReal(rel)) });
    assert.equal(r.ciego, null, `la copia mutada se declara ciega: ${r.ciego}`);
    assert.deepEqual(caidas(r), [...m.caen].sort(),
      `el trinquete tenía que nombrar ${JSON.stringify(m.caen)} y nombró ${JSON.stringify(caidas(r))}:\n${detalle(r)}`);
    for (const c of m.caen) {
      const fallos = [...r.rotas, ...r.fueraRotas].find((x) => (x.codigo ?? x.id) === c).fallos;
      assert.ok(fallos.length && fallos.every((f) => f.startsWith('src/')), `${c} cae sin decir en qué fichero: ${fallos}`);
    }
    assert.deepEqual(r.ausenciasRotas.map((a) => a.codigo), m.ausenciasCaen ?? []);
  });
}

// ── DE PUNTA A PUNTA: una COPIA en disco, por el CLI, con su código de salida ─────────────────

function correrCli(raiz) {
  try {
    return { status: 0, out: execFileSync(process.execPath, [CLI, '--raiz', raiz, '--json'], { encoding: 'utf8', maxBuffer: 16 << 20 }) };
  } catch (e) {
    return { status: e.status, out: e.stdout };
  }
}

test('SCRUM-524b · 🔴 EL QUE DECIDE, de punta a punta: copia de src/ en disco → 0; se quita 1130 → sale 1 y la nombra', () => {
  const copia = temporal('yaqu-524b-');
  fs.cpSync(path.join(RAIZ_REPO, 'src'), path.join(copia, 'src'), { recursive: true });

  const sana = correrCli(copia);
  assert.equal(sana.status, 0, `la copia SIN tocar ya sale ${sana.status}: el control no distinguiría la mutación`);
  assert.deepEqual(JSON.parse(sana.out).rotas, []);

  const f = path.join(copia, F.esquemas);
  const texto = fs.readFileSync(f, 'utf8');
  const de = 'const motivo = invalidPrefijoSerie(v);';
  assert.equal(texto.split(de).length - 1, 1, 'la cobaya no existe en la copia');
  fs.writeFileSync(f, texto.replace(de, () => 'const motivo = null;'));

  const rota = correrCli(copia);
  assert.equal(rota.status, 1, `con 1130 quitada el CLI sale ${rota.status}, no 1`);
  assert.deepEqual(JSON.parse(rota.out).rotas.map((x) => x.codigo), ['1130']);
});

// ── ⚫ EL SUELO DE CEGUERA ─────────────────────────────────────────────────────────────────────

test('SCRUM-524b · ⚫ CIEGO: sin src/, el instrumento no dice «0 comprobadas», dice CIEGO y sale 2', () => {
  const vacio = temporal('yaqu-524b-vacio-');
  const r = evaluarTabla({ raiz: vacio });
  assert.ok(r.ciego, 'sobre un árbol vacío el instrumento dio un veredicto');
  assert.equal(correrCli(vacio).status, 2);
});

test('SCRUM-524b · ⚫ CIEGO: con un src/ que no es el nuestro, no encuentra NINGUNA de las comprobadas y lo dice', () => {
  const ajeno = temporal('yaqu-524b-ajeno-');
  fs.mkdirSync(path.join(ajeno, 'src'));
  fs.writeFileSync(path.join(ajeno, 'src', 'otra-cosa.ts'), 'export const a = `<sum1:FacturasRectificadas>`;\n');
  const r = evaluarTabla({ raiz: ajeno });
  assert.equal(r.vivas.length, 0);
  assert.match(r.ciego ?? '', /ninguna de las \d+ comprobadas/);
  assert.equal(correrCli(ajeno).status, 2);
});
