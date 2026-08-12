// SCRUM-244 · LA COBERTURA DEL «TODO LO MÍO» NO PUEDE QUEDARSE CORTA EN SILENCIO.
//
// Sin gate: DMMF y un doble de Prisma. Ni BD, ni red, ni turno.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ATA, Y CONTRA QUÉ
//
// La derivación de producción (`modelosDelMerchant`, que lee `Prisma.dmmf`) se compara con
// `modelosConTenancy`, la derivación que YA existe y que usan los guards de SCRUM-172 y 192
// sobre el TEXTO de `schema.prisma`. Son dos caminos independientes hacia la misma verdad:
//
//   producción → DMMF (el schema compilado dentro del cliente generado)
//   guard      → `schema.prisma` (el fichero)
//
// Si divergen, algo está desincronizado —el cliente sin regenerar es el caso típico— y este
// export estaría prometiendo «todo» sobre una lista que no es la del schema. **No se escribe un
// tercer derivador**: reusar el que ya existe es lo que impide que este ticket repita el defecto
// que cerró SCRUM-240 (dos generadores capaces de calcular cosas distintas).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelosConTenancy } from './scrum172-cobertura-tenancy.test.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');

const {
  modelosDelMerchant, modelosAExportar, camposDe, comprobarDerivacion, construirPaquete,
  EXCLUIDOS, MINIMO_MODELOS, CAMPO_TENENCIA,
} = await import('../dist/modules/exports/domain/portabilidadCompleta.js');

const { Prisma } = await import('@prisma/client');

/** Doble de Prisma: un delegado por modelo derivado, que devuelve una fila marcada. */
function clienteFalso(modelos, { sin = [] } = {}) {
  const cliente = { llamadas: [] };
  for (const { delegado } of modelos) {
    if (sin.includes(delegado)) continue;
    cliente[delegado] = {
      findMany: async (args) => {
        cliente.llamadas.push({ delegado, args });
        return [{ id: 1, [CAMPO_TENENCIA]: args.where[CAMPO_TENENCIA] }];
      },
    };
  }
  return cliente;
}

test('SCRUM-244 · la lista sale del SCHEMA y no de una enumeración: producción y guard coinciden', () => {
  const produccion = modelosDelMerchant().map((m) => m.modelo).sort();
  const delFichero = modelosConTenancy(SCHEMA).map((m) => m.modelo).sort();

  assert.deepEqual(
    produccion, delFichero,
    '🔴 LA DERIVACIÓN DE PRODUCCIÓN Y LA DEL SCHEMA NO COINCIDEN.\n\n' +
      `  producción (DMMF): ${produccion.join(', ')}\n` +
      `  schema.prisma    : ${delFichero.join(', ')}\n\n` +
      '  Los dos caminos leen la misma verdad, así que discrepar significa que algo está\n' +
      '  desincronizado — típicamente el cliente de Prisma sin regenerar. Mientras dure, este\n' +
      '  export promete «todos tus datos» sobre una lista que no es la del schema.',
  );
});

test('SCRUM-244 · un modelo NUEVO con merchantId entra solo, sin tocar ninguna lista', () => {
  // La prueba de que esto es una derivación y no una enumeración: se inventa un modelo y tiene
  // que aparecer sin que nadie lo declare en ninguna parte.
  const inventado = {
    models: [
      ...Prisma.dmmf.datamodel.models,
      { name: 'ModeloRecienNacido', dbName: 'modelo_recien_nacido', fields: [
        { name: 'id', kind: 'scalar' },
        { name: CAMPO_TENENCIA, kind: 'scalar', dbName: 'merchant_id' },
      ] },
    ],
  };
  const nombres = modelosDelMerchant(inventado).map((m) => m.modelo);
  assert.ok(
    nombres.includes('ModeloRecienNacido'),
    '🔴 un modelo nuevo con merchantId NO aparece solo: entonces esto es una lista disfrazada de ' +
      'derivación, y envejecerá igual que las dos que ya derivaron en este repo.',
  );
  assert.equal(
    modelosAExportar(inventado).some((m) => m.modelo === 'ModeloRecienNacido'), true,
    '🔴 el modelo nuevo se deriva pero no se exporta',
  );
});

test('SCRUM-244 · se deriva por el NOMBRE DEL CAMPO, no por el de la columna (la trampa de 205)', () => {
  // De los 22 modelos con merchantId, DOS mapean la columna en camelCase — `Quote` e `Invoice`.
  // Una derivación que buscara la columna `merchant_id` los perdería EN SILENCIO: un export de
  // portabilidad sin las facturas ni los presupuestos, sin ningún aviso.
  const columnaDe = (modelo) => {
    const m = Prisma.dmmf.datamodel.models.find((x) => x.name === modelo);
    const f = m.fields.find((x) => x.name === CAMPO_TENENCIA);
    return f.dbName ?? f.name;
  };
  const raros = modelosDelMerchant()
    .map((m) => m.modelo)
    .filter((m) => columnaDe(m) !== 'merchant_id');

  assert.ok(
    raros.length >= 2,
    `🔴 ESCÁNER CIEGO: esperaba al menos 2 modelos cuya columna NO se llama merchant_id y veo ` +
      `${raros.length}. Si ese caso desapareció del schema, este test dejó de proteger de nada; ` +
      'si es que la lectura del DMMF cambió, la trampa vuelve a estar abierta.',
  );
  for (const m of raros) {
    assert.ok(
      modelosDelMerchant().some((x) => x.modelo === m),
      `🔴 ${m} tiene la columna en camelCase y se ha perdido en la derivación`,
    );
  }
});

test('SCRUM-244 · todo modelo derivado está cubierto O declarado fuera, con su motivo', () => {
  const derivados = modelosDelMerchant().map((m) => m.delegado);
  const exportados = new Set(modelosAExportar().map((m) => m.delegado));
  const huerfanos = derivados.filter((d) => !exportados.has(d) && !(d in EXCLUIDOS));

  assert.deepEqual(
    huerfanos, [],
    '🔴 HAY MODELOS QUE NI SE EXPORTAN NI ESTÁN DECLARADOS FUERA:\n' +
      huerfanos.map((h) => `    ${h}`).join('\n') +
      '\n\n  Una ausencia sin motivo escrito es indistinguible de un olvido. Si un modelo no debe\n' +
      '  ir en el paquete, decláralo en `EXCLUIDOS` con la razón — se ve en el diff.',
  );

  for (const [modelo, motivo] of Object.entries(EXCLUIDOS)) {
    assert.ok(
      derivados.includes(modelo),
      `🔴 «${modelo}» está excluido pero ya NO existe como modelo con ${CAMPO_TENENCIA}: la ` +
        'exclusión sobra y confunde a quien la lea.',
    );
    assert.ok(motivo.length > 20, `🔴 la exclusión de «${modelo}» no explica nada`);
  }
});

test('SCRUM-244 · SUELO: una derivación CIEGA falla, no exporta cero y sale verde', () => {
  // Es el modo de fallo que importa: con el DMMF vacío el paquete saldría vacío y VERDE — un ZIP
  // presentado como «todos tus datos» que no lleva ninguno. Peor que un error, porque nadie lo revisa.
  const ciego = comprobarDerivacion({ models: [] });
  assert.equal(ciego.ok, false, '🔴 un datamodel VACÍO se ha aceptado como derivación buena');
  assert.match(ciego.motivo, /0 modelos/, '🔴 el motivo no dice cuántos vio');

  const pocos = comprobarDerivacion({
    models: Array.from({ length: MINIMO_MODELOS - 1 }, (_, i) => ({
      name: `M${i}`, fields: [{ name: CAMPO_TENENCIA, kind: 'scalar' }],
    })),
  });
  assert.equal(pocos.ok, false, `🔴 ${MINIMO_MODELOS - 1} modelos deberían quedar por debajo del suelo`);
  assert.equal(comprobarDerivacion().ok, true, '🔴 ESCÁNER CIEGO: el schema real no pasa su propio suelo');
});

test('SCRUM-244 · construirPaquete pide TODOS los derivados, filtrando por merchant', async () => {
  const modelos = modelosAExportar();
  const cliente = clienteFalso(modelos);
  const paquete = await construirPaquete(cliente, 77);

  assert.equal(paquete.length, modelos.length, '🔴 el paquete no trae un dataset por modelo exportable');
  assert.deepEqual(
    cliente.llamadas.map((l) => l.delegado).sort(),
    modelos.map((m) => m.delegado).sort(),
    '🔴 no se ha consultado exactamente el conjunto derivado',
  );
  for (const l of cliente.llamadas) {
    assert.equal(
      l.args.where[CAMPO_TENENCIA], 77,
      `🔴 «${l.delegado}» se consultó SIN filtrar por merchant. En un export de datos personales ` +
        'eso es entregarle a un profesional los datos de otro (regla 2).',
    );
  }
  for (const excluido of Object.keys(EXCLUIDOS)) {
    assert.ok(
      !cliente.llamadas.some((l) => l.delegado === excluido),
      `🔴 «${excluido}» está declarado FUERA y se ha consultado igualmente`,
    );
  }
});

test('SCRUM-244 · un modelo derivado que el cliente no expone FALLA, no se salta', async () => {
  const modelos = modelosAExportar();
  const cliente = clienteFalso(modelos, { sin: [modelos[0].delegado] });
  await assert.rejects(
    () => construirPaquete(cliente, 1),
    /portabilidad_modelo_sin_delegado/,
    '🔴 un modelo sin delegado se ha saltado en silencio. Si la derivación y el cliente miran ' +
      'schemas distintos, NADA del paquete es fiable — y saltarlo produce justo el export corto ' +
      'que este ticket existe para impedir.',
  );
});

test('SCRUM-244 · los campos salen del DMMF, y las relaciones no son columnas', () => {
  const campos = camposDe('Invoice');
  assert.ok(campos.includes(CAMPO_TENENCIA), '🔴 falta merchantId en los campos de Invoice');
  assert.ok(campos.includes('number'), '🔴 falta `number` en los campos de Invoice');
  assert.ok(
    !campos.includes('merchant'), '🔴 la RELACIÓN `merchant` se ha colado como campo: no es una columna',
  );
  assert.deepEqual(camposDe('NoExisteEsteModelo'), [], '🔴 un modelo inexistente debería dar lista vacía');
});
