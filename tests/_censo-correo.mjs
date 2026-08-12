// tests/_censo-correo.mjs — SCRUM-475
//
// DOS CENSOS DERIVADOS SOBRE `src/`, las dos mitades de «¿qué pasó con este correo?»:
//
//   A · LOS EMISORES — quién manda un correo, y si mira lo que el proveedor le contesta.
//   B · LOS LLAMADORES — qué pasa cuando el envío falla DE FORMA VISIBLE: ¿sube o se traga?
//
// La B es la que puede destapar lo peor. «No sabemos si llegó» es una laguna del proveedor;
// «falló y no se lo dijimos a nadie» es una decisión nuestra, y ocurre en el único caso en el que
// SÍ lo sabíamos.
//
// ⚠️ AST, NUNCA `grep`: este fichero está lleno de las palabras que vigila.
// ⚠️ Y el receptor de la llamada no se filtra por nombre (`axios`, `http`, el que sea): lo que
// define un emisor es a DÓNDE llama, no cómo se llame la variable.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const RAIZ = path.resolve(import.meta.dirname, '..');
export const HOST_PROVEEDOR = 'api.resend.com';

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

function nombreEnvolvente(n, sf) {
  let p = n.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if (ts.isMethodDeclaration(p) && p.name) return p.name.getText(sf);
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent
        && ts.isVariableDeclaration(p.parent) && p.parent.name) return p.parent.name.getText(sf);
    p = p.parent;
  }
  return '<módulo>';
}

/**
 * ¿Se APROVECHA lo que devuelve esta llamada? Sí si su valor se asigna, se devuelve o se lee.
 * `await x(...)` a secas —sentencia suelta— es tirar la respuesta.
 */
function seAprovechaElValor(llamada) {
  let n = llamada;
  // El `await` envuelve a la llamada: se mira lo que hay por encima del await.
  if (n.parent && ts.isAwaitExpression(n.parent)) n = n.parent;
  const p = n.parent;
  if (!p) return false;
  if (ts.isExpressionStatement(p)) return false;           // ← la respuesta se descarta
  return ts.isVariableDeclaration(p) || ts.isReturnStatement(p) || ts.isBinaryExpression(p)
    || ts.isPropertyAccessExpression(p) || ts.isCallExpression(p) || ts.isArrowFunction(p)
    || ts.isPropertyAssignment(p) || ts.isTemplateSpan(p);
}

/**
 * 🔴 SCRUM-477 · ¿SE USA EL RESULTADO RESUELTO? — distinto de `seAprovechaElValor`, y hace falta.
 *
 * `seAprovechaElValor` contesta «¿se aprovecha la EXPRESIÓN?», y para el censo A basta. Aquí no:
 * `sendMerchantPaymentEmail(...).catch(() => {})` aprovecha la expresión —hay un `.catch` colgado—
 * pero **nadie mira lo que devolvió**. Con aquel criterio los cuatro salían `mira-resultado`, que
 * es exactamente lo contrario de lo que pasa. Medido: por eso existe esta segunda función.
 *
 * Aquí se atraviesan los eslabones de promesa (`await`, `.then`, `.catch`, `.finally`) y se
 * pregunta por el VALOR: si al final de la cadena la expresión es una sentencia suelta, el
 * resultado se tiró. Un `.then(r => …)` con parámetro **sí** lo consume; `.catch`/`.finally` no
 * lo reciben nunca.
 */
export function seUsaElResultado(llamada) {
  let n = llamada;
  for (;;) {
    const p = n.parent;
    if (!p) return false;
    if (ts.isAwaitExpression(p)) { n = p; continue; }
    if (ts.isPropertyAccessExpression(p) && ['then', 'catch', 'finally'].includes(p.name.text)
        && p.parent && ts.isCallExpression(p.parent)) {
      if (p.name.text === 'then') {
        const cb = p.parent.arguments[0];
        if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) && cb.parameters.length) return true;
      }
      n = p.parent;
      continue;
    }
    // Fin de la cadena: si es una sentencia suelta, el valor no fue a ninguna parte.
    return !ts.isExpressionStatement(p);
  }
}

/**
 * CENSO A, EL NÚCLEO · sobre un TEXTO, no sobre el disco.
 *
 * 🔴 Está separado para poder AUTOPROBAR el analizador. «Ninguna respuesta se tira» y «mi detector
 * no reconoce el patrón» salen por la misma línea y significan lo contrario, así que el test le da
 * un fuente sintético con un descarte dentro y comprueba que lo ve — ANTES de creerse ningún cero.
 */
export function censarEmisoresDeTexto(texto, nombreFichero = 'sintetico.ts') {
  const salida = [];
  const sf = ts.createSourceFile(path.basename(nombreFichero), texto, ts.ScriptTarget.Latest, true);
  (function walk(n) {
    if (ts.isCallExpression(n) && n.arguments.length
        && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text.includes(HOST_PROVEEDOR)) {
      salida.push({
        fichero: nombreFichero,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        fn: nombreEnvolvente(n, sf),
        guardaRespuesta: seAprovechaElValor(n),
      });
    }
    ts.forEachChild(n, walk);
  })(sf);
  return salida;
}

/** CENSO A · toda llamada cuyo primer argumento es una URL del proveedor. */
export function censarEmisores() {
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    salida.push(...censarEmisoresDeTexto(fs.readFileSync(fichero, 'utf8'), rel(fichero)));
  }
  return salida;
}

/**
 * CENSO A-bis (SCRUM-475, sesión 2) · LOS NOMBRES DE LOS EMISORES, DERIVADOS DEL ÁRBOL.
 *
 * 🔴 POR QUÉ EXISTE ESTA FUNCIÓN: la sesión 1 pasaba al censo B una lista escrita A MANO
 * (`['sendInvoiceEmail', 'sendQuoteEmail', 'sendMagicLink', 'sendMail', 'sendMerchantPaymentEmail']`).
 * Funcionaba el día que se escribió. Cuando SCRUM-406 entró en `main` con `enviarCorreo()` y su
 * llamador en `soporteAdmin.routes.ts`, el censo B **no los vio** — no porque el análisis fallara,
 * sino porque el nombre no estaba en la lista. El censo A, que SÍ deriva del árbol, cazó el mismo
 * fichero sin ayuda.
 *
 * Es la misma lección de la casa una vez más: **lo enumerado a mano se queda viejo en silencio**,
 * y su silencio se lee igual que un verde. Así que la lista se deriva.
 *
 * Una función es EMISORA si ALCANZA una llamada al proveedor: o la hace ella, o llama a otra que la
 * hace —**esté en su fichero o en otro**—. Se propaga hasta punto fijo sobre el árbol entero. Se
 * devuelven las EXPORTADAS, que son las que un router puede llamar.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 SESIÓN 3 · POR QUÉ ESTO PROPAGA ENTRE FICHEROS, Y NO ES UNA MEJORA: ERA UN FALSO CERO
 *
 * La sesión 2 propagaba **solo dentro de un fichero**, y funcionaba porque cada emisor tenía su
 * propio POST al proveedor dentro. SCRUM-475 (Luis, PR #708) unificó los siete POST en UN SOLO
 * emisor —forma mejor, y es la que hay— así que `sendMerchantPaymentEmail` pasó a llamar a
 * `enviarCorreo`, que vive en OTRO fichero.
 *
 * Resultado medido al traer `main`: la lista derivada cayó de **13 nombres a 4**, el censo B pasó
 * de 21 llamadores a 14, y **los cuatro mudos desaparecieron del informe**. Nadie los arregló:
 * siguen ahí, con su `.catch(() => {})` intacto. **El detector dejó de verlos.**
 *
 * Y el atajo que había aquí —«si el fichero no nombra al proveedor ni `sendMail`, sáltatelo»— era
 * la otra mitad del mismo agujero: después del refactor, un fichero que llama a un emisor importado
 * no menciona ninguna de las dos cosas. Se ha retirado.
 *
 * La lección, que es la de la casa y esta vez me mordió al revés: **un refactor correcto puede
 * cegar un guard sin tocarlo**, y el guard lo cuenta como «cero». «Cero mudos» y «no supe mirar»
 * salían por la misma línea. Por eso `scrum475-constancia-correo.test.mjs` prueba el detector
 * contra un mudo conocido ANTES de creerse ningún cero.
 */
export function nombresDeEmisor() {
  const nodos = construirGrafo();
  const nombres = new Set();
  for (const f of nodos.values()) if (f.emisora && f.exportada) nombres.add(f.nombre);
  return [...nombres].sort();
}

/**
 * CENSO A-ter (SCRUM-477) · POR QUÉ CANAL VIAJA EL FALLO DE CADA EMISOR.
 *
 * 🔴 EL CRITERIO QUE FALTABA, Y POR QUÉ SIN ÉL EL CENSO MIRABA A OTRO LADO.
 *
 * `censarLlamadores` clasificaba por lo que pasa **si la llamada LANZA**: ¿hay `catch`?, ¿contesta?,
 * ¿loguea? Eso es correcto para `sendMerchantPaymentEmail`, que lanza. Pero `enviarCorreo` **no
 * lanza nunca**: captura dentro y DEVUELVE `{ enviado:false, constancia }`. Para sus llamadores la
 * pregunta «¿hay catch?» no significa nada — no hay excepción que capturar—, así que salían como
 * `sube`, que se lee como «alguien se entera» cuando puede no enterarse nadie.
 *
 * No era un fallo del análisis: **medía otra cosa**. Un fallo puede caerse por dos canales
 * distintos y el censo solo vigilaba uno.
 *
 *   · **lanza**    → el fallo viaja como EXCEPCIÓN. Se pierde si un `catch` se la come.
 *   · **devuelve** → el fallo viaja como VALOR. Se pierde si nadie mira lo que devolvió.
 *
 * ⚠️ SE PROPAGA, y hace falta: los tres emisores mudos tienen `throw = 0` en su propio cuerpo.
 * Lanzan porque llaman a un `sendEmail` local que sí lanza. Medido por AST: quedarse en el cuerpo
 * propio los habría clasificado a los tres como `devuelve` y cambiado su veredicto sin motivo.
 *
 * ⚠️ Y ANTE LA DUDA, `devuelve`: un `throw` dentro de un `try` de la propia función no sale de
 * ella, así que no cuenta. Equivocarse hacia `devuelve` produce un FALSO POSITIVO —alguien mira un
 * sitio que estaba bien—; equivocarse hacia `lanza` esconde un fallo que no se registra. El error
 * barato va donde alguien lo ve.
 */
export function canalDeFallo() {
  const nodos = construirGrafo();
  const canal = new Map();
  for (const f of nodos.values()) {
    if (f.exportada && f.emisora) canal.set(f.nombre, f.lanza ? 'lanza' : 'devuelve');
  }
  return canal;
}

/** El grafo de funciones del árbol, con sus llamadas resueltas ENTRE FICHEROS. */
function construirGrafo() {
  // ── 1 · Un nodo por función del árbol, con sus llamadas RESUELTAS a fichero+nombre ──────
  const nodos = new Map(); // "fichero::nombre" → { exportada, emisora, lanza, llama:Set<clave> }

  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    const texto = fs.readFileSync(fichero, 'utf8');
    const sf = ts.createSourceFile(path.basename(fichero), texto, ts.ScriptTarget.Latest, true);

    // Mapa de importados: nombre local → fichero donde vive de verdad. Es lo que permite seguir la
    // cadena cuando el emisor y quien lo usa están en módulos distintos.
    const importado = new Map();
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !ts.isStringLiteralLike(st.moduleSpecifier)) continue;
      const spec = st.moduleSpecifier.text;
      if (!spec.startsWith('.')) continue; // paquetes de node_modules: no son nuestros
      const destino = resolverModulo(fichero, spec);
      if (!destino) continue;
      const clausula = st.importClause;
      if (!clausula) continue;
      if (clausula.namedBindings && ts.isNamedImports(clausula.namedBindings)) {
        for (const el of clausula.namedBindings.elements) {
          importado.set(el.name.text, { destino, original: (el.propertyName || el.name).text });
        }
      }
      if (clausula.name) importado.set(clausula.name.text, { destino, original: 'default' });
    }

    const declaraciones = [];
    (function walk(n) {
      let nombre = null;
      let exportada = false;
      if (ts.isFunctionDeclaration(n) && n.name) {
        nombre = n.name.text;
        exportada = !!(ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export);
      } else if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n))
                 && n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) {
        nombre = n.parent.name.text;
        exportada = !!(ts.getCombinedModifierFlags(n.parent) & ts.ModifierFlags.Export);
      }
      if (nombre && n.body) declaraciones.push({ nombre, exportada, nodo: n });
      ts.forEachChild(n, walk);
    })(sf);

    for (const { nombre, exportada, nodo } of declaraciones) {
      let emisora = false;
      let lanza = false;
      const llama = new Set();
      const llamaSinProteger = new Set(); // las que NO están dentro de un try de esta función
      (function walk(n) {
        // ¿Un `throw` que SALE de esta función? Uno dentro de su propio `try` no sale.
        if (ts.isThrowStatement(n) && !dentroDeTry(n, nodo)) lanza = true;
        if (ts.isCallExpression(n)) {
          // ¿Llama al proveedor por HTTP? (por el DESTINO, no por el nombre del cliente)
          if (n.arguments.length && ts.isStringLiteralLike(n.arguments[0])
              && n.arguments[0].text.includes(HOST_PROVEEDOR)) emisora = true;
          // ¿O manda por SMTP?
          if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'sendMail') emisora = true;
          if (ts.isIdentifier(n.expression)) {
            const imp = importado.get(n.expression.text);
            const clave = imp ? `${imp.destino}::${imp.original}` : `${fichero}::${n.expression.text}`;
            llama.add(clave);
            // Una excepción de la callee solo sale de aquí si la llamada NO está protegida.
            if (!dentroDeTry(n, nodo) && !tieneCatchPegado(n)) llamaSinProteger.add(clave);
          }
        }
        ts.forEachChild(n, walk);
      })(nodo.body);
      nodos.set(`${fichero}::${nombre}`, { nombre, exportada, emisora, lanza, llama, llamaSinProteger });
    }
  }

  // ── 2 · Propagación hasta punto fijo, SOBRE EL ÁRBOL ENTERO ────────────────────────────
  //
  // Dos propagaciones, y son distintas a propósito:
  //   · EMISORA  — por `llama`: quien llama a un emisor manda un correo, lo proteja o no.
  //   · LANZA    — por `llamaSinProteger`: una excepción solo sube si NADIE la captura por el
  //                camino. Si la llamada va dentro de un `try` o lleva `.catch()` pegado, el fallo
  //                deja de viajar por ese canal y quien está más arriba no lo verá.
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (const f of nodos.values()) {
      if (!f.emisora) {
        for (const destino of f.llama) {
          if (nodos.get(destino)?.emisora) { f.emisora = true; cambio = true; break; }
        }
      }
      if (!f.lanza) {
        for (const destino of f.llamaSinProteger) {
          if (nodos.get(destino)?.lanza) { f.lanza = true; cambio = true; break; }
        }
      }
    }
  }

  return nodos;
}

/**
 * ¿Se ESPERA esta llamada? Un `try` solo captura la excepción de lo que se espera: una promesa que
 * nadie aguarda rechaza después de que el bloque haya terminado, y su `catch` nunca la ve.
 */
function estaEsperada(n) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isAwaitExpression(p)) return true;
    // Salir de la expresión: si llegamos a una sentencia sin haber visto `await`, no se espera.
    if (ts.isStatement(p)) return false;
    // Entrar en otra función (callback) corta la cadena del `await` de fuera.
    if (ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) return false;
  }
  return false;
}

/** ¿Está `n` dentro de un `try` de la función `limite`? (no se sale de esa función al subir) */
function dentroDeTry(n, limite) {
  for (let p = n.parent; p && p !== limite; p = p.parent) {
    if (ts.isTryStatement(p) && p.catchClause
        && p.tryBlock.getStart() <= n.getStart() && n.getEnd() <= p.tryBlock.getEnd()) return true;
  }
  return false;
}

/** ¿La llamada lleva un `.catch(...)` pegado? Entonces su excepción tampoco sube. */
function tieneCatchPegado(n) {
  return !!(n.parent && ts.isPropertyAccessExpression(n.parent) && n.parent.name.text === 'catch'
    && n.parent.parent && ts.isCallExpression(n.parent.parent));
}

/** Resuelve un import relativo a un fichero `.ts` del árbol. `null` si no apunta a uno nuestro. */
function resolverModulo(desde, spec) {
  const base = path.resolve(path.dirname(desde), spec);
  for (const cand of [`${base}.ts`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

/**
 * CENSO B · quién llama a un emisor, y qué hace si revienta.
 *
 * Cuatro veredictos, y la diferencia entre los dos primeros me la enseñó equivocarme:
 *   · `sube`        — el error propaga: alguien arriba se entera.
 *   · `avisa`       — hay `catch` y **contesta al usuario que NO salió** (`sendFailureBody`,
 *                     `ok:false`, un status de error). Es trabajo hecho (SCRUM-126) y no es un
 *                     tragón: el profesional ve que falló y puede reintentar.
 *   · `traga-log`   — hay `catch` y SOLO escribe en consola: nadie se entera.
 *   · `traga-mudo`  — hay `catch` y ni siquiera loguea.
 *
 * 🔴 LA PRIMERA VERSIÓN DE ESTE CENSO CLASIFICABA POR LA FORMA DEL `catch` —¿relanza?, ¿loguea?—
 * y metía en el mismo cubo a quien avisa al usuario y a quien no. Es el defecto que este repo
 * lleva nueve variantes cazando: el guard atado a la FORMA en vez de al HECHO. El hecho es
 * «¿se entera alguien?», y eso se mide mirando si el `catch` produce una RESPUESTA.
 */
export function censarLlamadores(nombresDeEmisor, canales = canalDeFallo()) {
  const salida = [];
  for (const fichero of ficherosTs(path.join(RAIZ, 'src'))) {
    const sf = ts.createSourceFile(path.basename(fichero), fs.readFileSync(fichero, 'utf8'), ts.ScriptTarget.Latest, true);
    (function walk(n) {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && nombresDeEmisor.includes(n.expression.text)) {
        // 🔴 PRIMERO el `.catch(...)` PEGADO A LA LLAMADA, y va primero porque manda: si lo hay,
        // el `try` de la ruta NUNCA ve este error. Buscar solo `try` me hizo clasificar
        // `sendMerchantPaymentEmail(...).catch(() => {})` —mudo del todo— como «avisa», porque
        // subí hasta el `catch` de la ruta, que contesta al PSP y no al profesional.
        let cuerpoManejador = null;
        if (n.parent && ts.isPropertyAccessExpression(n.parent) && n.parent.name.text === 'catch'
            && n.parent.parent && ts.isCallExpression(n.parent.parent)) {
          const arg = n.parent.parent.arguments[0];
          cuerpoManejador = arg ? arg.getText(sf) : '';
        }
        // Si no, ¿hay un try/catch por encima que capture ESTA llamada?
        //
        // 🔴 SCRUM-477 · SOLO SI SE ESPERA CON `await`, Y ESTO ME DIO UN VERDE FALSO.
        //
        // Al envolver los cuatro avisos en `conConstancia(...)` —sin `await`, para que un correo
        // que no sale no pueda tumbar el cobro— el censo los marcó `avisa`: había subido hasta el
        // `try` de la ruta, que sí contesta. **Pero ese `try` no captura nada de esto.** La llamada
        // no se espera, así que el rechazo de la promesa viaja por su cuenta y el bloque `try` ya
        // ha terminado cuando llega. El veredicto era bueno por un motivo que no existe.
        //
        // La regla es general y no cuesta nada: un `try` solo ve la excepción de lo que se espera.
        if (cuerpoManejador === null && estaEsperada(n)) {
          let p = n.parent;
          while (p) {
            if (ts.isTryStatement(p) && p.catchClause && p.tryBlock.getStart(sf) <= n.getStart(sf)
                && n.getEnd() <= p.tryBlock.getEnd()) { cuerpoManejador = p.catchClause.block.getText(sf); break; }
            p = p.parent;
          }
        }
        let veredicto = 'sube';
        if (cuerpoManejador !== null) {
          const cuerpo = cuerpoManejador.replace(/\/\/.*$/gm, '');
          const relanza = /\bthrow\b/.test(cuerpo);
          // ¿El `catch` CONTESTA que no salió? Ése es el hecho, no si loguea.
          const avisa = /sendFailureBody|res\.status\(|res\.json\(/.test(cuerpo);
          veredicto = relanza ? 'sube'
            : avisa ? 'avisa'
            : /console\.(error|warn|log)/.test(cuerpo) ? 'traga-log' : 'traga-mudo';
        }

        // ── 🔴 SCRUM-477 · EL SEGUNDO CANAL ────────────────────────────────────────────────
        //
        // Todo lo de arriba contesta a «¿qué pasa si esto LANZA?». Para un emisor que NO lanza
        // —captura dentro y devuelve `{ enviado:false, constancia }`— esa pregunta no significa
        // nada: no hay excepción, así que sale `sube` («alguien se entera») cuando puede no
        // enterarse nadie. El fallo se cae por el OTRO canal, y por ahí nadie miraba.
        //
        // Para esos, el hecho es: **¿alguien mira lo que devolvió?**
        //
        // ⚠️ Y VA ANTES QUE EL CANAL, no después: si el valor se ENTREGA a otra función, esa función
        // se hace cargo de los dos canales —del valor y del rechazo— y este censo, que mira una
        // llamada cada vez, no puede ni debe decidir por ella. Lo que sí exige la casa es que esa
        // receptora esté probada: `conConstancia` lo está, caso por caso, en
        // `scrum477-avisos-con-constancia.test.mjs`.
        const canal = canales.get(n.expression.text) || 'lanza';
        if (seUsaElResultado(n)) veredicto = 'mira-resultado';
        else if (canal === 'devuelve') veredicto = 'ignora-resultado';

        salida.push({
          canal,
          fichero: rel(fichero),
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          emisor: n.expression.text,
          veredicto,
        });
      }
      ts.forEachChild(n, walk);
    })(sf);
  }
  return salida;
}
