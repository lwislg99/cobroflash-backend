// tests/_censo-escrituras-albaran.mjs — SCRUM-462
//
// TODAS las escrituras de `Albaran` del árbol, con el texto de su `data:`, DERIVADAS DEL AST.
//
// No por `grep`: un `where: { estado: 'firmado' }` es una LECTURA y sale igual que una escritura,
// y un comentario que explique una escritura sale igual que la escritura. Medido hoy: de las cinco
// apariciones de `estado: 'firmado'` en `src/`, **tres son `where`** y solo dos son `data`. Un
// censo por texto habría contado cinco.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ VIVE AQUÍ Y NO DENTRO DE UN TEST
//
// Nació en `scrum361-version-al-firmar.test.mjs`, que lo usa para exigir que toda escritura de
// CONTENIDO incremente `version`. SCRUM-462 necesita el mismo censo para otra pregunta —que toda
// escritura que marque FIRMADO traiga su sobre—, y copiarlo habría dejado dos censos del mismo
// hecho que se desincronizan en cuanto uno mejore. Que es, literalmente, la familia de defectos
// que esta casa persigue.
//
// Un solo censo, dos preguntas.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * @param {string} raiz  la raíz del repo
 * @returns {{ escrituras: Array<{fichero:string, linea:number, data:string, indirecto:string}>, ficheros:number }}
 */
export function escriturasDeAlbaran(raiz) {
  return escriturasDeModelo(raiz, { modelo: 'albaran', verbos: ['update', 'updateMany'] });
}

/**
 * 🔴 EL MISMO CENSO, PARA CUALQUIER MODELO — SCRUM-878 (16-sep-2026).
 *
 * `escriturasDeAlbaran` queda ARRIBA, intacta en su firma y en lo que devuelve, porque tres tests
 * dependen de ella (`scrum361`, `scrum462`, `scrum472`). Lo único que ha cambiado es que ahora
 * delega. **No se ha escrito un segundo censo**: es la regla que este mismo fichero dejó escrita
 * en su cabecera —«un solo censo, dos preguntas»— aplicada una vez más, y evita lo que su propio
 * comentario advierte, dos censos del mismo hecho que se desincronizan en cuanto uno mejore.
 *
 * Lo que sube con la generalización son las dos lecciones caras que ya llevaba dentro: que un
 * `data:` con `...spread` hay que seguirlo hasta las asignaciones de la función, y que un `where`
 * no es una escritura. Quien censa otro modelo las hereda sin volver a pagarlas.
 *
 * @param {string} raiz
 * @param {{modelo:string, verbos?:string[]}} opciones  `verbos` por defecto: update + updateMany.
 */
export function escriturasDeModelo(raiz, { modelo, verbos = ['update', 'updateMany'] }) {
  const out = [];
  let ficheros = 0;
  const reVerbo = new RegExp(`^(${verbos.join('|')})$`);
  const reModelo = new RegExp(`${modelo}$`, 'i');
  const reAtajo = new RegExp(`${modelo}\\.(${verbos.join('|')})`, 'i');

  const visitarDir = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { visitarDir(p); continue; }
      if (!e.name.endsWith('.ts')) continue;
      ficheros += 1;
      const src = fs.readFileSync(p, 'utf8');
      if (!reAtajo.test(src)) continue;
      const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
      // ⚠️ ACTUALIZACIONES, no creaciones — y es una decisión medida, no un olvido. Al extraer este
      // censo se amplió a `create`/`upsert` «por completitud», y eso CAMBIÓ el significado del
      // guard que ya lo usaba: una creación pone `lineas` y `notas` y no incrementa `version`
      // porque nace en 1, así que SCRUM-361 empezó a acusarla. Ampliar el alcance de un censo
      // ajeno no es gratis.
      //
      // Las creaciones se miraron aparte: hay DOS (`albaranes.routes.ts` y `jobs.routes.ts`) y
      // NINGUNA marca `estado: 'firmado'` — un albarán nace en borrador. Hay test propio en
      // SCRUM-462 que lo mantiene cierto, porque de eso depende que este censo baste.
      const visitar = (n) => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
            reVerbo.test(n.expression.name.text) &&
            reModelo.test(n.expression.expression.getText(sf))) {
          const arg = n.arguments[0];
          let data = '';
          if (arg && ts.isObjectLiteralExpression(arg)) {
            for (const pr of arg.properties) {
              if (ts.isPropertyAssignment(pr) && pr.name.getText(sf) === 'data') {
                data = pr.initializer.getText(sf).replace(/\s+/g, ' ');
              }
            }
          }
          // 🔴 EL `data:` NO SIEMPRE ES UN LITERAL COMPLETO, y esto costó un rojo falso en
          // SCRUM-361: el PATCH escribe `data: { ...data, version: { increment: 1 } }` y va
          // rellenando `data.lineas`, `data.notas`… más arriba. Mirando solo el literal, la ÚNICA
          // escritura que toca contenido salía clasificada como metadatos — o sea, el guard habría
          // vigilado todo menos lo que importa.
          //
          // Así que si el `data:` trae un `...ident`, se recogen también las asignaciones
          // `ident.<campo> =` de la función que contiene la escritura.
          // 🔴 Y `data: updateData` A SECAS ES LA MISMA FORMA, con otra cara — SCRUM-878.
          // El `data:` no siempre es un literal ni un literal con spread: también puede ser un
          // identificador pelado que se rellena arriba (`const updateData: any = {}` y luego
          // `updateData.reminder7SentAt = …`). Mirando solo el texto, eso sale como el campo
          // «updateData», que no existe, y la escritura acaba en NO CLASIFICADO — del lado malo,
          // que es lo correcto pero es peor que resolverla. Se sigue igual que el spread.
          const spread = [...data.matchAll(/\.\.\.(\w+)/g)].map((m) => m[1]);
          if (/^\w+$/.test(data.trim())) spread.push(data.trim());
          let indirecto = '';
          if (spread.length) {
            let fn = n;
            while (fn && !ts.isFunctionDeclaration(fn) && !ts.isFunctionExpression(fn) && !ts.isArrowFunction(fn)) {
              fn = fn.parent;
            }
            const cuerpo = fn ? fn.getText(sf) : src;
            for (const id of spread) {
              for (const m of cuerpo.matchAll(new RegExp(`\\b${id}\\.(\\w+)\\s*=`, 'g'))) indirecto += ` ${m[1]}`;
            }
          }
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          out.push({ fichero: path.relative(raiz, p).replace(/\\/g, '/'), linea: line + 1, data, indirecto });
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
    }
  };
  visitarDir(path.join(raiz, 'src'));
  return { escrituras: out, ficheros };
}

/**
 * ¿La llamada a `nombre(...)` de este fichero va envuelta en un `.catch(...)`?
 *
 * 🔴 POR AST Y NO POR REGEX, y esto costó un rojo falso. La primera versión era
 * `/nombre\s*\([\s\S]*?\)\s*\.catch\s*\(/`, y el `[\s\S]*?` **salta por encima del cierre real del
 * paréntesis**: en la ruta de firma casó con el `.catch` de la llamada SIGUIENTE
 * —`ensureAlbaranPdf(...).catch(...)`, que ahí es correcta— y acusó a un código que estaba bien.
 *
 * Un guard con falsos positivos se desactiva al primer roce. La estructura la sabe el AST: se
 * busca un acceso `.catch` cuyo objeto sea EXACTAMENTE la llamada que nos importa.
 */
export function llamadaVaConCatch(raiz, fichero, nombre) {
  const src = fs.readFileSync(path.join(raiz, fichero), 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  let hay = false;
  const visitar = (n) => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'catch' &&
        ts.isCallExpression(n.expression) &&
        n.expression.expression.getText(sf) === nombre) {
      hay = true;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return hay;
}

/**
 * La FUNCIÓN que contiene una escritura, en texto. Sirve para preguntar qué más hace alrededor —
 * por ejemplo, si construye el sobre de evidencias antes de marcar `firmado`.
 */
export function funcionQueContiene(raiz, fichero, linea) {
  const src = fs.readFileSync(path.join(raiz, fichero), 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  let encontrada = null;
  const visitar = (n) => {
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    if (line + 1 === linea && ts.isCallExpression(n)) {
      let fn = n;
      while (fn && !ts.isFunctionDeclaration(fn) && !ts.isFunctionExpression(fn) && !ts.isArrowFunction(fn)) {
        fn = fn.parent;
      }
      if (fn && !encontrada) encontrada = fn.getText(sf);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return encontrada ?? '';
}
