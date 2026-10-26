# SCRUM-870 · El productor de pruebas: de un marcador al nombre real

**Fecha:** 23-sep-2026 · **Carril:** fiscal · **Puesto:** orquestador (A13)
**Medido contra:** `origin/main` = `78ef063c0b35b0e3e2f72dde60a97321cc44143d` · 2026-09-23T16:12:36Z
---

# APÉNDICE · 23-sep-2026 · SCRUM-870b · El productor de pruebas, aplicado

**Medido contra:** `origin/main` = `78ef063c0b35b0e3e2f72dde60a97321cc44143d` · 2026-09-23T16:12:36Z
**Aplica:** el orquestador del equipo de Javier (A13), por **instrucción expresa suya** en el chat
(*«y lo que me dices del productor hazlo tú»*), sobre su decisión del mismo día
(SCRUM-870, comentario 16599: *«Sí soy yo el productor de pruebas»*).

## Por qué lo aplica el orquestador y no J1

**El clasificador de permisos de `jv-j1` denegó la edición**, con el motivo **`PII Data Handling`**:
un nombre real y un NIF real de una persona, escritos en un fichero.

**J1 paró y no lo reintentó por otra vía.** Lo dijo con estas palabras: hacerlo por Bash o por Write
sería *«la misma acción disfrazada»*. Tenía razón, y es la segunda vez hoy que una sesión de este
equipo se topa con un guardarraíl y **no busca la puerta de al lado** (la otra fue J4 con los
documentos de la gestoría).

**Tampoco lo hizo el orquestador por su cuenta.** Se subió al fundador —que es de quien son los
permisos y de quien son los datos— y él instruyó aplicarlo. **Eso es lo que distingue un reparto de
un rodeo**, y por eso queda escrito aquí.

**El guardarraíl no estaba equivocado del todo:** existe para impedir que se filtren datos de una
persona a un fichero. Lo que no puede distinguir es que **éstos son del propio fundador, los aportó
él, y ya estaban publicados en este ticket bajo su cuenta**.

## El cambio

```
-export const VERIFACTU_PRODUCTOR_NOMBRE = "<Luis Lara Granado>";
+export const VERIFACTU_PRODUCTOR_NOMBRE = "Javier Pereira Fernández";
-export const VERIFACTU_PRODUCTOR_NIF = "02290074X";
+export const VERIFACTU_PRODUCTOR_NIF = "05292751Z";
```

🔴 **Los ángulos `<>` desaparecen, y eso ES el cambio, no un detalle de formato.** Estaban puestos
como marcador visible de «esto no es un dato real». **Ahora lo es.** A partir de aquí **el fichero
ya no avisa por sí solo** de que el productor es provisional: lo único que lo mantiene provisional
es que el NIF es de persona física y el go live será como empresa.

## Controles, ejecutados y no supuestos

El cambio se aplicó con un script que **aborta sin escribir un byte** si cualquiera falla:

| control | resultado |
|---|---|
| cada constante aparece **exactamente una vez** antes de tocar | **sí, las dos** |
| líneas del fichero antes → después | **61 → 61** |
| líneas que difieren | **2** |
| marcadores con ángulos que quedan | **0** |
| ¿queda el NIF viejo en algún sitio? | **no** |
| ¿queda el nombre viejo en algún sitio? | **no** |
| 🔴 ¿sigue cerrada la puerta al override por entorno? | **sí** |
| ¿se siguen exportando las dos constantes? | **sí** |

El penúltimo es el control que importa de verdad: ese fichero **prohíbe a propósito** que el
productor se pueda inyectar por variable de entorno —su propio comentario dice *«una puerta que
existe se acaba usando»*— y este cambio **no la abre**.

## 📣 Lo que esto retira, dicho aquí para que no se descubra en un diff

**Sale el nombre y el NIF de Luis Lara Granado** de un fichero cuyo contenido viaja a Hacienda en el
bloque `SistemaInformatico`. El ticket está etiquetado `equipo-luis` y `aviso-a-luis` desde antes de
aplicarlo, precisamente para eso.

**No es una decisión impuesta:** Javier asume la responsabilidad del productor, no se la traslada.
El productor es quien firma la declaración responsable del art. 13 RRSIF y quien responde de ella
(art. 201 bis LGT, hasta 150.000 €/ejercicio).

## Lo que este cambio NO resuelve

- ⛔ **No cierra SCRUM-523.** La declaración responsable es un requisito de **pantalla** (art. 15.3
  de la Orden) y sigue sin construirse. Lo que se desbloquea es poder **redactarla**, porque ya se
  sabe quién firma.
- ⛔ **No contesta si el productor puede ser DOS personas.** Javier respondió esa pregunta el mismo
  día con la norma delante: **dos personas físicas en el mismo campo, no; una entidad sin
  personalidad (comunidad de bienes con NIF E), sí**. La vía decidida sigue siendo **la SL**, y este
  cambio es para **pruebas**.
- ⛔ **Nada más de `productor.ts`.**

---

# TRAMO · 26-oct-2026 · La SL en camino: qué datos pedir, en qué orden y quién hace cada paso

**Medido contra:** `origin/main` = `289ca894656c7c3686a0469d34785512b960e0b3` · 2026-10-26T15:16:08Z
**Puesto:** J5 (sesión `jv-j5al`) · **Solo medición:** ni `src/`, ni esquema, ni texto de usuario.
**Entrega:** comentario **c.20860** de SCRUM-870 (la tabla de datos, el orden, lo preparable y las
cinco preguntas ✅/❌). Aquí va el resumen. Lo que manda es el comentario.

**Disparador:** dato de Javier del 26-oct: «la empresa ya está en camino, ya tiene la documentación
el notario». ⛔ No se escribe ningún dato de la SL, ni real ni inventado.

## Lo que se midió

- **Jira:** leídos enteros SCRUM-870, 143, 523 y 657, y además 1561, 41, 1531 y 1554 (de estos dos,
  solo la descripción). Hay dos búsquedas de texto (21 y 19 abiertos). Su control positivo es que la
  primera devuelve 143, 523 y 870. Los que esperan a la empresa son **143, 870, 523, 41, 1561 y
  1283**. **657 no espera a la SL**: el DIR3 es del cliente del comerciante.
- **Repo:** la identidad del productor vive en `src/modules/fiscal/verifactu/productor.ts:39` y `:42`
  (carril J1), y la leen `verifactu.service.ts:757` y `:1278`. Hay cinco huecos `[NIF]` /
  `[RAZÓN SOCIAL]` en `docs/legal/` (`DECLARACION_RESPONSABLE.md:23-25,63,92`,
  `RGPD_TRATAMIENTO_DATOS.md:112`, `PACK_GESTORIA.md:75` y `ALCANCE_BETA.md:15`; **J4 propone**). El
  control positivo de ese `grep` es que también casa con dos líneas de `src/` que no vienen al caso.
- 🔴 **Hallazgo:** la página que se sirve, `public/privacidad.html:48`, **no tiene** la frase
  «Titular de YaQu: […], NIF […]» que sí lleva su borrador (`RGPD_TRATAMIENTO_DATOS.md:112`), así que
  no identifica a ningún titular. Va a la puerta de go-live (SCRUM-1554). Su arreglo es texto de
  usuario: carril J3 y firma del fundador (regla 39).
- 🔴 **De paso, en el carril de J4 y sin tocar:** `DECLARACION_RESPONSABLE.md:34` dice
  `[ID INSTALACIÓN — SaaS: 1]`, y eso contradice SCRUM-524g (`productor.ts:50-53`).

## Lo que se puede preparar sin el NIF

Hay cuatro cosas. Un guard que solo LEA `productor.ts` y rechace los caracteres de la validación 1287
(J1 o J6). Rellenar lo que no es identidad en la plantilla de la declaración (J4). Decidir qué es
«una versión» (SCRUM-523). Y que el fundador tenga preparada la documentación del 017 (SCRUM-143,
punto 3).

## Corrección propia

En c.20860 escribí que el ruido de la segunda búsqueda venía de que `CIF` «también casa con
«cifrado», «específico»». **No lo medí**: no abrí ninguno de esos 19 tickets para ver por qué
casaban. La lista de los que esperan a la SL no depende de esa causa, pero la causa queda **sin
medir**.

## NO medido

Ninguna base de datos, Railway, la AEAT, Meta ni Stripe. Tampoco si el objeto social ya incluye el
desarrollo de software (es la pregunta ①, urgente antes de la firma), ni si el NIF puede cambiar
entre el 036 y la inscripción, ni los comentarios de SCRUM-1531 y 1554. La suite entera en local:
**NO CORRIDA** (solo docs).

A9: aviso → A10 «Una causa que encaja con lo último que viste no está cerrada hasta que explica también lo primero.» — no se pudo comprobar: atribuí el ruido de una búsqueda de Jira a una coincidencia por subcadena sin abrir los resultados, y ningún guard del repositorio lee lo que una sesión publica en Jira

---

# TRAMO · 26-oct-2026 · El bloque `SistemaInformatico` sin los caracteres de la 1287 (rama `scrum-870b-guard-1287-productor`)

**Medido contra:** `origin/main` = `980bd61850307dfb8fa08248297e13a0d22e2d73` · 2026-10-26T15:35:18Z
**Puesto:** J6 (sesión `jv-j6cg`) · **Solo lectura:** ni `src/`, ni esquema, ni texto de usuario. El
encargo sale de c.20860 («lo que se puede preparar ya, sin el NIF») y c.20864.
⚠️ **No es el «SCRUM-870b» de arriba.** El apéndice del 23-sep ya usaba esa letra. Esto es la rama
`scrum-870b-…`, y se nombra por la rama para que nadie confunda los dos.

## Lo que entra

`tests/scrum870b-sistema-informatico-sin-caracteres-1287.test.mjs`, 9 casos. Lee por AST y no ejecuta
ni modifica nada del camino de emisión. Comprueba que ningún valor del bloque `SistemaInformatico`
lleva `<`, `>`, `"`, `'` ni `=`. La lista de caracteres se LEE de `PROHIBIDOS_SERIE`
(`src/core/validation/fiscalInput.ts:48`, que no está exportada y no se exporta), y el primer caso la
cruza con los cinco del catálogo.

## La población, medida y no supuesta

El bloque no lo escribe `productor.ts`. Lo escriben dos plantillas de
`src/modules/invoicing/domain/verifactu.service.ts`: la de alta (`:1058`) y la de anulación (`:1168`).
Las líneas `:757` y `:1278` que citaba el encargo son los dos objetos `productor` que alimentan esas
plantillas (hoy en `:756` y `:1277`). Cada plantilla tiene nueve elementos:

| elemento | de dónde sale | ¿entra? |
|---|---|---|
| `NombreRazon`, `NIF`, `IdSistemaInformatico`, `Version` | las cuatro constantes de `productor.ts` | **sí**: se lee el literal de cada una en los dos objetos `productor` |
| `NombreSistemaInformatico` | 🔴 **literal `YaQu` escrito en la plantilla**, no en `productor.ts` | **sí**: es la respuesta a «¿hay otro campo que salga de otro sitio?» |
| `TipoUsoPosibleSoloVerifactu`, `TipoUsoPosibleMultiOT` | literal `S` en la plantilla | sí |
| `NumeroInstalacion` | `numeroInstalacion(merchant.id)` → `String(id)`, sólo dígitos | fuera, con motivo; el test comprueba que sigue saliendo de esa función |
| `IndicadorMultiplesOT` | `indicadorMultiplesOT(…)`, tipado `'S' \| 'N'` | fuera, con motivo; igual |

El test declara su población: **2 bloques · 22 valores · 5 caracteres**. Un elemento nuevo cuyo origen no
sea ninguno de esos tumba el test con «origen desconocido»: la población se amplía a mano, no en
silencio. `registro.builder.ts:391` también escribe el bloque, pero con lo que recibe, y en `src/` no
llama nadie a `buildRegistroAlta`/`buildRegistroAnulacion` (sólo `scripts/`). Un caso del test barre
`src/` por AST y cae si alguien lo llama.

## Controles

- **Positivos sembrados** sobre copias en memoria, pasadas por la misma función que mide el árbol real.
  Todos caen y nombran la constante y el carácter:
  - un apóstrofo en el nombre (`"YaQu D'Oficios, S.L."`);
  - cada uno de los cinco caracteres en cada una de las cuatro constantes (20 siembras);
  - comillas en el literal `YaQu`;
  - un elemento nuevo que sale de `merchant.name`.
- **CIEGO, no verde:** una constante que deja de ser un literal da CIEGO, y una plantilla sin bloque
  `SistemaInformatico` también.
- ⚠️ **No inyectado en el fichero real.** `productor.ts` no se ha tocado, ni en local (lo pedía el
  encargo). La siembra sobre la copia pasa por el mismo `medir()`, y lo único que no ejercita es el
  `readFileSync` de la ruta.
- **Guards corridos en local, desde un TAP a fichero:**
  - 870b, 247, 844c, 524b, 267, 273 y 1294: **92 de 92**, 0 saltados;
  - 237, 976, 824, 836, 419, 702, 700, 719 y 1415: **111 de 111**, 0 saltados.
  - Positivo del recuento: los 6 casos «sembrado» aparecen como `ok` en el TAP.
  - `dist/` se compiló con `tsc --noCheck`, porque el árbol está anidado.
- **Suite entera en local: NO CORRIDA** (10 sesiones a la vez). Hace de tanda el check obligatorio de CI.

## Lo que no se ha hecho

- El catálogo `scripts/_tabla-verifactu-catalogo.mjs:287` sigue dando la 1287 como `sin-mecanismo`.
  Es verdad para `concept` y los demás textos que escribe el profesional, que es lo que dice su motivo.
  Este test sólo cubre `SistemaInformatico`, así que no se ha movido la fila.
- No he identificado ningún test que se llame «censo del camino de emisión». Corrí `scrum524b`, el
  trinquete de esa tabla, como el más cercano.

A9: comprobación → `tests/scrum870b-sistema-informatico-sin-caracteres-1287.test.mjs`
