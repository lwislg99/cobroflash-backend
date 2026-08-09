// tests/_alcance-dominio.mjs — SCRUM-411 · ¿qué exports de dominio NO puede alcanzar un profesional?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE VIGILA
//
// Un módulo de dominio sin llamadores **pasa todos los tests, entra verde, y desde fuera es
// indistinguible de una función entregada**. Su ticket se cierra, y el cableado que falta deja de
// estar en ninguna lista. Ya han caído así `cambiarFlagFiscal` (SCRUM-218) y `borrarMerchant`
// (SCRUM-244, RGPD-1), los dos con el ticket CERRADO.
//
// ⚠️ LOS TESTS NO CUENTAN COMO LLAMADOR. Un módulo llamado solo por su test es exactamente el
// caso que se busca: por eso el grafo arranca en `src/index.ts` y `src/app.ts`, que son las
// entradas del proceso, y `tests/` no se mira.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA ALCANZABILIDAD POR FICHERO MIENTE — y esto lo aprendí fallando
//
// La primera versión de este censo daba `borradoMerchant.ts` por VIVO, porque `barridoDemo.ts`
// importa de él. Pero importa **dos constantes** (`ORDEN_BORRADO_MERCHANT`, `COLGADOS_DE_CHARGE`);
// **la función `borrarMerchant` no la importa nadie**. Un módulo vivo por una constante ESCONDE
// una función muerta.
//
// De ahí la regla de este fichero: **el veredicto es por EXPORT y por ALCANCE, nunca por módulo.**
// Un export está vivo solo si lo importa un fichero que a su vez es alcanzable desde una entrada.
//
// `export type` / `export interface` quedan fuera a propósito: no se pueden llamar, y contarlos
// inflaría el censo con cosas que nunca tendrán llamador en tiempo de ejecución.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export const ENTRADAS = ['src/index.ts', 'src/app.ts'];

const rel = (raiz, p) => path.relative(raiz, p).split(path.sep).join('/');

export function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Imports relativos de un fichero, resueltos a rutas reales. */
export function importsDe(ruta, codigo = null) {
  const sf = ts.createSourceFile(ruta, codigo ?? fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const v = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      const espec = n.moduleSpecifier.text;
      if (espec.startsWith('.')) {
        const base = path.resolve(path.dirname(ruta), espec);
        for (const cand of [base + '.ts', path.join(base, 'index.ts')]) {
          if (fs.existsSync(cand)) { out.push(cand); break; }
        }
      }
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  return out;
}

/** Nombres importados por un fichero (los que de verdad ata a otro módulo). */
export function nombresImportados(ruta, codigo = null) {
  const sf = ts.createSourceFile(ruta, codigo ?? fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = new Set();
  const v = (n) => {
    if (ts.isImportDeclaration(n)) {
      const b = n.importClause?.namedBindings;
      if (b && ts.isNamedImports(b)) for (const el of b.elements) out.add(el.name.text);
      if (n.importClause?.name) out.add(n.importClause.name.text);
      // `import * as x` ata el módulo entero: se marca para no dar por muerto lo que se use por `x.`
      if (b && ts.isNamespaceImport(b)) out.add('*');
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  return out;
}

/** Exports CON VALOR en tiempo de ejecución (función, clase, const). Los tipos, no. */
export function exportsDe(ruta, codigo = null) {
  const sf = ts.createSourceFile(ruta, codigo ?? fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const exportado = (n) => (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export) !== 0;
  const v = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && exportado(n)) out.push(n.name.text);
    else if (ts.isClassDeclaration(n) && n.name && exportado(n)) out.push(n.name.text);
    else if (ts.isVariableStatement(n) && exportado(n)) {
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) out.push(d.name.text);
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  return out;
}

/**
 * El análisis completo del árbol.
 *
 * Devuelve, por módulo de dominio: sus exports, cuáles NO tiene ningún importador ALCANZABLE, y
 * si el módulo entero es inalcanzable (ningún export vivo).
 */
export function analizar(raiz) {
  const src = path.join(raiz, 'src');
  // Sin `src/` no se REVIENTA: se devuelve un análisis vacío y marcado. Un analizador que lanza
  // dentro de una suite hace caer un test con un ENOENT que no nombra el problema real; y un cero
  // sin marcar se leería como «no hay nada inalcanzable», que es el verde que este fichero existe
  // para impedir. El suelo de arriba es quien convierte ese cero en rojo.
  if (!fs.existsSync(src)) {
    return {
      sinSrc: true,
      totalFicheros: 0, alcanzables: 0, modulosDominio: 0,
      modulos: [], inalcanzables: [], exportsHuerfanosEnModulosVivos: 0,
    };
  }
  const todos = ficherosTs(src);

  // ── Alcance: se camina el grafo desde las entradas del proceso ──────────────────────────
  const grafo = new Map(todos.map((p) => [p, importsDe(p)]));
  const alcanzables = new Set();
  const pila = ENTRADAS.map((r) => path.join(raiz, r)).filter((p) => fs.existsSync(p));
  while (pila.length) {
    const p = pila.pop();
    if (alcanzables.has(p)) continue;
    alcanzables.add(p);
    for (const q of (grafo.get(p) || [])) pila.push(q);
  }

  // ── Qué nombre importa cada fichero ALCANZABLE ──────────────────────────────────────────
  const importadoPor = new Map(); // nombre → [ficheros alcanzables que lo importan]
  const conNamespace = new Set();  // ficheros importados con `import * as`
  for (const p of todos) {
    if (!alcanzables.has(p)) continue; // un importador que nadie alcanza no da vida a nadie
    const nombres = nombresImportados(p);
    for (const n of nombres) {
      if (n === '*') { for (const q of grafo.get(p) || []) conNamespace.add(q); continue; }
      const lista = importadoPor.get(n) ?? [];
      lista.push(rel(raiz, p));
      importadoPor.set(n, lista);
    }
  }

  const dominio = todos.filter((p) => /\/modules\/[^/]+\/domain\//.test(rel(raiz, p)));
  const modulos = dominio.map((p) => {
    const r = rel(raiz, p);
    const exps = exportsDe(p);
    // Un módulo importado con `import * as` se da por vivo entero: no se puede saber qué se usa.
    const porNamespace = conNamespace.has(p);
    const huerfanos = porNamespace ? [] : exps.filter((nombre) => {
      const quien = (importadoPor.get(nombre) ?? []).filter((otro) => otro !== r);
      return quien.length === 0;
    });
    return {
      modulo: r,
      exports: exps,
      huerfanos,
      vivos: exps.length - huerfanos.length,
      inalcanzable: exps.length > 0 && huerfanos.length === exps.length,
      porNamespace,
    };
  });

  return {
    totalFicheros: todos.length,
    alcanzables: alcanzables.size,
    modulosDominio: modulos.length,
    modulos,
    inalcanzables: modulos.filter((m) => m.inalcanzable),
    exportsHuerfanosEnModulosVivos: modulos.filter((m) => !m.inalcanzable).reduce((a, m) => a + m.huerfanos.length, 0),
  };
}
