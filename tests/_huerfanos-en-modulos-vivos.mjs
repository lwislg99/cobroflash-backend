// tests/_huerfanos-en-modulos-vivos.mjs — SCRUM-411 · LA SEGUNDA POBLACIÓN.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ POBLACIÓN ES ÉSTA, Y POR QUÉ NO LA VE EL TRINQUETE QUE YA HABÍA
//
// `tests/scrum411-exports-inalcanzables.test.mjs` vigila MÓDULOS enteros que nadie alcanza: hoy 8,
// con tope. Pero un módulo está «vivo» en cuanto **uno solo** de sus exports tiene llamador — y
// dentro de un módulo vivo puede haber funciones que no llama nadie. Ésa es **la otra población**:
// hoy **190 exports huérfanos dentro de 66 módulos vivos**, y no la vigilaba nadie.
//
// 🔴 LA VÍCTIMA, para que no se lea como higiene: `system/domain/borradoMerchant.ts → borrarMerchant`
// no lo llama nadie, su ticket RGPD (SCRUM-244) está CERRADO, **y la página de privacidad promete
// que un profesional puede pedir que le borren la cuenta.** Estuvo meses así. Lo encontró un censo
// lanzado a mano buscando otra cosa. El instrumento no falló: esa población no era suya.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTO NO ES UN TOPE NUMÉRICO, QUE ES EL TICKET ENTERO
//
// «No más de 190» NO SIRVE. En una base viva se escribe un export antes que su consumidor
// constantemente, así que un tope o bloquea trabajo legítimo o se sube sin mirar hasta que deja de
// significar nada. Lo que hace falta es lo que 411 ya hace con los módulos: **que un huérfano NUEVO
// TENGA QUE DECLARARSE, con su fecha y su motivo.** El número no es el guard; el guard es que nadie
// entre en esta población **en silencio**. Las declaraciones viven en
// `tests/_huerfanos-declarados.mjs` y el trinquete las compara en
// `tests/scrum411-exports-inalcanzables.test.mjs`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// NO SE TOCA `_alcance-dominio.mjs`
//
// Es el instrumento de la primera población y es bueno: alcanzabilidad por EXPORT, entradas reales,
// `tests/` fuera. Aquí se **reutiliza** y se le añade lo que a esta población le falta —la LÍNEA de
// cada huérfano, para poder nombrarlo; y dos señales que separan «el export sobra» de «esto no lo
// ejecuta nadie»—. Se AÑADE una población, no se cambia la que hay.
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analizar } from './_alcance-dominio.mjs';

export const clave = (modulo, nombre) => `${modulo}::${nombre}`;

const leer = (ruta, codigo) =>
  ts.createSourceFile(ruta, codigo ?? fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/**
 * Línea (1-indexada) de la declaración de cada nombre de nivel superior.
 *
 * ⚠️ Por AST y no por `grep`: un guard que dice «huérfano nuevo» sin nombrar fichero **y línea**
 * obliga a buscarlo a mano, y un guard que cuesta de atender se acaba desactivando. Y una regex
 * sobre `export const X` falla con los `export const A = 1, B = 2` y con las declaraciones que
 * arrancan en otra línea que su nombre.
 */
export function lineasDeDeclaracion(ruta, codigo = null) {
  const sf = leer(ruta, codigo);
  const out = new Map();
  const marcar = (nodo) => out.set(nodo.text, sf.getLineAndCharacterOfPosition(nodo.getStart()).line + 1);
  const v = (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) marcar(n.name);
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) marcar(n.name);
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  return out;
}

/**
 * El grafo de llamadas DENTRO de un fichero: qué nombres de nivel superior menciona el cuerpo de
 * cada nombre de nivel superior.
 *
 * Hace falta porque «tiene hermanos vivos» NO significa «lo alcanzan». Un módulo con 14 exports y
 * uno solo cableado puede tener 13 funciones que no ejecuta nadie, y ésa es justo la diferencia
 * entre «el `export` sobra» y «esto no lo corre nadie».
 */
export function grafoInterno(ruta, codigo = null) {
  const sf = leer(ruta, codigo);
  const cuerpos = new Map();   // nombre de nivel superior → nodo cuyo cuerpo se mira
  const declarados = new Set();
  const registrar = (nombre, nodo) => { declarados.add(nombre); cuerpos.set(nombre, nodo); };
  const v = (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) registrar(n.name.text, n);
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) registrar(n.name.text, n.initializer ?? n);
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);

  const aristas = new Map();
  for (const [nombre, nodo] of cuerpos) {
    const usa = new Set();
    const w = (n) => {
      if (ts.isIdentifier(n) && declarados.has(n.text) && n.text !== nombre) {
        const p = n.parent;
        // `obj.x` y `{ x: … }` no son usos del nombre de nivel superior `x`.
        const esMiembro = p && ts.isPropertyAccessExpression(p) && p.name === n;
        const esClave = p && (ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) && p.name === n;
        const esSuPropiaDecl = p && (ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p)) && p.name === n;
        if (!esMiembro && !esClave && !esSuPropiaDecl) usa.add(n.text);
      }
      ts.forEachChild(n, w);
    };
    ts.forEachChild(nodo, w);
    aristas.set(nombre, usa);
  }
  return aristas;
}

/** Qué nombres de nivel superior se alcanzan, dentro del fichero, partiendo de `semillas`. */
export function alcanceInterno(aristas, semillas) {
  const visto = new Set();
  const pila = [...semillas];
  while (pila.length) {
    const n = pila.pop();
    if (visto.has(n)) continue;
    visto.add(n);
    for (const q of aristas.get(n) ?? []) pila.push(q);
  }
  return visto;
}

/**
 * EL CENSO de la segunda población.
 *
 * Devuelve una fila por export huérfano de un módulo VIVO, con:
 *   · `linea`            — para poder nombrarlo cuando el trinquete caiga
 *   · `loEjecutaAlguien` — si algún export VIVO del mismo fichero lo alcanza por el grafo interno.
 *                          `false` = **nada de lo que corre en producción pasa por aquí.**
 *   · `hermanosVivos`    — cuántos exports del mismo módulo sí tienen llamador
 *
 * `sinSrc` se propaga tal cual: sin árbol que mirar, esto NO devuelve un cero mudo (ver el SUELO
 * del test — «cero» y «no supe mirar» nunca son el mismo número).
 */
export function censar(raiz) {
  const R = analizar(raiz);
  if (R.sinSrc) return { sinSrc: true, total: 0, modulosConHuerfanos: 0, filas: [] };

  const filas = [];
  for (const m of R.modulos) {
    if (m.inalcanzable || m.huerfanos.length === 0) continue;
    const abs = path.join(raiz, m.modulo);
    const lineas = lineasDeDeclaracion(abs);
    const vivos = m.exports.filter((e) => !m.huerfanos.includes(e));
    const alcanzados = alcanceInterno(grafoInterno(abs), vivos);
    for (const nombre of m.huerfanos) {
      filas.push({
        modulo: m.modulo,
        nombre,
        linea: lineas.get(nombre) ?? 0,
        loEjecutaAlguien: alcanzados.has(nombre),
        hermanosVivos: vivos.length,
      });
    }
  }
  filas.sort((a, b) => clave(a.modulo, a.nombre).localeCompare(clave(b.modulo, b.nombre)));
  return {
    sinSrc: false,
    total: filas.length,
    modulosConHuerfanos: new Set(filas.map((f) => f.modulo)).size,
    filas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA AUTOPRUEBA — el detector se prueba a sí mismo ANTES de que nadie se crea su número
//
// Un censo que solo se mide contra el repo real no puede distinguir «no hay huérfanos nuevos» de
// «me he quedado ciego»: las dos cosas salen como una lista que no crece. Así que antes de creerse
// el 190 se construye un árbol SINTÉTICO en disco con la respuesta conocida de antemano:
//
//   index.ts → app.ts → x.routes.ts → domain/motor.ts → domain/ayuda.ts
//
//   · `motorVivo`      lo importa la ruta            → NO debe salir
//   · `ayudaIndirecta` lo importa `motor.ts`, que a su vez es alcanzable → 🔴 LLAMADA INDIRECTA,
//                      a través de otro módulo: NO debe salir. Aquí es donde se equivoca un
//                      detector ingenuo que solo mire «¿lo importa una ruta?».
//   · `motorHuerfano`  no lo importa nadie           → SÍ debe salir, y con su línea
//   · `SEMILLA`        no lo importa nadie, pero `motorVivo` lo usa dentro del fichero → SÍ sale,
//                      con `loEjecutaAlguien: true`. Es la señal que separa «el `export` sobra» de
//                      «esto no lo corre nadie», y sin este caso no estaría probada.
// ─────────────────────────────────────────────────────────────────────────────────────────

const FUENTE_SINTETICA = {
  'package.json': '{ "name": "sintetico", "scripts": {} }\n',
  'src/index.ts': `import { arrancar } from './app';\narrancar();\n`,
  'src/app.ts': `import { rutaViva } from './modules/x/x.routes';\nexport function arrancar() { return rutaViva(); }\n`,
  'src/modules/x/x.routes.ts': `import { motorVivo } from './domain/motor';\nexport function rutaViva() { return motorVivo(); }\n`,
  'src/modules/x/domain/motor.ts':
    `import { ayudaIndirecta } from './ayuda';\n` +
    `export const SEMILLA = 3;\n` +
    `export function motorVivo() { return ayudaIndirecta() + SEMILLA; }\n` +
    `export function motorHuerfano() { return 'nadie me llama'; }\n`,
  'src/modules/x/domain/ayuda.ts': `export function ayudaIndirecta() { return 2; }\n`,
};

/** Escribe el árbol sintético en un directorio temporal y devuelve su raíz. */
export function escribirFuenteSintetica() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum411-autoprueba-'));
  for (const [rel, contenido] of Object.entries(FUENTE_SINTETICA)) {
    const destino = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
  }
  return raiz;
}

/**
 * Corre el censo contra la fuente sintética y devuelve el veredicto.
 * `ok === true` solo si encontró EXACTAMENTE lo plantado, ni uno más ni uno menos.
 */
export function autoprueba() {
  const raiz = escribirFuenteSintetica();
  try {
    const c = censar(raiz);
    const vistos = c.filas.map((f) => clave(f.modulo, f.nombre)).sort();
    const ESPERADOS = [
      'src/modules/x/domain/motor.ts::SEMILLA',
      'src/modules/x/domain/motor.ts::motorHuerfano',
    ].sort();
    const fila = (n) => c.filas.find((f) => f.nombre === n);
    return {
      raiz,
      vistos,
      esperados: ESPERADOS,
      // el plantado sale, y sale NOMBRADO con su línea
      plantadoConLinea: fila('motorHuerfano')?.linea === 4,
      // el que sí tiene llamante DIRECTO no se marca nunca
      noMarcaAlVivo: !vistos.includes('src/modules/x/domain/motor.ts::motorVivo'),
      // 🔴 el que se llama INDIRECTAMENTE, a través de otro módulo, tampoco
      noMarcaAlIndirecto: !vistos.some((v) => v.endsWith('::ayudaIndirecta')),
      // la señal que separa «el export sobra» de «esto no lo corre nadie»
      distingueEjecutado: fila('SEMILLA')?.loEjecutaAlguien === true
        && fila('motorHuerfano')?.loEjecutaAlguien === false,
      ok: JSON.stringify(vistos) === JSON.stringify(ESPERADOS),
    };
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
}
