// tests/scrum387-procedencia-aprobacion.test.mjs — SCRUM-387
//
// «APROBADO POR EL FUNDADOR» ES HOY UNA CADENA QUE PUEDE ESCRIBIR CUALQUIERA.
//
// La regla 30 dice que la microcopy la aprueba SOLO el fundador. Pero la regla vive en la cabeza
// de quien la respeta: en el repo, «aprobado» es texto libre, y una vez escrito es
// **indistinguible de una aprobación real**. Ya produjo una contradicción medible — seis
// identificadores marcados como aprobados el 6-ago frente a cinco distintos que el fundador
// aprobó ese mismo día, y cuatro de cinco no coincidían.
//
// Y el coste no es cosmético: esos ids se guardan en una columna. Cambiarlos después de migrar
// obliga a reescribir filas de un documento firmado.
//
// ── QUÉ EXIGE ESTE GUARD, Y QUÉ NO ──────────────────────────────────────────────────────────
// NO valida que la aprobación sea cierta —eso no lo puede saber un test— sino que sea
// **RASTREABLE**: que diga DÓNDE consta. Con eso, comprobarla cuesta un clic en vez de una
// arqueología por el historial.
//
// Procedencia rastreable = un ticket (`SCRUM-<n>`) o un documento (`docs/…`) en el mismo bloque
// de comentario. Una FECHA SOLA no vale: «aprobado el 5-ago» no dice dónde mirar, y es
// exactamente la forma que tenían las seis marcas contradictorias.
//
// ── EL TRINQUETE, Y POR QUÉ ES BIDIRECCIONAL ────────────────────────────────────────────────
// Las marcas sin procedencia que ya existen NO se pueden arreglar aquí: reescribir una
// atribución de aprobación es afirmar algo sobre el fundador que esta sesión no sabe (regla 30).
// Así que se congelan y se cuentan. El número **no puede subir** —código nuevo nace con
// procedencia— y **tampoco puede bajar en silencio**: si alguien arregla una, el test cae y
// obliga a bajar la cifra, que es como queda constancia de la mejora (patrón SCRUM-243/273/275).
//
// ⚠️ SE MIRAN COMENTARIOS, NO EL FICHERO ENTERO. La marca es una convención de comentario; un
// `grep` sobre el fuente casaría el texto de pantalla que dice «presupuesto aprobado», que es
// lenguaje de dominio y no tiene nada que ver. Se extraen con el escáner de TypeScript.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIRS = ['src', 'public'];

// La MARCA de aprobación: «aprobad{o,a,os,as} por el fundador». No basta «aprobado» a secas —
// «presupuesto aprobado» es el dominio del producto, no una atribución al fundador.
const MARCA = /aprobad[oa]s?\s+por\s+el\s+fundador/i;
// Procedencia RASTREABLE: un ticket o un documento. Una fecha sola no dice dónde mirar.
const PROCEDENCIA = /SCRUM-\d+|docs\/[\w./ -]+/i;

function ficheros(dir) {
  const out = [];
  (function andar(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') andar(p); }
      else if (/\.(ts|js|mjs)$/.test(e.name)) out.push(p);
    }
  })(path.join(RAIZ, dir));
  return out;
}

/** Los COMENTARIOS de un fuente, agrupados en bloques: `//` seguidos cuentan como uno solo. */
function bloquesDeComentario(codigo, nombre) {
  const escaner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, codigo);
  const trozos = [];
  let k;
  while ((k = escaner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (k === ts.SyntaxKind.SingleLineCommentTrivia || k === ts.SyntaxKind.MultiLineCommentTrivia) {
      trozos.push({ texto: escaner.getTokenText(), inicio: escaner.getTokenStart(), fin: escaner.getTokenEnd(), suelto: k === ts.SyntaxKind.SingleLineCommentTrivia });
    }
  }
  // Unir los `//` consecutivos: la marca y su `(SCRUM-264)` suelen ir en líneas distintas del
  // mismo comentario, y separarlas convertiría una procedencia válida en un falso positivo.
  const bloques = [];
  for (const t of trozos) {
    const ult = bloques[bloques.length - 1];
    const entre = ult ? codigo.slice(ult.fin, t.inicio) : null;
    if (ult && ult.suelto && t.suelto && /^\s*$/.test(entre) && (entre.match(/\n/g) || []).length <= 1) {
      ult.texto += '\n' + t.texto; ult.fin = t.fin;
    } else {
      bloques.push({ ...t, fichero: nombre, linea: codigo.slice(0, t.inicio).split('\n').length });
    }
  }
  return bloques;
}

function censar() {
  const conProcedencia = [];
  const sinProcedencia = [];
  for (const dir of DIRS) {
    for (const f of ficheros(dir)) {
      const codigo = fs.readFileSync(f, 'utf8');
      if (!MARCA.test(codigo)) continue; // atajo barato; el escáner solo corre donde puede haber algo
      for (const b of bloquesDeComentario(codigo, path.relative(RAIZ, f).replace(/\\/g, '/'))) {
        if (!MARCA.test(b.texto)) continue;
        const donde = `${b.fichero}:${b.linea}`;
        if (PROCEDENCIA.test(b.texto)) conProcedencia.push(donde); else sinProcedencia.push(donde);
      }
    }
  }
  return { conProcedencia, sinProcedencia };
}

// ── EL TRINQUETE ─────────────────────────────────────────────────────────────────────────────
// Marcas de aprobación SIN procedencia rastreable que había cuando se encendió el guard.
// Solo puede BAJAR, y bajarlo obliga a tocar esta línea: así la mejora queda escrita.
export const SIN_PROCEDENCIA = 10;

test('SCRUM-387 · SUELO: el censo encuentra marcas de aprobación de verdad', () => {
  const { conProcedencia, sinProcedencia } = censar();
  const total = conProcedencia.length + sinProcedencia.length;
  assert.ok(total >= 20,
    `solo ${total} marcas «aprobado por el fundador» encontradas en src/ y public/: el escáner no está mirando. Cero marcas NO significa «todo limpio»`);
  assert.ok(conProcedencia.length > 0,
    'ninguna marca con procedencia: si TODAS salen sin procedencia, lo roto es el detector de procedencia, no el árbol');
});

test('SCRUM-387 · el trinquete no sube: código nuevo nace con procedencia rastreable', () => {
  const { sinProcedencia } = censar();
  assert.ok(
    sinProcedencia.length <= SIN_PROCEDENCIA,
    `han aparecido marcas «aprobado por el fundador» SIN decir dónde consta la aprobación.\n` +
    `  antes: ${SIN_PROCEDENCIA} · ahora: ${sinProcedencia.length}\n` +
    `  ${sinProcedencia.join('\n  ')}\n\n` +
    `  Añade el ticket (SCRUM-<n>) o el documento (docs/…) donde consta. Una fecha sola no vale:\n` +
    `  no dice dónde mirar, y es la forma que tenían las seis marcas que se contradijeron.`,
  );
});

test('SCRUM-387 · el trinquete tampoco baja en silencio: la mejora se escribe', () => {
  const { sinProcedencia } = censar();
  assert.ok(
    sinProcedencia.length >= SIN_PROCEDENCIA,
    `se han arreglado marcas sin procedencia (${SIN_PROCEDENCIA} → ${sinProcedencia.length}) y el número no se ha bajado.\n` +
    `  Baja SIN_PROCEDENCIA a ${sinProcedencia.length} en este fichero: si no, el trinquete deja de\n` +
    `  proteger el hueco ya cerrado y mañana vuelve a colarse una.`,
  );
});

test('SCRUM-387 · una FECHA sola no es procedencia; un ticket o un documento sí', () => {
  // El detector, probado contra casos escritos a mano — no contra el árbol, que puede cambiar.
  const evaluar = (comentario) => {
    const b = bloquesDeComentario(comentario + '\nconst x = 1;', 'prueba.ts').filter((x) => MARCA.test(x.texto));
    assert.equal(b.length, 1, `el escáner no vio la marca en: ${comentario}`);
    return PROCEDENCIA.test(b[0].texto);
  };
  assert.equal(evaluar('// Microcopy aprobada por el fundador el 5-ago-2026.'), false, 'una fecha sola no dice dónde mirar');
  assert.equal(evaluar('// Microcopy aprobada por el fundador (SCRUM-264, regla 30).'), true);
  assert.equal(evaluar('// Copy aprobado por el fundador (23-jul, docs/Sprint Scrum/SESION_ACTUAL_SCRUM-69.md)'), true);
  // Y la procedencia vale aunque vaya en otra línea del MISMO bloque:
  assert.equal(evaluar('// Los diez rótulos, aprobados por el fundador.\n// Consta en SCRUM-284.'), true);
  // …pero no si es otro comentario distinto, separado por código:
  const separado = bloquesDeComentario('// aprobado por el fundador\nconst x = 1;\n// SCRUM-284\n', 'p.ts')
    .filter((b) => MARCA.test(b.texto));
  assert.equal(PROCEDENCIA.test(separado[0].texto), false, 'un SCRUM-<n> en otro comentario, tras código, no es la procedencia de esta marca');
});

test('SCRUM-387 · «presupuesto aprobado» NO es una marca de aprobación', () => {
  // La trampa que haría inútil el guard: «aprobado» es lenguaje de dominio en este producto.
  // Si la marca casara con eso, saldrían decenas de falsos positivos y alguien lo silenciaría.
  const codigo = '// El presupuesto aprobado por el cliente pasa a Trabajo.\nconst x = 1;';
  const b = bloquesDeComentario(codigo, 'p.ts').filter((x) => MARCA.test(x.texto));
  assert.deepEqual(b, [], 'la marca ha casado con lenguaje de dominio');
});
