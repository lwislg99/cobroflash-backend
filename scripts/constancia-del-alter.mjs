#!/usr/bin/env node
// scripts/constancia-del-alter.mjs — SCRUM-687
//
// ¿Tiene producción las columnas que este código va a nombrar? Se lo pregunta A ELLA.
//
//   node scripts/constancia-del-alter.mjs
//   node scripts/constancia-del-alter.mjs --url https://…/schema-check
//
// ── LO QUE HACE, Y EL ORDEN IMPORTA ─────────────────────────────────────────────────────────
// 1. Deriva el conjunto ESPERADO del cliente de Prisma de ESTE árbol (el DMMF), que es lo que el
//    código desplegado va a nombrar. No de un fichero del repo: `deriva-prod.sql` se GENERA desde
//    el mismo esquema, así que preguntarle a él si el `ALTER` está aplicado es consultar el valor
//    que el defecto falsifica.
// 2. Se lo manda a producción.
// 3. **Compara `comparadas` con lo que envió.** Un «no falta nada» habiendo comparado 0 columnas
//    es el suelo de siempre: un cero sin control positivo no es un cero, es una pregunta sin
//    contestar.
//
// 🔴 EL SECRETO NO SE ESCRIBE NI SE IMPRIME. Se lee de `SCHEMA_CHECK_SECRET` y viaja en una
// cabecera. Este fichero no contiene ningún valor, tampoco de ejemplo.
//
// SALIDAS, y las tres significan cosas distintas:
//   0 · producción tiene todas las columnas preguntadas
//   1 · FALTAN columnas — el hallazgo: falta aplicar el `ALTER`
//   2 · NO PUDE PREGUNTAR. **No es verde.** Sin secreto, sin red, 404, 401 o catálogo ilegible.
import { execFileSync } from 'node:child_process';

export const SALIDA_FALTAN = 1;
export const SALIDA_NO_PUDE_PREGUNTAR = 2;

const URL_POR_DEFECTO = 'https://yaqu.app/schema-check';

function arg(nombre, pordefecto) {
  const i = process.argv.indexOf('--' + nombre);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : pordefecto;
}

/**
 * Las columnas que el cliente de Prisma va a nombrar, en la forma `tabla.columna`.
 *
 * `dbName ?? name` resuelve el `@map` — el esquema de la casa lo usa a medias a propósito, así que
 * confundirlo daría falsos positivos en masa. Se descartan los campos `kind: 'object'`: son
 * relaciones, no columnas.
 *
 * Es la MISMA derivación que hace `schemaDrift` al arrancar. Que las dos miren lo mismo es el
 * punto: esto comprueba antes de mergear lo que aquello comprobaría al desplegar — pero cinco
 * minutos de healthcheck antes, y sin dejar producción parada nueve días.
 */
export function esperadasDelDatamodel(datamodel) {
  const fuera = [];
  for (const m of datamodel.models) {
    const tabla = m.dbName ?? m.name;
    for (const f of m.fields) {
      if (f.kind === 'object') continue;
      fuera.push(`${tabla}.${f.dbName ?? f.name}`);
    }
  }
  return [...new Set(fuera)].sort();
}

const morir = (codigo, titulo, detalle) => {
  console.log('\n[constancia del ALTER] ' + titulo);
  if (detalle) console.log(detalle);
  if (process.env.GITHUB_ACTIONS === 'true') {
    const cuerpo = String(detalle || '').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log('::' + (codigo === SALIDA_FALTAN ? 'error' : 'warning') + ' title=' + titulo + '::' + cuerpo);
  }
  process.exit(codigo);
};

if (process.argv[1] && process.argv[1].endsWith('constancia-del-alter.mjs')) {
  const url = arg('url', URL_POR_DEFECTO);
  const secreto = process.env.SCHEMA_CHECK_SECRET;
  if (!secreto) {
    morir(SALIDA_NO_PUDE_PREGUNTAR, '⚠️ NO PUDE PREGUNTAR: no hay `SCHEMA_CHECK_SECRET` en el entorno.',
      '   Esto NO es «el esquema está aplicado»: es que no se ha podido comprobar.\n'
      + '   El secreto lo coloca el fundador en producción y en los secretos del repositorio.');
  }

  let esperadas;
  try {
    const { Prisma } = await import('@prisma/client');
    esperadas = esperadasDelDatamodel(Prisma.dmmf.datamodel);
  } catch (e) {
    morir(SALIDA_NO_PUDE_PREGUNTAR, '⚠️ NO PUDE PREGUNTAR: no se pudo leer el cliente de Prisma.',
      '   ' + String(e.message).split('\n')[0] + '\n   ¿Falta `npx prisma generate`?');
  }
  if (!esperadas.length) {
    morir(SALIDA_NO_PUDE_PREGUNTAR, '⚠️ NO PUDE PREGUNTAR: el datamodel no dio NI UNA columna.',
      '   Con cero esperadas no hay nada que comparar, y un «no falta nada» sería mentira.');
  }

  let r; let cuerpo;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-schema-check-secret': secreto },
      body: JSON.stringify({ esperadas }),
    });
    cuerpo = await r.json().catch(() => null);
  } catch (e) {
    morir(SALIDA_NO_PUDE_PREGUNTAR, '⚠️ NO PUDE PREGUNTAR a producción.',
      '   ' + String(e.message).split('\n')[0]);
  }

  if (r.status === 404) {
    morir(SALIDA_NO_PUDE_PREGUNTAR, '⚠️ NO PUDE PREGUNTAR: producción responde 404.',
      '   El endpoint es fail-closed: sin `SCHEMA_CHECK_SECRET` en SU entorno, no existe.\n'
      + '   Que responda 404 NO dice nada sobre el esquema.');
  }
  if (r.status === 401) {
    morir(SALIDA_NO_PUDE_PREGUNTAR, '⚠️ NO PUDE PREGUNTAR: producción responde 401.',
      '   El secreto de este lado no es el que producción espera. Sigue sin comprobarse nada.');
  }
  if (!r.ok) {
    morir(SALIDA_NO_PUDE_PREGUNTAR, `⚠️ NO PUDE PREGUNTAR: producción responde ${r.status}.`,
      '   ' + JSON.stringify(cuerpo || {}).slice(0, 300));
  }

  const faltan = (cuerpo && cuerpo.faltan) || [];
  const comparadas = cuerpo && cuerpo.comparadas;

  // ── 🔴 EL SUELO QUE PIDE EL TICKET: `N` tiene que cuadrar con lo enviado ────────────────
  // Un «no falta nada» habiendo comparado 0 —o 3 de 411— es el mismo cero disfrazado de verde.
  if (comparadas !== esperadas.length) {
    morir(SALIDA_NO_PUDE_PREGUNTAR,
      `⚠️ NO PUDE PREGUNTAR: se enviaron ${esperadas.length} columnas y producción dice haber comparado ${comparadas}.`,
      '   No cuadran, así que su respuesta no describe la pregunta que se hizo. No se lee como verde.');
  }

  if (faltan.length === 0) {
    console.log('\n[constancia del ALTER] producción responde que no le falta ninguna de las '
      + comparadas + ' columnas preguntadas');
    process.exit(0);
  }

  morir(SALIDA_FALTAN,
    `🔴 producción no tiene ${faltan.length} de las ${comparadas} columnas preguntadas`,
    '   ' + faltan.slice(0, 100).join(', ') + (faltan.length > 100 ? ` … y ${faltan.length - 100} más` : '')
    + '\n\n   Falta aplicar el `ALTER` en producción ANTES de mergear este esquema. Si se mergea así,\n'
    + '   `schemaDrift` se negará a arrancar —correctamente— y el despliegue fallará el healthcheck.\n'
    + '   Railway dejará vivo el anterior, no habrá caída, no habrá alerta, y el síntoma será «no\n'
    + '   cambia nada». Así se perdieron nueve días.');
}
