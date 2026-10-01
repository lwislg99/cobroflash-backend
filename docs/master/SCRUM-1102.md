# SCRUM-1102 · REDEME, SII y las exclusiones del RRSIF: la medición, contra el BOE

**Medido contra:** `origin/main` = `bf4d82c68cc74c390af36f92c90cdb915e8c31e8` · 2026-09-25T18:12:23Z

Sesión J1 (`jv-j1`), 25-sep-2026. Este documento **solo mide: no construye nada**. No hay rama de
código, no se toca el máster y no se ha cambiado el alcance del ticket. J1 paró porque el alcance
medido no es el del enunciado. Las decisiones (a) y (b) de §⑤ están en manos del fundador, y la (c)
ya es SCRUM-1129.

## ⓪ Las fuentes, y cómo se leyeron

Textos consolidados del BOE, descargados el 25-sep-2026 y leídos **literalmente**. Se extrajo el
texto del HTML y se buscó cada artículo por su encabezado exacto, no por un resumen. Las citas de
abajo son copia literal.

| norma | BOE | consolidación | sha256 del HTML (16) |
|---|---|---|---|
| Reglamento del IVA (RIVA), RD 1624/1992 | `BOE-A-1992-28925` | «Última actualización publicada el 28/02/2026» | `5761105b8dc2354b` |
| Reglamento de los SIF (RRSIF), RD 1007/2023 | `BOE-A-2023-24840` | «Última actualización publicada el 03/12/2025» | `fb9c94138436c048` |

Trampa del instrumento, anotada: la primera búsqueda de «Artículo 30» cogió el **30 ter**, y la de
«Artículo 62» el **62 ter**. Se corrigió exigiendo `Artículo N.` seguido de mayúscula. Después hubo
exactamente una coincidencia para cada uno.

## ① Las citas del asesor quedan VERIFICADAS

El asesor (23-sep-2026, pregunta 5 de Q-C8) citó de memoria (⚠) los arts. 30 y 62.6 del RIVA.
**Los dos son correctos**, y la cadena que describe se cierra con la norma en la mano:

1. **RIVA art. 30.1**: el REDEME.
   > «Para poder ejercitar el derecho a la devolución establecido en los artículos 116 y 163 nonies
   > de la Ley del Impuesto, los sujetos pasivos deberán estar inscritos en el registro de
   > devolución mensual regulado en este artículo.»

   **Art. 30.4**: la solicitud se presenta en noviembre.
   > «Las solicitudes de inscripción en el registro se presentarán en el mes de noviembre del año
   > anterior a aquél en que deban surtir efectos.»

2. **RIVA art. 71.3, 3.º**: los inscritos liquidan por mes natural.
   > «3.º Los comprendidos en el artículo 30 de este reglamento autorizados a solicitar la
   > devolución del saldo existente a su favor al término de cada período de liquidación.»

3. **RIVA art. 62.6, párrafo 1**: quien liquida por mes natural lleva los libros por el SII.
   > «…deberán llevarse a través de la Sede electrónica de la Agencia Estatal de Administración
   > Tributaria, mediante el suministro electrónico de los registros de facturación, por los
   > empresarios o profesionales y otros sujetos pasivos del Impuesto, que tengan un periodo de
   > liquidación que coincida con el mes natural de acuerdo con lo dispuesto en el artículo 71.3
   > del presente Reglamento.»

4. **RRSIF art. 3.3**: a esos no se les aplica el RRSIF.
   > «El presente Reglamento no se aplicará a los contribuyentes que lleven los libros registros en
   > los términos establecidos en el apartado 6 del artículo 62 del Reglamento del Impuesto sobre el
   > Valor Añadido…»

**Conclusión del asesor, confirmada:** un profesional en REDEME queda fuera del RRSIF y, por tanto,
fuera de lo que YaQu hace con VeriFactu.

## ② 🔴 Hallazgo 1 · la exclusión es «lleva el SII», no «está en REDEME»

El art. 3.3 no excluye a los del REDEME: excluye a **todo el que lleve los libros «en los términos
del art. 62.6»**. El REDEME es **una puerta de varias**:

- **La opción voluntaria**, en el párrafo 2 del mismo 62.6:
  > «Además, aquellos empresarios o profesionales y otros sujetos pasivos del Impuesto no
  > mencionados en el párrafo anterior, podrán optar por llevar los libros registro […] a través de
  > la Sede electrónica de la Agencia Estatal de Administración Tributaria en los términos
  > establecidos en el artículo 68 bis de este Reglamento.»
- **Las otras entradas a la liquidación mensual** del art. 71.3, que llevan al SII obligatorio
  igual que el REDEME:
  - 1.º, volumen de operaciones el año anterior de más de 6.010.121,04 €;
  - 2.º, adquisición de un patrimonio empresarial que lleve a superar esa cifra;
  - 4.º, régimen especial del grupo de entidades;
  - 5.º, titulares de depósitos fiscales de hidrocarburos.

**Una pregunta por el REDEME dejaría fuera a los demás**: es el mismo fallo, en el otro sentido.
**La pregunta que detecta la exclusión es «¿llevas el SII?»**. El texto exacto, si se decide
hacerla, lo firma el fundador (regla 39).

Dato relacionado, también literal (RIVA art. 30.3 d): no puede inscribirse en el REDEME quien
«realice actividades que tributen en el régimen simplificado».

## ③ 🔴 Hallazgo 2 · la línea 1858 del máster es FALSA en dos de sus cuatro puntos

`docs/YAQU_MASTER.md:1858` dice:

> `| Exclusiones: módulos, recargo equivalencia, forales, SII | ✅ | RD 1007/2023 |`

Contrastada con el RD 1007/2023 que ella misma cita:

| exclusión que afirma | qué dice el RD | ¿cierta? |
|---|---|---|
| **SII** | art. 3.3, citado arriba | ✅ sí |
| **forales** | art. 1: «En relación con los territorios históricos del País Vasco y en la Comunidad Foral de Navarra, el presente Reglamento será de aplicación a los obligados tributarios a que se refiere el artículo 3 de este Reglamento cuando tengan su domicilio fiscal en territorio común.» | ⚠️ cierta **según el DOMICILIO FISCAL**, no según el territorio donde se trabaja |
| **módulos** (régimen simplificado) | art. 10, abajo | 🔴 **NO**: están dentro |
| **recargo de equivalencia** | art. 10, abajo | 🔴 **NO**: están dentro |

**Por qué el art. 10 lo demuestra.** Es el artículo del contenido del registro de facturación de
alta, y dice:

> «Se informará además si la operación documentada ha sido realizada por un contribuyente al que le
> sea de aplicación el régimen simplificado o el régimen de recargo de equivalencia del Impuesto
> sobre el Valor Añadido.»

**No se informa del régimen de quien está excluido.** Si la norma obliga a que el registro diga que
el emisor está en simplificado o en recargo, es que ese emisor **genera registros**: está dentro del
RRSIF. Este razonamiento vale más que la cita suelta. Una exclusión no puede convivir con la
obligación de informar de ella en un registro que el excluido no tendría que hacer.

🔴 **El daño que se evita.** El punto 2 del ticket pedía «censar qué pasa hoy con las otras tres
exclusiones ya declaradas (módulos, recargo de equivalencia, forales)» para detectarlas en el alta.
**Censar las cuatro exclusiones para detectarlas en el alta habría hecho que DOS de ellas echaran a
clientes que la norma obliga a atender.** Los profesionales en módulos y en recargo son, además,
buena parte de los oficios.

**Por qué una línea con ✅ es peor que una sin marcar:** el ✅ la da por verificada, y **nadie
vuelve a comprobar lo que ya figura como comprobado**. No estaba registrada como falsa en ningún
sitio: `git grep` de «Exclusiones: m…» en `docs/` y `.claude/` solo devuelve esta línea y su copia en
`docs/historico/`, y no aparece en el inventario de SCRUM-528.

Corregirla es **cambio de máster** (regla 35), y lo firma el fundador. Aquí no se toca.

## ④ El estado del código hoy (solo lectura)

- `REDEME`, `SII` y «suministro inmediato»: **0 apariciones** en `src/`, `public/` y `prisma/`.
- `model Merchant` **no tiene ningún campo de régimen fiscal**: solo `taxId`, `country` y `timezone`.
  Guardar cualquier respuesta del alta exige una columna nueva (ALTER, A5).
- El `recargoEquivalencia` que existe (`Customer`, SCRUM-294) es **el del CLIENTE** destinatario,
  no el del profesional. No sirve para esto, y no debe confundirse.
- «foral», «Navarra» y «País Vasco»: 0 en código. El territorio y el régimen del impuesto (IGIC,
  IPSI) son SCRUM-646. `zonaDelMerchant.ts` resuelve el huso horario y avisa expresamente de que
  **no** resuelve el impuesto.
- **Hallazgo 3, ya es SCRUM-1129:** `registro.builder.ts:55` fija `CLAVE_REGIMEN_GENERAL = '01'`, y
  las líneas 313 y 328 lo aplican a todos los registros. Con el art. 10 en la mano, un emisor en
  simplificado o en recargo necesitaría informarlo. **Qué código de `ClaveRegimen` corresponde a
  cada régimen NO SE HA VERIFICADO:** el XSD `SuministroInformacion.xsd` enumera `01…20` sin su
  significado, y dar el significado de memoria sería una cita no verificada. Arreglarlo es camino de
  emisión (regla 40, STOP). Hoy no afecta, porque `INVOICING_ES_ENABLED` y `SIF_ENABLED` están en OFF.

## ⑤ Lo que queda por decidir (no lo decide J1)

- **(a) Corregir la línea 1858 del máster.** Firma del fundador. Redacción propuesta, a efectos de
  revisión: «Exclusión: quien lleve los libros por SII (RIVA 62.6: REDEME, más de 6 M€, grupos,
  depósitos fiscales o por opción del 68 bis) y quien tenga el domicilio fiscal en territorio
  foral. Módulos y recargo de equivalencia NO excluyen: se informan en el registro (RRSIF art. 10)».
- **(b) El alcance de SCRUM-1102** pasaría de «detectar REDEME» a «detectar el SII y el domicilio
  foral». Arrastra una columna nueva en `merchants` (ALTER, A5) y una pregunta de cara al usuario
  (regla 39). Recordatorio del enunciado: **se pregunta, no se asesora** (regla 7).
- **(c) `ClaveRegimen`:** SCRUM-1129, abierto por el orquestador.

## ⑥ Lo relacionado que no se toca aquí

El asesor añadió en la misma respuesta que **el SII elimina el 347 y VeriFactu NO**. Afecta a
SCRUM-1067. **No se ha verificado en esta medición**: queda como dicho por el asesor, pendiente de
cotejar.

---

# SCRUM-1102e · La segunda sonda: las mismas citas, por la API de legislación consolidada

**Medido contra:** `origin/main` = `548d5148954b04559f43949f898cbff71a8010ee` · 2026-10-01T02:33:01Z

A9: sin fallo que generalice — solo docs; la premisa caducada del encargo la cazó el PASO 0 antes de escribir nada, y su lección ya es la frase de A10 de SCRUM-1154.

Sesión J4b (`jv-j4b`), 1-oct-2026. **Solo docs: ni `src/`, ni esquema, ni textos de pantalla.** El
ticket es `area-j1` y J4b es de otro carril: el cruce lo autorizó el orquestador del equipo de
Javier (`cobroflash-backend-5b`) para este anexo, y nada más.

## ⓪ Por qué existe este anexo

El encargo llegó el 1-oct con la premisa del enunciado del 23-sep: «`git grep REDEME` → cero» y
«verificar la cita es lo primero». **Las dos cosas estaban hechas desde el 25-sep** (secciones de
arriba, PRs #1790, #1792 y #1797), y Jira no lo reflejaba. Medido hoy: `REDEME` aparece en **7**
ficheros del repositorio, todos de `docs/`.

Lo que sí aporta esta vuelta son tres cosas: una **segunda verificación por un instrumento
distinto** (§①), un dato de la norma que cambia el diseño (§②) y una afirmación del máster que es
una inferencia y está marcada ✅ (§③).

## ① La segunda sonda

J1 leyó el **HTML** del texto consolidado. Aquí se lee la **API de datos abiertos**, que entrega cada
artículo como un `<bloque>` con todas sus `<version>` y la fecha de vigencia de cada una:

    https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/<BOE-A-…>/texto   (Accept: application/xml)

De cada bloque se toma la última versión con `fecha_vigencia` ≤ 2026-10-01. Ningún bloque de los
leídos tiene versiones futuras.

| norma | BOE | bytes | bloques | sha256 del XML |
|---|---|---|---|---|
| RIVA, RD 1624/1992 | `BOE-A-1992-28925` | 1.933.214 | 187 | `a558146bdd95724641edde646cd638840fedcfd2ffb8fa50ecbe85407f024a23` |
| RRSIF, RD 1007/2023 | `BOE-A-2023-24840` | 88.577 | 36 | `20d704afa2d24e91cf97e8ec83c41038f1eef964a1ba724ff6f0958425a8ca38` |

Descargados el 2026-10-01 hacia las 02:28Z. Los XML **no se suben** (2 MB de texto ajeno): se
regeneran con la URL de arriba. ⚠️ El sha256 es el de ese día: si el BOE consolida un cambio en
cualquier artículo, cambia, y eso no invalida la medición — obliga a repetirla.

**Control del instrumento** (¿es el texto vigente, o el original de 1992?):

- RIVA **art. 71**: 14 versiones; la vigente es la de `BOE-A-2024-26694`, **desde el 22-dic-2024**, y
  trae el ordinal 5.º del apartado 3 que añadió la Ley 7/2024. Un artículo modificado hace poco sale
  en su redacción nueva.
- RIVA **art. 68 bis**: existe (2 versiones, la primera de `BOE-A-2016-11575`). En el texto de 1992
  no existía.
- RIVA **art. 62**: 7 versiones; el apartado 6 lo añadió el RD 596/2016.

**Resultado: los literales coinciden con los de §① de J1, palabra por palabra.**

| artículo | qué dice | versión vigente | desde |
|---|---|---|---|
| RIVA 30.1 y 30.4 | registro de devolución mensual; solicitud en noviembre | `BOE-A-2016-11575` | 2017-07-01 |
| RIVA 71.3, 3.º | los del art. 30 liquidan por mes natural | `BOE-A-2024-26694` | 2024-12-22 |
| RIVA 62.6, párr. 1 y 2 | mes natural → libros por la Sede; y la opción voluntaria | `BOE-A-2021-10026` | 2021-07-01 |
| RIVA 68 bis | cómo se ejerce y se renuncia a esa opción | `BOE-A-2018-17995` | 2019-01-01 |
| RRSIF 1.3 | territorios forales, por domicilio fiscal | `BOE-A-2023-24840` | 2023-12-07 |
| RRSIF 3.3 | no se aplica a quien lleve los libros según el 62.6 | `BOE-A-2023-24840` | 2023-12-07 |
| RRSIF 10.1 m) | se informa del simplificado y del recargo | `BOE-A-2023-24840` | 2023-12-07 |

Las dos citas que el asesor marcó ⚠ (arts. 30 y 62.6 del RIVA) quedan verificadas por dos vías
independientes.

## ② 🔴 De la norma: la respuesta CADUCA

RIVA art. 68 bis, párrafos 1 y 5, literal:

> «La opción a que se refiere el artículo 62.6 de este Reglamento, podrá ejercitarse a lo largo de
> todo el ejercicio, mediante la presentación de la correspondiente declaración censal, surtiendo
> efecto para el primer periodo de liquidación que se inicie después de que se hubiera ejercicio
> dicha opción.»

> «Los sujetos pasivos inscritos en el registro de devolución mensual que queden excluidos del mismo
> por aplicación de lo dispuesto en el artículo 30.6 de este Reglamento quedarán asimismo excluidos
> de la obligación de llevar los libros registro a través de la Sede electrónica…»

(«ejercicio» por «ejercido» es errata del propio BOE; se copia tal cual.)

Un profesional puede **entrar** en el SII a mitad de año y puede **salir** de él. Preguntarlo una
sola vez en el alta —que es lo que pedía el enunciado: «conviene detectarla en el alta»— deja un
dato que envejece. **El dato tiene que poder cambiarse después.**

## ③ 🔴 La exclusión foral del máster es una INFERENCIA, y está marcada ✅

`docs/YAQU_MASTER.md:1858` dice hoy que queda excluido «quien tenga el domicilio fiscal en
territorio foral», con «✅ verificado contra fuente primaria». El literal del RRSIF art. 1.3 es:

> «En relación con los territorios históricos del País Vasco y en la Comunidad Foral de Navarra, el
> presente Reglamento será de aplicación a los obligados tributarios a que se refiere el artículo 3
> de este Reglamento cuando tengan su domicilio fiscal en territorio común.»

Eso dice a quién se aplica el Reglamento **en relación con los territorios forales**. Que un
domiciliado foral que trabaja en territorio común quede fuera es la lectura *a contrario*: **no es
el literal**, y depende del Concierto y del Convenio, que aquí **no se han leído**.

**No se toca el máster.** Va a la lista del asesor (SCRUM-1264). Hasta que conteste, esa mitad de
la línea 1858 es «inferida», no «verificada».

## ④ El censo, re-medido, y el mecanismo que ya existe

Población: **455** ficheros seguidos por git en `src/`, `public/` y `prisma/` (control positivo:
`merchantId` aparece en 153).

| se busca | ficheros |
|---|---|
| `REDEME` · `SII` · «suministro inmediato» | 0 |
| «foral» · «Navarra» · «País Vasco» | 0 |
| «módulos» · «estimación objetiva» | 0 |
| las dos columnas del SQL de 1102, en cualquiera de sus dos grafías | 0 |
| «recargo» | 11 — el del CLIENTE (`Customer`), no el del profesional |
| «simplificado» | 2 — un aviso de gastos que SCRUM-324 dejó apagado |

Las dos columnas de `docs/sql/scrum-1102-sii-y-domicilio-foral.sql` **no están en
`prisma/schema.prisma`** y nada las lee ni las escribe. Ese SQL dice que se aplicó en staging y en
producción el 25-sep; `docs/MIGRATIONS_PENDING.md` confirma en dev la del domicilio foral y declara
la del SII «no medida». **Aquí no se ha medido ninguna base.**

**El mecanismo que se reusa** (no hace falta un segundo): Configuración ya tiene selectores de
estado fiscal de **tres estados** sobre columnas del `Merchant` —el de `name="criterioCaja"`
(`Boolean?`) y el de `name="retencionIrpfTipo"`, en `public/dashboard/js/settingsView.js`—. Es el
mismo contrato que pide el SQL de 1102 (`NULL` no es `false`), comparten la terna que empieza por
«No consta», se colocan con `colocar(…)` —que es lo que lee el censo de Configuración de SCRUM-284—
y se validan en `src/core/validation/schemas.ts`.

## ⑤ Lo que queda bloqueado, y de quién es

Los tres han subido al fundador por el orquestador; ninguno lo decide una sesión.

1. **Esquema** (regla 40): faltan las dos columnas en `prisma/schema.prisma`, y confirmar dev.
2. **Los dos textos de pantalla** (regla 39). Se propusieron al orquestador y **no se registran
   aquí**: un texto sin firma no se escribe en el repositorio.
3. **Qué hace YaQu con la respuesta.** Guardar un «sí» que nadie lee repite «declarada no es
   existente» un escalón más abajo. 🔴 **Sugerencia de IA, no de la norma ni del asesor:** que
   encender `INVOICING_ES_ENABLED` para un comercio exija las dos respuestas en «no», sin que `NULL`
   valga. Eso es una puerta en el camino de emisión: STOP y ticket aparte.

Sigue **sin verificar** lo de §⑥ de arriba (el SII y el 347).

## ⑥ El instrumento

El extractor, entero, porque el original vivía en un directorio temporal. Lee el XML de la API,
declara su población y, de cada bloque pedido, lista todas las versiones y escribe la vigente.

```js
import fs from 'node:fs';
const HOY = '20261001';
const [, , fichero, ...ids] = process.argv;
const xml = fs.readFileSync(fichero, 'utf8');
const bloques = [...xml.matchAll(/<bloque id="([^"]+)" tipo="([^"]+)"(?: titulo="([^"]*)")?[^>]*>([\s\S]*?)<\/bloque>/g)];
console.log(`POBLACION fichero=${fichero} bytes=${xml.length} bloques=${bloques.length}`);
const limpia = (s) => s
  .replace(/<a [^>]*>[\s\S]*?<\/a>/g, '')
  .replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
for (const id of ids) {
  const b = bloques.find((x) => x[1] === id);
  if (!b) { console.log(`##### ${id}: NO EXISTE EL BLOQUE`); continue; }
  const versiones = [...b[4].matchAll(/<version id_norma="([^"]+)" fecha_publicacion="(\d+)"(?: fecha_vigencia="(\d*)")?[^>]*>([\s\S]*?)<\/version>/g)];
  console.log(`##### ${id} · ${b[3] ?? ''} · versiones=${versiones.length}`);
  for (const v of versiones) console.log(`   - ${v[1]} publicada ${v[2]} vigente desde ${v[3] || '(sin fecha)'}`);
  const vigentes = versiones.filter((v) => (v[3] || v[2]) <= HOY);
  const v = vigentes.at(-1);
  console.log(`   VIGENTE HOY: ${v[1]} desde ${v[3] || v[2]} · futuras=${versiones.length - vigentes.length}`);
  console.log(limpia(v[4]));
}
```

Bloques leídos: en el RIVA, `a30`, `a62`, `a68bis`, `a71`; en el RRSIF, `a1`, `a3` y `a1-2`.
⚠️ **El identificador de bloque no es el número del artículo:** en el RRSIF el art. 10 es `a1-2` y
el 11 es `a1-3`. Se busca por el atributo `titulo`, no se deduce.

---

# SCRUM-1102f · Configuración pregunta por el SII y el domicilio foral, y lo guarda

**Medido contra:** `origin/main` = `ba712b6d2d1938d2eb5bb4d27a970468a3041377` · 2026-10-01T03:10:58Z

A9: comprobación → `tests/scrum1102f-sii-y-foral-se-preguntan-y-se-guardan.test.mjs`

Sesión J2d (`jv-j2`), 1-oct-2026. Es el paso ③ de A5: esquema + código + tests en un PR.

**Cruce de carril, autorizado por el orquestador del equipo de Javier (`cobroflash-backend-5b`) el
1-oct-2026, por mensaje:** el ticket es `area-j1` y toca `settingsView.js` (pestaña fiscal, J1) y
`merchantAdmin.ts` (J3). Se asigna a J2 porque J1 y J4 pidieron relevo con el ticket a medias y
éste era el árbol libre cuando el fundador desbloqueó el esquema y firmó los textos. No hay
criterio de especialidad detrás, y lo dijo así.

## ⓪ De dónde sale cada permiso

Ninguno se lo oí yo al fundador: los tres están en Jira, transcritos por el orquestador, y ahí los
leí antes de escribir.

| qué | comentario de SCRUM-1102 | literal del fundador |
|---|---|---|
| las dos líneas en `prisma/schema.prisma`, sin ALTER | 17709 | «1-Ok go, y dev lo revisas tú» |
| los dos enunciados | 17709 | «2-Sí firmo» |
| las opciones «No consta / Sí / No» | 17721 | «1-Ok las firmo» |
| que las columnas existen en producción, anulables y sin valor por defecto | 17714 | medición suya, no firma |

## ① Qué entra

- `prisma/schema.prisma`: `llevaLibrosPorSii` y `domicilioFiscalForal`, `Boolean?`, sin `@default`,
  sobre las columnas que creó `docs/sql/scrum-1102-sii-y-domicilio-foral.sql`. **Ningún ALTER y
  ningún `db push`:** el fichero se pone al día con un DDL ya aplicado.
- `src/core/validation/schemas.ts`: las dos claves en el esquema del PUT, `boolean` anulable y
  opcional. Sin ellas `z.object` las descarta en silencio (el fallo de SCRUM-1269).
- `src/modules/system/merchantAdmin.ts`: las dos en el `select` del GET. Sin ellas el siguiente
  guardado de cualquier ajuste las devolvería a NULL (el fallo de SCRUM-1227).
- `public/dashboard/js/settingsView.js` y `settingsSubmenus.js`: dos selectores de tres estados en
  la pestaña Empresa, debajo de «Criterio de caja», con el mismo mecanismo que ya existía.
- `docs/microcopy/`: una ficha para los dos enunciados y otra para las opciones.
- `docs/sql/deriva-prod.sql`: regenerado con su script (509 → 511 columnas).
- `docs/legal/AUDITORIA_CAMINO_EMISION.md:36`: el ancla de `vf_hash` pasa de `910-911` a `917-918`.
  Las siete líneas nuevas del modelo `Merchant` la movieron; la afirmación no cambia.

## ② Qué NO entra

- **Ninguna puerta lee estas columnas.** Encender `INVOICING_ES_ENABLED` no las mira. Eso es
  camino de emisión: ticket aparte y STOP aparte (comentario 17709, §③). Hoy la respuesta se
  guarda y nadie actúa sobre ella.
- **El alta no las pregunta.** Van sólo en Configuración.
- **Ningún texto de ayuda.** La caja de cada selector es la pregunta y sus opciones (regla 7).

## ③ Dos cosas que el encargo daba por hechas y no lo estaban

**Los rótulos de las opciones no estaban firmados.** El comentario 17709 decía «la terna que ya
existe: No consta / Sí / No». La terna que existe en `settingsView.js` es «No consta / Sí, estoy
acogido / No estoy acogido», y la del recargo, «Sí, está en recargo / No está en recargo». «Sí» y
«No» a secas no constaban como literal aprobado en `docs/microcopy/` ni en el registro congelado.
Se avisó antes de escribir código; lo corrige el comentario 17717 y lo firma el 17721.

**La ficha de encargo no declaraba el cruce de carril.** Se preguntó antes de empezar (A20) y el
orquestador lo confirmó con su motivo, que es el párrafo de arriba.

## ④ Cómo se midió

**Rojo primero.** Con el `dist/` de `f5d99bd7` y el test ya escrito, los tres casos del viaje por
el servidor caen: «mando null y en la base queda true», «guardar una ha movido la otra» y «acepta
"si"». Las dos claves no sobrevivían al esquema del PUT.

**El test del ticket**, `tests/scrum1102f-sii-y-foral-se-preguntan-y-se-guardan.test.mjs`: 9
casos. Esquema contra el DDL; los tres estados de cada columna por el PUT y de vuelta por el GET;
la pantalla montada en el banco de vistas (pinta lo guardado, y al guardar lo devuelve igual); los
enunciados y las opciones contra su ficha, por ticket y ranura.

**Mutaciones**, `tests/banco-scrum1102f/mutar.mjs`: 14 de 14 caen, cada una en el caso que se
esperaba. Base verde antes de mutar, build entre mutaciones de `src/`, árbol limpio al acabar.

**Navegador**, `tests/banco-scrum1102f/navegador.mjs`, a 390 y a 1280 px: los dos selectores se
ven en la pestaña Empresa al abrir, miden 44,5 px, la pregunta cabe y la página no desborda. Con
«Sí» y «No» guardados se pintan «Sí» y «No»; tras elegir «No consta» y «Sí» y pulsar «Guardar
cambios» se manda `null` y `true`, y el criterio de caja no se mueve. Control positivo: el selector
del criterio de caja, que ya existía, se ve con el mismo instrumento. Este instrumento se lanza a
mano; no está en `guards:visuales`.

**Guards que saltaron al cambiar el esquema, y eran el aviso:** `scrum222` y `scrum461` (el censo
de deriva no conocía las dos columnas) y `scrum525d` (el ancla de arriba). `scrum1227` y
`scrum1269` piden que su fixture cubra todo lo que la pantalla guarda: se añadieron las dos claves
a `GUARDADO`, sin tocar ninguna aserción.

## ⑤ Mis errores

1. **Di por guardado algo que no se había mandado.** Al montar la pantalla por primera vez, mi
   perfil de prueba no llevaba teléfono; el formulario avisó y no guardó, y mi sonda dijo
   «0 guardados» sin error. Es la A10 «una operación que no se ejecutó se lee exactamente igual
   que un éxito». **La comprobación:** en el test, `guardar()` exige exactamente un PUT y si no se
   declara ciego. Es la línea `A9:` de arriba.
2. **Añadí una regla de 44 px sin medir si hacía falta.** La base de `.field select` ya da 44,5.
   Lo medí después, en navegador, y quité la regla y su clase. No llegó a empujarse.
3. **Compilé sin regenerar el cliente de Prisma** tras tocar el esquema: build roto, un minuto.
   Es A1, y estaba escrita.

## ⑥ Lo que queda sin medir

- **Dev.** `MIGRATIONS_PENDING.md` confirma la columna foral y dice que la del SII no se midió.
  Este árbol no la ha medido tampoco. Quien arranque en local contra dev puede encontrarse
  «columna que no existe» en cualquier lectura de `Merchant`. El comentario 17709 deja esa
  medición a cargo del orquestador.
- **Staging**: que el ALTER está aplicado lo dice la cabecera del SQL; aquí no se ha medido.
- **La pantalla en yaqu.app**: se mide después del despliegue.

---

# SCRUM-1102g · Dónde se enciende `INVOICING_ES_ENABLED` y qué forma tendría el corte

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T06:10:09Z

A9: sin fallo que generalice — medición de sólo lectura; mis tres tropiezos los delató un control al lado y van en «Mis errores»

Sesión J6f (`jv-j6`), 1-oct-2026, por encargo del orquestador del equipo de Javier
(`cobroflash-backend-5b`). **Es medición y propuesta. No se construye nada**: la puerta es camino de
emisión (regla 40), y va en ticket aparte con su propio GO. `src/` y `public/` sólo se han leído.

## ⓪ En corto

1. **Hoy la respuesta no la lee nadie, medido por efecto:** con «Sí» en el SII, el interruptor se
   enciende igual y el modo sale `fiscal` igual (`hoy.txt`).
2. **Encender el flag para un merchant tiene UN camino en `src/`** (`cambiarFlagFiscal`) y **un solo
   llamador**: el guion que ejecuta el fundador a mano. Ahí cabe el corte más barato.
3. **Pero hay tres caminos que ese corte no ve:** la variable de entorno, los dos guiones que crean
   merchants con el flag ya puesto, y —hallazgo— **cambiar el país en Configuración**.
4. **La respuesta caduca** (§② de SCRUM-1102e): un corte sólo al encender no cubre a quien conteste
   «Sí» después. Eso pide un segundo corte, en la lectura, que es más caro.
5. **Recomiendo dos pasos, no uno:** ahora, la puerta de encendido más la vigilancia; antes de que un
   merchant real pase tiempo encendido, el corte en el modo. La foral, en los dos, **avisa y no
   bloquea**.

## ① Dónde se enciende hoy: todos los caminos, con su población

`isFlagEnabled` (`src/core/flags.ts:68`) resuelve por precedencia: país → override del merchant →
variable de entorno → valor por defecto (`false`). De ahí salen los caminos.

| # | camino | quién lo escribe | población medida |
|---|---|---|---|
| A | override en `merchants.flags` por la puerta con constancia | `cambiarFlagFiscal` (`flagFiscal.service.ts:117`) | **1** escritura en `src/` de 23 escrituras de `merchant`; **0** llamadores en `src/`; **1** guion: `scripts/cambiar-flag-fiscal.mjs`. Sin ruta HTTP, a propósito |
| B | override escrito al CREAR el merchant, sin pasar por A | `scripts/seed-video.mjs:376` y `scripts/medir-concurrencia-emision.mjs:85` | **2** guiones de 266 ficheros de `scripts/` y `prisma/`. El primero pide confirmar el host; el segundo lee la base de dev |
| C | override por SQL a mano | nadie en el repo | **0** sentencias en `src/`, `scripts/` y `docs/sql/`. Por construcción no se puede censar: deja el flag sin fila `cambio_flag` |
| D | variable de entorno `INVOICING_ES_ENABLED=true` | Railway | **0** asignaciones en workflows, `package.json` y ficheros de entorno seguidos por git. **Railway no se ve desde aquí** |
| E | el país deja de ser `ES` | `PUT /admin/merchant` (rol `admin`), desde el selector de país de Configuración | el esquema lo deja pasar (medido por efecto); ver §④ |
| F | el merchant demo (id 1) | — | modo `demo` siempre, con o sin flag |

Por el alta no entra: `registerMerchant` crea el merchant sin `flags`. Y por `PUT /admin/merchant`
tampoco entra el flag: el esquema descarta la clave `flags` (medido: entra `{flags, name}` y sale
`{name}`).

Dos sondas independientes dan el mismo conjunto de escritores de `flags` hacia la base, tres:
la mía por AST (`sonda-lectores-y-escritores.txt`) y el censo de la casa
(`node scripts/censo-usos-de-campo.mjs flags`, `censo-usos-flags-escrituras.txt`).

**Cuántos merchants tienen hoy el override puesto: no lo he medido** (no he tocado ninguna base). El
instrumento existe: `scripts/guard-acreditacion-invoicing-es.mjs` (SCRUM-1097).

## ② Hoy nadie lee la respuesta — por efecto

`evidencias/SCRUM-1102/hoy.mjs`, sobre `dist/` compilado en este commit, 28 mediciones:

- `getEmissionMode` da el mismo modo para «No consta», «Sí» y «No», en las seis combinaciones de
  override y entorno. Control: el modo **sí** cambia con el override, con el demo y con el país.
- `cambiarFlagFiscal`, con un cliente doblado: **enciende en los tres casos** y escribe su fila de
  auditoría. Control: con la confirmación equivocada **se niega**.
- En `src/` las dos columnas aparecen en dos sitios: el `select` de `merchantAdmin.ts:148` y el
  esquema de validación. Ninguna condición las mira (`censo-usos-llevaLibrosPorSii.txt`).

## ③ Dónde se LEE el flag: los sitios donde cabe un corte

| sitio | qué decide | población |
|---|---|---|
| `isFlagEnabled` (`core/flags.ts`) | todos los flags | 39 llamadas en `src/`; 6 con este flag |
| `getEmissionMode` (`emission.service.ts:36`) | `fiscal` / `demo` / `receipt` | 16 llamadas en 10 ficheros; de aquí cuelgan las rutas, los correos y lo que el panel pinta |
| `allocateInvoiceNumber` (`invoiceNumber.service.ts:335`) | el embudo: reserva el número o lanza | 7 llamadores; su propio `select` del merchant (línea 375) |
| `exports.routes.ts:145` y `:544` | si se entrega el XML | 2 lecturas directas, sin pasar por el modo |

Dato que decide entre ellos: **emitir en España y generar el registro VeriFactu son hoy el mismo
acto**. `sellarTrasEmision` se llama tras cada emisión (7 sitios) y `SIF_ENABLED` sólo pausa la cola de
remisión (`sif.procesador.ts:77`). No existe «factura sin registro» para un merchant español.

El embudo ya rechaza con `invoicing_es_disabled` cuando el modo es `receipt`
(`invoiceNumber.service.ts:448`), pero **nadie captura ese error por su nombre** (0 sitios en `src/` y
`public/`): quien de verdad para al usuario antes es el modo, en cada ruta.

## ④ Hallazgo aparte: el país se cambia desde Configuración

`getEmissionMode` devuelve `fiscal` para todo país que no sea `ES`, sin mirar el flag
(`emission.service.ts:38`). Eso ya se sabía. Lo que no constaba:

- El esquema de `PUT /admin/merchant` **acepta `country`** (`schemas.ts:471`; medido: entra
  `{country:"MX"}` y sale `{country:"MX"}`), y Configuración tiene el selector
  (`settingsView.js:373`).
- `updateMerchantProfile` escribe lo que sobrevive al esquema (`merchantAdmin.ts:251`) y no mira el
  país. Esto último es **lectura**: no lo he ejecutado contra una base.

O sea: un merchant español con rol `admin` está a un guardado de quedar en modo `fiscal` sin el flag,
sin registro VeriFactu (`sellarTrasEmision` marca «no aplica» lo que no entra en la cadena) y fuera
del guard de SCRUM-1097, que filtra por `country = 'ES'`. **Cualquier corte por el SII pensado para
España queda igual de fuera.** No he encontrado ticket que lo nombre. No lo arreglo: lo reporto.

## ⑤ Las formas del corte, con su coste

**W · La puerta de encendido.** `cambiarFlagFiscal` lee las dos columnas en el `select` que ya hace
(`flagFiscal.service.ts:87`) y se niega a ENCENDER `INVOICING_ES_ENABLED` si el SII no es «No».
Apagar nunca se bloquea.

- Coste: 1 función, 1 guion que imprime la negativa, 3 ficheros de test que la nombran. Dos códigos
  de error nuevos, internos (los ve el fundador en su terminal, no un usuario).
- Cubre: el camino A, que es el único con constancia y el único que el fundador usa.
- No cubre: B, C, D, E, ni a quien conteste «Sí» **después** de encendido.

**V · La vigilancia.** El guard de SCRUM-1097 añade las dos columnas a su consulta y lista los
merchants con el flag puesto y el SII distinto de «No».

- Coste: 1 guion de sólo lectura y su test. No es camino de emisión y es de este puesto.
- Cubre: A, B y C, y también la respuesta que caduca, pero **detecta, no impide**.
- No cubre: D (lo dice su propia cabecera) ni E. Y sólo habla si alguien lo lanza: la tarea
  programada de SCRUM-1109 es de Railway y **no sé si está desplegada**.

**M · El modo lo sabe.** `getEmissionMode` devuelve `receipt` para un español no demo con el flag
puesto y el SII distinto de «No». Todo lo que cuelga del modo se comporta como con el flag apagado.

- Coste: `MerchantLike` gana un campo; 16 llamadas en 10 ficheros tienen que traer la columna en su
  `select`; el del embudo también; y los tests que montan un merchant con el flag puesto —**33
  ficheros** lo nombran encendido, cota superior— necesitan el campo o pasan a `receipt`. Los dos
  guiones del camino B, igual. Una negativa nueva que ve el usuario pide texto con firma (regla 39).
- Cubre: A, B, C y D, y la respuesta que caduca.
- No cubre: E. Y deja dos lecturas directas (`exports.routes.ts`) diciendo lo contrario que el modo.
- 🔴 Efecto que hay que decidir, no un detalle: con M, un merchant que ya emite y guarda «Sí» en
  Configuración **se queda sin documento y sin cobro** (regla 24) al pulsar «Guardar cambios», y la
  pantalla, por la regla 7, no puede decirle por qué.

**Descartadas.** Cortar sólo en el embudo: el rechazo llegaría a 7 caminos que no saben
traducirlo, y las pantallas seguirían ofreciendo facturar. Cortar en `isFlagEnabled`: 39 llamadas y
un contexto que comparten los trece flags.

**Recomendación.** W + V ahora. M, en su propio ticket, **antes** de que un merchant real quede
encendido de forma estable: mientras el único que enciende sea el fundador y a mano, W cubre el
presente; lo que W no puede cubrir nunca es el dato que envejece.

## ⑥ SII y foral, por separado

| | SII | domicilio foral |
|---|---|---|
| en qué se apoya | literal: RRSIF art. 3.3 | inferencia del art. 1.3; espera al asesor (SCRUM-1264) |
| en W | **bloquea** el encendido si no es «No» | **no bloquea**: el guion enseña la respuesta antes de encender y la fila de auditoría la guarda |
| en V | lista al merchant como hallazgo | lo lista aparte, como «pendiente del asesor» |
| en M | pasa a `receipt` | **no entra en M** |
| si el asesor confirma | — | se añade como segunda condición de W, y entonces se decide M |
| si el asesor lo niega | — | se retira el aviso; la pregunta de Configuración se queda sin efecto y hay que decidir si se quita |

No he medido si algún guard fija la forma del `payload` de la fila `cambio_flag`; guardar ahí las dos
respuestas puede pedir tocar ese guard.

## ⑦ «No consta» no es «No»: los tres sitios donde se pierde

1. **En la condición.** `!== true` trata «No consta» como «No»: deja encender a quien no ha
   contestado, y la puerta no sirve. La condición tiene que ser `=== false`, con tres desenlaces:
   «No» pasa; «Sí» se niega; «No consta» **se niega con otro código**, porque lo que pide es otra
   cosa (que conteste, no que se vaya).
2. **En el `select`.** Un sitio que no trae la columna entrega `undefined`, que frente a
   `=== false` es lo mismo que «No consta». En W hay un solo `select`. En M hay 16 llamadas: si el
   campo de `MerchantLike` es **obligatorio** en el tipo, el que lo olvide no compila; si es
   opcional, el olvido es mudo. `allocateInvoiceNumber` ya pagó esto una vez con `flags`
   (SCRUM-81, comentario de la línea 379).
3. **En los datos de prueba.** Un doble de test sin la columna ejercita «No consta» sin saberlo. Con
   la condición bien puesta eso da rojo, que es lo correcto; con `!== true` daría verde sobre el caso
   que la puerta existe para parar.

Y un borde: el merchant demo tiene las dos columnas en «No consta». En M la comprobación va **después**
de la rama del demo, o el demo deja de emitir.

## ⑧ 🔴 Lo que es mío, de IA, y no está en la norma

1. **Que «No consta» bloquee el encendido.** La norma no habla de respuestas sin dar. Es diseño: la
   idea original era de J4b y ya iba marcada así. La alternativa —avisar y dejar encender— es
   legítima y más floja.
2. **Que el excluido «no pueda ser cliente».** El literal del art. 3.3 dice que el Reglamento «no se
   aplicará» a quien lleve los libros por el SII. Que por eso no pueda usar el módulo es la frase
   del asesor (23-sep), no la del BOE. No he verificado si alguien no obligado puede usar un sistema
   VeriFactu por su cuenta. La decisión de bloquear ya está tomada; dejo dicho en qué se apoya.
3. **Qué pasa con quien entra en el SII ya encendido.** El art. 68 bis fija **desde cuándo** surte
   efecto la opción («el primer periodo de liquidación que se inicie después»). Una columna de sí o
   no **no tiene fecha**: no puede decir desde cuándo. Y qué se hace con los registros ya emitidos no
   sale de nada de lo leído. Es pregunta para el asesor.
4. **Que el corte sea «sin documento y sin cobro».** Es consecuencia de la regla 24 y de que aquí
   emitir y sellar son un solo acto, no de la norma. Atender a un profesional del SII con facturas
   sin registro sería otro producto; no lo propongo.

## ⑨ Sin medir

- La variable de entorno en Railway, y si la tarea programada de SCRUM-1109 está desplegada.
- Cuántos merchants tienen el override, en cualquier base.
- Escrituras de `merchant` anidadas dentro de la creación de otro modelo: mi sonda sólo ve
  `<x>.merchant.<método>(…)`. El censo de la casa, que mira el campo y no la llamada, tampoco las saca.
- El camino E de punta a punta contra una base.
- Los «33 ficheros de test» son los que nombran el flag encendido, no los que caerían: es una cota.

## Mis errores

- **Dije que el país no se podía cambiar desde el perfil** tras buscar `country` en un tramo de
  líneas del esquema que no llegaba a donde está declarado. Lo tumbó ejecutar el esquema: `country`
  pasa. De ahí sale el §④.
- Mi sonda imprimió **«portadores del flag: 0»** por leer mal lo que devuelve el censo de la casa.
  Corregido, da 1.788: el cierre pasa por `isFlagEnabled` y arrastra todos los flags, así que **no
  sirve para esta pregunta** y no lo uso (`portadores.txt`).
- Conté «27 mediciones» en una pasada de `hoy.mjs` y son 28 tras añadir la del país.

## Reproducir

    npm run build
    node docs/master/evidencias/SCRUM-1102/hoy.mjs .
    node docs/master/evidencias/SCRUM-1102/sonda-lectores-y-escritores.mjs .
    node scripts/censo-usos-de-campo.mjs flags
    node scripts/censo-usos-de-campo.mjs llevaLibrosPorSii
