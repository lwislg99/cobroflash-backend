#!/usr/bin/env node
// scripts/censo-arbitro-de-toque.mjs — SCRUM-562
//
// DOS CENSOS BARATOS SOBRE EL MISMO DEFECTO: algo tapa a un elemento y la comprobación no se
// entera.
//
//   ① ¿Dónde se pregunta por PERTENENCIA A LA PILA cuando lo que se quiere saber es si el
//      usuario puede pulsar? Ése es el idioma que produce verdes falsos.
//   ② ¿Cuántos pseudo-elementos DECORATIVOS hay sin `pointer-events:none` en la superficie
//      pública? Son los candidatos a tapar sin que se vea en ninguna revisión del CSS.
//
// ── ⚠️ EL CENSO ① CLASIFICA POR LA PREGUNTA, NO POR LA SINTAXIS ──────────────────────────────
// `elementsFromPoint(...).includes(el)` NO está mal siempre. Está mal para «¿se puede pulsar
// aquí?», porque contesta que sí aunque haya algo encima. Cuando la pregunta es «¿qué hay DEBAJO
// de este elemento?» —contraste, superposiciones— la posición en la pila es justo el dato que
// hace falta, y ahí `findIndex` + `slice` es lo correcto.
//
// Medido: los cuatro usos de `.claude/skills/impeccable` son de esa segunda clase — buscan lo
// que hay debajo para analizar contraste. Marcarlos como defecto habría sido pedir que se
// «arreglase» código que hace lo correcto, y un censo que grita de más se acaba ignorando.
//
// ── ⚠️ Y EL CENSO ② NO PIDE `pointer-events:none` PARA TODOS ────────────────────────────────
// `.announce a::after` es un pseudo-elemento posicionado y SIN `pointer-events:none` a
// propósito: amplía el área del enlace de 23,6 a 47 px (SCRUM-543). Quitárselo rompería un
// arreglo bueno. Por eso la clase se decide por DE QUIÉN cuelga: si cuelga de algo pulsable,
// amplía SU PROPIA área; si cuelga de un contenedor, se pone por encima de lo que haya.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();

// ── ZONAS ────────────────────────────────────────────────────────────────────────────────────
/**
 * Lo VENDIDO no se cuenta como deuda nuestra: `.claude/skills` y `.agents/skills` están
 * gobernadas por hash en `skills-lock.json` y la regla 36 prohíbe tocarlas sin revisión del
 * fundador. Se MIDEN igual —para que el número no salga de una lista escrita a mano— y se
 * declaran aparte.
 */
export const ZONAS_VENDIDAS = ['.claude/skills/', '.agents/skills/'];
const esVendido = (rel) => ZONAS_VENDIDAS.some((z) => rel.replace(/\\/g, '/').includes(z));

const IGNORAR = new Set(['node_modules', 'dist', '.git', 'coverage', '.next']);

function ficheros(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(abs, exts, out);
    else if (exts.has(path.extname(e.name))) out.push(abs);
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL IDIOMA
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Cómo se consulta el resultado de `elementsFromPoint`. La clase decide, no la sintaxis. */
export const CLASES = {
  TOPE: 'pregunta por el de ENCIMA — correcto para «¿se puede pulsar?»',
  PERTENENCIA: '🔴 pregunta si el elemento ESTÁ EN LA PILA — da por bueno lo que otro tapa',
  POSICION: 'usa la POSICIÓN en la pila (qué hay debajo) — legítimo para contraste',
  SINGULAR: 'elementFromPoint (singular): ya devuelve el de encima',
  OTRO: 'no he sabido clasificarlo',
};

/**
 * Clasifica UNA aparición mirando los 200 caracteres que la siguen.
 *
 * 🔴 SUELO DE ESTA FUNCIÓN: lo que no encaje sale como `OTRO`, no como `TOPE`. Un clasificador
 *    que ante la duda dice «correcto» convierte cada caso raro en un aprobado silencioso, que
 *    es exactamente el fallo que este ticket viene a quitar.
 */
export function clasificar(trozo) {
  if (/\belementFromPoint\s*\(/.test(trozo)) return 'SINGULAR';
  const cola = trozo.slice(trozo.indexOf('elementsFromPoint'));
  if (/elementsFromPoint\s*\([^)]*\)\s*(\[\s*0\s*\]|\.at\(\s*0\s*\))/.test(cola)) return 'TOPE';
  if (/elementsFromPoint\s*\([^)]*\)\s*\.(includes|indexOf|some)\s*\(/.test(cola)) return 'PERTENENCIA';
  // Asignado a una variable: se mira cómo se consulta esa variable justo después.
  const m = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[\s\S]{0,80}?elementsFromPoint/.exec(trozo);
  if (m) {
    const v = m[1];
    const uso = trozo.slice(trozo.indexOf('elementsFromPoint'));
    if (new RegExp(`\\b${v}\\s*\\.(findIndex|indexOf)\\b`).test(uso) && /\.slice\s*\(/.test(uso)) return 'POSICION';
    if (new RegExp(`\\b${v}\\s*\\[\\s*0\\s*\\]`).test(uso)) return 'TOPE';
    if (new RegExp(`\\b${v}\\s*\\.(includes|some)\\s*\\(`).test(uso)) return 'PERTENENCIA';
    if (new RegExp(`\\b${v}\\s*\\.findIndex\\b`).test(uso)) return 'POSICION';
  }
  return 'OTRO';
}

/** Las apariciones del idioma, DERIVADAS del árbol. Los comentarios no cuentan. */
export function censarIdioma(raiz = RAIZ) {
  const out = [];
  for (const abs of ficheros(raiz, new Set(['.js', '.mjs', '.cjs', '.ts', '.html']))) {
    const rel = path.relative(raiz, abs).replace(/\\/g, '/');
    // Los comentarios de BLOQUE se vacian conservando los saltos, para que los numeros de linea
    // sigan siendo los del fichero. Sin esto, la cabecera de `_medidor-de-toque.mjs` —que CITA el
    // idioma malo para explicarlo— se contaria como un uso del idioma malo.
    const src = fs.readFileSync(abs, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    const lineas = src.split('\n').map((l) => l.replace(/^\s*\/\/.*$/, ''));
    for (let i = 0; i < lineas.length; i += 1) {
      // 🔴 SOLO LLAMADAS DE VERDAD: `algo.elementsFromPoint(`.
      //
      // La primera version buscaba el NOMBRE, y se contaba a si misma 8 veces —las expresiones
      // regulares de `clasificar` de aqui abajo llevan el nombre dentro— mas las citas de los
      // comentarios, la del `assert.match` que comprueba que el guard lo menciona, y la del
      // `<style>` de la landing. Trampa de autorreferencia: el instrumento entra en su propia
      // poblacion y el numero deja de significar nada.
      //
      // Exigir el punto y el parentesis deja fuera esas cuatro clases SIN listas de exclusion:
      // una mencion dentro de una cadena, de una expresion regular o de un comentario no es una
      // llamada, y una comprobacion de existencia (`if (document.elementsFromPoint)`) tampoco.
      //
      // ⚠️ LO QUE NO VE, dicho: una llamada indirecta (`const f = document.elementsFromPoint`)
      //    no la caza. No hay ninguna hoy, y si aparece, este censo no la vera.
      if (!/\.\s*elements?FromPoint\s*\(/.test(lineas[i])) continue;
      out.push({
        rel,
        linea: i + 1,
        vendido: esVendido(rel),
        // La ventana mira ATRAS tambien: `const stack =` puede estar en la linea anterior, que es
        // como esta escrito el ternario de `impeccable`.
        clase: clasificar(lineas.slice(Math.max(0, i - 3), i + 8).join('\n')),
        texto: lineas[i].trim().slice(0, 110),
      });
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② LOS PSEUDO-ELEMENTOS DECORATIVOS
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** La superficie que ve alguien sin haber entrado. El panel va aparte, no mezclado. */
export const SUPERFICIE_PUBLICA = [
  'public/index.html', 'public/precios.html', 'public/privacidad.html', 'public/terminos.html',
  'public/login.html', 'public/register.html', 'public/auth.css', 'public/tokens.css',
];

/** Qué selectores cuelgan de algo que se puede pulsar: ahí el pseudo AMPLIA su propia area. */
const BASE_PULSABLE = /(^|[\s>+~])(a|button|summary)([.:#\[][^\s>+~]*)?$|\.(btn|link|p-link)[^\s>+~]*$/i;

/** Saca las reglas `…::before|::after { … }` de un texto CSS, con su bloque. */
export function reglasDePseudo(css) {
  const out = [];
  const re = /::(before|after)/g;
  let m;
  while ((m = re.exec(css))) {
    const abre = css.indexOf('{', m.index);
    if (abre < 0) continue;
    const cierra = css.indexOf('}', abre);
    if (cierra < 0) continue;
    // El selector empieza tras el ultimo `{`, `}` o `;` anteriores.
    const corte = Math.max(css.lastIndexOf('{', m.index), css.lastIndexOf('}', m.index), css.lastIndexOf(';', m.index));
    const selector = css.slice(corte + 1, abre).replace(/\s+/g, ' ').trim();
    if (!selector || selector.includes('@')) continue;
    out.push({ selector, bloque: css.slice(abre + 1, cierra) });
  }
  return out;
}

const cssDe = (rel) => {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) return null;
  const src = fs.readFileSync(abs, 'utf8');
  if (!rel.endsWith('.html')) return src;
  return [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
};

export function censarPseudos(ficherosRel = SUPERFICIE_PUBLICA) {
  const out = [];
  for (const rel of ficherosRel) {
    const css = cssDe(rel);
    if (css === null) { out.push({ rel, error: 'no existe' }); continue; }
    for (const r of reglasDePseudo(css)) {
      const protegido = /pointer-events\s*:\s*none/.test(r.bloque);
      const posicionado = /position\s*:\s*(absolute|fixed)/.test(r.bloque);
      const base = r.selector.replace(/::?(before|after)$/, '').trim();
      const suyo = BASE_PULSABLE.test(base);
      out.push({
        rel,
        selector: r.selector + '::' + (/::after/.test(r.selector + '::after') ? '' : ''),
        base,
        protegido,
        posicionado,
        suyo,
        clase: protegido ? 'PROTEGIDO'
          : !posicionado ? 'EN FLUJO'
            : suyo ? 'AMPLIA SU PROPIA AREA'
              : 'CANDIDATO',
      });
    }
  }
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let fallos = 0;

  const idioma = censarIdioma();
  console.log('═'.repeat(84));
  console.log('① EL IDIOMA · ¿se pregunta por el de ENCIMA o por pertenencia a la pila?');
  console.log('═'.repeat(84));
  if (idioma.length === 0) {
    console.error('🔴 CIEGO: cero apariciones de elementsFromPoint en todo el árbol. O el recorrido '
      + 'no está mirando donde cree, o el filtro se comió los usos. Un cero aquí se leería como '
      + '«no queda ni uno del idioma viejo», que es la conclusión más cara.');
    fallos += 1;
  }
  const nuestro = idioma.filter((x) => !x.vendido);
  const vendido = idioma.filter((x) => x.vendido);
  for (const grupo of [['NUESTRO CÓDIGO', nuestro], ['VENDIDO (skills, gobernadas por hash — regla 36)', vendido]]) {
    console.log('\n── ' + grupo[0] + ' · ' + grupo[1].length + ' usos');
    for (const x of grupo[1]) {
      const marca = x.clase === 'PERTENENCIA' ? '🔴' : x.clase === 'OTRO' ? '🟡' : '  ';
      console.log(`   ${marca} [${x.clase}] ${x.rel}:${x.linea}\n        ${x.texto}`);
    }
  }
  const malos = nuestro.filter((x) => x.clase === 'PERTENENCIA');
  const dudosos = nuestro.filter((x) => x.clase === 'OTRO');
  console.log('\n   en nuestro código · por pertenencia: ' + malos.length + '   ·   sin clasificar: ' + dudosos.length);
  if (malos.length) { console.error('   🔴 ese idioma da por bueno lo que otro elemento tapa. Usa `_medidor-de-toque.mjs`.'); fallos += 1; }
  if (dudosos.length) { console.error('   🟡 hay usos que no he sabido clasificar. Míralos: no se dan por buenos.'); fallos += 1; }

  const pseudos = censarPseudos();
  console.log('\n' + '═'.repeat(84));
  console.log('② PSEUDO-ELEMENTOS en la superficie pública · ¿cuáles pueden comerse un toque?');
  console.log('═'.repeat(84));
  if (pseudos.length === 0) {
    console.error('🔴 CIEGO: cero pseudo-elementos en toda la superficie pública. El extractor no está leyendo el CSS.');
    fallos += 1;
  }
  const cuenta = {};
  for (const p of pseudos) cuenta[p.clase || 'error'] = (cuenta[p.clase || 'error'] || 0) + 1;
  for (const [k, v] of Object.entries(cuenta)) console.log('   ' + String(v).padStart(3) + '  ' + k);
  const candidatos = pseudos.filter((p) => p.clase === 'CANDIDATO');
  if (candidatos.length) {
    console.log('\n   🟡 CANDIDATOS (decorativo posicionado, sin `pointer-events:none`, colgando de un contenedor):');
    for (const c of candidatos) console.log(`      · ${c.rel} — ${c.base}`);
    console.log('\n   Esto NO es un veredicto: quien decide es `npm run guard:objetivo-tactil`, que lo mide');
    console.log('   en navegador. Aquí sólo se dice dónde mirar, que es barato y no lo hacía nadie.');
  }

  console.log('\n' + '─'.repeat(84));
  process.exit(fallos ? 1 : 0);
}
