// tests/scrum381-scripts-cargables.test.mjs — SCRUM-381
//
// UN SCRIPT QUE NADIE EJECUTA NO TIENE FORMA DE DECIR QUE ESTÁ ROTO.
//
// `scripts/seed-demo.mjs` llevaba **tickets enteros sin poder ni arrancar**: importaba
// `./_wipe-demo.mjs`, que SCRUM-314 (`cbc2880`) borró al mover el barrido al dominio sin actualizar
// el import. No lo cazó nadie porque **ninguna suite tocaba la capa `scripts/`**. Se descubrió
// porque otra sesión necesitó datos a la una de la madrugada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SE COMPRUEBA SIN EJECUTAR
//
// Importar de verdad un sembrador **lo ejecuta**: abre una conexión y siembra. Este guard no
// necesita eso para contestar la pregunta —«¿este script podría siquiera arrancar?»— así que
// resuelve sus `import`/`require` **estáticamente**: cada especificador relativo tiene que existir
// en el árbol, y cada símbolo con nombre tiene que estar exportado por el fichero de destino.
//
// Es la misma pregunta que SCRUM-378 hace de las páginas HTML —«¿está cargado lo que necesita?»—
// una capa más abajo: allí el que carga es el navegador, aquí es Node.
//
// ⚠️ `dist/` es destino legítimo: `npm test` compila antes de correr, y los scripts importan de ahí
// por convención (`_conciliacion-fiscal.mjs`, `gen-registros-sample.mjs`). Si dist no estuviera
// construido, el suelo de abajo lo dice en vez de aprobar por ausencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'scripts');

/** Los scripts de la capa. Los `_*.mjs` son piezas compartidas y también tienen que resolver. */
function scripts() {
  return fs.readdirSync(DIR)
    .filter((f) => /\.(mjs|js|cjs)$/.test(f))
    .map((f) => path.join(DIR, f))
    .sort();
}

/** `import … from 'x'` y `require('x')` de un fichero, con los nombres que trae de cada uno. */
export function dependenciasDe(fuente) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const visita = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const nombres = [];
      const c = n.importClause;
      if (c?.namedBindings && ts.isNamedImports(c.namedBindings)) {
        for (const e of c.namedBindings.elements) nombres.push((e.propertyName ?? e.name).text);
      }
      out.push({ especificador: n.moduleSpecifier.text, nombres, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'require' &&
        n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      out.push({ especificador: n.arguments[0].text, nombres: [], linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

/** Lo que un módulo JS EXPORTA con nombre. `export *` marca el fichero como «no se puede afirmar». */
export function exportaciones(fuente) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true);
  const out = new Set();
  let reexportaTodo = false;
  for (const s of sf.statements) {
    if (ts.isExportDeclaration(s)) {
      if (!s.exportClause) { reexportaTodo = true; continue; }
      if (ts.isNamedExports(s.exportClause)) for (const e of s.exportClause.elements) out.add(e.name.text);
    }
    const exportado = ts.getCombinedModifierFlags(s) & ts.ModifierFlags.Export;
    if (exportado) {
      if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) out.add(s.name.text);
      if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text);
    }
  }
  // CommonJS compilado por tsc: `exports.foo = …`
  const visita = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression) &&
        n.left.expression.text === 'exports') out.add(n.left.name.text);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { nombres: out, reexportaTodo };
}

/** Resuelve un especificador relativo a fichero, o `null`. */
function resolver(desde, especificador) {
  if (!especificador.startsWith('.')) return null; // paquete: lo resuelve npm, no este guard
  const base = path.resolve(path.dirname(desde), especificador);
  for (const cand of [base, base + '.mjs', base + '.js', base + '.cjs', path.join(base, 'index.js')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-381 · SUELO: hay scripts, tienen dependencias y `dist/` está construido', () => {
  const lista = scripts();
  assert.ok(lista.length >= 10,
    `🔴 solo ${lista.length} scripts en la capa: el barrido no está leyendo, y «todos resuelven» ` +
    'sería un verde vacío.');

  const conDeps = lista.filter((f) => dependenciasDe(fs.readFileSync(f, 'utf8')).some((d) => d.especificador.startsWith('.')));
  assert.ok(conDeps.length >= 5,
    `🔴 solo ${conDeps.length} scripts con dependencias relativas: el lector de imports no está viendo nada.`);

  assert.ok(fs.existsSync(path.join(RAIZ, 'dist', 'modules')),
    '🔴 `dist/` no está construido. Los scripts importan de ahí por convención, así que sin dist ' +
    'este guard aprobaría por ausencia en vez de comprobar. `npm test` compila antes: si esto cae, ' +
    'es que se corrió el fichero suelto sin build.');
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-381 · 🔴 todo `import` de un script RESUELVE a un fichero que existe', () => {
  const rotos = [];
  for (const f of scripts()) {
    for (const d of dependenciasDe(fs.readFileSync(f, 'utf8'))) {
      if (!d.especificador.startsWith('.')) continue;
      if (!resolver(f, d.especificador)) {
        rotos.push(`${path.relative(RAIZ, f).replace(/\\/g, '/')}:${d.linea} → ${d.especificador}`);
      }
    }
  }
  assert.deepEqual(rotos, [],
    '🔴 HAY SCRIPTS QUE IMPORTAN FICHEROS QUE NO EXISTEN:\n    ' + rotos.join('\n    ') +
    '\n\n  Ese script no arranca: revienta en el primer `import`, antes de su primera línea útil.\n' +
    '  Es exactamente lo que le pasó a `seed-demo.mjs` durante tickets enteros sin que nadie se\n' +
    '  enterara, porque ninguna suite carga esta capa.');
});

test('SCRUM-381 · 🔴 todo símbolo importado EXISTE en el fichero de destino', () => {
  // La otra mitad: el fichero puede existir y no exportar ya lo que se le pide. Revienta igual, y
  // el mensaje de Node es peor de leer.
  const ausentes = [];
  for (const f of scripts()) {
    for (const d of dependenciasDe(fs.readFileSync(f, 'utf8'))) {
      if (!d.nombres.length) continue;
      const destino = resolver(f, d.especificador);
      if (!destino) continue; // ya lo cuenta el test de arriba
      const { nombres, reexportaTodo } = exportaciones(fs.readFileSync(destino, 'utf8'));
      if (reexportaTodo) continue; // con `export *` no se puede afirmar sin seguir la cadena
      for (const n of d.nombres) {
        if (!nombres.has(n)) {
          ausentes.push(`${path.relative(RAIZ, f).replace(/\\/g, '/')}:${d.linea} pide «${n}» a ` +
            `${path.relative(RAIZ, destino).replace(/\\/g, '/')}, que no lo exporta`);
        }
      }
    }
  }
  assert.deepEqual(ausentes, [],
    '🔴 HAY SCRIPTS QUE PIDEN SÍMBOLOS QUE SU DESTINO YA NO EXPORTA:\n    ' + ausentes.join('\n    ') +
    '\n\n  El fichero existe, así que el import «parece» bien: falla al usarlo.');
});

// ── LOS ROJOS QUE LO DEFINEN ─────────────────────────────────────────────────────────────

test('SCRUM-381 · 🔴 borrar un fichero importado por un script hace caer el guard NOMBRÁNDOLO', () => {
  // El sabotaje que reproduce el defecto ①: se simula el árbol SIN un fichero que un script importa.
  const victima = path.join(DIR, '_db-guard.mjs');
  assert.ok(fs.existsSync(victima), '🔴 el fichero que este test finge borrar ya no existe');

  const quienLoImporta = scripts().filter((f) =>
    dependenciasDe(fs.readFileSync(f, 'utf8')).some((d) => resolver(f, d.especificador) === victima));
  assert.ok(quienLoImporta.length > 0,
    '🔴 LA MUTACIÓN NO PRUEBA NADA: ningún script importa `_db-guard.mjs`, así que borrarlo no ' +
    'rompería a nadie. Elige otra víctima antes de fiarte de este rojo.');

  // Se recalcula con el fichero fuera del árbol, sin tocar el disco.
  const resolverSinVictima = (desde, esp) => {
    const r = resolver(desde, esp);
    return r === victima ? null : r;
  };
  const rotos = [];
  for (const f of scripts()) {
    for (const d of dependenciasDe(fs.readFileSync(f, 'utf8'))) {
      if (!d.especificador.startsWith('.')) continue;
      if (!resolverSinVictima(f, d.especificador)) rotos.push(`${path.basename(f)} → ${d.especificador}`);
    }
  }
  assert.ok(rotos.length >= quienLoImporta.length,
    `🔴 EL GUARD NO CAZA EL FICHERO BORRADO. Lo importan ${quienLoImporta.length} scripts y el ` +
    `guard solo ve ${rotos.length} rotos: el hueco de la capa scripts/ seguiría abierto, que es ` +
    'justo el que dejó pasar el import muerto de `seed-demo.mjs`.');
  assert.ok(rotos.some((r) => r.includes('_db-guard')),
    `🔴 el rojo no NOMBRA el fichero que falta. Vistos: ${rotos.join(', ') || 'ninguno'}`);
});

test('SCRUM-381 · 🔴 y quitar un símbolo del destino también cae, nombrando cuál', () => {
  // El defecto de la segunda mitad: el fichero sigue, el símbolo no.
  const destino = path.join(RAIZ, 'dist', 'modules', 'system', 'domain', 'barridoDemo.js');
  assert.ok(fs.existsSync(destino), '🔴 el destino de la prueba no existe: ¿está dist construido?');

  const fuente = fs.readFileSync(destino, 'utf8');
  const { nombres } = exportaciones(fuente);
  assert.ok(nombres.has('barridoDemo'),
    '🔴 (suelo) `barridoDemo` ya no se exporta ahí: este test estaría midiendo otra cosa');

  // Sin ese símbolo, el lector tiene que notarlo.
  const sinSimbolo = fuente.replace(/exports\.barridoDemo\s*=/g, 'exports.__otro =');
  assert.notEqual(sinSimbolo, fuente, '🔴 LA MUTACIÓN NO SE APLICÓ: no encuentro la exportación');
  assert.equal(exportaciones(sinSimbolo).nombres.has('barridoDemo'), false,
    '🔴 el lector de exportaciones sigue viendo un símbolo que ya no está: no distingue nada');
});
