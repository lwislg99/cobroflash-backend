// SCRUM-1502j · de un solo uso. Las marcas canónicas SIN procedencia del censo de scrum921 (censarFirmas). Uso: node procedencia-921.mjs <raíz> > salida.json
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const R = process.argv[2]; const imp = (p) => import(pathToFileURL(path.join(R, p)).href);
const { censarFirmas } = await imp('tests/_censo-firmas-autorizacion.mjs');
const { censarProcedencia } = await imp('tests/_procedencia-aprobacion.mjs');
const MC = /(aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+(el\s+)?(fundador|asesor|orquestador)/i;
const c = censarFirmas(R);
const s921 = c.candidatos.filter((x) => MC.test(x.texto) && !x.procedencia).map((x) => `${x.fichero}:${x.linea}`);
console.log(JSON.stringify({ s921 }));
