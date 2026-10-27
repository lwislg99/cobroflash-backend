// Barrido de palabras de territorio. Uso: node barrido.mjs <raiz del arbol> <fichero de salida>
// Poblacion declarada, positivo SEMBRADO por el propio instrumento y control de cero derivado.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { veredicto, OK, ROTO } from './veredicto.mjs';

const [, , raiz, salida, ...ambitos] = process.argv;
const plano = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// palabra -> regex sobre texto PLANO (sin tildes, minusculas), con limites de palabra
const PALABRAS = {
  foral: /\bforal(es)?\b/,
  ticketbai: /ticket\s?bai/,
  batuz: /\bbatuz\b/,
  igic: /\bigic\b/,
  canarias: /\bcanari[ao]s?\b/,
  navarra: /\bnavarr[ao]s?\b|\bnafarroa\b/,
  bizkaia: /\bbizkaia\b|\bvizcaya\b/,
  alava: /\balava\b|\baraba\b/,
  gipuzkoa: /\bgipuzkoa\b|\bguipuzcoa\b/,
  paisvasco: /\bpais vasco\b|\beuskadi\b/,
  ipsi: /\bipsi\b/,
  ceutamelilla: /\bceuta\b|\bmelilla\b/,
  tenerife_laspalmas: /\btenerife\b|\blas palmas\b/,
  regimen_comun: /regimen comun|territorio comun/,
  ZZ_CERO: /\bqwzxforalinventado\b/,
};

function mirar(texto) {
  const lineas = texto.split(/\r?\n/);
  const hits = [];
  let cabecera = '';
  lineas.forEach((l, i) => {
    if (/^#{1,4}\s/.test(l)) cabecera = l.trim();
    const p = plano(l);
    for (const [nombre, re] of Object.entries(PALABRAS)) {
      if (re.test(p)) hits.push({ nombre, linea: i + 1, cabecera, texto: l });
    }
  });
  return { hits, lineas: lineas.length };
}

// --- positivo sembrado y control de quitarlo ---
const siembra = '# Parte SEMBRADA\nHacienda Foral · TicketBAI · Batuz · IGIC · Canarias · Navarra · Bizkaia · Álava · Gipuzkoa · País Vasco · IPSI · Ceuta · Tenerife · régimen común\n';
const s = mirar(siembra);
const vistas = new Set(s.hits.map((h) => h.nombre));
const esperadas = Object.keys(PALABRAS).filter((k) => k !== 'ZZ_CERO');
const faltan = esperadas.filter((k) => !vistas.has(k));
const sinSiembra = mirar('# Parte SEMBRADA\nnada de nada\n').hits.length;
// Tres resultados por control (SCRUM-1536b). El positivo solo es OK si habia algo que esperar: sin
// catalogo, «0 de 0» no falta nada y no prueba nada. El de cero solo es OK si el centinela se busco
// de verdad y la misma pasada vio alguna otra palabra: no ver el centinela sin haber visto nada no absuelve.
const vPositivo = veredicto({ pudoMirar: esperadas.length > 0, roto: faltan.length > 0 });
const vCero = veredicto({
  pudoMirar: PALABRAS.ZZ_CERO instanceof RegExp && [...vistas].some((k) => k !== 'ZZ_CERO'),
  roto: vistas.has('ZZ_CERO'),
});
let rotuloPositivo = vPositivo;
if (vPositivo === ROTO) rotuloPositivo = 'FALTAN ' + faltan;
console.log('CONTROL positivo sembrado:', vistas.size, 'de', esperadas.length, rotuloPositivo, '· cero en la siembra:', vCero, '· quitada la siembra:', sinSiembra, '(tiene que ser 0)');
if (vPositivo !== OK || vCero !== OK || sinSiembra !== 0) { console.log('CIEGO'); process.exit(2); }

// --- poblacion: ficheros seguidos por git bajo los ambitos ---
const lista = execFileSync('git', ['-C', raiz, 'ls-files', '-z', '--', ...ambitos], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
let leidos = 0, ilegibles = 0, bytes = 0;
const porPalabra = {};
const out = [];
for (const f of lista) {
  if (/\.(png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|zip|p12|pfx)$/i.test(f)) continue;
  let t;
  try { t = fs.readFileSync(path.join(raiz, f), 'utf8'); } catch { ilegibles++; continue; }
  leidos++; bytes += t.length;
  const { hits } = mirar(t);
  for (const h of hits) {
    (porPalabra[h.nombre] ??= { lineas: 0, ficheros: new Set() });
    porPalabra[h.nombre].lineas++;
    porPalabra[h.nombre].ficheros.add(f);
    out.push(`${f}:${h.linea}\t[${h.nombre}]\t${h.cabecera.slice(0, 90)}\t${h.texto.length}c\t${h.texto}`);
  }
}
fs.writeFileSync(salida, out.join('\n') + '\n');
console.log('POBLACION ambitos', JSON.stringify(ambitos), '· listados', lista.length, '· leidos', leidos, '· ilegibles', ilegibles, '· caracteres', bytes);
for (const k of Object.keys(PALABRAS)) {
  const v = porPalabra[k];
  console.log(k.padEnd(20), v ? `${v.lineas} lineas en ${v.ficheros.size} ficheros` : '0');
}
console.log('SALIDA', salida, out.length, 'lineas');
console.log('EXIT=0');
