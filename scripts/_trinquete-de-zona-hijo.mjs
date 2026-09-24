// scripts/_trinquete-de-zona-hijo.mjs — SCRUM-813 · UNA pasada de la tanda, en LA ZONA QUE HEREDA.
//
//   node scripts/_trinquete-de-zona-hijo.mjs <ficheros.json> <medida.json> <raiz>
//
// Este proceso NO elige zona: la recibe en `TZ` de quien lo lanza, y la primera cosa que escribe
// es cuál ha visto de verdad (`zonaVista`). Quien lo llama compara — así una `TZ` que no llega no
// se convierte en un censo de ceros, se convierte en un CIEGO.
//
// ── POR QUÉ `run()` Y NO UN REPORTER ────────────────────────────────────────────────────────
// SCRUM-745 ya pagó esta lección en `meta-guard-mutaciones.mjs`: leer `✔`/`✖` del reporter `spec`
// deja al instrumento colgando de una constante que cualquiera puede cambiar en otro fichero.
// `run()` entrega `test:pass` / `test:fail` como DATOS, con el nombre y el fichero dentro. Sin
// reporter no hay glifo que se pueda mover.
//
// ⚠️ EL FLUJO HAY QUE CONSUMIRLO. Suscribirse y no iterarlo devuelve CERO eventos y estado 0 — un
// «no hay» indistinguible de un «no supe mirar». Por eso el bucle `for await`, y por eso quien
// llama exige que la medida traiga pruebas.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from 'node:test';

const [, , listaJson, destino, raiz] = process.argv;

const ficheros = JSON.parse(fs.readFileSync(listaJson, 'utf8'));

/** Peor gana: un fichero que registra dos veces el mismo nombre no puede salir mejor de lo que es. */
const PESO = { fail: 3, skip: 2, pass: 1 };

const veredictos = new Map();
const anotar = (fichero, nombre, v) => {
  const rel = fichero && path.isAbsolute(fichero) ? path.relative(raiz, fichero) : (fichero || '?');
  const clave = `${rel.split(path.sep).join('/')}::${nombre}`;
  const antes = veredictos.get(clave);
  if (!antes || PESO[v] > PESO[antes]) veredictos.set(clave, v);
};

/**
 * 🔴 LA CONCURRENCIA SE ESCRIBE, NO SE HEREDA — y esto está MEDIDO, no supuesto.
 *
 * Sin esta línea, una pasada de 718 ficheros llevaba **más de 30 minutos** y `Win32_Process`
 * enseñaba **dos** procesos de test vivos, no once: `run()` NO toma por defecto la concurrencia
 * que sí toma `node --test` en la línea de órdenes. Con dos pasadas, eso convierte un instrumento
 * de PR en uno que nadie va a esperar — y un instrumento que nadie espera se apaga.
 *
 * `availableParallelism() - 1` es exactamente lo que usa `npm test`: se deja un núcleo para que la
 * máquina siga respondiendo. Y se fija a un número en vez de a `true` para que las dos pasadas
 * midan con el MISMO reparto pase lo que pase en el entorno: si una zona corriera con más
 * paralelismo que la otra, la diferencia de veredicto podría venir de ahí y no del huso.
 */
const CONCURRENCIA = Math.max(1, os.availableParallelism() - 1);

const flujo = run({ files: ficheros, cwd: raiz, forceExit: true, concurrency: CONCURRENCIA });

for await (const ev of flujo) {
  if (ev.type === 'test:pass') {
    anotar(ev.data.file, ev.data.name, ev.data.skip || ev.data.todo ? 'skip' : 'pass');
  } else if (ev.type === 'test:fail') {
    // 🔴 Un fichero que MUERE AL CARGAR emite UN solo `test:fail` y su `name` es la RUTA del
    // fichero (medido en SCRUM-784). Entra como una clave más, y eso es lo correcto aquí: si un
    // fichero muere en una zona y vive en la otra, ESO es una dependencia de zona de las gordas.
    anotar(ev.data.file, ev.data.name, 'fail');
  }
}

fs.writeFileSync(destino, JSON.stringify({
  zonaVista: Intl.DateTimeFormat().resolvedOptions().timeZone,
  tz: process.env.TZ ?? null,
  concurrencia: CONCURRENCIA,
  ficheros: ficheros.length,
  veredictos: [...veredictos],
}));
