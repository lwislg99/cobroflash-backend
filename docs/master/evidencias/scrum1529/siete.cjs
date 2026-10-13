// docs/master/evidencias/scrum1529/siete.cjs — SCRUM-1529
//
// LOS SIETE CAMPOS DE ESTADO QUE ESPERAN AL FUNDADOR, con un control POSITIVO y un CERO por campo.
//
//     node docs/master/evidencias/scrum1529/siete.cjs
//
// QUÉ HACE Y QUÉ NO. Los valores del código (D) y los del máster (M) NO los saca este fichero: los
// sacan los dos instrumentos de SCRUM-1500 (J5), sin tocar, a través de leer.cjs. Lo que añade:
//
//   1. EL CONTROL POR CAMPO, SEMBRADO. Copia src/, el esquema, el máster y los dos instrumentos a un
//      directorio temporal FUERA del repositorio y le añade UN fichero con siete escrituras de Prisma
//      fabricadas, una por campo, cada una con un valor que no existe (`zz1529_<delegado>`). Corre los
//      instrumentos tres veces:
//        · árbol REAL            → el valor sembrado tiene que salir 0 veces    (el CERO derivado)
//        · copia SEMBRADA        → tiene que salir en SU campo y en ningún otro  (el POSITIVO)
//        · copia SIN la siembra  → 0 otra vez: lo que lo hizo aparecer fue la siembra, no la copia
//      Si la siembra no llegó a escribirse, sale CIEGO, no verde.
//   2. UNA SONDA DE TEXTO sobre src/ y public/, independiente del AST: cuántas líneas nombran cada
//      valor en disputa, entre comillas y como palabra entera. NO atribuye la línea a un campo (un
//      texto no sabe de qué tabla habla): dice si el valor vive en algún sitio que los instrumentos
//      no miran (lecturas, public/). Qué campo es cada línea se lee a mano, y va en el registro.
//
// NO VE: SQL crudo, las transiciones, ninguna base de datos.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const SIETE = [
  ['QuoteRequest.status', 'quoteRequest', 'status'],
  ['ParteTrabajo.estado', 'parteTrabajo', 'estado'],
  ['TeamMember.status', 'teamMember', 'status'],
  ['Quote.status', 'quote', 'status'],
  ['Invoice.status', 'invoice', 'status'],
  ['Charge.status', 'charge', 'status'],
  ['WhatsAppMessage.status', 'whatsAppMessage', 'status'],
];
const sembrado = (delegado) => `zz1529_${delegado}`;
const NOMBRE_SIEMBRA = path.join('src', 'sonda1529-siembra.ts');

function leer(raiz) {
  // cwd = el árbol real: desde ahí se resuelve el módulo typescript (la copia no tiene node_modules).
  const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const salida = execFileSync(process.execPath, [path.join(raiz, 'docs', 'master', 'evidencias', 'scrum1529', 'leer.cjs'), raiz], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(salida);
}

function copiar(destino) {
  for (const rel of ['src', path.join('prisma', 'schema.prisma'), path.join('docs', 'YAQU_MASTER.md'),
    path.join('docs', 'master', 'evidencias', 'scrum1500'), path.join('docs', 'master', 'evidencias', 'scrum1500c'), path.join('docs', 'master', 'evidencias', 'scrum1529')]) {
    fs.cpSync(path.join(RAIZ, rel), path.join(destino, rel), { recursive: true });
  }
}

function sembrar(destino) {
  const cuerpo = SIETE.map(([, delegado, campo]) => `  await prisma.${delegado}.update({ where: { id: 1 }, data: { ${campo}: '${sembrado(delegado)}' } });`).join('\n');
  fs.writeFileSync(path.join(destino, NOMBRE_SIEMBRA), `// SIEMBRA de SCRUM-1529: no es código del producto.\nexport async function siembra(prisma: any) {\n${cuerpo}\n}\n`);
}

/** Cuántas de las siete marcas hay de verdad en el fichero sembrado (0 si no existe). */
function marcasEnDisco(destino) {
  const f = path.join(destino, NOMBRE_SIEMBRA);
  if (!fs.existsSync(f)) return 0;
  const t = fs.readFileSync(f, 'utf8');
  return SIETE.filter(([, d]) => t.includes(`'${sembrado(d)}'`)).length;
}

const dondeSale = (r, valor) => Object.keys(r.campos).filter((id) => r.campos[id].D.includes(valor));

function ficheros(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor' && e.name !== 'node_modules') ficheros(p, exts, out); } else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

function sondaDeTexto() {
  const VALORES = [
    ['Quote.status', 'pending_approval'], ['Invoice.status', 'expired'], ['Charge.status', 'failed'], ['Charge.status', 'cancelled'],
    ['WhatsAppMessage.status', 'received'], ['QuoteRequest.status', 'converted'], ['QuoteRequest.status', 'discarded'], ['QuoteRequest.status', 'seen'],
    ['ParteTrabajo.estado', 'facturado'], ['TeamMember.status', 'suspended'],
  ];
  // Misma población que los instrumentos: los `.d.ts` no cuentan.
  const fs1 = ficheros(path.join(RAIZ, 'src'), ['.ts']).filter((f) => !f.endsWith('.d.ts'));
  const fs2 = ficheros(path.join(RAIZ, 'public'), ['.js', '.html']);
  // DOS recuentos por valor, y no son lo mismo: `comillas` es el valor ENTRE COMILLAS (un literal:
  // lo escribe o lo compara alguien); `palabra` es la palabra entera, que incluye además las claves
  // de objeto sin comillas (`pending_approval: {…}`) y TAMBIÉN los comentarios y la prosa.
  const cuenta = (lista, valor) => {
    const comillas = new RegExp(`['"\`]${valor}['"\`]`);
    const palabra = new RegExp(`(^|[^A-Za-z0-9_])${valor}([^A-Za-z0-9_]|$)`);
    let nc = 0; let np = 0; const donde = new Set();
    for (const f of lista) {
      fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
        if (palabra.test(l)) { np += 1; donde.add(f); }
        if (comillas.test(l)) nc += 1;
      });
    }
    return { comillas: nc, palabra: np, ficheros: donde.size };
  };
  const filas = VALORES.map(([campo, v]) => ({ campo, valor: v, src: cuenta(fs1, v), pub: cuenta(fs2, v), cero: cuenta(fs1, `${v}zz1529`).palabra + cuenta(fs2, `${v}zz1529`).palabra }));
  return { poblacion: { src: fs1.length, public: fs2.length }, filas };
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1529-'));
  let mal = 0;
  try {
    const real = leer(RAIZ);
    copiar(tmp);
    const sinSiembra = leer(tmp);
    sembrar(tmp);
    const marcas = marcasEnDisco(tmp);
    const conSiembra = marcas === SIETE.length ? leer(tmp) : null;

    console.log(`POBLACION: ${SIETE.length} campos · árbol real: ${real.poblacion.ficheros} ficheros .ts bajo src/ (${real.poblacion.sinParsear} sin parsear), ${real.poblacion.escriturasVistas} escrituras de Prisma vistas, esquema ${real.poblacion.lineasEsquema} líneas, máster ${real.poblacion.lineasMaster} líneas`);
    console.log(`           copia sembrada: ${conSiembra ? `${conSiembra.poblacion.ficheros} ficheros .ts (${conSiembra.poblacion.sinParsear} sin parsear), ${conSiembra.poblacion.escriturasVistas} escrituras` : 'NO SE LEYÓ'} · marcas de la siembra en disco: ${marcas} de ${SIETE.length}`);
    if (Object.keys(real.campos).length !== SIETE.length) { console.log(`🔴 CIEGO: los instrumentos devuelven ${Object.keys(real.campos).length} de los ${SIETE.length} campos`); mal += 1; }
    if (!conSiembra) { console.log('🔴 CIEGO: la siembra no llegó al disco; ningún control vale'); mal += 1; }

    console.log('\n=== LOS SIETE, hoy (lo dicen los instrumentos de SCRUM-1500, sin tocar) ===');
    for (const [id] of SIETE) {
      const c = real.campos[id];
      if (!c) { console.log(`\n${id} → 🔴 NO DEVUELTO`); continue; }
      const sobran = c.M ? c.D.filter((x) => !c.M.includes(x)) : [];
      const faltan = c.M ? c.M.filter((x) => !c.D.includes(x)) : [];
      console.log(`\n${id} (esquema, línea ${c.lineaEsquema}) → ${c.veredicto}   [${c.instrumento}]`);
      console.log(`    código  : ${c.D.join(' | ') || '(nada)'}${c.defecto ? `   · @default ${c.defecto}` : '   · sin @default'}`);
      console.log(`    máster  : ${c.M ? `${c.M.join(' | ')}   ← línea ${c.lineaMaster}` : 'EL MÁSTER NO LO FIJA (sin lista para este campo)'}`);
      if (c.M) console.log(`    en el código y no en el máster: ${sobran.join(', ') || '(ninguno)'} · en el máster y no en el código: ${faltan.join(', ') || '(ninguno)'}`);
      if (c.cierre && c.cierre.length) console.log(`    lo cierra: ${c.cierre.join(' | ')}   ← ${c.cierreDe}`);
      for (const s of c.literales || []) console.log(`      literal    ${s}`);
      for (const s of c.noLiterales || []) console.log(`      NO literal ${s}`);
      for (const f of c.fuentes || []) {
        console.log(`      · ${f.de}: ${f.valores.join(' | ') || '(ningún literal)'}${f.ciego ? `   🔴 ${f.ciego}` : ''}`);
        for (const s of f.noLiterales) console.log(`          NO literal ${s}`);
      }
    }

    console.log('\n=== CONTROLES, uno POSITIVO y uno de CERO por campo ===');
    let vistos = 0;
    for (const [id, delegado] of SIETE) {
      const v = sembrado(delegado);
      const enReal = dondeSale(real, v);
      const enCopia = dondeSale(sinSiembra, v);
      const enSembrada = conSiembra ? dondeSale(conSiembra, v) : null;
      const mismosValores = JSON.stringify(real.campos[id] && real.campos[id].D) === JSON.stringify(sinSiembra.campos[id] && sinSiembra.campos[id].D);
      const bien = enReal.length === 0 && enCopia.length === 0 && enSembrada && enSembrada.length === 1 && enSembrada[0] === id && mismosValores;
      if (bien) vistos += 1; else mal += 1;
      console.log(`${bien ? 'VE   ' : '🔴 MAL'} ${id}: «${v}» sale en el árbol real ${enReal.length} veces (tiene que ser 0) · en la copia sin siembra ${enCopia.length} (0) · sembrado sale en [${enSembrada ? enSembrada.join(', ') : 'CIEGO'}] (tiene que ser sólo ${id}) · la copia sin siembra da los mismos valores que el árbol real: ${mismosValores ? 'sí' : 'NO'}`);
    }
    console.log(`\n${vistos} de ${SIETE.length} campos: la búsqueda VE una escritura nueva en ese campo y no la confunde con otro`);

    const t = sondaDeTexto();
    console.log(`\n=== SONDA DE TEXTO (no atribuye a un campo) · ${t.poblacion.src} ficheros .ts de src/ · ${t.poblacion.public} ficheros .js/.html de public/ ===`);
    for (const f of t.filas) {
      console.log(`    «${f.valor}» (por ${f.campo}): src/ ${f.src.comillas} entre comillas, ${f.src.palabra} como palabra, en ${f.src.ficheros} fichero(s) · public/ ${f.pub.comillas} entre comillas, ${f.pub.palabra} como palabra, en ${f.pub.ficheros} fichero(s) · control «${f.valor}zz1529»: ${f.cero}`);
      if (f.cero !== 0) mal += 1;
    }
    if (t.poblacion.src === 0 || t.poblacion.public === 0) { console.log('🔴 CIEGO: la sonda de texto no leyó ficheros'); mal += 1; }
    const positivo = t.filas.find((f) => f.valor === 'pending_approval');
    if (!positivo || positivo.src.comillas === 0 || positivo.pub.comillas === 0) { console.log('🔴 CIEGO: «pending_approval» tiene que salir entre comillas en src/ y en public/'); mal += 1; }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\nEXIT=${mal ? 1 : 0}`);
  process.exit(mal ? 1 : 0);
}

main();
