// tests/_xsd-verifactu.mjs — validación XSD REAL del XML de VeriFactu (SCRUM-198 / SCRUM-209).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
//
// Hasta hoy la única comprobación automática de conformidad eran asserts de cadena escritos
// a mano. `scripts/validate-registros-xsd.ps1` sí valida de verdad (XmlSchemaSet de .NET),
// pero corre A MANO, sobre una MUESTRA de `tmp/`, y —lo peor— validaba el constructor que
// **no usaba nadie**: el XML que exportaba el producto no pasaba por ahí. Verde permanente
// sobre el fichero equivocado (SCRUM-209).
//
// `xmllint-wasm` (libxml2 compilado a WASM, MIT, 892 KB, cero dependencias) lo mete en
// `npm test`. Se eligió sobre `libxml2-wasm` (API de input provider marcada `@alpha`) y
// sobre `libxmljs2` (nativo, 9,3 MB, un prebuild por plataforma) — decisión del fundador,
// regla 36.
//
// EL IMPORT REMOTO, que es el único truco de todo esto: `SuministroInformacion.xsd` importa
// xmldsig con `schemaLocation="http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd"`.
// Sin red, eso no resuelve. Se reescribe al fichero vendorizado — exactamente lo que hace el
// `.ps1` con `XmlResolver = $null`. NO es una licencia que nos tomemos con el esquema: el
// contenido es el mismo `.xsd` que la AEAT referencia, guardado en el repo.
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateXML } from 'xmllint-wasm';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DIR_XSD = path.join(AQUI, '..', 'src', 'modules', 'fiscal', 'verifactu', 'xsd');

const leer = (f) => fs.readFileSync(path.join(DIR_XSD, f), 'utf8');

const IMPORT_REMOTO = 'schemaLocation="http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd"';

/**
 * Los tres esquemas en juego: `SuministroLR` (raíz del envío) importa `SuministroInformacion`,
 * que a su vez importa `xmldsig-core-schema`. Se cargan los tres desde el repo.
 */
function esquemas() {
  const info = leer('SuministroInformacion.xsd');
  if (!info.includes(IMPORT_REMOTO)) {
    // Guarda de presencia: si la AEAT publica el XSD con otro schemaLocation y este reemplazo
    // deja de aplicar, xmllint intentaría salir a la red y fallaría con un error críptico.
    // Mejor un mensaje que diga exactamente qué mirar.
    throw new Error(
      'El import de xmldsig ya no es el esperado en SuministroInformacion.xsd. Revisa el ' +
        `schemaLocation y actualiza IMPORT_REMOTO en tests/_xsd-verifactu.mjs.`,
    );
  }
  return {
    raiz: leer('SuministroLR.xsd'),
    preload: [
      { fileName: 'SuministroInformacion.xsd', contents: info.replace(IMPORT_REMOTO, 'schemaLocation="xmldsig-core-schema.xsd"') },
      { fileName: 'xmldsig-core-schema.xsd', contents: leer('xmldsig-core-schema.xsd') },
    ],
  };
}

/**
 * Valida un XML de registros contra los XSD oficiales.
 * Devuelve `{ valido: boolean, errores: string[] }` — nunca lanza por un XML inválido:
 * quien llama decide si eso es un rojo o el caso esperado.
 */
export async function validarRegistrosXml(xml, nombre = 'registros.xml') {
  const { raiz, preload } = esquemas();
  const r = await validateXML({
    xml: [{ fileName: nombre, contents: xml }],
    schema: [raiz],
    preload,
  });
  return {
    valido: !!r.valid,
    errores: (r.errors ?? []).map((e) => String(e.rawMessage ?? e.message ?? e).trim()),
  };
}
