// tests/scrum379-recarga-sin-await.test.mjs — SCRUM-379
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, Y POR QUÉ NO ES SCRUM-375
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// En los cinco sitios de la ficha del albarán el patrón era:
//
//     const recargar = () => renderAlbaranDetailView(…)   // async
//     …
//     recargar()                                          // ← SIN await
//
// Sin `await`, el rechazo NO entra en el `catch` del handler: se va como **promesa sin
// gestionar**. Y el desenlace es distinto al de 375:
//
//   · **375** → el profesional lee algo FALSO («no se han podido marcar» cuando sí se marcaron).
//   · **379** → no lee NADA. Hace la acción, la escritura ocurre, la pantalla no cambia — y lo
//     natural es que la REPITA.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES PREGUNTAS, QUE SON DISTINTAS
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
//   (a) ¿Dice algo cuando la escritura fue bien y la recarga no?  → se EJECUTA el decisor puro.
//   (b) ¿Dice lo de la escritura cuando la que falla es la escritura? → el simétrico, o el
//       arreglo habría cambiado un silencio por una mentira.
//   (c) ¿La promesa se pierde?  → se ARMA `unhandledRejection` y se ejecuta el flujo real.
//
// 🔴 (a) y (c) NO son la misma pregunta, y ésa es la razón de que este fichero no se conforme
// con mirar el mensaje: **mirar el mensaje comprueba que alguien dijo algo; armar el manejador
// comprueba que la promesa no se perdió.** Un arreglo que pinte el aviso pero siga soltando el
// rechazo por otro sitio pasaría (a) y fallaría (c) — y la causa raíz es (c).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'albaranDetailView.js');
const FUENTE = fs.readFileSync(RUTA, 'utf8');

const require_ = createRequire(import.meta.url);
const { COPY_ALBARAN_SIN_REFRESCO, resultadoAccionAlbaran } = require_(RUTA);

const sf = ts.createSourceFile('albaranDetailView.js', FUENTE, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const recorrer = (n, fn) => { fn(n); n.forEachChild((h) => recorrer(h, fn)); };
const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// (a) + (b) · EL DECISOR, EJECUTADO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-379 · (a) 🔴 escritura OK + recarga KO: la pantalla TIENE que decir algo', () => {
  const r = resultadoAccionAlbaran({ escrituraOk: true, recargaOk: false });

  assert.notEqual(r.texto, '',
    '🔴 EL DEFECTO ENTERO: la escritura ocurrió, la recarga falló y la pantalla no dice NADA. '
    + 'El profesional ve la ficha sin cambiar y repite la acción — y de los cinco sitios, tres '
    + 'dejan rastro que no se deshace (dos mandan un WhatsApp al cliente, el tercero duplica una '
    + 'foto que hoy no se puede borrar desde ningún sitio del producto).');
  assert.equal(r.texto, COPY_ALBARAN_SIN_REFRESCO, '🔴 no es el texto firmado por el fundador');
  assert.equal(r.seEscribio, true,
    '🔴 el desenlace no reconoce que la escritura ocurrió: es lo único que evita la repetición');
  assert.ok(r.tono,
    '🔴 desenlace SIN TONO. Un `.alert` sin tono está OCULTO por CSS (`styles.css:1667`): el '
    + 'aviso existiría en el DOM y el profesional no vería nada — el mismo silencio, con más código.');
});

test('SCRUM-379 · (a) el texto dice PRIMERO que se hizo y DESPUÉS que hay que recargar', () => {
  // El orden es la mitad del trabajo del texto: si empezara por el fallo, se leería como que la
  // acción no salió, que es justo lo que hace repetirla.
  const t = COPY_ALBARAN_SIN_REFRESCO;
  const iHecho = t.search(/Hecho/i);
  const iFallo = t.search(/no hemos podido/i);
  assert.ok(/^Hecho\./.test(t), `🔴 el aviso no empieza confirmando la acción: «${t}»`);
  assert.ok(iHecho >= 0 && iFallo > iHecho,
    `🔴 el fallo se anuncia antes que el hecho (hecho en ${iHecho}, fallo en ${iFallo}): «${t}». `
    + 'Leído en ese orden, el aviso suena a que la acción no salió — que es lo que hace repetirla.');
  assert.match(t, /recárgala/,
    '🔴 el aviso no dice qué hacer: sin eso, el profesional sabe que pasó algo pero no cómo salir');
});

test('SCRUM-379 · (b) el simétrico: si la que falla es la ESCRITURA, el mensaje es el suyo', () => {
  const propio = 'No se pudo firmar: la firma supera el tamaño máximo permitido.';
  const r = resultadoAccionAlbaran({ escrituraOk: false, errorEscritura: propio });

  assert.equal(r.texto, propio, '🔴 se ha perdido el mensaje propio del fallo de escritura');
  assert.notEqual(r.texto, COPY_ALBARAN_SIN_REFRESCO,
    '🔴 UNA ESCRITURA QUE FALLÓ ESTÁ DICIENDO «Hecho». Eso es cambiar el silencio de 379 por la '
    + 'mentira de 375: el profesional se va creyendo que firmó, y no firmó.');
  assert.equal(r.seEscribio, false, '🔴 el desenlace afirma que se escribió cuando no se escribió');
  assert.equal(r.tono, 'error', '🔴 un fallo de escritura no puede llevar el tono de un aviso');
});

test('SCRUM-379 · todo bien: NO se pinta ningún aviso (la ficha recargada es el mensaje)', () => {
  const r = resultadoAccionAlbaran({ escrituraOk: true, recargaOk: true });
  assert.equal(r.texto, '',
    '🔴 un «hecho» sobre una ficha que ya se ve actualizada es ruido, y el ruido enseña al '
    + 'profesional a ignorar los avisos que sí importan');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// (c) · LA CAUSA RAÍZ · el flujo REAL, con `unhandledRejection` armado
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Saca del fichero el `refrescar` REAL (por AST, no por recorte de texto) y lo hace invocable. */
function refrescarReal({ recargar, setStatus }) {
  let decl = null;
  recorrer(sf, (n) => {
    if (!decl && ts.isVariableDeclaration(n) && n.name.getText(sf) === 'refrescar') decl = n;
  });
  assert.ok(decl,
    '🔴 ESCÁNER CIEGO: no encuentro `refrescar` en la vista. Si se renombró, todo lo de abajo '
    + 'mediría el vacío y este fichero daría verde sobre nada.');
  const fabricar = new Function(
    'recargar', 'setStatus', 'resultadoAccionAlbaran',
    `const ${decl.getText(sf)}; return refrescar;`,
  );
  return fabricar(recargar, setStatus, resultadoAccionAlbaran);
}

/** Arma el manejador global y devuelve lo que se haya perdido. */
async function conUnhandledRejectionArmado(fn) {
  const perdidas = [];
  const previos = process.listeners('unhandledRejection');
  for (const l of previos) process.off('unhandledRejection', l);
  const captor = (razon) => perdidas.push(razon);
  process.on('unhandledRejection', captor);
  try {
    await fn();
    // Un `unhandledRejection` se emite cuando el micro-tick termina sin manejador: hay que
    // DEJARLE LLEGAR. Sin estas vueltas, el test diría «no se perdió nada» porque miró pronto.
    for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r));
  } finally {
    process.off('unhandledRejection', captor);
    for (const l of previos) process.on('unhandledRejection', l);
  }
  return perdidas;
}

test('SCRUM-379 · (c) 🔴 CAUSA RAÍZ: el rechazo de la recarga NO queda sin gestionar', async () => {
  const avisos = [];
  const refrescar = refrescarReal({
    recargar: () => Promise.reject(new Error('la recarga se cayó')),
    setStatus: (tono, texto) => avisos.push({ tono, texto }),
  });

  // Se invoca SIN `await` A PROPÓSITO: así era el código roto, y así es como se comprueba que el
  // arreglo no depende de que quien llame se acuerde. Si `refrescar` volviera a soltar el rechazo,
  // el manejador lo recogería.
  const perdidas = await conUnhandledRejectionArmado(() => { refrescar(); });

  assert.deepEqual(
    perdidas.map((p) => String(p?.message ?? p)), [],
    '🔴 UNA PROMESA RECHAZADA SE HA PERDIDO. Éste es el defecto en su forma original: sin `await` '
    + 'y sin gestión, el fallo de la recarga no entra en ningún `catch` y desaparece — la pantalla '
    + 'se queda callada y el profesional repite la acción. Que el aviso se pinte no basta: si el '
    + 'rechazo se escapa por otro sitio, el arreglo es cosmético.',
  );
  assert.deepEqual(
    avisos, [{ tono: 'info', texto: COPY_ALBARAN_SIN_REFRESCO }],
    '🔴 la promesa no se perdió, pero tampoco se avisó: silencio gestionado sigue siendo silencio',
  );
});

test('SCRUM-379 · (c) SUELO: el manejador armado SÍ caza una promesa perdida de verdad', async () => {
  // Sin este suelo, el test de arriba sería verde también con el detector roto: «no se perdió
  // nada» y «no supe mirar» se escriben igual.
  const perdidas = await conUnhandledRejectionArmado(() => {
    Promise.reject(new Error('perdida de control'));
  });
  assert.deepEqual(
    perdidas.map((p) => String(p.message)), ['perdida de control'],
    '🔴 DETECTOR CIEGO: se ha soltado un rechazo a propósito y el manejador no lo ha visto. '
    + 'Con esto roto, el test de la causa raíz daría verde pase lo que pase.',
  );
});

test('SCRUM-379 · (c) si la recarga va bien, no se inventa ningún aviso', async () => {
  const avisos = [];
  const refrescar = refrescarReal({
    recargar: () => Promise.resolve(),
    setStatus: (tono, texto) => avisos.push({ tono, texto }),
  });
  await refrescar();
  assert.deepEqual(avisos, [], '🔴 se pinta un aviso cuando todo fue bien');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA FORMA · los cinco sitios, derivados del AST
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// Los tests de arriba miden el COMPORTAMIENTO; éstos, que el patrón no vuelva. Arreglar solo el
// comportamiento deja la forma a merced del siguiente que copie el sitio de al lado — y el patrón
// malo estaba en cinco sitios precisamente porque se copió.

/** Todas las llamadas a `refrescar(...)`, con si llevan `await` y en qué línea están. */
const LLAMADAS = (() => {
  const out = [];
  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return;
    if (n.expression.text !== 'refrescar') return;
    out.push({ nodo: n, linea: linea(n), conAwait: !!n.parent && ts.isAwaitExpression(n.parent) });
  });
  return out;
})();

test('SCRUM-379 · SUELO: los CINCO sitios siguen ahí', () => {
  assert.equal(
    LLAMADAS.length, 5,
    `🔴 esperaba 5 refrescos tras acción y veo ${LLAMADAS.length} `
    + `(líneas ${LLAMADAS.map((l) => l.linea).join(', ') || 'ninguna'}). Los cinco son: emitir, `
    + 'enviar para firmar, firmar aquí, enviar por WhatsApp y subir foto. Si uno se fue, o la '
    + 'acción desapareció o volvió a llamar a la recarga por su cuenta.',
  );
});

test('SCRUM-379 · los cinco refrescos van con `await`', () => {
  const sinAwait = LLAMADAS.filter((l) => !l.conAwait).map((l) => `línea ${l.linea}`);
  assert.deepEqual(
    sinAwait, [],
    '🔴 refresco SIN `await` en ' + sinAwait.join(', ') + '. Es el defecto original tal cual: el '
    + 'handler termina antes que la recarga y su rechazo no entra en ningún `catch`.',
  );
});

test('SCRUM-379 · ningún refresco vive DENTRO del `try` de la escritura', () => {
  // El simétrico de la forma. Si el refresco vuelve dentro del `try` del POST, su fallo lo caza
  // el `catch` de la escritura y la pantalla dice que la acción falló CUANDO SÍ OCURRIÓ: eso es
  // SCRUM-375, que ya se pagó una vez en el camino del dinero.
  const dentro = [];
  for (const { nodo, linea: ln } of LLAMADAS) {
    for (let p = nodo; p; p = p.parent) {
      if (!ts.isTryStatement(p)) continue;
      let escribe = false;
      recorrer(p.tryBlock, (x) => {
        if (ts.isCallExpression(x) && x.expression.getText(sf).endsWith('apiRequest')) escribe = true;
      });
      if (escribe) { dentro.push(`línea ${ln}`); break; }
    }
  }
  assert.deepEqual(
    dentro, [],
    '🔴 el refresco ha vuelto dentro del `try` de la escritura en ' + dentro.join(', ') + '. '
    + 'Su fallo lo cazaría el `catch` del POST y la pantalla diría que la acción no salió cuando '
    + 'sí salió — el defecto de SCRUM-375, que es el opuesto de éste y no una mejora.',
  );
});

test('SCRUM-379 · la recarga cruda no se llama desde ningún sitio salvo el refresco', () => {
  // `recargar()` a pelo es lo que había antes. Se permite exactamente una llamada: la que hace
  // `refrescar`, que es quien gestiona su rechazo.
  const crudas = [];
  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return;
    if (n.expression.text !== 'recargar') return;
    let dentroDelRefresco = false;
    for (let p = n; p; p = p.parent) {
      if (ts.isVariableDeclaration(p) && p.name.getText(sf) === 'refrescar') dentroDelRefresco = true;
    }
    if (!dentroDelRefresco) crudas.push(`línea ${linea(n)}`);
  });
  assert.deepEqual(
    crudas, [],
    '🔴 se llama a `recargar()` fuera de `refrescar` en ' + crudas.join(', ') + '. Ahí el rechazo '
    + 'no lo gestiona nadie: es el patrón que este ticket retira. Pasa por `refrescar`.',
  );
});
