// docs/master/evidencias/scrum1500c/master-movido.cjs — SCRUM-1500c
//
// VERLO EN ROJO: el mismo cotejo sobre un máster cambiado EN MEMORIA (no se escribe nada en disco).
// Cada cambio toca UNA línea y tiene que dar la vuelta al veredicto de UN campo y de ningún otro.
//
//     node docs/master/evidencias/scrum1500c/master-movido.cjs
const fs = require('node:fs');
const path = require('node:path');
const { cotejarOnce } = require('./cotejo-once.cjs');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const master = fs.readFileSync(path.join(RAIZ, 'docs', 'YAQU_MASTER.md'), 'utf8');

const CAMBIOS = [
  // El máster GANA el valor que el código tiene de más: el campo tiene que dejar de estar fuera.
  { campo: 'Quote.status', de: '`draft → sent → accepted | rejected`', a: '`draft → pending_approval → sent → accepted | rejected`', espera: 'COINCIDE_CON_EL_MASTER' },
  { campo: 'Invoice.status', de: '**Invoice:** `pending → paid`', a: '**Invoice:** `pending → paid` · `pending → expired`', espera: 'COINCIDE_CON_EL_MASTER' },
  { campo: 'WhatsAppMessage.status', de: '**WhatsAppMessage:** `queued → sent → delivered → read`', a: '**WhatsAppMessage:** `received → queued → sent → delivered → read`', espera: 'COMENTARIO_ATRASADO' },
  // ↑ Yo esperaba COINCIDE y salió MUDA a la primera: el comentario del esquema enumera cinco valores
  //   y no trae `received`, así que con el máster ampliado el atrasado pasa a ser el comentario. Es
  //   el único de los seis cambios que ejercita ese cajón.
  // El máster PIERDE un valor que el código escribe: un campo que coincide tiene que salir fuera.
  { campo: 'Job.status', de: '→ en_curso → terminado → cerrado`', a: '→ en_curso → terminado`', espera: 'CODIGO_FUERA_DEL_MASTER' },
  { campo: 'BotSession.state', de: 'asking_zone|confirming_request|done|handoff', a: 'asking_zone|done|handoff', espera: 'CODIGO_FUERA_DEL_MASTER' },
  { campo: 'Invoice.vfEstado', de: '· `pendiente_de_sellado → no_aplica`', a: '', espera: 'CODIGO_FUERA_DEL_MASTER' },
];

const veredictos = (r) => Object.fromEntries(r.filas.filter((f) => !f.control).map((f) => [f.id, f.veredicto]));
const baseV = veredictos(cotejarOnce());
let mal = 0;
console.log(`BASE: ${Object.entries(baseV).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
for (const c of CAMBIOS) {
  const veces = master.split(c.de).length - 1;
  if (veces !== 1) { console.log(`🔴 CIEGO ${c.campo}: el texto a cambiar sale ${veces} veces en el máster (tiene que ser 1)`); mal += 1; continue; }
  const v = veredictos(cotejarOnce({ textoMaster: master.replace(c.de, () => c.a) }));
  const otros = Object.keys(v).filter((k) => k !== c.campo && v[k] !== baseV[k]);
  const bien = v[c.campo] === c.espera && baseV[c.campo] !== c.espera && otros.length === 0;
  if (!bien) mal += 1;
  console.log(`${bien ? 'VIVA ' : '🔴 MUDA'} ${c.campo}: ${baseV[c.campo]} → ${v[c.campo]} (se esperaba ${c.espera}) · otros campos que cambian: ${otros.length}${otros.length ? ` (${otros.join(', ')})` : ''}`);
}
console.log(`\n${CAMBIOS.length - mal} de ${CAMBIOS.length} cambios dan la vuelta a su campo y sólo a él`);
process.exit(mal ? 1 : 0);
