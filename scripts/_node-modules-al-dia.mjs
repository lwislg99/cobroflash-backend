// scripts/_node-modules-al-dia.mjs — SCRUM-471 · corre en `pretest`, ANTES de la suite.
//
// El aviso tiene que llegar ANTES que los tests, o llega tarde: cinco fallos de la cola offline se
// leen como un fallo del producto —dos sesiones lo hicieron el mismo día y se abrió un ticket
// sobre un defecto que no existía— y para cuando alguien sospecha de las dependencias ya ha
// perdido la mañana. Aquí sale UN rojo que nombra la dependencia, y la suite ni empieza.
//
// FALLA DURO, no avisa. Un `console.warn` es un paso manual, y un paso manual no es una barrera:
// es una costumbre (SCRUM-395, decisión del fundador 11-ago-2026).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { avisoDeDesfase } from '../tests/_desfase-node-modules.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const aviso = avisoDeDesfase(RAIZ);
if (aviso) {
  console.error('\n' + aviso + '\n');
  process.exit(1);
}
