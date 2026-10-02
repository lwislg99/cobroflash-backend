// scripts/_reporters-de-node-options.mjs — SCRUM-1289b · LOS REPORTERS DE LA TANDA, FUERA DE `NODE_OPTIONS`.
//
// EL DEFECTO (SCRUM-1289, medido por S5 el 29-sep-2026): el CI pone los reporters de la tanda en
// `NODE_OPTIONS` (SCRUM-552). `NODE_OPTIONS` lo HEREDA todo proceso `node` que cuelgue de la tanda,
// así que un test que lanza su propio `node --test` (scrum976, scrum928, scrum850b…) arranca un
// segundo orquestador con los MISMOS reporters: abre `tanda.tap` TRUNCÁNDOLO y escribe su TAP desde
// el byte 0 mientras el padre sigue en su desplazamiento. Resultado: el TAP de TODAS las tandas,
// verdes incluidas, salía con un 94 % de NUL.
//
// Arreglarlo hijo a hijo (`delete env.NODE_OPTIONS`) es una carrera que se pierde con el siguiente
// test. Lo que lo quita de raíz es que los reporters NO lleguen a `NODE_OPTIONS` de nadie: el
// envoltorio (`tanda-con-veredicto.mjs`) los saca de ahí y se los pasa COMO ARGUMENTOS solo al
// `node --test` que lanza. Los argumentos no se heredan.
//
// ⚠️ Van JUSTO DETRÁS de `--test`, no al final: medido por S5, `node --test <ficheros> --test-reporter=…`
// ignora en silencio los reporters puestos detrás de los ficheros. Por eso tampoco se puede hacer
// desde `ci.yml`.

const REPORTER = /^--test-reporter(-destination)?(=|$)/;

/** Trocea `NODE_OPTIONS` como lo hace node: por espacios, respetando las comillas dobles. */
function trozos(texto) {
  return String(texto || '').match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

const sinComillas = (s) => s.replace(/"/g, '');

/**
 * Separa los `--test-reporter*` del resto. Acepta `--opcion=valor` y `--opcion valor`.
 * @returns {{ reporters: string[], resto: string }} `reporters` en el MISMO orden en que venían
 *   (el orden empareja cada reporter con su destino), ya en forma `--opcion=valor`.
 */
export function separarReporters(nodeOptions) {
  const t = trozos(nodeOptions);
  const reporters = [];
  const resto = [];
  for (let i = 0; i < t.length; i++) {
    const m = t[i].match(REPORTER);
    if (!m) { resto.push(t[i]); continue; }
    // Como ARGUMENTO no hay shell que quite las comillas: se quitan aquí, o el destino sería
    // literalmente `"C:/con espacio/t.tap"` con sus comillas.
    if (m[2] === '=') { reporters.push(sinComillas(t[i])); continue; }
    // `--test-reporter spec`: el valor es el trozo siguiente.
    const valor = t[i + 1];
    if (valor === undefined || valor.startsWith('--')) {
      // Sin valor no es algo que yo sepa mover: se deja donde estaba, y node dirá lo que tenga que decir.
      resto.push(t[i]);
      continue;
    }
    reporters.push(`${t[i]}=${sinComillas(valor)}`);
    i++;
  }
  return { reporters, resto: resto.join(' ') };
}

/**
 * Qué lanzar y con qué entorno. Solo actúa si la orden es un `node --test` (hay dónde meter los
 * reporters DELANTE de los ficheros); en cualquier otro caso devuelve lo que recibió, intacto.
 * @returns {{ args: string[], env: object, movidos: string[] }}
 */
export function reportersComoArgumentos(orden, args, env) {
  const i = orden === 'node' ? args.indexOf('--test') : -1;
  const { reporters, resto } = separarReporters(env.NODE_OPTIONS);
  if (i < 0 || reporters.length === 0) return { args, env, movidos: [] };
  const nuevoEnv = { ...env };
  if (resto) nuevoEnv.NODE_OPTIONS = resto;
  else delete nuevoEnv.NODE_OPTIONS;
  return { args: [...args.slice(0, i + 1), ...reporters, ...args.slice(i + 1)], env: nuevoEnv, movidos: reporters };
}
