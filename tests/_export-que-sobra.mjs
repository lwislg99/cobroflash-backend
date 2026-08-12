// tests/_export-que-sobra.mjs — SCRUM-494 · cuándo el `export` sobra, y qué hay que aconsejar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL PRINCIPIO, Y ES LO QUE HACE QUE ESTO SEA UN TICKET Y NO UNA NOTA
//
// **El mensaje de un guard no es documentación: es la instrucción que la siguiente persona va a
// ejecutar.** El trinquete de huérfanos (SCRUM-411) caza bien —cazó `metodoDeclarado` minutos
// después de nacer— pero aconseja DECLARARLO, y para aquél la respuesta correcta era **quitarle el
// `export`**. Un guard que caza bien y aconseja mal convierte su acierto en deuda: el fichero de
// declaraciones se llena de ayudantes de test y deja de señalar lo que importa.
//
// La DETECCIÓN no se toca. Lo que se arregla es el consejo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SON DOS EJES, NO UNO. Y ÉSTE ES EL SEGUNDO.
//
//   EJE 1 · POR QUÉ EXISTE   → `_huerfanos-declarados.mjs`, categorías declaradas A MANO. Es un
//                              juicio: motor en espera, vocabulario, especificación ejecutable…
//   EJE 2 · ¿SOBRA EL EXPORT? → esto. **Se mide, no se juzga.**
//
// Confundirlos fue el error del primer intento de este ticket: se colgó la sub-categoría del árbol
// de «por qué existe», donde no encajaba. Una categoría puede estar bien nombrada y colgar del
// sitio equivocado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL ORDEN DE LAS PREGUNTAS ES PARTE DE LA DEFINICIÓN
//
// CANON (decisión de los fundadores, 12-ago-2026): en una taxonomía, **lo que cumple dos criterios
// cae en el primero que se pregunte**. Por eso el orden vive en `ORDEN_DE_PREGUNTAS` como DATO y no
// en la secuencia de unos `if`: un orden que solo existe en el flujo de control es un orden que el
// siguiente refactor cambia sin enterarse. Hay un test que invierte el array y comprueba que la
// clasificación cambia — si no cambiara, el orden no significaría nada.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { grafoInterno } from './_huerfanos-en-modulos-vivos.mjs';

export const SUBCATEGORIA = 'EXPORTADO_SOLO_PARA_EL_TEST';

/**
 * 🔴 EL ORDEN, EXPLÍCITO. Se recorre en este orden y gana la primera que responda que sí.
 *
 * Cambiar el array cambia la clasificación, y eso es a propósito: así el orden se ve, se comenta y
 * se prueba, en vez de esconderse en la escalera de `if`.
 */
export const ORDEN_DE_PREGUNTAS = [
  {
    id: 'CON_PRODUCCION',
    pregunta: '¿lo importa algún fichero que NO es un test?',
    porQue: 'Va primero porque cierra el caso: si algo de producción lo importa, el `export` hace ' +
      'falta y no hay nada más que preguntar.',
  },
  {
    id: 'USO_INTERNO',
    pregunta: '¿lo usa alguna declaración de su propio módulo?',
    porQue: '🔴 Va ANTES que «¿lo consume su test?» por decisión de los fundadores (12-ago-2026): ' +
      'el uso interno es la explicación más fuerte de POR QUÉ existe el símbolo, y preguntarlo ' +
      'después mandaría a la casilla equivocada todo lo que es las dos cosas. Aquí es donde cae ' +
      '`metodoDeclarado`, que tenía uso interno (`campoPaidViaAlMarcar`) y solo su test lo importaba.',
  },
  {
    id: 'SOLO_SU_TEST',
    pregunta: '¿lo único que entra de fuera es un test?',
    porQue: 'Sin uso interno, un símbolo que solo toca su test suele ser un MOTOR ESPERANDO CABLE: ' +
      'su consumidor es la fase siguiente. Quitarle el `export` le cerraría la puerta, así que ' +
      'este grupo NO recibe el consejo de des-exportar.',
  },
  {
    id: 'SIN_NADIE',
    pregunta: 'no lo usa su módulo y no lo importa nadie, ni un test',
    porQue: 'El `export` no sirve a nadie, pero tampoco hay test que lo sostenga: el veredicto de ' +
      'por qué existe es del EJE 1, no de éste.',
  },
];

const rel = (raiz, p) => path.relative(raiz, p).split(path.sep).join('/');

function ficheros(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (/\.(ts|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * Índice: nombre → ficheros que lo IMPORTAN.
 *
 * ⚠️ Incluye el destructuring de un import dinámico (`const { x } = await import(…)`). Sin eso,
 * `sendQuoteEmail` parecería que no lo importa nadie — y sí lo importa una ruta.
 */
function indiceDeImportadores(raiz) {
  const out = new Map();
  for (const p of [...ficheros(path.join(raiz, 'src')), ...ficheros(path.join(raiz, 'tests'))]) {
    const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const anota = (n) => {
      if (!out.has(n)) out.set(n, new Set());
      out.get(n).add(rel(raiz, p));
    };
    const v = (n) => {
      if (ts.isImportDeclaration(n)) {
        const b = n.importClause?.namedBindings;
        if (b && ts.isNamedImports(b)) for (const el of b.elements) anota(el.propertyName?.text ?? el.name.text);
      }
      if (ts.isVariableDeclaration(n) && n.name && ts.isObjectBindingPattern(n.name)) {
        for (const el of n.name.elements) if (ts.isIdentifier(el.name)) anota(el.name.text);
      }
      ts.forEachChild(n, v);
    };
    ts.forEachChild(sf, v);
    if (!out.has('')) out.set('', new Set()); // marca de índice construido
  }
  return out;
}

const esTest = (f) => f.startsWith('tests/');

/**
 * EL CLASIFICADOR. Devuelve el grupo del EJE 2 y, si procede, la sub-categoría.
 *
 * `sobra === true` **solo** en `USO_INTERNO` + entra su test: el consumidor real está dentro, y lo
 * único que el `export` está sirviendo es al test.
 */
export function clasificador(raiz) {
  const indice = indiceDeImportadores(raiz);
  const cacheGrafo = new Map();
  const usoInterno = (moduloRel, nombre) => {
    if (!cacheGrafo.has(moduloRel)) cacheGrafo.set(moduloRel, grafoInterno(path.join(raiz, moduloRel)));
    for (const [de, usa] of cacheGrafo.get(moduloRel)) if (de !== nombre && usa.has(nombre)) return true;
    return false;
  };

  /** @param orden — se puede pasar invertido A PROPÓSITO, para probar que el orden manda. */
  return function clasificar(moduloRel, nombre, orden = ORDEN_DE_PREGUNTAS) {
    const fuera = [...(indice.get(nombre) ?? [])].filter((f) => f !== moduloRel);
    const tests = fuera.filter(esTest);
    const produccion = fuera.filter((f) => !esTest(f));
    const dentro = usoInterno(moduloRel, nombre);

    const responde = {
      CON_PRODUCCION: () => produccion.length > 0,
      USO_INTERNO: () => dentro,
      SOLO_SU_TEST: () => tests.length > 0,
      SIN_NADIE: () => true,
    };
    // 🔴 Gana la PRIMERA que responda que sí. El orden es el del array, y por eso es un dato.
    const grupo = (orden.find((q) => responde[q.id]()) ?? { id: 'SIN_NADIE' }).id;

    // La sub-categoría cuelga de USO_INTERNO y solo de ahí.
    const subcategoria = grupo === 'USO_INTERNO' && tests.length > 0 ? SUBCATEGORIA : null;
    return { modulo: moduloRel, nombre, grupo, subcategoria, tests, produccion, usoInterno: dentro, sobra: subcategoria !== null };
  };
}

/** El censo sobre una lista de pares `modulo::nombre` (los huérfanos declarados). */
export function censar(raiz, pares) {
  const clasificar = clasificador(raiz);
  const filas = [];
  for (const k of pares) {
    const [modulo, nombre] = k.split('::');
    filas.push(clasificar(modulo, nombre));
  }
  const porGrupo = {};
  for (const f of filas) porGrupo[f.grupo] = (porGrupo[f.grupo] ?? 0) + 1;
  return {
    total: filas.length,
    porGrupo,
    sobran: filas.filter((f) => f.sobra),
    filas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CONSEJO — lo que la siguiente persona va a ejecutar
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Y NO SE QUEDA EN «QUÍTALE EL `export`».
 *
 * Un consejo que manda des-exportar sin decir CÓMO se sigue probando manda a la siguiente persona a
 * un callejón: quitas el `export` y el test deja de compilar. El patrón que lo hace posible ya
 * existe en la casa y lo escribió quien resolvió `metodoDeclarado` —
 * `tests/scrum441-metodo-declarado.test.mjs` declara en su cabecera que **mide por la SUPERFICIE
 * PÚBLICA**— pero no está en ninguna guía. Aquí va, en el sitio donde alguien lo va a leer.
 */
export function consejoPara(fila) {
  if (fila.sobra) {
    return `QUÍTALE EL \`export\` a \`${fila.nombre}\`. No hace falta declararlo: su consumidor real ` +
      `ya está DENTRO de \`${fila.modulo}\`, y de fuera solo entra su test ` +
      `(${fila.tests.join(', ')}). El \`export\` no le está sirviendo a nadie más.\n` +
      '     CÓMO se sigue probando sin él: midiendo por la SUPERFICIE PÚBLICA — el patrón está en ' +
      '`tests/scrum441-metodo-declarado.test.mjs`, que lo declara en su cabecera. Se prueba el ' +
      'export que sí tiene consumidor y el de dentro queda cubierto por él.';
  }
  if (fila.grupo === 'SOLO_SU_TEST') {
    return `DECLÁRALO en \`_huerfanos-declarados.mjs\`. NO le quites el \`export\`: nadie lo usa dentro ` +
      'de su módulo, así que suele ser un MOTOR ESPERANDO CABLE y des-exportarlo le cerraría la puerta.';
  }
  return 'DECLÁRALO en `_huerfanos-declarados.mjs` con su categoría y su motivo.';
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA AUTOPRUEBA — sobre fuente sintética, ANTES de creerse ningún número
//
//   · `AYUDA`      uso interno + solo su test         → CAE en la sub-categoría
//   · `COMPARTIDA` uso interno + importador de PRODUCCIÓN → NO cae (el `export` hace falta)
//   · `ESPERANDO`  SIN uso interno + solo su test     → NO cae (motor esperando cable)
//   · `NADIE`      sin uso interno y sin importador   → NO cae
//
// Y la autoprueba DEL ORDEN: `AYUDA` cumple DOS criterios (uso interno y solo su test). Con el
// orden canónico cae en `USO_INTERNO`; invirtiendo las dos preguntas cae en `SOLO_SU_TEST`. Si no
// cambiara, el orden no sería parte de la definición.
// ─────────────────────────────────────────────────────────────────────────────────────────

const FUENTE = {
  'package.json': '{ "name": "sintetico", "scripts": {} }\n',
  'src/index.ts': `import { arrancar } from './app';\narrancar();\n`,
  'src/app.ts': `import { rutaViva } from './modules/x/x.routes';\nexport function arrancar() { return rutaViva(); }\n`,
  'src/modules/x/x.routes.ts':
    `import { motorVivo } from './domain/motor';\n` +
    `import { COMPARTIDA } from './domain/motor';\n` +
    `export function rutaViva() { return motorVivo() + COMPARTIDA; }\n`,
  'src/modules/x/domain/motor.ts':
    `export const AYUDA = 7;\n` +
    `export const COMPARTIDA = 9;\n` +
    `export const ESPERANDO = 11;\n` +
    `export const NADIE = 13;\n` +
    `export function motorVivo() { return AYUDA + COMPARTIDA; }\n`,
  'tests/motor.test.mjs':
    `import { AYUDA, ESPERANDO } from '../src/modules/x/domain/motor';\n` +
    `console.log(AYUDA, ESPERANDO);\n`,
};

export function escribirFuenteSintetica() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum494-'));
  for (const [r, c] of Object.entries(FUENTE)) {
    const destino = path.join(raiz, r);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, c);
  }
  return raiz;
}

export function autoprueba() {
  const raiz = escribirFuenteSintetica();
  try {
    const clasificar = clasificador(raiz);
    const M = 'src/modules/x/domain/motor.ts';
    const canon = (n) => clasificar(M, n);

    // El orden INVERTIDO: se preguntan «solo su test» antes que «uso interno».
    const invertido = [
      ORDEN_DE_PREGUNTAS[0],
      ORDEN_DE_PREGUNTAS[2],
      ORDEN_DE_PREGUNTAS[1],
      ORDEN_DE_PREGUNTAS[3],
    ];

    return {
      // ¿el discriminante separa los cuatro casos?
      caeElQueSobra: canon('AYUDA').sobra === true && canon('AYUDA').subcategoria === SUBCATEGORIA,
      noCaeElDeProduccion: canon('COMPARTIDA').sobra === false && canon('COMPARTIDA').grupo === 'CON_PRODUCCION',
      noCaeElMotorEnEspera: canon('ESPERANDO').sobra === false && canon('ESPERANDO').grupo === 'SOLO_SU_TEST',
      noCaeElQueNoUsaNadie: canon('NADIE').sobra === false && canon('NADIE').grupo === 'SIN_NADIE',
      // 🔴 ¿manda el orden?
      conOrdenCanonico: canon('AYUDA').grupo,
      conOrdenInvertido: clasificar(M, 'AYUDA', invertido).grupo,
      elOrdenMandaDeVerdad: canon('AYUDA').grupo !== clasificar(M, 'AYUDA', invertido).grupo,
      // y el consejo, que es lo que se ejecuta
      consejoDelQueSobra: consejoPara(canon('AYUDA')),
      consejoDelMotor: consejoPara(canon('ESPERANDO')),
    };
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
}
