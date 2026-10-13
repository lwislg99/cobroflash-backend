#!/usr/bin/env node
// SCRUM-1295 · Genera, desde docs/equipo/dos-equipos.md §3, lo que hace que el FICHERO diga de quién es:
//   · `.claude/carriles.json`       → el mapa que consulta la cerradura (.claude/hooks/carril.mjs)
//   · `.claude/rules/carril-XX.md`  → notas que Claude carga SOLAS al leer un fichero que casa
//   · `mesa`: `CLAUDE.local.md` + `.yaqu-puesto.json` de la carpeta fija de un puesto (pieza 5)
// NUNCA se editan a mano: si la tabla cambia, se regenera, y tests/scrum1295-carriles.test.mjs falla
// mientras lo generado y la tabla no coincidan.
//
//   node scripts/carriles.mjs generar            escribe carriles.json y las reglas
//   node scripts/carriles.mjs comprobar          salida 1 si lo escrito no es lo que sale de la tabla
//   node scripts/carriles.mjs de <ruta>          de quién es un fichero, y por qué fila
//   node scripts/carriles.mjs sin-fila [--lista] los scripts que sólo cubre la fila general (SCRUM-1480f)
//   node scripts/carriles.mjs mesa <PUESTO> <dir>
//
// Salida 2 = NO-PUDE-MIRAR (tabla ambigua, ruta que no existe, puesto desconocido): nunca un verde.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FUENTE, PUESTOS, construirMapa, reglaDe, excepcionPara, areasDePuestos, titulosDePuestos, fichaDe, globARegex, censoDeHuecos, nombresQueContradicen, puestoDeNombre, scriptsSinFila } from './_carriles.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAPA = '.claude/carriles.json';
export const DIR_REGLAS = '.claude/rules';

export function ficherosDelRepo(raiz = RAIZ) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
}

/** Todo lo generado, como {ruta relativa → contenido}, más la población y los errores. */
export function generar(textoTabla, ficheros) {
  const mapa = construirMapa(textoTabla, ficheros);
  const sha = crypto.createHash('sha256').update(textoTabla.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
  const areas = areasDePuestos(textoTabla);
  const titulos = titulosDePuestos(textoTabla);
  const json = {
    _: `GENERADO por scripts/carriles.mjs desde ${FUENTE} (sha256 ${sha}). NO se edita a mano: se cambia la tabla y se regenera.`,
    fuente: FUENTE,
    sha,
    areas,
    titulos,
    reglas: mapa.reglas.map(({ patron, puesto, tipo, linea, dueno, general }) => ({ patron, puesto, tipo, linea, dueno, ...(general ? { general } : {}) })),
    excepciones: mapa.excepciones,
  };
  const salida = { [MAPA]: JSON.stringify(json, null, 2) + '\n' };
  for (const p of PUESTOS) {
    const propias = mapa.reglas.filter((r) => r.puesto === p);
    if (!propias.length) continue;
    // Lo que un patrón ancho de este puesto NO cubre, porque una fila más específica lo da a otro.
    const excepto = mapa.reglas.filter((r) => r.puesto !== p && propias.some((q) => q.patron.includes('*') && globARegex(q.patron).test(r.patron.replace(/\*+/g, 'x'))));
    const lineas = [
      '---',
      'paths:',
      ...propias.map((r) => `  - "${r.patron}"`),
      '---',
      `# Carril ${p} — GENERADO por \`scripts/carriles.mjs\` desde \`${FUENTE}\` §3. No se edita a mano.`,
      '',
      `Este fichero es del puesto **${p}**${titulos[p] ? ` (${titulos[p]})` : ''}, salvo que lo cubra una fila más específica de otro puesto (abajo).`,
      `Si tu puesto no es ${p}, **no lo edites**: se pide al dueño por Jira (\`${FUENTE}\` §5). Un cruce legítimo se declara en §3.4 con su motivo y se regenera. Lo hace cumplir \`.claude/hooks/carril.mjs\`.`,
      ...(propias.some((r) => r.tipo === 'contenedor') ? ['', `Contenedores de ${p} (cualquier puesto añade SOLO su bloque, marcado con su puesto; nunca reescribe lo ajeno): ${propias.filter((r) => r.tipo === 'contenedor').map((r) => `\`${r.patron}\``).join(', ')}.`] : []),
      ...(excepto.length ? ['', 'Tienen otro dueño aunque casen con los patrones de arriba:', ...excepto.map((r) => `- \`${r.patron}\` → ${r.puesto ?? 'sin cerradura'} (${FUENTE}:${r.linea})`)] : []),
      '',
    ];
    salida[`${DIR_REGLAS}/carril-${p.toLowerCase()}.md`] = lineas.join('\n');
  }
  return { salida, mapa, sha };
}

/** El texto de la mesa de un puesto: CLAUDE.local.md y .yaqu-puesto.json. */
export function textoMesa(puesto, textoTabla, ficheros, leerCicatrices = () => null, nombre = null) {
  const areas = areasDePuestos(textoTabla);
  if (puesto !== 'ORQ' && !areas[puesto]) return { error: `puesto «${puesto}» desconocido: no está en las tablas de §2 de ${FUENTE}` };
  // El NOMBRE con el que se lanza va en la mesa: es la traducción de quien lanza, y la sonda del nombre
  // la lee de ahí en vez de traducir por su cuenta (puestoDeNombre). Un puesto J no tiene un nombre que
  // se deduzca de su forma («sesion-1» es J1 allí y S1 aquí): sin --nombre no hay mesa, y se dice AQUÍ,
  // al lanzar, no parando después a todo su equipo por una discrepancia que no es señal.
  if (/^J/.test(puesto) && !nombre) return { error: `la mesa de ${puesto} necesita --nombre <nombre de sesión>: en el equipo de Javier el nombre no se deduce del puesto, y sin él la cerradura leería «sesion-N» como SN y pararía por DISCREPANCIA` };
  if (nombre && !/^sesion-\d$/i.test(nombre.trim())) {
    const porForma = puestoDeNombre(nombre);
    if (porForma && porForma !== puesto) return { error: `el nombre «${nombre}» dice ${porForma} por su forma y la mesa es de ${puesto}: eso no es una traducción, es una discrepancia` };
  }
  const { mapa, sha } = generar(textoTabla, ficheros);
  const ficha = fichaDe(puesto);
  const propias = mapa.reglas.filter((r) => r.puesto === puesto).map((r) => `\`${r.patron}\``);
  const cicatrices = puesto === 'ORQ' ? null : leerCicatrices(puesto);
  const md = [
    `# Eres ${puesto === 'ORQ' ? 'el ORQUESTADOR' : `el puesto ${puesto}`}`,
    '',
    `> GENERADO por \`scripts/carriles.mjs mesa\` desde \`${FUENTE}\` (sha256 ${sha}). Lo sabes por la CARPETA`,
    '> en la que has arrancado, no porque te lo diga un prompt. Si tu nombre de sesión (`-n`) dice otro puesto,',
    '> la discrepancia ES el dato: PARA y avisa, no elijas uno.',
    '',
    ...(puesto === 'ORQ' ? ['Coordinas; no construyes en el carril de nadie.'] : [`**Área:** ${areas[puesto]}`]),
    '',
    `**Tu ficha:** \`${ficha}\` — léela al arrancar.`,
    ...(propias.length ? ['', `**Tu carril (ficheros que son tuyos):** ${propias.join(', ')}.`] : []),
    '',
    `Lo demás tiene dueño: \`node scripts/carriles.mjs de <ruta>\` te dice de quién. La cerradura \`.claude/hooks/carril.mjs\` no te deja editar fuera de tu carril salvo excepción declarada en §3.4.`,
    ...(cicatrices ? ['', '## Tus cicatrices (en qué se equivoca este puesto)', '', cicatrices.trim()] : []),
    '',
  ].join('\n');
  const json = JSON.stringify({ puesto, ...(nombre ? { nombre: nombre.trim() } : {}), generadoDe: `${FUENTE}@${sha}`, generadoEn: new Date().toISOString() }, null, 2) + '\n';
  return { md, json };
}

function principal(argv) {
  const [orden, ...resto] = argv;
  let tabla;
  let ficheros;
  try {
    tabla = fs.readFileSync(path.join(RAIZ, FUENTE), 'utf8');
    ficheros = ficherosDelRepo();
  } catch (e) {
    console.log(`NO-PUDE-MIRAR: no leo ${FUENTE} o la lista de ficheros (${e.message})`);
    return 2;
  }
  const { salida, mapa } = generar(tabla, ficheros);
  const poblacion = `carriles · ${mapa.filas} filas de §3 · ${mapa.reglas.length} reglas (${mapa.reglas.filter((r) => r.puesto).length} con dueño) · ${mapa.excepciones.length} excepciones · ${Object.keys(salida).length - 1} ficheros de regla · ${ficheros.length} ficheros en el repo`;
  if (mapa.errores.length) {
    console.log(`NO-PUDE-MIRAR: la tabla no se deja convertir sin elegir por ella:\n  ${mapa.errores.join('\n  ')}`);
    return 2;
  }
  if (orden === 'generar' || orden === 'comprobar') {
    const distintos = [];
    const sobran = fs.existsSync(path.join(RAIZ, DIR_REGLAS))
      ? fs.readdirSync(path.join(RAIZ, DIR_REGLAS)).filter((f) => /^carril-.*\.md$/.test(f)).map((f) => `${DIR_REGLAS}/${f}`).filter((f) => !(f in salida))
      : [];
    for (const [rel, contenido] of Object.entries(salida)) {
      const abs = path.join(RAIZ, rel);
      const actual = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') : null;
      if (actual === contenido) continue;
      distintos.push(rel);
      if (orden === 'generar') { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, contenido); }
    }
    if (orden === 'generar') for (const f of sobran) fs.rmSync(path.join(RAIZ, f));
    console.log(poblacion);
    if (orden === 'comprobar' && (distintos.length || sobran.length)) {
      console.log(`DISTINTO de la tabla: ${[...distintos, ...sobran].join(', ')} — node scripts/carriles.mjs generar`);
      return 1;
    }
    console.log(orden === 'generar' ? `escritos: ${distintos.length} · borrados: ${sobran.length}` : 'IGUAL a la tabla');
    return 0;
  }
  if (orden === 'de') {
    const rel = path.relative(RAIZ, path.resolve(resto[0] ?? '')).split(path.sep).join('/');
    const r = reglaDe(rel, mapa);
    console.log(r ? `${rel} → ${r.puesto ?? 'SIN CERRADURA'} (${r.tipo}) · ${FUENTE}:${r.linea} · «${r.dueno}» · patrón ${r.patron}` : `${rel} → sin fila en §3: nadie lo reclama`);
    // SCRUM-1480e: la fila general de scripts/ no da dueño (no es «todo lo demás de…», que sí lo da). A
    // quien cae en ella se le dice aquí, que es donde se pregunta, y no en un documento que hay que ir a leer.
    if (r && !r.puesto && r.patron === 'scripts/**') console.log(`  ⚠ sólo lo cubre la fila general de scripts/: su dueño no lo ha decidido nadie, y no es de la S0 por caer aquí. Si lo estás CREANDO, nace con fila en tu mismo PR: la del puesto del área del ticket que lo crea (${FUENTE} §3.3, «Cómo nace la fila de un fichero de scripts/»).`);
    for (const p of PUESTOS) { const e = excepcionPara(rel, p, mapa); if (e && !e.quien.includes('*')) console.log(`  excepción para ${p}: ${e.motivo} (${FUENTE}:${e.linea})`); }
    const todos = excepcionPara(rel, '*', mapa); if (todos) console.log(`  excepción para todos: ${todos.motivo} (${FUENTE}:${todos.linea})`);
    return 0;
  }
  if (orden === 'mesa') {
    const iN = resto.indexOf('--nombre');
    const nombre = iN >= 0 ? resto[iN + 1] : null;
    if (iN >= 0 && (!nombre || nombre.startsWith('--'))) { console.log('NO-PUDE-MIRAR: --nombre sin valor'); return 2; }
    const [puesto, dir] = resto.filter((_, i) => iN < 0 || (i !== iN && i !== iN + 1));
    if (!puesto || !dir || !path.isAbsolute(dir) || !fs.existsSync(dir)) { console.log('NO-PUDE-MIRAR: uso: mesa <PUESTO> <ruta ABSOLUTA de la mesa, que exista>'); return 2; }
    const leer = (p) => { const f = path.join(RAIZ, 'docs/equipo/cicatrices', `${p}.md`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('- ')).join('\n') || null : null; };
    const r = textoMesa(puesto.toUpperCase(), tabla, ficheros, leer, nombre);
    if (r.error) { console.log(`NO-PUDE-MIRAR: ${r.error}`); return 2; }
    fs.writeFileSync(path.join(dir, 'CLAUDE.local.md'), r.md);
    fs.writeFileSync(path.join(dir, '.yaqu-puesto.json'), r.json);
    console.log(`mesa ${puesto.toUpperCase()} → ${dir}: CLAUDE.local.md (${Buffer.byteLength(r.md)} B) + .yaqu-puesto.json${nombre ? ` (nombre «${nombre.trim()}»)` : ''}`);
    return 0;
  }
  if (orden === 'huecos') {
    const c = censoDeHuecos(mapa, ficheros);
    console.log(`huecos · ${c.producto} ficheros de producto (src/, public/) · ${c.especificos} con fila específica · ${c.generales} solo por la fila general (${c.reglasGenerales} filas generales) · ${c.sinFila.length} sin fila`);
    // CONTROL POSITIVO: sin producto, sin filas generales o sin ficheros con dueño específico, el censo
    // no tiene con qué comparar, y su «0 huecos» no sabría nada.
    if (!c.producto || !c.reglasGenerales || !c.especificos || !c.generales) { console.log('NO-PUDE-MIRAR: población vacía en alguna columna; un censo así no ve huecos, no es que no los haya'); return 2; }
    for (const f of c.sinFila) console.log(`SIN-FILA  ${f} → ninguna fila de §3 lo reclama`);
    for (const h of c.parientes) console.log(`PARIENTE  ${h.fichero} → ${h.puesto} solo por la fila general (${FUENTE}:${h.linea}); por el nombre se parece a ${h.pistas.map((p) => `${p.puesto} («${p.palabra}»: ${p.ejemplos.map((e) => e.slice(e.lastIndexOf('/') + 1)).join(', ')}${p.n > 2 ? `, +${p.n - 2}` : ''})`).join(' · ')}`);
    const nc = nombresQueContradicen(mapa, ficheros);
    console.log(`nombres · ${nc.conPuestoEnElNombre} rutas del repo llevan un puesto en el nombre · ${nc.casos.length} tramos contradicen a la tabla`);
    if (!nc.conPuestoEnElNombre) { console.log('NO-PUDE-MIRAR: ninguna ruta lleva un puesto en el nombre; existen (las fichas de los puestos), así que el lector no ve'); return 2; }
    for (const k of nc.casos) console.log(`NOMBRE    ${k.tramo} → el nombre dice ${k.dice}, la tabla dice ${k.puesto} (${FUENTE}:${k.linea}); ${k.n} fichero${k.n === 1 ? '' : 's'}`);
    const n = c.sinFila.length + c.parientes.length + nc.casos.length;
    console.log(`→ ${n} casos. No es un veredicto: es la pregunta para los jefes (¿hueco de la tabla, o de ese puesto a propósito?). Cada uno se cierra con una fila en §3.`);
    return n ? 1 : 0;
  }
  if (orden === 'sin-fila') {
    // SCRUM-1480f: los scripts que sólo cubre la fila general. Con `--lista`, sólo los nombres (uno por línea).
    const scripts = ficheros.filter((f) => f.startsWith('scripts/'));
    const sin = scriptsSinFila(mapa, ficheros);
    // CONTROL POSITIVO: sin scripts, o sin ninguno con fila, la cuenta no distingue nada.
    if (!scripts.length || sin.length === scripts.length) { console.log('NO-PUDE-MIRAR: no hay scripts/ o ninguno tiene fila; una cuenta así no mide'); return 2; }
    if (!resto.includes('--lista')) console.log(`sin-fila · ${scripts.length} ficheros en scripts/ · ${scripts.length - sin.length} con fila propia · ${sin.length} sólo con la fila general (${FUENTE} §3.3)`);
    for (const f of sin) console.log(f);
    return 0;
  }
  console.log('uso: node scripts/carriles.mjs generar | comprobar | de <ruta> | huecos | sin-fila [--lista] | mesa <PUESTO> <dir> [--nombre <nombre de sesión>]');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = principal(process.argv.slice(2));
