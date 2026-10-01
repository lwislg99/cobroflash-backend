// tests/scrum811c-skill-ui-declarada.test.mjs — SCRUM-811
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA SKILL «OBLIGATORIA» QUE NADIE CARGA NO ES UNA REGLA: ES UN DOCUMENTO
//
// Medido en SCRUM-811 (comentario 15828, S1/S6): `yaqu-premium-ui` se declara obligatoria
// «antes de tocar UI» en `CLAUDE.md` y en su propio fichero, y de 222 registros que tocaban
// `public/` sólo 2 la mencionan (0,9 %). La comparación que decide el diseño de este guard:
//
//   | obligación                | mecanismo | cumplimiento |
//   | -------------------------- | --------- | ------------- |
//   | ancla `**Medido contra:**` | GUARD     | 572/574 · 99,7 % |
//   | `yaqu-premium-ui`          | prosa     | 2/222 · 0,9 %  |
//
// **La distancia no la explica la disciplina: la explica el guard.** Decisión del fundador
// (comentario 16268, 21-sep-2026): «guard de entrada que exija "skill cargada / por qué no"
// en registros que toquen public/ (mide declaración, no carga)». Este fichero es eso.
//
// ── QUÉ SE PUEDE MEDIR DESDE EL REPO, Y QUÉ NO ────────────────────────────────────────────
// Que una sesión CARGÓ la skill no es comprobable desde git (la carga no toca el árbol). Lo
// que SÍ se puede exigir, igual que `**Medido contra:**`, es la DECLARACIÓN estructural: un
// campo fijo en el encabezado de la entrada. Mide declaración, no carga — tal cual pide el
// encargo. Que alguien escriba `**Skill UI:** cargada` sin haberla abierto es posible, y es
// el mismo límite que ya acepta `**Medido contra:**` (nadie comprueba que el sha se copió de
// verdad de un `git rev-parse`). No es un guard peor: es el mismo tipo de guard.
//
// ── TROCEADOR REUTILIZADO, NO DUPLICADO ───────────────────────────────────────────────────
// `entradasTroceadas()` viene de `scrum267-ancla-de-medicion.test.mjs`, igual que ya hacen
// `scrum649` y `scrum859`: parte cada fichero de `docs/master/` en sus entradas reales
// (incluye apéndices, SCRUM-532) y no depende de un troceador propio que pueda divergir.
//
// ── LA RUTA public/ SE BUSCA EN TODO EL CUERPO, NO SÓLO EN «## Ficheros» ──────────────────
// SCRUM-391 ya midió que la sección «## Ficheros» sólo la usan 58 de 104 entradas: acotar el
// detector a esa sección cegaría a las otras 46. Se busca la ruta en el cuerpo entero, igual
// que SCRUM-391 busca `tests/*.test.mjs` en el cuerpo entero. Falso positivo aceptado (una
// entrada que sólo MENCIONA `public/` en prosa, sin tocarlo) por el mismo motivo que allí: es
// mejor pedir una declaración de más que quedarse ciego en el 44 % de los casos.
//
// ── EL CORTE POR FECHA, Y POR QUÉ NO SE EXIGE A LO YA ESCRITO ─────────────────────────────
// 222 entradas ya tocan `public/` sin este campo — exigírselo retroactivamente castigaría a
// quien siguió el formato vigente cuando lo escribió (el mismo argumento del README para las
// tres anclas exentas de SCRUM-267: SCRUM-231, 244, 264). El campo se exige sólo a partir de
// `CORTE`, que es la fecha en que este guard entra en `main` — así lo dice la propia fecha en
// el campo `**Fecha:**` de cada entrada, sin necesidad de mantener una lista de excepciones.
// Si estás escribiendo una entrada NUEVA que toca `public/`, esto te afecta: pon el campo.
//
// ── 🔴 SCRUM-1340 · LO DE ARRIBA EXIMÍA A QUIEN NO LE DABA DATOS ──────────────────────────
// Las dos condiciones de arriba —nombrar la ruta CON su prefijo y llevar el campo de fecha—
// las cumplía el propio registro que se iba a medir, y CADA UNA bastaba para quedar exento.
// Medido el 1-oct-2026 sobre `main`: de 101 PR que habían tocado la interfaz desde el corte,
// este guard miraba 5; 96 salían exentos y 74 de ellos no declaraban nada. El campo de fecha,
// además, casi había dejado de escribirse (3 de 170 entradas desde el 27-sep): el guard
// esperaba un campo que el registro ya no usaba. En todo el árbol exigía a 9 entradas de 1.384.
//
// La pregunta «¿toca la interfaz?» se le hace ahora al CAMBIO, no al registro: el motor está en
// `_skill-ui-por-efecto.mjs` y la segunda mitad de este fichero es el guard que lo usa. Lo de
// arriba se CONSERVA tal cual, en unión: lo que ya se medía se sigue midiendo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { entradasTroceadas, entradasConClave } from './scrum267-ancla-de-medicion.test.mjs';
import {
  parsearNombres, parsearParches, leerUnidades, veredictoDeUnidad, agruparPorFichero,
} from './_skill-ui-por-efecto.mjs';

// El corte: entradas fechadas EN o ANTES de este día quedan exentas (formato vigente cuando
// se escribieron no exigía el campo). A partir del día siguiente, se exige.
const CORTE_AAAAMMDD = '2026-09-22';

const MESES = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

/** `**Fecha:** 22-sep-2026` → `'2026-09-22'`, o `null` si no hay campo reconocible. */
export function fechaDeEntrada(cuerpo) {
  const m = /\*\*Fecha:\*\*\s*(\d{1,2})-([a-z]{3})-(\d{4})/i.exec(cuerpo);
  if (!m) return null;
  const mes = MESES[m[2].toLowerCase()];
  if (!mes) return null;
  return `${m[3]}-${mes}-${String(m[1]).padStart(2, '0')}`;
}

/** ¿El cuerpo nombra una ruta real bajo `public/`? Toda la entrada, no sólo «## Ficheros». */
export function tocaPublic(cuerpo) {
  return /public\/[A-Za-z0-9_./-]+\.(js|css|html)/.test(cuerpo);
}

/** ¿Lleva `**Skill UI:** cargada` o `**Skill UI:** no cargada · <motivo>`? */
export function declaraSkillUi(cuerpo) {
  return /\*\*Skill UI:\*\*\s*(cargada\b|no cargada\s*·\s*\S)/i.test(cuerpo);
}

/** Entradas que EXIGEN el campo: tocan `public/`, fecha posterior al corte, y no lo llevan. */
export function entradasSinDeclarar(entradas) {
  return entradas.filter((e) => {
    if (!tocaPublic(e.cuerpo)) return false;
    const f = fechaDeEntrada(e.cuerpo);
    if (!f || f <= CORTE_AAAAMMDD) return false; // sin fecha reconocible o pre-corte: exenta
    return !declaraSkillUi(e.cuerpo);
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO — el detector ve el árbol real, y ve casos de `public/` de verdad (si no, está ciego)
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-811 · SUELO: el troceador ve entradas, y algunas tocan public/ de verdad', () => {
  const entradas = entradasTroceadas();
  assert.ok(entradas.length >= 300,
    `🔴 CIEGO: sólo ${entradas.length} entradas — se midieron 696+ el 15-sep-2026 (SCRUM-859). ` +
    'El troceador no está llegando al árbol.');

  const tocanPublic = entradas.filter((e) => tocaPublic(e.cuerpo));
  assert.ok(tocanPublic.length >= 50,
    `🔴 sólo ${tocanPublic.length} entradas mencionan una ruta public/*.{js,css,html} — se ` +
    'midieron 222 el 17-sep-2026 (SCRUM-811b). Si el detector de rutas está roto, este guard ' +
    'nunca exige nada y su verde no significa «cumple»: significa «no miré».');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AUTOPRUEBA — sobre texto fabricado, el detector acierta los cuatro casos
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-811 · AUTOPRUEBA: fecha, ruta y declaración se leen bien sobre el cebo', () => {
  assert.equal(fechaDeEntrada('**Fecha:** 22-sep-2026 · **Carril:** A'), '2026-09-22');
  assert.equal(fechaDeEntrada('**Fecha:** 3-ene-2027'), '2027-01-03');
  assert.equal(fechaDeEntrada('sin campo de fecha aquí'), null);

  assert.equal(tocaPublic('Cambios en `public/dashboard/js/app.js` y tests.'), true);
  assert.equal(tocaPublic('Cambios en `src/modules/quotes/service.ts` solamente.'), false);

  assert.equal(declaraSkillUi('**Skill UI:** cargada'), true);
  assert.equal(declaraSkillUi('**Skill UI:** no cargada · no toca componentes visuales, solo el copy de un log'), true);
  assert.equal(declaraSkillUi('**Skill UI:** no cargada'), false, '🔴 «no cargada» SIN motivo no basta: el campo pide el porqué');
  assert.equal(declaraSkillUi('sin ese campo'), false);

  // El caso que decide el guard: toca public/, es POSTERIOR al corte, y no declara → se exige.
  const rojo = [{ cuerpo: '**Fecha:** 23-sep-2026\n\nToca `public/dashboard/js/app.js`.' }];
  assert.equal(entradasSinDeclarar(rojo).length, 1, '🔴 el caso que debía caer no cayó');

  // Y el CONTROL NEGATIVO, en tres variantes que NO deben caer:
  const verdes = [
    // ① declara el campo
    { cuerpo: '**Fecha:** 23-sep-2026\n\nToca `public/dashboard/js/app.js`.\n\n**Skill UI:** cargada' },
    // ② fecha en el corte mismo (exenta: «en o antes» del corte)
    { cuerpo: '**Fecha:** 22-sep-2026\n\nToca `public/dashboard/js/app.js`.' },
    // ③ no toca public/
    { cuerpo: '**Fecha:** 23-sep-2026\n\nToca `src/modules/quotes/service.ts`.' },
  ];
  assert.deepEqual(entradasSinDeclarar(verdes), [],
    '🔴 FALSO POSITIVO sobre un caso que no debía caer — ver los tres del control negativo');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL QUE DECIDE — ninguna entrada real, posterior al corte, se salta la declaración
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-811 · toda entrada NUEVA que toca public/ declara si cargó la skill, o por qué no', () => {
  const faltan = entradasSinDeclarar(entradasTroceadas())
    .map((e) => `${e.fichero}#${e.clave ?? e.indice} (${e.tituloCompleto.trim()})`);

  assert.deepEqual(faltan, [],
    `🔴 ${faltan.length} entrada(s) tocan public/ y no declaran \`**Skill UI:**\`:\n\n` +
    faltan.map((f) => `      ${f}`).join('\n') +
    '\n\n  Añade `**Skill UI:** cargada` o `**Skill UI:** no cargada · <motivo>` al encabezado. ' +
    'yaqu-premium-ui se declara obligatoria antes de tocar UI (CLAUDE.md, Parte AB del máster).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1340 · LA VÍA DEL EFECTO — a quién se le exige lo decide el cambio, no el registro
//
// Una UNIDAD es un PR: en `main`, cada commit de la cadena de primer padre posterior al corte;
// en una rama (y en CI), lo que va de su base al disco. Si la unidad cambió un
// `public/**.{js,css,html}`, es de interfaz, y al menos una de las entradas que ELLA escribió
// tiene que declarar la skill. Cuatro veredictos, y ninguno es «no la miré»:
// NO_ES_INTERFAZ · DECLARA · SIN_DECLARAR · NO_SE. Los dos últimos caen.
//
// ── POR QUÉ HAY UNA LISTA, Y POR QUÉ NO ES UNA ESCAPATORIA ────────────────────────────────
// Cuando esto se midió había 74 PR de interfaz YA MERGEADOS sin declarar, de los dos equipos.
// Reescribir sus registros para que crucen estaba prohibido por el ticket, y un segundo corte
// por fecha los habría perdonado sin nombrarlos. Van aquí UNO A UNO, por el sha de su merge
// —que no se puede mover—, y SIGUEN contando en la cuenta que este guard imprime en cada pasada.
//
// 🔴 LA LISTA SÓLO PUEDE ENCOGER, y no es una frase: lo hace cumplir el guard.
//   · un sha POSTERIOR al techo (por posición en la cadena de primer padre) no puede entrar;
//   · no puede tener más entradas que las 74 con las que nació;
//   · y si una de las listadas pasa a declarar, el guard CAE hasta que se quite de aquí: la
//     lista no encoge en silencio (las dos mitades del trinquete, A23 nº 7).
// Aprobada por el orquestador del equipo de Javier el 1-oct-2026 como cicatriz permanente; si el
// fundador decide que se declaren a posteriori, encoge sola.
// ═════════════════════════════════════════════════════════════════════════════════════════
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// El mismo corte de arriba, como INSTANTE: el final de ese día en Madrid (CEST, +02:00).
const CORTE_INSTANTE = `${CORTE_AAAAMMDD}T22:00:00Z`;

/** La punta de `main` sobre la que se derivó la lista. Nada posterior a ella puede entrar. */
export const TECHO_DE_HEREDADAS = 'eb3d3b367e62e95ca86c217a0a39a32764200075';
/** Con cuántas nació. El recuento de la lista no puede pasar de aquí. */
export const HEREDADAS_AL_NACER = 74;

// Derivada el 1-oct-2026 con `docs/master/evidencias/scrum1340/derivar.mjs` (el motor de este
// guard) y cruzada, conjunto contra conjunto, con un censo escrito aparte. De la más vieja a la
// más nueva, UNA POR LÍNEA: el día de su merge y el registro donde escribió.
export const HEREDADAS = [
  '936743224df712808258053f64391a25e0e3791c', // 2026-09-23 · SCRUM-910.md
  'b77a3cb3cbd4583302edecaddc17c255fe02e74e', // 2026-09-24 · SCRUM-1042.md
  '09f8ba9974964b9205936b9c3eb0ec70a8f0acb5', // 2026-09-24 · SCRUM-1008.md
  'f6814d23d2467de7f790e9bebb6e059a083f890c', // 2026-09-25 · SCRUM-1108.md (sólo tocadas)
  'e528628e30fc65357153e9159a43f1fdf2eafea0', // 2026-09-25 · SCRUM-1049.md
  'cbd6a2b43039b506953be1ca19fafcef05d3d20d', // 2026-09-25 · SCRUM-1022.md (sólo tocadas)
  '7eaf74892d9a4f2e3ef47d6f6ec4362bfa9efa03', // 2026-09-26 · SCRUM-1134.md
  '942e90d1f84dd6d7fcf5fa92aad48f36758c2d87', // 2026-09-26 · SCRUM-1124.md
  '494c0a7165d4b3e39e9b4b39d50616e32616a710', // 2026-09-27 · SCRUM-1186.md
  '8c77d6db85534f7dc5c9bda2585624eb42fd8da7', // 2026-09-27 · SCRUM-1175.md, SCRUM-1189.md
  '7ba1ad5f2a87e7752894f790a5256b20a65f9ed5', // 2026-09-27 · SCRUM-993.md
  '2bb2857144d7c80ee80bc780390d31f9ac8cfc7c', // 2026-09-28 · SCRUM-1162.md
  '3f4c643e93871234e59e5ca5db145ba5cef8f9ee', // 2026-09-28 · SCRUM-1161.md
  'a1f4d9ddae5e6f47e56ea0f4a39c58c4527afc40', // 2026-09-28 · SCRUM-1165.md
  'f9dc44a3f9267cd5624a4902ba3fc1fd93b108d9', // 2026-09-28 · SCRUM-1202.md
  '90b82de5844e9e6c664b66707cf0aaf3a67a21f9', // 2026-09-28 · SCRUM-993.md (sólo tocadas)
  '92161e9387119b6fdd39507bc0561b7af252b6ec', // 2026-09-28 · SCRUM-1188.md
  '00eef8c5e641fb418d8a25e9e172f90b328bd04c', // 2026-09-28 · SCRUM-1216.md
  'c57f745d0f9f8424abc90e8a591d10fd81a00cad', // 2026-09-28 · SCRUM-1164.md
  '6184ea45acbf37a645a7402e55f5e1abf85ab8f8', // 2026-09-28 · SCRUM-1191.md
  '3d57a7c0eca6dd630bca7391157ca41bd465e642', // 2026-09-28 · SCRUM-1219.md
  'dcbfe76d9427d689a9961ab695ef56ee006b05b5', // 2026-09-28 · SCRUM-1193.md
  '8b607386fc6f43b022e44bd56b8671784046f1cd', // 2026-09-28 · SCRUM-653.md
  '59012d2309adbd8569fc047bcd880f453ade523a', // 2026-09-28 · SCRUM-1164.md (sólo tocadas)
  'c6337738d88b64068a53e3f54983a3f8abee5476', // 2026-09-28 · SCRUM-1205.md
  'beca1de8870d43381668da32b51c8729ef6e5e21', // 2026-09-28 · SCRUM-1171.md (sólo tocadas)
  '44dd30659ce983dd646f35da0ee582860877a9bb', // 2026-09-28 · SCRUM-1215.md
  '0fa2140a431df06e942cc58ae6ef920c44a5417c', // 2026-09-28 · SCRUM-1188.md (sólo tocadas)
  '666f0a078e466800bbdf7c5e7bd49c2b427b89f0', // 2026-09-28 · SCRUM-1230.md
  '0c381c940db43ad4699537e29262791df7fcee95', // 2026-09-28 · SCRUM-1184.md (sólo tocadas)
  'c504b033de5e11ecfd7e7d46d0bc8b8d6fa546d8', // 2026-09-28 · SCRUM-1229.md
  'a3c0be3e3659152fc1662a3434b0b14e80044b21', // 2026-09-28 · SCRUM-1234.md
  'd49787292b06b2bca8dfee765f401ca5cd39b6f7', // 2026-09-28 · SCRUM-1199.md (sólo tocadas)
  '44f8dd38259d67e219830b0a7322589fd8f287f5', // 2026-09-28 · SCRUM-1220.md (sólo tocadas)
  '0afa87cd95645317226f59bc379edae59a7bea44', // 2026-09-28 · SCRUM-1239.md
  '76da0f4916e2c39541c44f01e389cf9fc2d6747f', // 2026-09-28 · SCRUM-1216.md
  '7ddab7d83ed9cc6c7c4b18e9d780f641c56fe1a6', // 2026-09-28 · SCRUM-1200.md
  'fdc01e4fc4a33e53f91affe4b5780a95ec013ce6', // 2026-09-28 · SCRUM-1235.md
  '8a27dd4a85b731faea7f4902295cbec1c64ef870', // 2026-09-28 · SCRUM-1247.md
  '244b30787df5d4b3c54d6592cd0a6b90c6631123', // 2026-09-28 · SCRUM-1130.md
  '0a0f6b79dea0f7f1f07fd69f57d317dffe79b999', // 2026-09-28 · SCRUM-1257.md
  '6112855bd225d5778598f4449ce752972614da32', // 2026-09-28 · SCRUM-1136.md
  'bb542f6d590658a6baf01218fcac5d9d3c641075', // 2026-09-28 · SCRUM-1232.md (sólo tocadas)
  'a4e664cd5d130d330a0b391f0f34d0787020179c', // 2026-09-28 · SCRUM-1133.md
  'ba1b096661db77f93aaaf52acdcfd7c9d99db9aa', // 2026-09-29 · SCRUM-1257.md
  '510ba6d9f408490c6dcbf2bed0806fd298044627', // 2026-09-29 · SCRUM-1215.md
  'bd2964d9a4ebfc48a38f8d34cacc1db250ebd144', // 2026-09-29 · SCRUM-1180.md
  'ae49a457a20950256b4cc80b69aa7aedf40f72be', // 2026-09-29 · SCRUM-1215.md (sólo tocadas)
  '7a94abae5260c5953b4171860e9779dd428f6527', // 2026-09-29 · SCRUM-1233.md
  '51dcfe156990dfb36b6dfb225e6d75bda7e5a08e', // 2026-09-29 · SCRUM-1267.md
  '2d1f9244cd0991cf6804e3965ebe1119fe0fdbe7', // 2026-09-29 · SCRUM-1233.md (sólo tocadas)
  '84925995b8621619f5c27542e90988cdbe4ee1e1', // 2026-09-29 · SCRUM-1266.md
  'b1d8845daf38394c33a22814db323394517c091a', // 2026-09-29 · SCRUM-1215.md (sólo tocadas)
  'fcc889928bd077ecd81776fded32ca83658e7cbb', // 2026-09-29 · SCRUM-1272.md
  '89fb1ec45d06b8c8d8368bc68a1c2492f5e748ab', // 2026-09-29 · SCRUM-1233.md (sólo tocadas)
  '57d3b900b26c0ac5725010a0220d1b112471f935', // 2026-09-29 · SCRUM-1271.md
  '59453d6a6fdf45b9c59c36bab08c04d3db134f0f', // 2026-09-29 · SCRUM-1215.md (sólo tocadas)
  '00d98f6bae81edddfd783e7aa7ac86244b3bf07f', // 2026-09-29 · SCRUM-1135.md
  'd3b37ac8fc5de19c15c4a39bd9fc2bf5abe8ecfb', // 2026-09-29 · SCRUM-1212.md (sólo tocadas)
  '610adb8d9141b9d7e41038acca0fa73b6bba2932', // 2026-09-29 · SCRUM-1275.md
  'f61f2d2efa89bc35a6208d64ae072f650f4fecf6', // 2026-09-29 · SCRUM-1266.md (sólo tocadas)
  'e75b94ca8755bd5d27981940c5ff4c01b2df8695', // 2026-09-29 · SCRUM-1233.md (sólo tocadas)
  '3700de42ef552b5da5689f375084d8be8ff47157', // 2026-09-29 · SCRUM-1285.md
  '51d81311b01e19d592ad99a1f1f0817e4121cb55', // 2026-09-29 · SCRUM-1126.md
  '1183c79946d9da54f471aa3502070e6c43842105', // 2026-09-29 · SCRUM-1287.md
  '483010e03a3836c702932420c239344ee2838d9e', // 2026-09-30 · SCRUM-1154.md
  'd65cfaa9a09599656a3a97bfbb26f6ce82ad33e5', // 2026-09-30 · SCRUM-1196.md
  'a91203a9a78d86eb9505ef170673761d0a6de984', // 2026-09-30 · SCRUM-1302.md (sólo tocadas)
  '0e3b2d66d0ba92a3d0af41f01a2180644320077c', // 2026-09-30 · SCRUM-1196.md (sólo tocadas)
  '71a4cd0552af761519536c3dcc7b44045c6c5f7b', // 2026-09-30 · SCRUM-1302.md (sólo tocadas)
  '264096a822b0d225a17b673d15ae4c617d6b868d', // 2026-09-30 · SCRUM-1126.md
  'f98f3ee1f8dc968b8158e769b98e83dbfa09c8ab', // 2026-09-30 · SCRUM-1142.md
  'ba712b6d2d1938d2eb5bb4d27a970468a3041377', // 2026-10-01 · SCRUM-1257.md
  'a5b62893c7616ddd19626afe5921eec67c691e9e', // 2026-10-01 · SCRUM-1102.md
];

/**
 * El juicio sobre TODAS las unidades de interfaz, con la lista de heredadas delante.
 *
 * Función pura: recibe las unidades ya juzgadas (`u.v`) y devuelve la cuenta y los tres motivos
 * por los que este guard cae — `nuevas` (sin declarar y fuera de la lista), `noSe` (no sé a qué
 * entrada pedírselo) y `lista` (la lista se ha roto: creció, caducó o apunta a algo que no veo).
 */
export function juicioPorEfecto({ historia, pendiente }, heredadas = HEREDADAS,
  techo = TECHO_DE_HEREDADAS, tope = HEREDADAS_AL_NACER) {
  const deInterfaz = historia.filter((u) => u.v.veredicto !== 'NO_ES_INTERFAZ');
  const posicion = new Map(historia.map((u, i) => [u.id, i]));   // 0 = la más nueva
  const porId = new Map(historia.map((u) => [u.id, u]));

  const lista = [];
  if (!posicion.has(techo)) lista.push(`el techo ${techo} no está en la cadena que he leído`);
  if (heredadas.length > tope) {
    lista.push(`la lista tiene ${heredadas.length} entradas y nació con ${tope}: sólo puede ENCOGER`);
  }
  if (new Set(heredadas).size !== heredadas.length) lista.push('la lista repite algún sha');
  let vivas = 0;
  for (const sha of heredadas) {
    const u = porId.get(sha);
    if (!u) { lista.push(`${sha}: no es una unidad de la cadena posterior al corte`); continue; }
    if (posicion.has(techo) && posicion.get(sha) < posicion.get(techo)) {
      lista.push(`${sha}: es POSTERIOR al techo — la lista no admite altas, sólo bajas`);
      continue;
    }
    if (u.v.veredicto === 'SIN_DECLARAR') { vivas++; continue; }
    lista.push(u.v.veredicto === 'DECLARA'
      ? `${sha}: ya declara — quítala de la lista (la lista encoge diciéndolo, no en silencio)`
      : `${sha}: está en la lista y hoy sale ${u.v.veredicto}${u.v.motivo ? ` (${u.v.motivo})` : ''}`);
  }

  const enLista = new Set(heredadas);
  const enCurso = pendiente && pendiente.v.veredicto !== 'NO_ES_INTERFAZ' ? [pendiente] : [];
  const todas = [...enCurso, ...deInterfaz];
  const nuevas = todas.filter((u) => u.v.veredicto === 'SIN_DECLARAR' && !enLista.has(u.id));
  const noSe = todas.filter((u) => u.v.veredicto === 'NO_SE');
  return {
    M: todas.length,
    N: todas.length - noSe.length,
    declaran: todas.filter((u) => u.v.veredicto === 'DECLARA').length,
    heredadas: vivas,
    tope,
    nuevas,
    noSe,
    lista,
    deEstaRama: pendiente ? pendiente.v.veredicto : 'SIN_CAMBIOS',
  };
}

/** La línea que sale SIEMPRE, también con cero. Es una función para que un test la pueda fijar. */
export function lineaDeCuenta(j) {
  return `[SCRUM-1340] exigí la skill a ${j.N} de ${j.M} registros de interfaz (PR que cambiaron `
    + `public/ desde el corte) · declaran ${j.declaran} · heredados sin declarar ${j.heredadas} `
    + `(lista cerrada: nació con ${j.tope}, sólo encoge) · sin declarar y fuera de la lista `
    + `${j.nuevas.length} · no sé clasificar ${j.noSe.length} · lo de esta rama: ${j.deEstaRama}`;
}

const nombrar = (u) => (u.id === 'PENDIENTE'
  ? `lo que esta rama cambia (${u.ui.length} fichero(s) de interfaz: ${u.ui.slice(0, 3).join(', ')}${u.ui.length > 3 ? '…' : ''})`
  : `el merge ${u.id}`)
  + (u.v.entradas.length ? ` → ${u.v.entradas.join(' · ')}` : '')
  + (u.v.motivo ? ` — ${u.v.motivo}` : '');

// La medición real se hace UNA vez por proceso: dos llamadas a `git log` y una a `git diff`.
let medida = null;
function medir() {
  if (medida) return medida;
  const u = leerUnidades(RAIZ, CORTE_INSTANTE);
  const entradas = entradasTroceadas();
  const porFichero = agruparPorFichero(entradas);
  const juzgar = (x) => ({ ...x, v: veredictoDeUnidad(x, porFichero, declaraSkillUi) });
  medida = {
    ciego: u.ciego,
    base: u.base,
    entradas,
    historia: u.historia.map(juzgar),
    pendiente: u.pendiente ? juzgar(u.pendiente) : null,
  };
  return medida;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1340 · SUELO — si no puedo leer la cadena, lo DIGO; un cero mío no vale nada sin esto
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1340 · SUELO: la cadena de primer padre se pudo leer, y trae PR de interfaz de verdad', () => {
  const m = medir();
  assert.equal(m.ciego, null,
    `🔴 CIEGO: no puedo medir qué PR tocaron la interfaz — ${m.ciego}. `
    + 'Esto NO es «nadie debe nada»: es «no he podido mirar». En CI el checkout necesita '
    + '`fetch-depth: 0` y la referencia remota de main (el job de la tanda los trae).');
  assert.ok(/^[0-9a-f]{40}$/.test(m.base.sha), '🔴 CIEGO: la base de la rama no es un sha');

  const deInterfaz = m.historia.filter((u) => u.ui.length);
  // El suelo se DERIVA de la lista: si la cadena llegara recortada, las heredadas no cabrían.
  assert.ok(m.historia.length > HEREDADAS.length && deInterfaz.length >= HEREDADAS.length,
    `🔴 CIEGO: he leído ${m.historia.length} unidades tras el corte y ${deInterfaz.length} de interfaz, `
    + `y sólo las heredadas ya son ${HEREDADAS.length}. La cadena no ha llegado entera.`);
  assert.ok(m.historia.some((u) => u.id === TECHO_DE_HEREDADAS),
    `🔴 CIEGO: el techo ${TECHO_DE_HEREDADAS} no está en la cadena leída desde ${m.base.sha}.`);
  // Y los parches llegaron: si la segunda llamada a git volviera vacía, NINGUNA unidad tendría
  // registro y todas saldrían «no sé» — o, peor, el guard no encontraría a quién pedírselo.
  assert.ok(deInterfaz.some((u) => u.registros.size > 0),
    '🔴 CIEGO: ninguna unidad de interfaz trae líneas añadidas a un registro: no he leído los parches');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1340 · AUTOPRUEBA — los dos lectores, sobre la salida de git escrita a mano
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1340 · AUTOPRUEBA: los lectores de `git log` separan unidades, ficheros y líneas añadidas', () => {
  const S = String.fromCharCode(1);
  const nombres = parsearNombres(
    `${S}aaa\t2026-09-28T10:00:00Z\n\npublic/dashboard/js/app.js\ndocs/master/SCRUM-7.md\n`
    + `${S}bbb\t2026-09-27T09:00:00+02:00\n\nsrc/app.ts\r\n`);
  assert.deepEqual(nombres, [
    { id: 'aaa', instante: '2026-09-28T10:00:00Z', ficheros: ['public/dashboard/js/app.js', 'docs/master/SCRUM-7.md'] },
    { id: 'bbb', instante: '2026-09-27T09:00:00+02:00', ficheros: ['src/app.ts'] },
  ]);

  const parche = [
    `${S}aaa`,
    'diff --git a/docs/master/SCRUM-7.md b/docs/master/SCRUM-7.md',
    'index 111..222 100644',
    '--- a/docs/master/SCRUM-7.md',
    '+++ b/docs/master/SCRUM-7.md',
    '@@ -0,0 +1,3 @@',
    '+# SCRUM-7 · un título',
    '+++ una línea que empieza por dos signos más, y es contenido',
    '-una línea quitada',
    'diff --git a/docs/master/README.md b/docs/master/README.md',
    '--- a/docs/master/README.md',
    '+++ b/docs/master/README.md',
    '@@ -1 +1 @@',
    '+esto no es un registro y no se guarda',
    `${S}bbb`,
    '',
  ].join('\n');
  const leido = parsearParches(parche);
  assert.deepEqual([...leido.keys()], ['aaa', 'bbb']);
  assert.deepEqual([...leido.get('aaa').keys()], ['SCRUM-7.md'], '🔴 el README no es un registro');
  assert.deepEqual([...leido.get('aaa').get('SCRUM-7.md')],
    ['# SCRUM-7 · un título', '++ una línea que empieza por dos signos más, y es contenido'],
    '🔴 la cabecera `+++ b/…` se saltó de más (o de menos): dentro de un tramo, `+++…` es contenido');
  assert.equal(leido.get('bbb').size, 0);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1340 · EL ROJO QUE SE VIO — la primera versión REAL del registro de SCRUM-1317
// ─────────────────────────────────────────────────────────────────────────────────────────
// `tests/fixtures/scrum1340/SCRUM-1317-primera-version.md` es `git show 56792052:docs/master/
// SCRUM-1317.md`, byte a byte: sin campo de fecha y con `homeView.js` y `app.js` SIN prefijo.
// Su rama cambiaba cinco ficheros bajo `public/dashboard/js/`. El guard de arriba la dejaba pasar.
const PRIMERA_1317 = fs.readFileSync(
  path.join(RAIZ, 'tests', 'fixtures', 'scrum1340', 'SCRUM-1317-primera-version.md'), 'utf8');
const UI_DE_1317 = ['app.js', 'homeView.js', 'productsView.js', 'quotesView.js', 'templatesView.js']
  .map((f) => `public/dashboard/js/${f}`);
const unidadDe = (texto, ui) => ({
  id: 'PENDIENTE', instante: null, ui,
  registros: new Map([['SCRUM-1317.md', new Set(texto.split('\n'))]]),
});
const juzgarTexto = (texto, ui) => veredictoDeUnidad(
  unidadDe(texto, ui), agruparPorFichero(entradasConClave('SCRUM-1317.md', texto)), declaraSkillUi);

test('SCRUM-1340 · 🔴 EL CASO QUE SE VIO: el registro de 1317 sin fecha y sin prefijo ya no sale exento', () => {
  const entradas = entradasConClave('SCRUM-1317.md', PRIMERA_1317);
  assert.equal(entradas.length, 1, '🔴 el fixture ya no es una entrada: no estoy midiendo el caso');

  // ① LO QUE PASABA, fijado para que nadie crea que la vía del texto ya lo cubría: no lo cubre.
  assert.equal(tocaPublic(PRIMERA_1317), false);
  assert.equal(fechaDeEntrada(PRIMERA_1317), null);
  assert.deepEqual(entradasSinDeclarar(entradas), [],
    'la vía del texto sigue sin verla: si esto cambia, alguien la ha tocado y hay que releer este test');

  // ② LO QUE PASA AHORA: su PR tocó la interfaz, así que se le exige, y no declara.
  const v = juzgarTexto(PRIMERA_1317, UI_DE_1317);
  assert.equal(v.veredicto, 'SIN_DECLARAR', '🔴 el caso que debía caer no cayó');
  assert.equal(v.entradas.length, 1);
  assert.equal(v.como, 'nacidas');

  // ③ CONTROL POSITIVO: el MISMO texto con la declaración pasa. Lo único que cambia es el campo.
  const conCampo = PRIMERA_1317.replace('A9: comprobación', '**Skill UI:** cargada\n\nA9: comprobación');
  assert.equal(conCampo.length, PRIMERA_1317.length + '**Skill UI:** cargada\n\n'.length,
    '🔴 el control no ha cambiado el texto: estaría comparando la entrada consigo misma');
  assert.equal(juzgarTexto(conCampo, UI_DE_1317).veredicto, 'DECLARA');

  // ④ Y EL OTRO CONTROL: si su PR NO hubiera tocado la interfaz, no se le exige nada.
  assert.equal(juzgarTexto(PRIMERA_1317, []).veredicto, 'NO_ES_INTERFAZ');
});

test('SCRUM-1340 · 🔴 lo que no sé clasificar CAE diciéndolo: interfaz sin registro, y registro sin entrada', () => {
  // Tocó la interfaz y no escribió en ningún registro.
  const sinRegistro = veredictoDeUnidad(
    { id: 'PENDIENTE', ui: UI_DE_1317, registros: new Map() }, new Map(), declaraSkillUi);
  assert.equal(sinRegistro.veredicto, 'NO_SE');
  assert.match(sinRegistro.motivo, /no escribió en ningún/);

  // Escribió en un registro, pero ninguna de sus líneas LARGAS está en una entrada de hoy. La
  // línea en blanco y la corta SÍ están en el fixture (se comprueba), y no pueden atribuir nada:
  // se repiten en todos los registros y harían suya cualquier entrada.
  const corta = PRIMERA_1317.split('\n').find((l) => l.length > 0 && l.length < 30 && !l.startsWith('#'));
  assert.ok(corta && PRIMERA_1317.split('\n').includes(''), '🔴 el fixture no trae línea corta o en blanco: el caso no ejercita nada');
  const sinAtribuir = veredictoDeUnidad(
    { id: 'PENDIENTE', ui: UI_DE_1317, registros: new Map([['SCRUM-1317.md', new Set(['', corta, 'una línea que hoy ya no está en ninguna entrada del registro'])]]) },
    agruparPorFichero(entradasConClave('SCRUM-1317.md', PRIMERA_1317)), declaraSkillUi);
  assert.equal(sinAtribuir.veredicto, 'NO_SE');
  assert.match(sinAtribuir.motivo, /ninguna línea suya sigue/);

  // Una segunda vuelta que sólo AÑADE un párrafo a una entrada que ya existía: se le atribuye
  // por las líneas que tocó, y la entrada entera es la que tiene que declarar.
  const larga = PRIMERA_1317.split('\n').find((l) => l.length >= 60 && !l.startsWith('#'));
  assert.ok(larga, '🔴 el fixture no tiene ninguna línea larga: el caso de abajo no ejercita nada');
  const segundaVuelta = veredictoDeUnidad(
    { id: 'PENDIENTE', ui: UI_DE_1317, registros: new Map([['SCRUM-1317.md', new Set([larga])]]) },
    agruparPorFichero(entradasConClave('SCRUM-1317.md', PRIMERA_1317)), declaraSkillUi);
  assert.equal(segundaVuelta.veredicto, 'SIN_DECLARAR');
  assert.equal(segundaVuelta.como, 'tocadas');

  // Y un juicio con un «no sé» lo cuenta fuera de la N: exigí a 0 de 1.
  const j = juicioPorEfecto({ historia: [], pendiente: { id: 'PENDIENTE', ui: UI_DE_1317, v: sinRegistro } }, [], 't', 0);
  assert.equal(j.M, 1);
  assert.equal(j.N, 0);
  assert.equal(j.noSe.length, 1);
});

test('SCRUM-1340 · 🔴 a un PR lo salvan SUS entradas: la declaración de una vieja que sólo rozó no cuenta', () => {
  const viejaQueDeclara = '# SCRUM-7 · una entrada vieja\n\n**Skill UI:** cargada\n\nUn párrafo largo de la entrada vieja, que el PR nuevo corrige de paso.';
  const nuevaQueCalla = '# SCRUM-8 · la entrada que estrena el PR\n\nUn párrafo largo de la entrada nueva, que no declara nada de la skill.';
  const porFichero = agruparPorFichero([
    ...entradasConClave('SCRUM-7.md', viejaQueDeclara), ...entradasConClave('SCRUM-8.md', nuevaQueCalla)]);
  const roce = new Set(['Un párrafo largo de la entrada vieja, que el PR nuevo corrige de paso.']);
  const unidad = (registros) => ({ id: 'PENDIENTE', ui: ['public/x.js'], registros: new Map(registros) });

  // El PR estrena SCRUM-8 (que no declara) y corrige una línea de SCRUM-7 (que sí): NO declara.
  const v = veredictoDeUnidad(
    unidad([['SCRUM-8.md', new Set(nuevaQueCalla.split('\n'))], ['SCRUM-7.md', roce]]), porFichero, declaraSkillUi);
  assert.equal(v.veredicto, 'SIN_DECLARAR', '🔴 la declaración de una entrada ajena ha salvado al PR');
  assert.deepEqual(v.entradas, ['SCRUM-8.md#SCRUM-8 · la entrada que estrena el PR']);

  // CONTROL: si sólo rozó la vieja y no estrenó nada, la vieja SÍ es su entrada, y declara.
  assert.equal(veredictoDeUnidad(unidad([['SCRUM-7.md', roce]]), porFichero, declaraSkillUi).veredicto, 'DECLARA');

  // Y con DOS entradas estrenadas basta con que declare una: el PR es la unidad, no la entrada.
  const dos = veredictoDeUnidad(
    unidad([['SCRUM-8.md', new Set(nuevaQueCalla.split('\n'))], ['SCRUM-7.md', new Set(viejaQueDeclara.split('\n'))]]),
    porFichero, declaraSkillUi);
  assert.equal(dos.veredicto, 'DECLARA');
  assert.equal(dos.entradas.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1340 · LA LISTA SÓLO ENCOGE — probado sobre una cadena fabricada, caso a caso
// ─────────────────────────────────────────────────────────────────────────────────────────
const uni = (id, veredicto) => ({ id, ui: ['public/x.js'], v: { veredicto, entradas: [`SCRUM-1.md#${id}`], motivo: null } });
// De la más nueva a la más vieja, como la da git: `nueva` entró DESPUÉS del techo.
const CADENA = [uni('nueva', 'SIN_DECLARAR'), uni('techo', 'DECLARA'), uni('vieja1', 'SIN_DECLARAR'),
  uni('vieja2', 'SIN_DECLARAR'), { id: 'docs', ui: [], v: { veredicto: 'NO_ES_INTERFAZ', entradas: [], motivo: null } }];

test('SCRUM-1340 · 🔴 la lista de heredadas no admite altas, no pasa de su tope y no encoge en silencio', () => {
  // CONTROL POSITIVO: la lista justa. Sólo acusa a la que entró después y no declara.
  const bien = juicioPorEfecto({ historia: CADENA, pendiente: null }, ['vieja1', 'vieja2'], 'techo', 2);
  assert.deepEqual(bien.lista, []);
  assert.deepEqual(bien.nuevas.map((x) => x.id), ['nueva']);
  assert.deepEqual([bien.M, bien.N, bien.declaran, bien.heredadas], [4, 4, 1, 2]);

  // ① ALTA: meter en la lista a la que entró después del techo NO la salva — rompe la lista.
  const alta = juicioPorEfecto({ historia: CADENA, pendiente: null }, ['vieja1', 'vieja2', 'nueva'], 'techo', 3);
  assert.equal(alta.lista.length, 1);
  assert.match(alta.lista[0], /nueva: es POSTERIOR al techo/);

  // ② TOPE: aunque fueran todas anteriores al techo, no caben más que con las que nació.
  const tope = juicioPorEfecto({ historia: CADENA, pendiente: null }, ['vieja1', 'vieja2'], 'techo', 1);
  assert.match(tope.lista.join('\n'), /tiene 2 entradas y nació con 1/);

  // ③ CADUCA: una de la lista que ya declara hace caer hasta que se quite.
  const paga = CADENA.map((x) => (x.id === 'vieja1' ? uni('vieja1', 'DECLARA') : x));
  const caduca = juicioPorEfecto({ historia: paga, pendiente: null }, ['vieja1', 'vieja2'], 'techo', 2);
  assert.match(caduca.lista.join('\n'), /vieja1: ya declara — quítala de la lista/);
  assert.equal(caduca.heredadas, 1);
  // …y quitándola, verde otra vez: así es como encoge.
  assert.deepEqual(juicioPorEfecto({ historia: paga, pendiente: null }, ['vieja2'], 'techo', 2).lista, []);

  // ④ UN SHA QUE NO VEO, y un techo que no veo: las dos cosas se dicen.
  const fantasma = juicioPorEfecto({ historia: CADENA, pendiente: null }, ['vieja1', 'vieja2', 'no-existe'], 'otro-techo', 3);
  assert.match(fantasma.lista.join('\n'), /el techo otro-techo no está en la cadena/);
  assert.match(fantasma.lista.join('\n'), /no-existe: no es una unidad de la cadena/);

  // ⑤ REPETIDA: dos veces el mismo sha no hace dos heredadas.
  assert.match(juicioPorEfecto({ historia: CADENA, pendiente: null }, ['vieja1', 'vieja1'], 'techo', 2).lista.join('\n'),
    /repite algún sha/);

  // ⑥ LO DE LA RAMA nunca es heredado: si toca interfaz y no declara, es nueva.
  const rama = juicioPorEfecto({ historia: CADENA.slice(1), pendiente: uni('PENDIENTE', 'SIN_DECLARAR') }, ['vieja1', 'vieja2'], 'techo', 2);
  assert.deepEqual(rama.nuevas.map((x) => x.id), ['PENDIENTE']);
  assert.equal(rama.deEstaRama, 'SIN_DECLARAR');
});

test('SCRUM-1340 · la línea de la cuenta sale SIEMPRE, también con cero, y dice N de M', () => {
  // Con CERO de todo: si sólo saliera cuando hay algo, que no esté no distinguiría «todos
  // medidos» de «alguien quitó el guard».
  const cero = lineaDeCuenta(juicioPorEfecto({ historia: [], pendiente: null }, [], 't', 0));
  assert.match(cero, /exigí la skill a 0 de 0 registros de interfaz/);
  assert.match(cero, /heredados sin declarar 0 /);
  assert.match(cero, /no sé clasificar 0 /);
  assert.match(cero, /lo de esta rama: SIN_CAMBIOS$/);

  const algo = lineaDeCuenta(juicioPorEfecto({ historia: CADENA, pendiente: uni('PENDIENTE', 'DECLARA') }, ['vieja1', 'vieja2'], 'techo', 2));
  assert.match(algo, /exigí la skill a 5 de 5 registros de interfaz/);
  assert.match(algo, /declaran 2 · heredados sin declarar 2 \(lista cerrada: nació con 2, sólo encoge\)/);
  assert.match(algo, /sin declarar y fuera de la lista 1 /);
  assert.match(algo, /lo de esta rama: DECLARA$/);

  // Y cuando N y M NO coinciden, cada una va en su sitio: «a 0 de 1» no es «a 1 de 0».
  const sinSaber = { id: 'PENDIENTE', ui: ['public/x.js'], v: { veredicto: 'NO_SE', entradas: [], motivo: 'sin registro' } };
  const cojo = lineaDeCuenta(juicioPorEfecto({ historia: [], pendiente: sinSaber }, [], 't', 0));
  assert.match(cojo, /exigí la skill a 0 de 1 registros de interfaz/);
  assert.match(cojo, /no sé clasificar 1 · lo de esta rama: NO_SE$/);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1340 · DE PUNTA A PUNTA — un repositorio de verdad, con sus merges, su rama y su clon
// ─────────────────────────────────────────────────────────────────────────────────────────
// Lo de arriba prueba el juicio con unidades escritas a mano. Esto prueba lo que las FABRICA:
// que las dos llamadas a git y la lectura del disco devuelven lo que el juicio espera. Una
// operación que no se ejecutó se lee igual que un éxito (A21), y aquí la operación es git.
function repoDePrueba() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1340-'));
  // Sin las `GIT_*` del proceso: dentro de un hook apuntarían al repositorio de verdad.
  const limpio = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const g = (args, fecha) => execFileSync('git', args, {
    cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: fecha ? { ...limpio, GIT_AUTHOR_DATE: fecha, GIT_COMMITTER_DATE: fecha } : limpio,
  });
  const escribir = (rel, texto) => {
    fs.mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true });
    fs.writeFileSync(path.join(raiz, rel), texto);
  };
  const registro = (n, extra = '') => `# SCRUM-${n} · una entrada de prueba\n\nUn párrafo lo bastante largo para que se pueda atribuir a quien lo escribió (${n}).\n${extra}`;
  /** Una rama con `ficheros`, mergeada en `main` con su commit de mezcla. Devuelve el sha del merge. */
  const pr = (nombre, ficheros, fecha) => {
    g(['checkout', '-q', '-b', nombre]);
    for (const [rel, texto] of ficheros) escribir(rel, texto);
    g(['add', '-A']); g(['commit', '-q', '-m', nombre], fecha);
    g(['checkout', '-q', 'main']);
    g(['merge', '-q', '--no-ff', '-m', `Merge ${nombre}`, nombre], fecha);
    return g(['rev-parse', 'HEAD']).trim();
  };
  g(['init', '-q', '-b', 'main']);
  g(['config', 'user.email', 'fixture@yaqu.test']); g(['config', 'user.name', 'Fixture']);
  g(['config', 'commit.gpgsign', 'false']); g(['config', 'core.autocrlf', 'false']);
  return { raiz, g, escribir, registro, pr, limpio };
}
const entradasDe = (raiz) => {
  const dir = path.join(raiz, 'docs', 'master');
  return agruparPorFichero(fs.readdirSync(dir).flatMap((f) => entradasConClave(f, fs.readFileSync(path.join(dir, f), 'utf8'))));
};

test('SCRUM-1340 · DE PUNTA A PUNTA: sobre un repositorio real ve los merges, lo de la rama, y se declara CIEGO en un clon somero', () => {
  const r = repoDePrueba();
  try {
    const ANTES = '2026-09-10T10:00:00Z';
    r.escribir('LEEME.md', 'base\n');
    r.g(['add', '-A']); r.g(['commit', '-q', '-m', 'base'], ANTES);
    const viejo = r.pr('pr-antes-del-corte', [['public/viejo.js', '//\n'], ['docs/master/SCRUM-1.md', r.registro(1)]], ANTES);
    const calla = r.pr('pr-interfaz-sin-declarar', [['public/css/b.css', 'a{}\n'], ['docs/master/SCRUM-2.md', r.registro(2)]]);
    const dice = r.pr('pr-interfaz-declara', [['public/c.html', '<p>\n'], ['docs/master/SCRUM-3.md', r.registro(3, '\n**Skill UI:** cargada\n')]]);
    const ajeno = r.pr('pr-sin-interfaz', [['src/x.ts', 'export {};\n'], ['docs/master/SCRUM-4.md', r.registro(4)]]);
    r.g(['update-ref', 'refs/remotes/origin/main', r.g(['rev-parse', 'HEAD']).trim()]);

    // ① EN MAIN, árbol limpio: tres unidades tras el corte, en orden, y nada pendiente.
    const enMain = leerUnidades(r.raiz, CORTE_INSTANTE);
    assert.equal(enMain.ciego, null);
    assert.deepEqual(enMain.historia.map((x) => x.id), [ajeno, dice, calla],
      '🔴 la cadena no es la esperada: o entró el merge anterior al corte, o falta alguno');
    assert.equal(enMain.historia.some((x) => x.id === viejo), false);
    assert.equal(enMain.pendiente, null);
    const porFichero = entradasDe(r.raiz);
    const ver = (x) => veredictoDeUnidad(x, porFichero, declaraSkillUi).veredicto;
    assert.deepEqual(enMain.historia.map(ver), ['NO_ES_INTERFAZ', 'DECLARA', 'SIN_DECLARAR']);
    assert.deepEqual(enMain.historia[2].ui, ['public/css/b.css']);
    assert.deepEqual([...enMain.historia[2].registros.keys()], ['SCRUM-2.md']);

    // ② EN UNA RAMA: interfaz y registro SIN RASTREAR todavía → se ven, y se le exige.
    r.g(['checkout', '-q', '-b', 'scrum-000-en-curso']);
    r.escribir('public/dashboard/js/nuevo.js', '//\n');
    const soloInterfaz = leerUnidades(r.raiz, CORTE_INSTANTE);
    assert.deepEqual(soloInterfaz.pendiente.ui, ['public/dashboard/js/nuevo.js']);
    assert.equal(veredictoDeUnidad(soloInterfaz.pendiente, entradasDe(r.raiz), declaraSkillUi).veredicto, 'NO_SE',
      '🔴 interfaz tocada sin registro tiene que salir «no sé», no pasar');
    r.escribir('docs/master/SCRUM-5.md', r.registro(5));
    const sinCampo = leerUnidades(r.raiz, CORTE_INSTANTE);
    assert.equal(veredictoDeUnidad(sinCampo.pendiente, entradasDe(r.raiz), declaraSkillUi).veredicto, 'SIN_DECLARAR');

    // ③ La misma rama, ya commiteada y con la declaración AÑADIDA a su registro: declara.
    r.g(['add', '-A']); r.g(['commit', '-q', '-m', 'el trabajo']);
    r.escribir('docs/master/SCRUM-5.md', r.registro(5, '\n**Skill UI:** no cargada · es un fichero de prueba\n'));
    const conCampo = leerUnidades(r.raiz, CORTE_INSTANTE);
    assert.equal(veredictoDeUnidad(conCampo.pendiente, entradasDe(r.raiz), declaraSkillUi).veredicto, 'DECLARA');
    assert.equal(conCampo.historia.length, 3, '🔴 lo de la rama se ha colado en la historia de main');

    // ④ CLON SOMERO: no hay cadena que leer, y lo dice en vez de devolver cero unidades.
    const somero = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1340-somero-'));
    try {
      execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', 'main', pathToFileURL(r.raiz).href, somero],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: r.limpio });
      const ciego = leerUnidades(somero, CORTE_INSTANTE);
      assert.match(String(ciego.ciego), /clon somero/);
      assert.deepEqual([ciego.historia.length, ciego.pendiente], [0, null]);
    } finally {
      fs.rmSync(somero, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(r.raiz, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1340 · EL QUE DECIDE — sobre el repositorio de verdad
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1340 · 🔴 todo PR que cambia public/ declara la skill en su registro, o está en la lista cerrada', () => {
  const m = medir();
  assert.equal(m.ciego, null, `🔴 CIEGO: ${m.ciego} — no he podido medir, y eso no es un verde`);
  const j = juicioPorEfecto(m);
  console.log(`  ${lineaDeCuenta(j)}`);

  assert.deepEqual(j.lista, [],
    `🔴 LA LISTA DE HEREDADAS ESTÁ ROTA (${j.lista.length}):\n\n`
    + j.lista.map((l) => `      ${l}`).join('\n')
    + '\n\n  La lista sólo puede encoger. No se le añade nada: lo que no declara, declara.');

  assert.deepEqual(j.noSe.map(nombrar), [],
    `🔴 ${j.noSe.length} cambio(s) de interfaz que NO SÉ a qué entrada exigirle la skill:\n\n`
    + j.noSe.map((x) => `      ${nombrar(x)}`).join('\n')
    + '\n\n  Un PR que cambia `public/**.{js,css,html}` escribe en su `docs/master/SCRUM-<n>.md`, '
    + 'y ahí declara `**Skill UI:** cargada` o `**Skill UI:** no cargada · <motivo>`. '
    + 'Que no sepa clasificarlo no lo exime: lo hace caer.');

  assert.deepEqual(j.nuevas.map(nombrar), [],
    `🔴 ${j.nuevas.length} cambio(s) de interfaz cuyo registro NO declara \`**Skill UI:**\`:\n\n`
    + j.nuevas.map((x) => `      ${nombrar(x)}`).join('\n')
    + '\n\n  Añade `**Skill UI:** cargada` o `**Skill UI:** no cargada · <motivo>` al encabezado de '
    + 'la entrada. Da igual cómo nombres los ficheros o si pones fecha: lo que cuenta es que tu '
    + 'cambio toca `public/`. yaqu-premium-ui es obligatoria antes de tocar UI (CLAUDE.md).');

  // LOS NÚMEROS CUADRAN: cada registro de interfaz está en una casilla y sólo en una.
  assert.equal(j.declaran + j.heredadas + j.nuevas.length + j.noSe.length, j.M,
    '🔴 la cuenta no cierra: hay registros de interfaz que no están en ninguna casilla');
});

test('SCRUM-1340 · la vía del texto dice cuántas mira y cuántas NO, y por qué', () => {
  const m = medir();
  const nombran = m.entradas.filter((e) => tocaPublic(e.cuerpo));
  const conFecha = nombran.filter((e) => fechaDeEntrada(e.cuerpo));
  const exigidas = conFecha.filter((e) => fechaDeEntrada(e.cuerpo) > CORTE_AAAAMMDD);
  // Las que la vía del efecto ya tiene como de interfaz: a ésas no las exime nadie.
  const porEfecto = new Set([...(m.pendiente ? [m.pendiente] : []), ...m.historia]
    .filter((x) => x.v.veredicto !== 'NO_ES_INTERFAZ').flatMap((x) => x.v.entradas));
  const sinFecha = nombran.filter((e) => !fechaDeEntrada(e.cuerpo));
  console.log(`  [SCRUM-1340] por texto (SCRUM-811): ${nombran.length} entradas nombran una ruta public/ · `
    + `exigí a ${exigidas.length} (fecha escrita posterior al corte) · ${conFecha.length - exigidas.length} con fecha `
    + `en o antes del corte · ${sinFecha.length} sin campo de fecha, de las que ${sinFecha.filter((e) => porEfecto.has(e.clave)).length} `
    + 'se miden por efecto y al resto NO se le exige: su PR no cambió public/, o es anterior al corte');
  // SUELO de esta cuenta: las tres casillas suman el total, y la vía del texto sigue viendo algo.
  assert.equal(exigidas.length + (conFecha.length - exigidas.length) + sinFecha.length, nombran.length);
  assert.ok(exigidas.length > 0, '🔴 la vía del texto ya no exige a nadie: lo que se medía ha dejado de medirse');
});
