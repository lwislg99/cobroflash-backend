// Mutaciones del guard de SCRUM-1132: cada una aplica UN cambio, corre el guard, restaura y comprueba.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const VISTA = 'public/dashboard/js/customerDetailView.js';
const DOMINIO = 'dist/modules/system/domain/notasDelCliente.js';
const REGISTRO = 'docs/microcopy/2026-10-14-SCRUM-1132-notas-del-cliente.md';

const MUTANTES = [
  { nombre: 'base sin mutar', fichero: null, espera: 0 },
  { nombre: 'listarNotas sin merchantId', fichero: DOMINIO, de: "where: { merchantId, customerId, type: 'nota' }", a: "where: { customerId, type: 'nota' }", espera: 1, cae: 'OTRO comercio' },
  { nombre: 'la tarjeta repite la Nota fija', fichero: VISTA, de: 'filter((n) => n && !n.esFija)', a: 'filter((n) => n)', espera: 1, cae: 'repite la Nota fija' },
  { nombre: 'el campo no se vacía', fichero: VISTA, de: "      campo.value = '';\n", a: '', espera: 1, cae: 'no se vacía' },
  { nombre: 'el error pinta err.message', fichero: VISTA, de: "window.mensajeParaPersona(err, '')", a: "(err && err.message) || ''", espera: 1, cae: 'tripa del sistema' },
  { nombre: 'sin la puerta de admin', fichero: VISTA, de: "if (window.appUserRole === 'admin') {\n    const notasCard", a: "if (true) {\n    const notasCard", espera: 1, cae: 'al técnico se le pinta' },
  { nombre: 'el clic no hace POST', fichero: VISTA, de: "{ method: 'POST', body: JSON.stringify({ texto: campo.value }) }", a: '{}', espera: 1, cae: 'no llegó a escribir' },
  { nombre: 'botón btn-sm (30 px)', fichero: VISTA, de: "boton.className = 'btn-secondary';", a: "boton.className = 'btn-secondary btn-sm';", espera: 1, cae: '< 44' },
  { nombre: 'sin el registro de la firma', fichero: REGISTRO, borrar: true, espera: 2, cae: 'sin los cuatro literales' },
];

const filas = [];
for (const m of MUTANTES) {
  let original = null;
  if (m.fichero) {
    original = fs.readFileSync(m.fichero, 'utf8');
    if (m.borrar) fs.unlinkSync(m.fichero);
    else {
      if (!original.includes(m.de)) { filas.push(`${m.nombre}: CIEGO — el texto a mutar no está`); continue; }
      fs.writeFileSync(m.fichero, original.replace(m.de, m.a));
    }
  }
  let r;
  try {
    r = spawnSync(process.execPath, ['scripts/guard-notas-en-la-ficha.mjs'], { encoding: 'utf8', timeout: 180000 });
  } finally {
    if (original !== null) fs.writeFileSync(m.fichero, original);
  }
  const salida = (r.stdout || '') + (r.stderr || '');
  const nombra = m.cae ? salida.includes(m.cae) : true;
  const ok = r.status === m.espera && nombra;
  filas.push(`${ok ? 'OK ' : 'MAL'} ${m.nombre}: salida ${r.status} (espera ${m.espera})${m.cae ? ` · nombra «${m.cae}»: ${nombra}` : ''} · ${salida.length} B`);
}
console.log(filas.join('\n'));
const estado = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout;
console.log('git status tras mutar:', JSON.stringify(estado));
console.log('dominio restaurado:', fs.readFileSync(DOMINIO, 'utf8').includes("where: { merchantId, customerId, type: 'nota' }"));
