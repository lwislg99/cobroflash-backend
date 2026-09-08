// tests/scrum705-cadena-tecnosel.test.mjs — LA CADENA DE TECNOSEL, RECORRIDA
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO EXISTE, Y NO ES UN DOCUMENTO MÁS
//
// El recorrido de Tecnosel se mide A MANO, salto a salto, y hay que rehacer ese documento cada vez
// que cambia algo. Un recorrido escrito es una FOTO: no impide que un eslabón se rompa, y cuando se
// rompe nadie se entera hasta que lo prueba una persona.
//
//     crear trabajo → asignar a varios → abrir el parte → dictar → firmar
//       → aparecer en «por valorar» → poner precios → verlos guardados
//
// ── 🔴 LO QUE VIGILA, Y NO ES «QUE LOS FICHEROS EXISTAN» ─────────────────────────────────
//
// El fallo que motiva este fichero es **PINTADO Y MUERTO**: una pantalla que se dibuja entera, con
// su botón, y **nadie escucha ese botón**. La suite pasa: el módulo existe, exporta, se registra en
// el índice y hasta se precachea. Y el profesional pulsa y no ocurre nada.
//
// Por eso cada eslabón del front declara TRES cosas:
//
//     pinta  →  el gancho que la pantalla dibuja
//     puerta →  la función PÚBLICA que el enrutador llama para abrir la pantalla
//     ata    →  la función que atiende ese gancho, y que tiene que estar LLAMADA en algún sitio
//
// 🔴 Y las dos últimas son preguntas DISTINTAS, que es lo que este fichero aprendió a golpes: un
// módulo bien hecho tiene UNA puerta pública y ata sus propios botones POR DENTRO. `app.js` llama a
// `renderParteDetailView`, y ésa ata el botón a `firmarParte` dentro del mismo fichero. Un detector
// que solo mirase «llamadores de fuera» daría los dos por muertos, y no lo están.
//
// Lo que sí está muerto es un gancho que se pinta y cuya función **no se llama en ninguna parte**.
//
// ⚠️ NINGUNA BASE DE DATOS. Los eslabones de servidor se comprueban sobre el árbol —la ruta está
// montada, declara su rol, y la regla que decide vive en el dominio— y los de pantalla ejecutando
// el módulo con dobles. Lo que se vigila es que la CADENA esté enganchada, no que un servidor
// conteste.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const existe = (p) => fs.existsSync(path.join(RAIZ, p));

/** Los `.js` del dashboard, para preguntar quién llama a qué. */
const MODULOS = fs.readdirSync(JS).filter((f) => f.endsWith('.js'));

/**
 * ¿Se LLAMA `nombre` en alguno de estos módulos?
 *
 * 🔴 CON LÍMITE DE PALABRA, siempre. Un prefijo no es un nombre: `window.renderParte` casa dentro
 * de `window.renderPartesOficinaView`, y esa colisión me dio un falso «tiene llamador» y luego un
 * falso «está muerto». En un producto los nombres parecidos son los relacionados, o sea los que más
 * se cruzan.
 *
 * Se lee el CÓDIGO, sin comentarios (`soloCodigo`, SCRUM-693): media cadena de este árbol se
 * menciona en las cabeceras que explican por qué existe, y un guard de texto se caza ahí.
 */
function seLlamaEn(nombre, ficheros) {
  const llamada = new RegExp(`\\b${nombre}\\s*\\(`);
  const porWindow = new RegExp(`window\\.${nombre}\\b(?!\\s*=)`);
  return ficheros.some((f) => {
    const codigo = soloCodigo(fs.readFileSync(path.join(JS, f), 'utf8'), f);
    return llamada.test(codigo) || porWindow.test(codigo);
  });
}

/** ¿Hay quien abra esta pantalla desde fuera? (la PUERTA) */
function tienePuerta(nombre, propio) {
  return seLlamaEn(nombre, MODULOS.filter((f) => f !== propio));
}

/**
 * ¿Está atado ese gancho? Vale que lo ate el propio módulo: es lo correcto.
 *
 * ⚠️ LO QUE ESTO **NO** VE, medido el 3-sep-2026: una llamada dentro de un `if (false)` sigue
 * siendo una llamada. Este guard mide que la función esté LLAMADA en el código, no que el botón
 * responda. Lo segundo lo mide `scrum683b` ejecutando la pantalla y PULSANDO el botón.
 *
 * Los dos hacen falta y ninguno sobra —es la misma pareja que los dos detectores de dinero de
 * SCRUM-652c—: quien retire «el que sobra» destapa el hueco del otro.
 */
function estaAtado(nombre, propio) {
  return seLlamaEn(nombre, [propio]) || tienePuerta(nombre, propio);
}

/**
 * 🔴 El CÓDIGO de un fuente del servidor, sin comentarios.
 *
 * Sin esto, comentar una línea la deja contando como si siguiera viva: `// mountAdmin(...)` es
 * texto, y un guard que busca texto lo da por montado. Medido — el primer rojo de este fichero NO
 * CAYÓ por eso, y la puerta de `/admin/partes` se podía quitar sin que nada se enterase.
 */
function codigoDe(ruta) {
  return soloCodigo(leer(ruta), path.basename(ruta));
}

/** ¿La pantalla dibuja ese gancho? Se mira en su código, no en sus comentarios. */
function pintaElGancho(fichero, gancho) {
  if (!existe(`public/dashboard/js/${fichero}`)) return false;
  return soloCodigo(leer(`public/dashboard/js/${fichero}`), fichero).includes(gancho);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA CADENA, SALTO A SALTO
// ═════════════════════════════════════════════════════════════════════════════════════════

const CADENA = [
  {
    salto: '1 · crear el trabajo',
    comprobar() {
      assert.ok(existe('src/modules/jobs/domain/trabajoDirecto.ts'), 'no existe el dominio del trabajo directo');
      assert.ok(/mountAdmin\(app, '\/admin\/jobs'/.test(codigoDe('src/app.ts')), '`/admin/jobs` no está montado');
    },
  },
  {
    salto: '2 · asignar a varios',
    pantalla: 'jobAsignados.js',
    // Esta pantalla no dibuja `data-…`: construye elementos con clase `job-asignados-*`. El
    // gancho es lo que de verdad pinta, no lo que uno esperaría que pintara.
    pinta: 'job-asignados-lista',
    puerta: 'construirSelectorAsignados',
    ata: 'construirSelectorAsignados',
    comprobar() {
      assert.ok(existe('public/dashboard/js/jobAsignados.js'), 'no existe la pantalla de asignados');
    },
  },
  {
    salto: '3 · abrir el parte',
    pantalla: 'parteDetailView.js',
    pinta: 'data-parte-bloque',
    // La PUERTA es `renderParteDetailView` (SCRUM-652 fase D): es la que llama `app.js`.
    // `renderParte` es su pieza de dentro, y medirla a ella daba un «muerto» falso.
    puerta: 'renderParteDetailView',
    ata: 'renderParte',
    comprobar() {
      assert.ok(/mountAdmin\(app, '\/admin\/partes'/.test(codigoDe('src/app.ts')), '`/admin/partes` no está montado');
    },
  },
  {
    salto: '4 · dictar',
    pantalla: 'parteDetailView.js',
    pinta: 'data-dictado-ordenar',
    puerta: 'renderParteDetailView',
    // 🔴 La que ATIENDE el botón es `ordenarElDictado`, no el alias `window.parteOrdenarDictado`.
    // Apuntar al alias dejaba el salto declarado muerto DESPUÉS de cablearlo: el trinquete inverso
    // no cantaba y la declaración habría envejecido mintiendo. Se mide la función, no su escaparate.
    ata: 'ordenarElDictado',
    comprobar() {
      const rutas = codigoDe('src/modules/jobs/app/routes/partes.routes.ts');
      assert.ok(rutas.includes("router.post('/:id/dictado'"), 'no existe la ruta del dictado');
      assert.ok(/\/admin\/partes\/:id\/dictado/.test(codigoDe('src/core/http/adminRouteDeclarations.ts')),
        'la ruta del dictado no declara su rol: el Operario no llegaría');
    },
  },
  {
    salto: '5 · firmar',
    pantalla: 'parteDetailView.js',
    pinta: 'data-parte-firmar',
    puerta: 'renderParteDetailView',
    ata: 'firmarParte',
    comprobar() {
      assert.ok(codigoDe('src/modules/jobs/app/routes/partes.routes.ts').includes("router.post('/:id/firmar'"),
        'no existe la ruta de firma del parte');
    },
  },
  {
    salto: '6 · aparecer en «por valorar»',
    pantalla: 'parteOficinaView.js',
    pinta: 'po-lista',
    puerta: 'renderPartesOficinaView',
    ata: 'renderPartesOficinaView',
    comprobar() {
      assert.ok(existe('public/dashboard/js/parteOficinaView.js'), 'no existe la pantalla de oficina');
    },
  },
  {
    salto: '7 · poner precios sobre un parte FIRMADO',
    comprobar() {
      const dominio = codigoDe('src/modules/jobs/domain/parteTrabajo.ts');
      assert.ok(dominio.includes('export function puedeEditarPrecios'), 'no existe la regla de precios');
      // Y la ruta la EJERCE: sin esto la regla existe y no cierra nada, que fue el defecto de la fila 5.
      assert.ok(codigoDe('src/modules/jobs/app/routes/partes.routes.ts').includes('puedeEditarPrecios'),
        'la ruta no usa `puedeEditarPrecios`: la regla existiría sin cerrar ninguna escritura');
    },
  },
  {
    salto: '8 · ver los precios guardados',
    comprobar() {
      const rutas = codigoDe('src/modules/jobs/app/routes/partes.routes.ts');
      assert.ok(/precioUnitario/.test(rutas),
        'la ruta no escribe ni lee `precioUnitario`: los precios no se guardarían');
    },
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TRINQUETE DE LO YA ROTO, con su motivo. NO se arregla aquí: se NOMBRA.
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// Medido el 3-sep-2026 y REMEDIDO tras el merge de la PR 942: queda UNO —la pantalla dibuja el botón y
// **nadie llama a la función que lo atendería**—. Se declaran para que el recorrido pueda entrar en
// verde y **el número no pueda crecer en silencio**, que es lo que este fichero viene a impedir.
//
// ⚠️ Uno de los tres es MÍO y de hoy (`parteOrdenarDictado`, SCRUM-683 cableado): el botón del
// dictado se pinta y no lo escucha nadie. No se arregla en este ticket porque el encargo dice que
// los hallazgos se NOMBRAN y los reparte el fundador.
//
// **La lista solo puede MENGUAR.** Si un salto se cablea, se borra de aquí en el mismo commit.
const MUERTOS_DECLARADOS = Object.freeze({
  // ✅ VACÍA desde el 3-sep-2026 (SCRUM-706): el último que quedaba —el botón «Ordenar en líneas»—
  // ya está atado en `renderParteDetailView`. **Los ocho saltos de la cadena están vivos.**
  //
  // Se deja el mecanismo aunque no tenga inquilinos: es lo que impide que el siguiente entre en
  // silencio. Una lista vacía aquí no es un adorno, es la afirmación de que hoy no hay ninguno.
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RECORRIDO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-705 · 🔴 SUELO: el recorrido ARRANCA — cero saltos recorridos es un instrumento roto', () => {
  assert.ok(CADENA.length >= 8, `🔴 la cadena declara ${CADENA.length} saltos y el recorrido tiene 8`);
  assert.ok(MODULOS.length >= 20,
    `🔴 CIEGO: solo veo ${MODULOS.length} módulos del dashboard. Si no se lee el árbol, «ningún ` +
    'eslabón roto» y «no supe mirar» dan el mismo verde.');

  let recorridos = 0;
  for (const paso of CADENA) { try { paso.comprobar(); } catch { /* roto, pero recorrido */ } recorridos += 1; }
  assert.equal(recorridos, CADENA.length,
    `🔴 CIEGO: solo se han podido recorrer ${recorridos} de ${CADENA.length} saltos. Ocho saltos y ` +
    'cero recorridos es un instrumento roto, no una cadena rota.');
});

test('SCRUM-705 · 🔴 LA CADENA NO SE ROMPE, y el rojo NOMBRA el salto', () => {
  const rotos = [];
  for (const paso of CADENA) {
    try { paso.comprobar(); } catch (e) { rotos.push(`${paso.salto} → ${e.message}`); }
  }
  assert.deepEqual(rotos, [],
    '🔴 LA CADENA DE TECNOSEL ESTÁ ROTA EN:\n    ' + rotos.join('\n    ') +
    '\n\n  El profesional no puede llegar del trabajo al cobro. Cada salto de arriba dice qué le ' +
    'falta; arreglar el que se nombra vuelve a unir el recorrido.');
});

test('SCRUM-705 · 🔴 PINTADO Y MUERTO: cada pantalla de la cadena tiene quien la escuche', () => {
  const muertos = [];
  const resucitados = [];

  for (const paso of CADENA) {
    if (!paso.pantalla) continue;

    // ① ¿dibuja su gancho? Si no, no hay ni botón que atender.
    assert.ok(pintaElGancho(paso.pantalla, paso.pinta),
      `🔴 ${paso.salto}: «${paso.pantalla}» ya no dibuja «${paso.pinta}». O se renombró el gancho —y ` +
      'entonces este recorrido está midiendo un fantasma— o la pantalla dejó de pintarlo.');

    // ② ¿la abre el enrutador? Una pantalla sin puerta no se ve nunca, por muy atada que esté.
    assert.ok(tienePuerta(paso.puerta, paso.pantalla),
      `🔴 ${paso.salto}: nadie llama a \`${paso.puerta}()\` desde fuera de «${paso.pantalla}». La ` +
      'pantalla no tiene puerta: el profesional no puede llegar a ella.');

    // ③ ¿está atado el gancho que pinta? Vale que lo ate el propio módulo — es lo correcto.
    const atado = estaAtado(paso.ata, paso.pantalla);
    const declarado = Object.prototype.hasOwnProperty.call(MUERTOS_DECLARADOS, paso.ata);

    if (!atado && !declarado) muertos.push(`${paso.salto} → nadie llama a \`${paso.ata}()\``);
    if (atado && declarado) resucitados.push(`${paso.salto} → \`${paso.ata}\` YA está atado`);
  }

  assert.deepEqual(muertos, [],
    '🔴 HAY PANTALLA PINTADA Y MUERTA EN LA CADENA:\n    ' + muertos.join('\n    ') +
    '\n\n  La pantalla se dibuja entera, con su botón, y NADIE escucha ese botón. Todo lo demás\n' +
    '  pasa —el módulo existe, exporta, se registra en el índice y se precachea— y el profesional\n' +
    '  pulsa y no ocurre nada. Si de verdad todavía no tiene cable, decláralo en\n' +
    '  `MUERTOS_DECLARADOS` con su motivo; esa lista solo puede MENGUAR.');

  // 🔴 EL TRINQUETE AL REVÉS: una declaración que ya no corresponde a nada deja la lista mintiendo,
  // y con ella un salto podría volver a morir sin que nadie lo viera.
  assert.deepEqual(resucitados, [],
    '🔴 ESTOS SALTOS YA ESTÁN CABLEADOS Y SIGUEN DECLARADOS COMO MUERTOS:\n    ' +
    resucitados.join('\n    ') + '\n\n  Bórralos de `MUERTOS_DECLARADOS` en el mismo commit que ' +
    'los cablea: una lista que no mengua deja de señalar lo que falta.');
});

test('SCRUM-705 · 🔴 CONTROL POSITIVO del detector: un gancho VIVO no se cuenta como muerto', () => {
  // `btnFirmarAqui` del albarán es el ejemplo medido de cable vivo: lo pinta `albaranDetailView.js`
  // y lo ata `albaranActionsRegistry.js`. Si el detector lo diera por muerto, su verde no valdría.
  assert.ok(tienePuerta('openSignaturePad', 'signaturePad.js'),
    '🔴 el detector da por muerto un cable que SÍ existe: entonces sus «muertos» no significan nada');

  // Y al revés: un nombre inventado no puede tener llamador.
  assert.ok(!tienePuerta('funcionQueNoExisteEnNingunSitio', 'app.js'),
    '🔴 el detector encuentra llamadores de algo que no existe: casa con cualquier cosa');
});

test('SCRUM-705 · 🔴 una declaración HUÉRFANA no puede esconderse', () => {
  // 🔴 EL AGUJERO QUE SE VIO AL CABLEAR EL SALTO 4, y es fino: el trinquete inverso comprueba
  // «declarado pero ya atado» recorriendo LOS SALTOS. Una declaración cuya clave no corresponde a
  // ningún `ata` de la cadena **no la mira nadie**: se queda ahí para siempre, diciendo que algo
  // está muerto cuando ni siquiera es algo que este recorrido vigile.
  //
  // Pasó de verdad: `ata` apuntaba al alias `parteOrdenarDictado` y no a `ordenarElDictado`, que
  // es la que atiende el botón. Al corregirlo, la declaración vieja quedó huérfana y el trinquete
  // se calló.
  const vigilados = new Set(CADENA.filter((p) => p.ata).map((p) => p.ata));
  const huerfanas = Object.keys(MUERTOS_DECLARADOS).filter((k) => !vigilados.has(k));
  assert.deepEqual(huerfanas, [],
    '🔴 ESTAS DECLARACIONES NO CORRESPONDEN A NINGÚN SALTO:\n    ' + huerfanas.join('\n    ') +
    '\n\n  Nadie las revisa nunca, así que envejecen mintiendo. O el salto cambió de función —y hay\n' +
    '  que actualizar su `ata`— o la declaración sobra y se borra.');
});

test('SCRUM-705 · los muertos declarados son EXACTAMENTE éstos, y la lista no puede crecer', () => {
  // Un tope escrito: añadir un cuarto obliga a decirlo aquí, y eso es una decisión, no un descuido.
  assert.equal(Object.keys(MUERTOS_DECLARADOS).length, 0,
    '🔴 la lista de pantallas muertas ha CAMBIADO de tamaño, y hoy está VACÍA: los ocho saltos ' +
    'están vivos. Si crece, alguien ha entregado una pantalla que se pinta y no responde — y eso ' +
    'es una decisión que se declara con su motivo, no un descuido que entra solo.');
  for (const [fn, motivo] of Object.entries(MUERTOS_DECLARADOS)) {
    assert.ok(motivo.includes('SCRUM-'), `🔴 «${fn}» se declara muerto sin decir de qué ticket viene`);
  }
});
