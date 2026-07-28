import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = path.join(raiz, 'prisma', 'schema.prisma');
const FIXTURE = path.join(raiz, 'tests', '_merchant-fixture.mjs');

/**
 * SCRUM-172 — la cobertura de `MODELOS_POR_MERCHANT` se DERIVA del schema, no se recuerda.
 *
 * El patrón multi-tenant de este repo es **de columna, no de relación**: `merchantId` es un
 * `Int` pelado, sin `@relation` y sin FK. La BD no puede cascadear ni quejarse, así que lo
 * ÚNICO que borra los hijos de un merchant efímero es esa lista, mantenida a mano.
 *
 * Si alguien añade un modelo con `merchantId` y no lo registra, no falla nada: no hay FK que
 * proteste, el `delete` del merchant sale exit 0, el test pasa verde y las filas quedan
 * huérfanas para siempre, en las tres BD donde corran los tests.
 *
 * Y ya ha pasado con la DOCUMENTACIÓN: un comentario mergeado prometía FK para 21 modelos
 * cuando era cierto para 12. Se arregló reescribiendo el comentario — es decir, se arregló el
 * síntoma. Este guard existe para que la próxima vez lo diga un test.
 */

const camel = (m) => m.charAt(0).toLowerCase() + m.slice(1);

/**
 * Modelos con columna de tenancy, DERIVADOS del texto del schema. Pura a propósito: así el
 * rojo se puede provocar con un schema sintético, sin tocar `prisma/schema.prisma` (que es el
 * único freno duro del repo, §3 de ASESOR.md — de aquí no se toca ni para probar).
 */
export function modelosConTenancy(schemaText) {
  const out = [];
  let modelo = null;
  for (const linea of String(schemaText || '').replace(/\r/g, '').split('\n')) {
    const m = /^\s*model\s+(\w+)\s*\{/.exec(linea);
    if (m) { modelo = m[1]; continue; }
    if (!modelo) continue;
    if (/^\s*\}/.test(linea)) { modelo = null; continue; }
    if (/\bmerchantId\b/.test(linea) && /\bInt\b/.test(linea)) {
      out.push({ modelo, nullable: /\bInt\?/.test(linea) });
    }
  }
  return out;
}

/** La lista se lee como TEXTO: no está exportada y este guard no debe modificar el fixture. */
function listaDeclarada(fuente) {
  const i = fuente.indexOf('const MODELOS_POR_MERCHANT');
  assert.ok(i !== -1, 'no se encuentra MODELOS_POR_MERCHANT en _merchant-fixture.mjs');
  const bloque = fuente.slice(i, fuente.indexOf('];', i));
  // Sin comentarios: dentro del bloque hay prosa que menciona nombres de modelo.
  const sinComentarios = bloque.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  return [...sinComentarios.matchAll(/'([A-Za-z]\w*)'/g)].map((m) => m[1]);
}

test('SCRUM-172: todo modelo con `merchantId` está en MODELOS_POR_MERCHANT', () => {
  const derivados = modelosConTenancy(fs.readFileSync(SCHEMA, 'utf8'));
  const declarados = listaDeclarada(fs.readFileSync(FIXTURE, 'utf8'));

  // Los NULLABLE se excluyen de ESTA comprobación a propósito — ver el test siguiente.
  const faltan = derivados
    .filter((d) => !d.nullable)
    .map((d) => camel(d.modelo))
    .filter((m) => !declarados.includes(m));

  assert.deepEqual(
    faltan, [],
    `\n\n🔴 Modelo(s) con \`merchantId\` que NADIE barre:\n` +
    faltan.map((m) => `   · ${m}`).join('\n') +
    '\n\nEl patrón multi-tenant aquí es de COLUMNA, no de relación: no hay FK que cascadee ni\n' +
    'que proteste. Sin entrada en MODELOS_POR_MERCHANT, las filas de ese modelo sobreviven al\n' +
    'merchant efímero y quedan huérfanas EN SILENCIO en las tres BD.\n' +
    'Añádelo a la lista (tests/_merchant-fixture.mjs), respetando el orden de dependencias.\n'
  );
});

test('SCRUM-172: un `merchantId` NULLABLE no cuenta como cubierto (SCRUM-174)', () => {
  /**
   * LA PARTE QUE ESTE GUARD NO PUEDE DAR POR BUENA, y es el motivo de que SCRUM-174 fuera
   * ticket aparte: `botSession.merchantId` es `Int?`. Está en la lista, el barrido se ejecuta
   * — y aun así deja filas, porque `where: { merchantId: N }` NO casa con `merchantId = null`,
   * que es justo el estado del PRIMER CONTACTO (la sesión se cachea por phone antes de saber
   * de qué merchant es).
   *
   * Es un fallo de PREDICADO, no de cobertura. Si este guard contara "está en la lista ⇒
   * cubierto", le pondría un SELLO DE GARANTÍA a un agujero real. Por eso exige que cada
   * modelo nullable tenga además su barrido propio documentado.
   */
  const derivados = modelosConTenancy(fs.readFileSync(SCHEMA, 'utf8'));
  const nullables = derivados.filter((d) => d.nullable).map((d) => camel(d.modelo));
  const fixture = fs.readFileSync(FIXTURE, 'utf8');

  for (const m of nullables) {
    assert.match(
      fixture, new RegExp(`SCRUM-174[\\s\\S]{0,400}${m}|${m}[\\s\\S]{0,400}SCRUM-174`),
      `\n\n🔴 \`${m}\` tiene la columna de tenancy NULLABLE y no consta su barrido propio.\n\n` +
      'Estar en MODELOS_POR_MERCHANT NO basta: `where: { merchantId }` no alcanza las filas con\n' +
      'merchantId null. Necesita un predicado adicional (SCRUM-174 lo resolvió por `phone` para\n' +
      'botSession). Si aparece otro modelo nullable, es la MISMA clase de agujero, no un caso.\n'
    );
  }
});

test('SCRUM-172: el detector funciona — probado con un schema sintético', () => {
  // Guarda de presencia + red probe permanente. `prisma/schema.prisma` NO se toca ni para
  // provocar el rojo: el freno duro del repo (ASESOR.md §3) no se manipula para probar un test.
  const sintetico = `
model Fulano {
  id         Int @id
  merchantId Int @map("merchant_id")
}
model Mengano {
  id         Int  @id
  merchantId Int? @map("merchant_id")
}
model SinTenancy {
  id   Int    @id
  name String
}`;
  const r = modelosConTenancy(sintetico);
  assert.deepEqual(r, [
    { modelo: 'Fulano', nullable: false },
    { modelo: 'Mengano', nullable: true },
  ], 'el detector no distingue tenancy nullable de no-nullable, o cuenta modelos sin merchantId');

  // Y el caso que motiva el ticket: un modelo nuevo sin registrar debe quedar FUERA de la lista.
  const declarados = ['fulano'];
  const faltan = r.filter((d) => !d.nullable).map((d) => camel(d.modelo)).filter((m) => !declarados.includes(m));
  assert.deepEqual(faltan, [], 'con Fulano declarado no debería faltar nada');

  const faltanSinDeclarar = r.filter((d) => !d.nullable).map((d) => camel(d.modelo)).filter((m) => ![].includes(m));
  assert.deepEqual(faltanSinDeclarar, ['fulano'], 'sin declarar, el modelo con merchantId DEBE salir como no cubierto');
});

test('SCRUM-172: el schema real tiene modelos con tenancy (guarda de presencia)', () => {
  // Si el parser se rompe o el fichero se mueve, los asserts de arriba pasarían en VACÍO —
  // indistinguible de "todo cubierto".
  const derivados = modelosConTenancy(fs.readFileSync(SCHEMA, 'utf8'));
  assert.ok(
    derivados.length >= 15,
    `el detector solo ve ${derivados.length} modelos con merchantId; o cambió el formato del schema o se movió el fichero. ACTUALIZA este guard, no lo borres.`
  );
});
