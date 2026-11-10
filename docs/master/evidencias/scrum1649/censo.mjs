// Reproduce veredictos() de tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs SIN importar el test
// (importarlo registraría sus tests). Mismo MARCA/EXCLUIR/NEGACION/VENTANA, copiados literalmente.
// Control: los niveles deben dar los del guard (SIN_RESPALDO=11).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { marcasDe } = await imp('tests/_procedencia-aprobacion.mjs');
const { indiceDeFuentes, respaldoDe, paresCitados } = await imp('tests/_respaldo-de-firma.mjs');
const { loQueSeLee } = await imp('tests/_cita-declarada.mjs');

const src = fs.readFileSync(path.join(RAIZ, 'tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs'), 'utf8');
const grab = (name) => { const m = src.match(new RegExp(`^const ${name} = (.*);$`, 'm')); if (!m) throw new Error('no ' + name); return m[1]; };
const MARCA = eval(grab('MARCA'));
const EXCLUIR = eval(grab('EXCLUIR'));
const FIN = '(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])';
const NEGACION = eval(grab('NEGACION'));
const VENTANA = Number(grab('VENTANA'));
const DIRS = ['src', 'public', 'tests', 'scripts'];
function niegaLaMarca(t) { return t.split(/(?<=[.:;])\s|\n/).filter((f) => MARCA.test(f)).some((f) => NEGACION.test(f)); }
function noAfirma(b) { const t = loQueSeLee(b.texto, b.fichero); if (!MARCA.test(t)) return 'citada'; if (niegaLaMarca(t)) return 'negada'; return null; }

const marcas = marcasDe(RAIZ, { dirs: DIRS, marca: MARCA, excluir: EXCLUIR, literalesTras: VENTANA });
const indice = indiceDeFuentes(RAIZ);
const out = [];
const cuenta = {};
for (const b of marcas) {
  const na = noAfirma(b);
  if (na) { cuenta[na] = (cuenta[na] || 0) + 1; continue; }
  const leido = { ...b, texto: loQueSeLee(b.texto, b.fichero) };
  const r = respaldoDe(leido, indice);
  cuenta[r.nivel] = (cuenta[r.nivel] || 0) + 1;
  const t = leido.texto;
  out.push({
    donde: `${b.fichero}:${b.linea}`, nivel: r.nivel, motivo: r.motivo, docRespaldo: r.donde, literalCasado: r.frase,
    pares: paresCitados(t),
    tickets: [...new Set((t.match(/SCRUM-\d+/gi) || []).map((s) => s.toUpperCase()))],
    docs: [...new Set(t.match(/docs\/[\w./ -]+/gi) || [])],
    asesor: /asesor/i.test(t),
    frase: t.split(/\n/).find((l) => MARCA.test(l))?.trim().slice(0, 220),
    texto: t.slice(0, 1500),
  });
}
console.log(JSON.stringify(cuenta));
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
