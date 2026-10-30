// tests/scrum870b-sistema-informatico-sin-caracteres-1287.test.mjs — SCRUM-870b · puesto J6
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// NINGÚN VALOR DEL BLOQUE `SistemaInformatico` LLEVA LOS CARACTERES QUE RECHAZA LA AEAT (1287).
//
// La validación 1287 del catálogo de la AEAT rechaza un registro cuyo campo contiene `<`, `>`, `"`,
// `'` o `=`. El bloque `SistemaInformatico` viaja en CADA registro (alta y anulación) con el nombre
// y el NIF del productor, y no lo protege ningún saneador: la lista que existe
// (`PROHIBIDOS_SERIE`, `src/core/validation/fiscalInput.ts`) protege `NumSerieFactura`, y
// `xmlEscape` escapa, no sanea — `'` sale como `&apos;` y la AEAT lo lee como `'` (SCRUM-870
// c.15926). Cuando entre la denominación de la SL (c.20864 ②), un apóstrofo o unas comillas
// saldrían tal cual.
//
// ── LA POBLACIÓN, Y DE DÓNDE SALE ────────────────────────────────────────────────────────────
//
// No se fija a mano: se LEE por AST de las plantillas de `verifactu.service.ts` que escriben
// `<sum1:SistemaInformatico>` (hoy dos: alta y anulación, nueve elementos cada una). Cada elemento
// es una de tres cosas:
//   · un LITERAL de la plantilla (`YaQu`, `S`) → se comprueba su texto;
//   · `productor.<campo>`, cuyo valor es un identificador importado de `productor.ts` → se
//     comprueba el literal de esa constante;
//   · un campo de FUERA_DE_POBLACION (abajo), con su motivo y con el AST que lo sostiene.
// Un elemento que no sea ninguna de las tres tumba el test: la población tiene que crecer a mano.
// El constructor de `registro.builder.ts` también escribe el bloque, pero con lo que le pasan, y
// en `src/` no lo llama nadie (sólo `scripts/`): si alguien lo llama, el test lo dice.
//
// ⛔ Este fichero NO toca `src/` ni `dist/`: sólo LEE fuentes (regla 38). Los positivos se SIEMBRAN
//    sobre copias en memoria del texto, pasadas por las mismas funciones que miden el árbol real.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REL = {
  productor: 'src/modules/fiscal/verifactu/productor.ts',
  servicio: 'src/modules/invoicing/domain/verifactu.service.ts',
  entrada: 'src/core/validation/fiscalInput.ts',
  builder: 'src/modules/fiscal/verifactu/registro.builder.ts',
};
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const parsear = (nombre, texto) => ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true);

// Los cinco del catálogo oficial (validación 1287), copiados de su texto. Se cruzan con la lista
// de la casa para que, si una de las dos cambia, se note.
const CATALOGO_1287 = ['<', '>', '"', "'", '='];

// Campos de `SistemaInformatico` que NO salen de `productor.ts`, con el callee que lo sostiene.
const FUERA_DE_POBLACION = {
  numInstalacion: { callee: 'numeroInstalacion', motivo: 'String(merchant.id): sólo dígitos (instalacion.ts, SCRUM-524g)' },
  indicadorMultiplesOT: { callee: 'indicadorMultiplesOT', motivo: "tipado 'S' | 'N' (instalacion.ts)" },
};

function recorrer(nodo, fn) { fn(nodo); ts.forEachChild(nodo, (h) => recorrer(h, fn)); }

/** La lista de la casa, leída por AST (no está exportada y no se exporta para esto). */
function prohibidosDeLaCasa(texto) {
  let lista = null;
  recorrer(parsear('fiscalInput.ts', texto), (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'PROHIBIDOS_SERIE'
      && n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
      lista = n.initializer.elements.filter(ts.isStringLiteral).map((e) => e.text);
    }
  });
  return lista;
}

/** `export const X = "literal"` de productor.ts → Map nombre → valor (o null si no es literal). */
function constantesDelProductor(texto) {
  const m = new Map();
  for (const st of parsear('productor.ts', texto).statements) {
    if (!ts.isVariableStatement(st)) continue;
    if (!st.modifiers?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      const i = d.initializer;
      if (i && ts.isObjectLiteralExpression(ts.isAsExpression(i) ? i.expression : i)) continue; // el agregado
      m.set(d.name.getText(), i && (ts.isStringLiteral(i) || ts.isNoSubstitutionTemplateLiteral(i)) ? i.text : null);
    }
  }
  return m;
}

/** Del servicio: los bloques `SistemaInformatico` (elementos y origen) y los objetos `productor`. */
function sistemaInformaticoDelServicio(texto) {
  const sf = parsear('verifactu.service.ts', texto);
  const importadosDelProductor = new Set();
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && /fiscal\/verifactu\/productor$/.test(st.moduleSpecifier.text)) {
      for (const e of st.importClause?.namedBindings?.elements ?? []) importadosDelProductor.add(e.name.text);
    }
  }
  const objetos = []; // cada objeto `productor` → Map campo → nodo inicializador
  const bloques = [];
  recorrer(sf, (n) => {
    const esProductor = (ts.isVariableDeclaration(n) || ts.isPropertyAssignment(n))
      && n.name.getText() === 'productor' && n.initializer && ts.isObjectLiteralExpression(n.initializer);
    if (esProductor) {
      const campos = new Map();
      for (const p of n.initializer.properties) if (ts.isPropertyAssignment(p)) campos.set(p.name.getText(), p.initializer);
      objetos.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, campos });
    }
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const trozos = ts.isTemplateExpression(n) ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)] : [n.text];
      if (!trozos.some((t) => t.includes('<sum1:SistemaInformatico>'))) return;
      const exprs = ts.isTemplateExpression(n) ? n.templateSpans.map((s) => s.expression) : [];
      // Texto con marcas \x00N\x00 en el sitio de cada expresión.
      let plano = trozos[0];
      exprs.forEach((e, k) => { plano += `\x00${k}\x00` + trozos[k + 1]; });
      const ini = plano.indexOf('<sum1:SistemaInformatico>');
      const fin = plano.indexOf('</sum1:SistemaInformatico>', ini);
      const cuerpo = fin < 0 ? '' : plano.slice(ini, fin);
      const elementos = [];
      for (const [, tag, contenido] of cuerpo.matchAll(/<sum1:(\w+)>([^<]*)<\/sum1:\1>/g)) {
        const marca = /^\x00(\d+)\x00$/.exec(contenido);
        elementos.push(marca ? { tag, expr: exprs[Number(marca[1])] } : { tag, literal: contenido });
      }
      bloques.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, elementos });
    }
  });
  return { importadosDelProductor, objetos, bloques };
}

/** `xmlEscape(productor.X)` o `productor.X` → 'X'; cualquier otra cosa → null. */
function campoDeProductor(expr) {
  let e = expr;
  if (ts.isCallExpression(e) && e.expression.getText() === 'xmlEscape' && e.arguments.length === 1) e = e.arguments[0];
  return ts.isPropertyAccessExpression(e) && e.expression.getText() === 'productor' ? e.name.text : null;
}

/** El veredicto: { valores: [{donde, valor}], fallos: [texto] } sobre unos textos dados. */
function medir({ productor, servicio, prohibidos }) {
  const fallos = [];
  const valores = [];
  const constantes = constantesDelProductor(productor);
  const { importadosDelProductor, objetos, bloques } = sistemaInformaticoDelServicio(servicio);
  if (bloques.length === 0) fallos.push('CIEGO: ninguna plantilla de verifactu.service.ts escribe <sum1:SistemaInformatico>');
  if (objetos.length === 0) fallos.push('CIEGO: no encuentro ningún objeto `productor` en verifactu.service.ts');

  for (const b of bloques) {
    if (b.elementos.length === 0) fallos.push(`CIEGO: el bloque de la línea ${b.linea} no tiene elementos legibles`);
    for (const el of b.elementos) {
      const donde = `verifactu.service.ts:${b.linea} <${el.tag}>`;
      if ('literal' in el) { valores.push({ donde: `${donde} (literal)`, valor: el.literal }); continue; }
      const campo = campoDeProductor(el.expr);
      if (!campo) { fallos.push(`${donde}: origen desconocido «${el.expr.getText()}» — la población tiene que crecer`); continue; }
      for (const o of objetos) {
        const ini = o.campos.get(campo);
        if (!ini) { fallos.push(`${donde}: el objeto productor de la línea ${o.linea} no tiene «${campo}»`); continue; }
        if (FUERA_DE_POBLACION[campo]) {
          const ok = ts.isCallExpression(ini) && ini.expression.getText() === FUERA_DE_POBLACION[campo].callee;
          if (!ok) fallos.push(`${donde}: «${campo}» ya no sale de ${FUERA_DE_POBLACION[campo].callee}() (línea ${o.linea}): ${ini.getText()}`);
          continue;
        }
        const id = ts.isIdentifier(ini) ? ini.text : null;
        if (!id || !importadosDelProductor.has(id)) { fallos.push(`${donde}: «${campo}» no sale de productor.ts (línea ${o.linea}): ${ini.getText()}`); continue; }
        if (!constantes.has(id)) { fallos.push(`${donde}: ${id} no es una constante exportada de productor.ts`); continue; }
        const v = constantes.get(id);
        if (v === null) { fallos.push(`CIEGO: ${id} no es un literal en productor.ts y no se puede leer sin ejecutar`); continue; }
        valores.push({ donde: `${donde} ← productor.ts ${id}`, valor: v });
      }
    }
  }
  for (const { donde, valor } of valores) {
    for (const c of prohibidos) if (valor.includes(c)) fallos.push(`1287: ${donde} = ${JSON.stringify(valor)} contiene ${JSON.stringify(c)}`);
  }
  return { valores, fallos, bloques, constantes };
}

const REAL = { productor: leer(REL.productor), servicio: leer(REL.servicio) };
const PROHIBIDOS = prohibidosDeLaCasa(leer(REL.entrada));

test('la lista de 1287 de la casa es la del catálogo, ni uno más ni uno menos', () => {
  assert.ok(PROHIBIDOS, 'no encuentro PROHIBIDOS_SERIE en fiscalInput.ts');
  assert.deepEqual([...PROHIBIDOS].sort(), [...CATALOGO_1287].sort());
});

test('árbol real: ningún valor de SistemaInformatico lleva < > " \' =', () => {
  const r = medir({ ...REAL, prohibidos: PROHIBIDOS });
  // Población declarada y con suelo: dos bloques (alta y anulación), nueve elementos cada uno, y
  // las cuatro constantes del productor leídas en cada bloque.
  assert.deepEqual(r.fallos, []);
  assert.ok(r.bloques.length >= 2, `bloques SistemaInformatico: ${r.bloques.length}`);
  for (const b of r.bloques) {
    const tags = b.elementos.map((e) => e.tag);
    for (const t of ['NombreRazon', 'NIF', 'NombreSistemaInformatico', 'IdSistemaInformatico', 'Version']) {
      assert.ok(tags.includes(t), `el bloque de la línea ${b.linea} no tiene <${t}>`);
    }
  }
  const leidas = new Set(r.valores.map((v) => v.donde.split(' ← productor.ts ')[1]).filter(Boolean));
  assert.deepEqual([...leidas].sort(), ['VERIFACTU_ID_SISTEMA', 'VERIFACTU_PRODUCTOR_NIF', 'VERIFACTU_PRODUCTOR_NOMBRE', 'VERIFACTU_VERSION']);
  console.log(`# población: ${r.bloques.length} bloques · ${r.valores.length} valores comprobados · ${PROHIBIDOS.length} caracteres`);
});

test('el constructor de registro.builder.ts no lo llama nadie en src/ (si lo llaman, la población crece)', () => {
  const llamadas = [];
  const pila = [path.join(RAIZ, 'src')];
  let mirados = 0;
  while (pila.length) {
    const d = pila.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { pila.push(p); continue; }
      if (!p.endsWith('.ts')) continue;
      mirados++;
      const texto = fs.readFileSync(p, 'utf8');
      if (!/buildRegistro(Alta|Anulacion)/.test(texto)) continue;
      recorrer(parsear(p, texto), (n) => {
        if (ts.isCallExpression(n) && /^buildRegistro(Alta|Anulacion)$/.test(n.expression.getText())) llamadas.push(path.relative(RAIZ, p));
      });
    }
  }
  assert.ok(mirados > 100, `sólo miré ${mirados} ficheros .ts en src/`);
  assert.deepEqual(llamadas, []);
});

// ── POSITIVOS SEMBRADOS: el mismo instrumento, sobre copias fabricadas ─────────────────────────

test('sembrado: un apóstrofo en el nombre del productor cae y nombra la constante y el carácter', () => {
  const nombre = constantesDelProductor(REAL.productor).get('VERIFACTU_PRODUCTOR_NOMBRE');
  assert.ok(nombre, 'no leo VERIFACTU_PRODUCTOR_NOMBRE');
  const copia = REAL.productor.replace(`"${nombre}"`, `"YaQu D'Oficios, S.L."`);
  assert.notEqual(copia, REAL.productor, 'la siembra no se aplicó');
  const r = medir({ productor: copia, servicio: REAL.servicio, prohibidos: PROHIBIDOS });
  assert.ok(r.fallos.length > 0, 'la copia sembrada salió verde');
  assert.ok(r.fallos.every((f) => f.includes('VERIFACTU_PRODUCTOR_NOMBRE') && f.includes(`"'"`)), r.fallos.join('\n'));
});

test('sembrado: cada uno de los cinco caracteres, en cada constante, cae', () => {
  const constantes = constantesDelProductor(REAL.productor);
  for (const id of ['VERIFACTU_PRODUCTOR_NOMBRE', 'VERIFACTU_PRODUCTOR_NIF', 'VERIFACTU_ID_SISTEMA', 'VERIFACTU_VERSION']) {
    for (const c of CATALOGO_1287) {
      const v = constantes.get(id);
      const copia = REAL.productor.replace(`${id} = "${v}"`, `${id} = ${JSON.stringify(v + c)}`);
      assert.notEqual(copia, REAL.productor, `la siembra de ${id} no se aplicó`);
      const r = medir({ productor: copia, servicio: REAL.servicio, prohibidos: PROHIBIDOS });
      assert.ok(r.fallos.some((f) => f.includes(id) && f.includes(JSON.stringify(c))), `${id} + ${c}: ${r.fallos.join(' | ') || 'verde'}`);
    }
  }
});

test('sembrado: un literal de la plantilla con comillas cae (NombreSistemaInformatico)', () => {
  const copia = REAL.servicio.replace('<sum1:NombreSistemaInformatico>YaQu<', '<sum1:NombreSistemaInformatico>"YaQu"<');
  assert.notEqual(copia, REAL.servicio, 'la siembra no se aplicó');
  const r = medir({ productor: REAL.productor, servicio: copia, prohibidos: PROHIBIDOS });
  assert.ok(r.fallos.some((f) => f.includes('NombreSistemaInformatico') && f.includes('(literal)')), r.fallos.join('\n') || 'verde');
});

test('sembrado: un elemento nuevo de otro origen cae como «origen desconocido»', () => {
  const copia = REAL.servicio.replace('<sum1:NombreSistemaInformatico>YaQu<', '<sum1:NombreSistemaInformatico>${xmlEscape(merchant.name)}<');
  assert.notEqual(copia, REAL.servicio, 'la siembra no se aplicó');
  const r = medir({ productor: REAL.productor, servicio: copia, prohibidos: PROHIBIDOS });
  assert.ok(r.fallos.some((f) => f.includes('origen desconocido') && f.includes('merchant.name')), r.fallos.join('\n') || 'verde');
});

test('sembrado: una constante que deja de ser literal dice CIEGO, no verde', () => {
  const copia = REAL.productor.replace(/VERIFACTU_VERSION = "[^"]*"/, 'VERIFACTU_VERSION = String(1)');
  assert.notEqual(copia, REAL.productor, 'la siembra no se aplicó');
  const r = medir({ productor: copia, servicio: REAL.servicio, prohibidos: PROHIBIDOS });
  assert.ok(r.fallos.some((f) => f.startsWith('CIEGO') && f.includes('VERIFACTU_VERSION')), r.fallos.join('\n') || 'verde');
});

test('sembrado: sin bloques SistemaInformatico el instrumento dice CIEGO, no verde', () => {
  const copia = REAL.servicio.replaceAll('<sum1:SistemaInformatico>', '<sum1:Otra>');
  const r = medir({ productor: REAL.productor, servicio: copia, prohibidos: PROHIBIDOS });
  assert.ok(r.fallos.some((f) => f.startsWith('CIEGO') && f.includes('SistemaInformatico')), r.fallos.join('\n') || 'verde');
});
