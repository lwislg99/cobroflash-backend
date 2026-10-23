// SCRUM-1123f · el CLI del aviso, de verdad (subproceso), con los estados REALES capturados por
// `capturar-estados.mjs`. Imprime, por caso, el tipo y el párrafo de «dónde mirar».
//   node los-cinco-casos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const CASOS = ['tipo-a-21oct', 'tipo-b-24sep', 'tipo-b-23oct', 'sano-falla-otro-servicio', 'sano-hoy'];
for (const caso of CASOS) {
  const estados = fs.readFileSync(path.join(AQUI, `${caso}.json`), 'utf8').replace(/^﻿/, '');
  const env = { ...process.env, VIGIA_ISSUES_JSON: '[]', VIGIA_MARCA: '<!-- m -->', VIGIA_RENGLON: 'r', VIGIA_RUN_URL: 'u',
    VIGIA_ESTADOS_JSON: estados, VIGIA_MENCION: '@lwislg99' };
  delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'vigia-despliegue-aviso.mjs')], { encoding: 'utf8', env });
  const d = JSON.parse(r.stdout);
  const parrafo = d.cuerpo.split('\n\n').find((p) => /Railway|avería/.test(p) && !/24,5 h/.test(p));
  console.log(`── ${caso} · exit ${r.status} · tipo=${d.tipo}\n${d.cuerpo.split('\n')[0]}\n${parrafo}\n`);
}
