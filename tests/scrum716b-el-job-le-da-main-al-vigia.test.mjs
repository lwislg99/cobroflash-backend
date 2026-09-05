// tests/scrum716b-el-job-le-da-main-al-vigia.test.mjs — SCRUM-716b.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, MEDIDO REPRODUCIENDO EL CHECKOUT DE UN PR
//
// El job del vigía llevaba `fetch-depth: 0`, y no basta. En un evento `pull_request`,
// `actions/checkout` trae **una sola ref** —la del PR— con toda su historia. En ese clon:
//
//     ¿resuelve origin/main?           NO
//     ¿está el commit de producción?   NO
//
// Así que el vigía se declaraba ciego. **Correctamente**: el script hacía lo suyo. Lo que
// faltaba se lo tenía que dar el JOB. Salía rojo en TODA PR, en 6-8 segundos, igual en ramas
// que no comparten nada — y un vigía que se lee como ruido no avisa el día que tiene razón.
//
// Con `git fetch … +refs/heads/main:refs/remotes/origin/main`, en el mismo banco:
//
//     producción dice 5bfc1136 · `main` está en 382439a1 · 0.7 h de hueco (margen 6 h)
//        6 commit(s) sin llegar. Un despliegue en curso se lee así.      ← veredicto REAL
//
// 📌 El workflow PROGRAMADO (`vigia-despliegue.yml`) NO lo necesita: se ejecuta sobre `main`, así
// que `actions/checkout` ya crea `refs/remotes/origin/main`. Por eso aquél funcionaba y éste no.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');

/** El bloque del job del vigía, acotado por el siguiente job de primer nivel. */
function jobDelVigia() {
  const ini = CI.indexOf('\n  vigia-despliegue:');
  assert.ok(ini > 0, '🔴 SUELO: no encuentro el job `vigia-despliegue` en ci.yml. Sin él, nada ' +
    'de lo de abajo comprueba nada.');
  // El siguiente job empieza con dos espacios y un nombre en la columna 3.
  const resto = CI.slice(ini + 1);
  const m = resto.slice(1).match(/\n {2}[a-z][a-z0-9-]*:\n/);
  const fin = m ? ini + 1 + 1 + m.index : CI.length;
  return CI.slice(ini, fin);
}

test('SCRUM-716b · 🔴 SUELO: el acotado del job trae algo, y no el fichero entero', () => {
  const job = jobDelVigia();
  assert.ok(job.length > 200, `🔴 el job acotado tiene ${job.length} caracteres: no lo está acotando`);
  assert.ok(job.length < CI.length,
    '🔴 el acotado se ha llevado el fichero entero: cualquier cosa de otro job pasaría por suya');
  assert.match(job, /vigilante-de-despliegue\.mjs/,
    '🔴 el job acotado no llama al vigía: se está midiendo otro trozo');
});

test('SCRUM-716b · 🔴 el job TRAE `main` antes de llamar al vigía', () => {
  const job = jobDelVigia();

  assert.match(job, /refs\/heads\/main:refs\/remotes\/origin\/main/,
    '🔴 el job no trae `main`. En un PR, `actions/checkout` sólo trae la ref del PR: ni ' +
    '`origin/main` resuelve ni está el commit de producción, así que el vigía se declara ciego ' +
    'en TODA PR — y un rojo constante se lee como ruido.');

  // 🔴 Y ANTES, no después: el vigía lee git nada más arrancar.
  const iFetch = job.indexOf('refs/heads/main:refs/remotes/origin/main');
  const iVigia = job.indexOf('vigilante-de-despliegue.mjs');
  assert.ok(iFetch < iVigia,
    '🔴 el `fetch` de `main` va DESPUÉS de llamar al vigía. Cuando llega, ya se declaró ciego.');
});

test('SCRUM-716b · ✅ CONTROL: no se ha tocado el `continue-on-error` ni el script', () => {
  // El job es informativo A PROPÓSITO: en cuanto sea bloqueante, deja de poder arreglarse el
  // problema que mide — el arreglo llega mergeando.
  assert.match(jobDelVigia(), /continue-on-error: true/,
    '🔴 el job del vigía ha dejado de ser informativo. Eso NO es de este ticket.');

  // Y el script sigue siendo el mismo: lo que se arregla es lo que el job le da, no lo que hace.
  const script = fs.readFileSync(path.join(RAIZ, 'scripts', 'vigilante-de-despliegue.mjs'), 'utf8');
  assert.match(script, /GET \/version` es p[úu]blico|no usa ninguna credencial/i,
    '🔴 el script del vigía ha cambiado de forma. Este ticket arregla el JOB, no el script.');
});

test('SCRUM-716b · 📌 el workflow PROGRAMADO no necesita el fetch, y se dice por qué', () => {
  // Se comprueba para que nadie «arregle» también aquél por simetría: se ejecuta sobre `main`,
  // así que `actions/checkout` ya crea la rama de seguimiento. Añadirlo ahí sería ruido.
  const prog = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'vigia-despliegue.yml'), 'utf8');
  assert.match(prog, /schedule/, '🔴 SUELO: el workflow programado ya no corre por `schedule`');
  assert.ok(!/refs\/heads\/main:refs\/remotes\/origin\/main/.test(prog),
    '🔴 se le ha añadido el fetch al workflow PROGRAMADO. Ahí no hace falta —corre sobre `main` y ' +
    '`actions/checkout` ya crea `origin/main`— y añadirlo esconde por qué el otro sí lo necesita.');
});
