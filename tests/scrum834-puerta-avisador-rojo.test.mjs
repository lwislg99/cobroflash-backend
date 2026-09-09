// SCRUM-834 — la puerta del avisador de PR en rojo.
//
// LOS DOS CONTROLES QUE PIDIÓ EL ENCARGO, y son dos por un motivo: «un guardia que nunca has
// visto decir NO no sabes si sabe decirlo». Así que se ejercen las dos direcciones —el rojo
// propio que SÍ despierta, y el fork que NO— y además se comprueba que el «no» viene con su
// código, no con silencio.
//
// SIN GATE: función pura + lectura de dos ficheros. Ni BD, ni red, ni servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir, esDeFork, cuerpoDespierta, cuerpoNoDebeDespertar, tocaCaminoFiscal, BOT } from '../scripts/puerta-avisador-rojo.mjs';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW = path.join(REPO, '.github', 'workflows', 'avisador-rojo.yml');
const CLAUDE_YML = path.join(REPO, '.github', 'workflows', 'claude.yml');

const NUESTRO = 'lwislg99/cobroflash-backend';
/** Un PR nuestro, abierto por el bot, con el CI en rojo y sin avisos previos. */
const base = {
  conclusionCI: 'failure',
  repoBase: NUESTRO,
  repoOrigen: NUESTRO,
  autor: BOT,
  permisoAutor: '',
  marcasPrevias: [],
  ficheros: ['public/dashboard/js/homeView.js'],
  marcaActual: 'abc1234:build + tests',
  tope: 3,
};

// ── CONTROL 1 · EL ROJO PROPIO DESPIERTA ───────────────────────────────────────────────────

test('CONTROL 1 · rojo en un PR NUESTRO abierto por el bot → AVISAR', () => {
  const r = decidir(base);
  assert.equal(r.avisar, true, 'si esto no despierta, el avisador no está hecho');
  assert.equal(r.codigo, 'AVISAR');
});

test('CONTROL 1b · también despierta si lo abrió una persona CON escritura', () => {
  const r = decidir({ ...base, autor: 'lwislg99', permisoAutor: 'admin' });
  assert.equal(r.avisar, true);
});

// ── CONTROL 2 · EL FORK NO DESPIERTA, Y LO DICE ────────────────────────────────────────────
// Es la condición sin la cual esto no se construye. `allowed_bots` desactiva la comprobación
// de permisos de la acción, y el repositorio es PÚBLICO: sin esta puerta, un desconocido
// podría despertar a Claude sobre un prompt que él controla.

test('CONTROL 2 · 🔴 PR de FORK con CI rojo → NO avisa, y lo DICE', () => {
  const r = decidir({ ...base, repoOrigen: 'desconocido/cobroflash-backend' });
  assert.equal(r.avisar, false, 'un PR de fork no despierta a Claude nunca');
  assert.equal(r.codigo, 'FORK-NO-DESPIERTA', 'el «no» tiene que venir con su código, no con silencio');
  assert.match(r.motivo, /fork/i);
});

test('CONTROL 2b · fork del MISMO dueño con otro nombre de repo → también fork', () => {
  // Se comparan nombres completos `owner/repo`: mirar solo el owner dejaría pasar un espejo.
  const r = decidir({ ...base, repoOrigen: 'lwislg99/otro-repo' });
  assert.equal(r.codigo, 'FORK-NO-DESPIERTA');
});

test('CONTROL 2c · `head.repo` a null (fork borrado) → se trata como fork', () => {
  assert.equal(esDeFork({ repoBase: NUESTRO, repoOrigen: null }), true);
  assert.equal(decidir({ ...base, repoOrigen: null }).codigo, 'FORK-NO-DESPIERTA');
});

// ── LA SEGUNDA MITAD DE LA PUERTA: EL PERMISO, PREGUNTADO OTRA VEZ ─────────────────────────

test('🔴 PR propio pero de una cuenta SIN escritura → no avisa', () => {
  const r = decidir({ ...base, autor: 'alguien', permisoAutor: 'read' });
  assert.equal(r.avisar, false);
  assert.equal(r.codigo, 'AUTOR-SIN-ESCRITURA');
});

test('🔴 permiso desconocido o vacío → no avisa (falla cerrado)', () => {
  assert.equal(decidir({ ...base, autor: 'x', permisoAutor: '' }).codigo, 'AUTOR-SIN-ESCRITURA');
  assert.equal(decidir({ ...base, autor: 'x', permisoAutor: 'triage' }).codigo, 'AUTOR-SIN-ESCRITURA');
});

// ── QUE NO AVISE DOS VECES, Y QUE EL BUCLE TENGA TOPE ──────────────────────────────────────

test('el MISMO rojo no se avisa dos veces', () => {
  const r = decidir({ ...base, marcasPrevias: ['abc1234:build + tests'] });
  assert.equal(r.avisar, false);
  assert.equal(r.codigo, 'YA-AVISADO');
});

test('un rojo NUEVO sobre un commit nuevo SÍ avisa (la marca lleva el sha dentro)', () => {
  const r = decidir({ ...base, marcasPrevias: ['abc1234:build + tests'], marcaActual: 'def5678:build + tests' });
  assert.equal(r.avisar, true, 'si no, un arreglo que falla otra vez no avisaría nunca');
});

test('🔴 el tope corta el bucle CI→aviso→push→CI', () => {
  const previas = ['a:x', 'b:y', 'c:z'];
  const r = decidir({ ...base, marcasPrevias: previas, marcaActual: 'd:w', tope: 3 });
  assert.equal(r.avisar, false);
  assert.equal(r.codigo, 'TOPE-ALCANZADO');
});

test('sin marca no se puede saber si ya se avisó → no se avisa', () => {
  assert.equal(decidir({ ...base, marcaActual: '' }).codigo, 'SIN-MARCA');
});

// ── Y QUE NO SE DISPARE CUANDO NO HAY ROJO ────────────────────────────────────────────────

test('CI verde → SIN-ROJOS (no es asunto del avisador)', () => {
  assert.equal(decidir({ ...base, conclusionCI: 'success' }).codigo, 'SIN-ROJOS');
});

test('CI cancelado no es un rojo', () => {
  assert.equal(decidir({ ...base, conclusionCI: 'cancelled' }).codigo, 'SIN-ROJOS');
});

// ── EL ESPEJO DE LA REGLA DEL VIGÍA ───────────────────────────────────────────────────────

test('🔴 un cuerpo SIN `@claude` no despierta a nadie: el avisador debe abortar', () => {
  assert.equal(cuerpoDespierta('El CI de este PR está en rojo.'), false,
    'sin esa cadena, claude.yml no dispara: el comentario saldría y no pasaría nada');
  assert.equal(cuerpoDespierta(''), false);
});

test('un cuerpo CON la mención sí despierta', () => {
  assert.equal(cuerpoDespierta('@claude el CI está en rojo'), true);
});

// ── QUE EL WORKFLOW SIGA USANDO ESTA PUERTA ───────────────────────────────────────────────
// Una puerta correcta que el workflow no invoca no protege de nada.

test('el workflow invoca la puerta y comprueba el cuerpo antes de publicar', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(yml, /puerta-avisador-rojo\.mjs/, 'el workflow debe llamar a la puerta');
  assert.match(yml, /cuerpoDespierta/, 'debe comprobar el cuerpo DENTRO del script, no en un README');
});

test('🔴 `allowed_bots` nombra al bot LITERAL y nunca un comodín', () => {
  const yml = fs.readFileSync(CLAUDE_YML, 'utf8');
  // Sin comentarios: la prosa que explica la prohibición escribe el comodín y se cazaría sola.
  const soloCodigo = yml.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(soloCodigo, /allowed_bots:\s*["']?yaqu-bot\[bot\]/,
    'sin allowed_bots el aviso se publica y no despierta a nadie');
  assert.ok(!/allowed_bots:\s*["']?\*/.test(soloCodigo),
    'JAMÁS el comodín: a los bots permitidos no se les comprueban los permisos, y el repo es público');
});

// ── EL CENSO CON MECANISMO ────────────────────────────────────────────────────────────────
// `allowed_bots` se pone sobre la IDENTIDAD `yaqu-bot[bot]`, no sobre un workflow: cualquier
// cosa que hable como ese bot puede despertar a Claude si su texto lleva la mención. Hoy son
// dos ficheros y los dos están cubiertos — pero el que escriba el tercero no va a saber que
// esta regla existe. Una prohibición sin mecanismo es una frase.

const DIR_WF = path.join(REPO, '.github', 'workflows');
const sinComentarios = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

/** Workflows que pueden HABLAR como el bot: los que acuñan el token de la App. */
function vozDelBot() {
  return fs.readdirSync(DIR_WF)
    .filter((f) => f.endsWith('.yml'))
    .filter((f) => sinComentarios(fs.readFileSync(path.join(DIR_WF, f), 'utf8'))
      .includes('create-github-app-token'));
}

test('SUELO del censo: encuentra a los que YA SABEMOS que hablan como el bot', () => {
  const censo = vozDelBot();
  // Si esto sale corto, el censo está ciego y todo lo de abajo mide sobre un conjunto falso.
  assert.ok(censo.includes('avisador-rojo.yml'), 'el avisador acuña token de App: el censo debe verlo');
  assert.ok(censo.includes('pr-automatico.yml'), 'pr-automatico acuña token de App: el censo debe verlo');
  assert.ok(censo.length >= 2, `censo demasiado corto (${censo.length}): está ciego`);
});

test('🔴 todo lo que habla como el bot pasa su texto por una de las dos comprobaciones', () => {
  // Sin comentarios: la prosa que explica la regla nombra las funciones y se cazaría sola.
  for (const f of vozDelBot()) {
    const codigo = sinComentarios(fs.readFileSync(path.join(DIR_WF, f), 'utf8'));
    const comprueba = /cuerpoDespierta|cuerpoNoDebeDespertar/.test(codigo);
    assert.ok(comprueba,
      `${f} habla como yaqu-bot[bot] y no comprueba su texto. O despierta a propósito ` +
      '(cuerpoDespierta) o se prohíbe despertar (cuerpoNoDebeDespertar), pero no puede ' +
      'quedar a merced de lo que traiga el texto.');
  }
});

test('el espejo es la negación exacta, no una comprobación parecida', () => {
  for (const c of ['@claude arregla esto', 'x @claude y', '@claude']) {
    assert.equal(cuerpoNoDebeDespertar(c), false, 'un texto que despierta NO es seguro');
    assert.equal(cuerpoDespierta(c), true);
  }
  for (const c of ['sin mención', '', 'claude sin arroba', 'correo@claudela.com']) {
    assert.equal(cuerpoNoDebeDespertar(c), !cuerpoDespierta(c), 'tienen que ser exactamente opuestas');
  }
});

// ── LA PUERTA FISCAL (SCRUM-834c) ─────────────────────────────────────────────────────────
// La regla 38 se les exige a las seis sesiones desde el primer día. Al robot no se le exigía,
// y desde que el avisador está vivo la cadena avisador → Claude → push se cierra SIN ninguna
// persona. En `verifactu.service` e `invoiceNumber.service` hay 28 piezas que se pueden
// romper con la tanda en VERDE. Un robot suelto ahí dentro es exactamente lo que no puede
// pasar.
//
// EL CONTROL QUE DECIDE ES EL NEGATIVO: un guardián que no has visto decir «no» no sabes si
// sabe decirlo.

const fiscal = { ...base, ficheros: ['src/modules/invoicing/domain/verifactu.service.ts'] };
const inocuo = { ...base, ficheros: ['public/dashboard/js/homeView.js', 'README.md'] };

test('🔴 CONTROL NEGATIVO · PR que toca verifactu.service → NO despierta y DICE ESCALADO-FISCAL', () => {
  const r = decidir(fiscal);
  assert.equal(r.avisar, false, 'un robot no toca el camino de emisión: lo mira una persona');
  assert.equal(r.codigo, 'ESCALADO-FISCAL', 'el «no» tiene que venir con su código, no con silencio');
  assert.match(r.motivo, /regla 38/);
});

test('las CUATRO rutas del alcance escalan', () => {
  for (const f of [
    'src/modules/invoicing/app/routes/invoices.routes.ts',
    'src/modules/invoicing/domain/verifactu.service.ts',
    'src/modules/invoicing/domain/invoiceNumber.service.ts',
    'prisma/schema.prisma',
  ]) {
    assert.equal(decidir({ ...base, ficheros: [f] }).codigo, 'ESCALADO-FISCAL', f);
  }
});

test('basta UN fichero fiscal entre muchos inocuos', () => {
  const r = decidir({ ...base, ficheros: ['README.md', 'public/x.js', 'prisma/schema.prisma'] });
  assert.equal(r.codigo, 'ESCALADO-FISCAL', 'no se mira la mayoría: se mira si hay alguno');
});

test('🔴 los dos .service siguen escalando si algún día los MUEVEN de invoicing/', () => {
  // La regla por nombre es redundante hoy y deja de serlo el día de la mudanza.
  const r = decidir({ ...base, ficheros: ['src/otro/sitio/verifactu.service.ts'] });
  assert.equal(r.codigo, 'ESCALADO-FISCAL');
});

test('🔴 sin lista de ficheros → escala (falla CERRADO)', () => {
  assert.equal(decidir({ ...base, ficheros: [] }).codigo, 'ESCALADO-FISCAL');
  assert.equal(decidir({ ...base, ficheros: undefined }).codigo, 'ESCALADO-FISCAL');
  assert.equal(tocaCaminoFiscal(null), true, 'no poder mirar no es haber mirado');
});

test('CONTROL POSITIVO de la puerta fiscal: un PR inocuo SÍ sigue despertando', () => {
  // La mitad que impide que «poner la puerta» acabe apagando el avisador entero.
  assert.equal(decidir(inocuo).avisar, true);
  assert.equal(decidir(inocuo).codigo, 'AVISAR');
});

test('el fork manda sobre lo fiscal: contenido de un desconocido es la razón más fuerte', () => {
  const r = decidir({ ...fiscal, repoOrigen: 'desconocido/cobroflash-backend' });
  assert.equal(r.codigo, 'FORK-NO-DESPIERTA');
});

test('el workflow le pasa a la puerta los ficheros del PR', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(yml, /pulls\/\$PR\/files|\/files/,
    'sin la lista de ficheros la puerta fiscal falla cerrado y NADA despertaría nunca');
  assert.match(yml, /ficheros/, 'y tiene que llegar a la puerta con ese nombre');
});
