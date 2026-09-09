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
import { decidir, esDeFork, cuerpoDespierta, cuerpoNoDebeDespertar, tocaCaminoFiscal, censarModulos, MODULOS_FISCALES, RUTAS_FISCALES, BOT } from '../scripts/puerta-avisador-rojo.mjs';

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

/** De los que hablan como el bot, los que además COMPONEN el texto en el propio YAML. */
function componeTexto(f) {
  const codigo = sinComentarios(fs.readFileSync(path.join(DIR_WF, f), 'utf8'));
  return /--body|body=@/.test(codigo);
}

test('🔴 todo lo que habla como el bot Y COMPONE TEXTO pasa ese texto por una comprobación', () => {
  // La distinción importa y la trajo el cambio de token de `claude.yml`: ese workflow habla
  // como el bot pero NO compone ningún cuerpo — el texto lo escribe el agente en tiempo de
  // ejecución, y el YAML no tiene nada que inspeccionar. Exigirle la comprobación sería pedir
  // que revise un texto que no existe cuando el workflow corre.
  //
  // ⚠️ Eso NO quiere decir que ese camino esté protegido: ver el test siguiente.
  for (const f of vozDelBot().filter(componeTexto)) {
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

// ── EL TOPE DEL BUCLE, SIMULADO DE VERDAD (SCRUM-834d) ────────────────────────────────────
//
// POR QUÉ ESTE CONTROL EXISTE, y por qué NO basta con la dedupe. El bucle que da miedo es:
//
//     CI rojo → el avisador despierta a Claude → Claude EMPUJA → CI corre → rojo → …
//
// La dedupe NO lo para, y esto es lo importante: es por `head_sha`, y CADA PUSH CREA UN SHA
// NUEVO. Así que `YA-AVISADO` no salta ni una sola vez en un bucle real. Lo único que hay
// debajo es el TOPE por PR, que cuenta AVISOS PUBLICADOS —no avisos coincidentes—, y por eso
// sí sobrevive a que cambie el sha.
//
// Esto se vuelve crítico el día que `claude.yml` empuje con la llave de la App: hasta hoy sus
// pushes no disparaban CI (medido: `check-runs total: 0` sobre `faebb1e6`), así que el ciclo
// se cortaba solo por avería. Cuando eso se arregle, el tope será lo ÚNICO que lo pare.

/**
 * Simula N ciclos rojos sobre el MISMO PR, como los ejecutaría el workflow:
 * cada ciclo trae un `head_sha` distinto, y cada aviso publicado deja su marca en el PR
 * —que es de donde el workflow lee `marcasPrevias` en la pasada siguiente—.
 */
function simularCiclos(n, tope = 3) {
  const marcasPrevias = [];
  const historia = [];
  for (let i = 1; i <= n; i++) {
    const marcaActual = `sha${String(i).padStart(4, '0')}:build + tests`; // sha NUEVO cada vez
    const r = decidir({ ...base, marcasPrevias: [...marcasPrevias], marcaActual, tope });
    historia.push(r.codigo);
    if (r.avisar) marcasPrevias.push(marcaActual); // el aviso publicado deja su marca
  }
  return { historia, publicados: marcasPrevias.length };
}

test('🔴 EL CONTROL DEL BUCLE · diez ciclos rojos seguidos y el avisador se PARA en el tope', () => {
  const { historia, publicados } = simularCiclos(10, 3);
  assert.equal(publicados, 3, 'se publican exactamente `tope` avisos y ni uno más');
  assert.deepEqual(historia.slice(0, 3), ['AVISAR', 'AVISAR', 'AVISAR']);
  assert.deepEqual(
    [...new Set(historia.slice(3))], ['TOPE-ALCANZADO'],
    'del cuarto ciclo en adelante NO se despierta a nadie, y siempre con el mismo veredicto',
  );
});

test('🔴 y la DEDUPE no salva de nada aquí: nunca llega a saltar', () => {
  // Es el punto que hace falta entender: con un sha nuevo por push, `YA-AVISADO` no aparece.
  const { historia } = simularCiclos(10, 3);
  assert.ok(!historia.includes('YA-AVISADO'),
    'si esto fallara, el tope estaría descansando sobre la dedupe, que en un bucle real no actúa');
});

test('la dedupe SÍ actúa cuando el sha NO cambia (rearranque del mismo CI)', () => {
  // El otro caso, que también existe: el mismo rojo re-evaluado sin push por medio.
  const marca = 'shaigual:build + tests';
  const r = decidir({ ...base, marcasPrevias: [marca], marcaActual: marca });
  assert.equal(r.codigo, 'YA-AVISADO');
});

test('el tope cuenta AVISOS PUBLICADOS, no coincidencias: por eso sobrevive al cambio de sha', () => {
  const r = decidir({ ...base, marcasPrevias: ['a:x', 'b:y', 'c:z'], marcaActual: 'd:w', tope: 3 });
  assert.equal(r.codigo, 'TOPE-ALCANZADO');
  assert.match(r.motivo, /para el bucle/);
});

test('🔴 el veredicto del tope se LEE sin abrir logs: sale al resumen del run', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  // El camino de «no avisar» escribe el CÓDIGO en el resumen, sea cual sea — incluido el tope.
  assert.match(yml, /\$CODIGO\*\* — \$MOTIVO/,
    'sin esta línea, TOPE-ALCANZADO solo existiría en el log y nadie lo vería');
  assert.match(yml, /GITHUB_STEP_SUMMARY/);
});

test('🔴 claude.yml empuja con la llave de la App, no con el token por defecto', () => {
  // Sin esto, TODO commit que Claude empuje produce un PR que no puede mergearse jamás:
  // los eventos del GITHUB_TOKEN no crean ejecuciones, así que no hay CI, no hay check
  // obligatorio, y el auto-merge espera para siempre. Medido en el #1212 (check-runs: 0).
  const yml = fs.readFileSync(CLAUDE_YML, 'utf8');
  const soloCodigo = yml.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(soloCodigo, /create-github-app-token/,
    'claude.yml tiene que acuñar el token de la App');
  assert.match(soloCodigo, /github_token:\s*\$\{\{\s*steps\.token\.outputs\.token/,
    'y pasárselo a la acción por `github_token`, que es lo que usa para empujar');
});

test('🔴 EL HUECO QUE DEJA ABIERTO EL CAMBIO DE TOKEN, escrito para que no se olvide', () => {
  // Con la llave de la App, los comentarios que publica la acción salen como `yaqu-bot[bot]`
  // — que ES quien está en `allowed_bots`. Antes salían como `claude[bot]`, que no lo está.
  //
  // Hoy eso no cierra ningún bucle, y está MEDIDO: el 9-sep, el run 12 de claude.yml disparado
  // por `claude[bot]` salió `skipped`. Skipped significa que el `if` a nivel de job dio falso,
  // o sea que el CUERPO no llevaba la mención. No fue la puerta de actores: fue el texto.
  //
  // Pero es una propiedad de HOY, y si una versión de la acción cambia su texto de respuesta,
  // Claude se despierta a sí mismo. Y el TOPE DEL AVISADOR NO CUBRE ESE CAMINO: cuenta marcas
  // `avisador-rojo`, y una autorrespuesta no lleva ninguna.
  //
  // Este test no lo impide —no hay dónde ponerle la puerta— pero fija las dos condiciones que
  // lo mantienen cerrado, para que quien las cambie vea que existían.
  const yml = fs.readFileSync(CLAUDE_YML, 'utf8');
  const soloCodigo = yml.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(soloCodigo, /allowed_bots:\s*["']?yaqu-bot\[bot\]/,
    'condición 1: la lista de bots permitidos es explícita y de un solo nombre');
  assert.match(soloCodigo, /if:\s*contains\(github\.event\.comment\.body,\s*'@claude'\)/,
    'condición 2: el disparo depende de que el CUERPO lleve la mención — si la acción empieza '
    + 'a escribirla en sus respuestas, esto se convierte en un bucle sin tope');
});

// ── EL AGUJERO DE LA LISTA A MANO, Y SU CENSO (SCRUM-834e) ────────────────────────────────
// La puerta fiscal dejaba pasar src/modules/fiscal/ ENTERO: 20 de 20 ficheros. Ahi viven la
// huella de VeriFactu, los libros de la AEAT, el modelo 303 y el atestiguamiento. Los 20
// nombres van DENTRO del test a proposito: un control que dice «los del modulo» no prueba
// nada el dia que el modulo cambie de forma.
const LOS_20_DE_FISCAL = [
  'src/modules/fiscal/evidencias/atestiguamiento.ts',
  'src/modules/fiscal/evidencias/evidencias.routes.ts',
  'src/modules/fiscal/evidencias/paquete.repo.ts',
  'src/modules/fiscal/evidencias/paquete.ts',
  'src/modules/fiscal/librosAeat/librosAeat.repo.ts',
  'src/modules/fiscal/librosAeat/librosAeat.routes.ts',
  'src/modules/fiscal/librosAeat/librosAeat.ts',
  'src/modules/fiscal/librosAeat/librosAeatCsv.ts',
  'src/modules/fiscal/modelo303/casillas.ts',
  'src/modules/fiscal/modelo303/modelo303.repo.ts',
  'src/modules/fiscal/modelo303/modelo303.routes.ts',
  'src/modules/fiscal/modelo303/modelo303.ts',
  'src/modules/fiscal/verifactu/productor.ts',
  'src/modules/fiscal/verifactu/registro.builder.ts',
  'src/modules/fiscal/verifactu/xsd/ConsultaLR.xsd',
  'src/modules/fiscal/verifactu/xsd/RespuestaConsultaLR.xsd',
  'src/modules/fiscal/verifactu/xsd/RespuestaSuministro.xsd',
  'src/modules/fiscal/verifactu/xsd/SuministroInformacion.xsd',
  'src/modules/fiscal/verifactu/xsd/SuministroLR.xsd',
  'src/modules/fiscal/verifactu/xsd/xmldsig-core-schema.xsd',
];

test('🔴 los 20 ficheros de src/modules/fiscal/ escalan, uno por uno', () => {
  assert.equal(LOS_20_DE_FISCAL.length, 20, "el control mide 20 ficheros, ni mas ni menos");
  for (const f of LOS_20_DE_FISCAL) {
    assert.equal(decidir({ ...base, ficheros: [f] }).codigo, "ESCALADO-FISCAL", f);
  }
});

test('🔴 EL SUELO DEL CENSO: ningún módulo del árbol se queda sin clasificar', () => {
  // Es la mitad que impide que esto se repita. `fiscal/` existía y nadie lo había clasificado
  // ni como fiscal ni como no-fiscal: simplemente no estaba, y por eso pasaba.
  const dirModulos = path.join(REPO, 'src', 'modules');
  const enElArbol = fs.readdirSync(dirModulos, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name);
  assert.ok(enElArbol.length >= 20, `suelo: solo ${enElArbol.length} módulos, el censo mide sobre poco`);

  const sinClasificar = censarModulos(enElArbol);
  assert.deepEqual(sinClasificar, [],
    `hay módulos sin clasificar: ${sinClasificar.join(', ')}. Cada uno tiene que ir a `
    + 'MODULOS_FISCALES o a MODULOS_NO_FISCALES, y meterlo en la segunda es AFIRMAR que un '
    + 'robot puede tocarlo sin que lo mire una persona.');
});

test('🔴 un módulo NUEVO sin clasificar se trata como fiscal, no como inocuo', () => {
  // La mitad viva del censo: no espera a la tanda para protegerse.
  assert.equal(tocaCaminoFiscal(['src/modules/moduloQueNadieHaClasificado/x.ts']), true);
  assert.equal(decidir({ ...base, ficheros: ['src/modules/inventado/a.ts'] }).codigo, 'ESCALADO-FISCAL');
});

test('el censo detecta lo que le falta, no solo lo que tiene', () => {
  assert.deepEqual(censarModulos(['fiscal', 'invoicing', 'auth']), []);
  assert.deepEqual(censarModulos(['fiscal', 'nuevoModulo']), ['nuevoModulo']);
});

test('y un módulo declarado NO fiscal sigue sin escalar', () => {
  // Si todo escalara, el avisador no despertaría nunca y habríamos apagado el aparato.
  assert.equal(decidir({ ...base, ficheros: ['src/modules/quotes/app/routes/quotes.routes.ts'] }).avisar, true);
});

test('las rutas se DERIVAN de los módulos fiscales, no se repiten a mano', () => {
  for (const m of MODULOS_FISCALES) {
    assert.ok(RUTAS_FISCALES.includes(`src/modules/${m}/`), `falta la ruta derivada de ${m}`);
  }
});
