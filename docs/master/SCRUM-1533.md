# SCRUM-1533 · Los datos se movieron a la UE: qué frases de docs/legal/ caducan, cuáles siguen y cuáles nunca se midieron

**Medido contra:** `origin/main` = `9226d0f2dd48f885b63b3222441f57554a7cdb1c` · 2026-10-13T07:19:13Z

A9: sin fallo que generalice — mis dos tropiezos (abajo, «Lo que me salió mal») no llegaron al resultado, y lo que este censo destapa (una tabla interna que se quedó detrás del texto publicado) no es un fallo mío ni tiene comprobación que yo pueda escribir sin tocar texto que ve el usuario.

13-oct-2026 · sesión `jv-j5d` (equipo de Javier, carril legal / fiscal), por encargo del orquestador
(`cobroflash-backend-2e`). [Escrito por la sesión, no por Javier. Leídos en Jira: SCRUM-1533 entero, que
no tiene comentarios; SCRUM-1521 entero con sus 7 comentarios, en particular `c.19153`.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha.
**Este PR sólo añade este fichero.** No toca `docs/legal/`, ni `public/`, ni `src/`, ni el máster.

## El resultado, en cinco frases

1. **Ninguna afirmación de `docs/legal/` ha pasado a ser falsa por el traslado.** En los 20 ficheros no
   hay ni una frase que diga dónde están alojados los datos. Lo que hay es **una pregunta pendiente**
   (`RGPD_TRATAMIENTO_DATOS.md`, línea 73) que tiene dos mitades, y el traslado contesta **una**.
2. **La política publicada tampoco ha pasado a ser falsa.** De Railway dice sólo «alojamiento de la
   aplicación y base de datos», sin lugar. No hay que cambiarle nada para que siga siendo cierta.
3. 🔴 **El traslado no cierra ninguna de las transferencias que la política DECLARA.** La política
   publicada marca cuatro como «transferencia internacional»: Meta, Resend, Cloudflare y Google
   (Gemini). Railway **nunca estuvo marcada**, ni cuando alojaba en California. Las cuatro siguen
   exactamente igual que ayer.
4. 🔴 **El «una de cinco» del encargo está mal contado, y la lista también.** Sale de la tabla interna
   de julio, que nombra a Anthropic y no tiene ni a Google ni a Cloudflare. La política publicada, desde
   el 30-sep-2026, es al revés: nombra a Google (Gemini) y a Cloudflare, y **dejó de nombrar a
   Anthropic** (SCRUM-1154).
5. **Lo que de verdad ha caducado en `docs/legal/` caducó el 30-sep, no hoy:** la tabla de encargados
   y la pregunta 5 al asesor llevan una lista de proveedores que ya no es la del producto ni la de la
   política. El traslado sólo lo ha hecho visible.

## De dónde sale que los datos se movieron: NO lo he medido

Lo dice el ticket, que lo atribuye al fundador. **En el repositorio no hay ni una línea que lo
registre** (búsqueda de «Ámsterdam», «EU West», «europe-west» en los 6.118 ficheros: 0; la misma
búsqueda sí ve «US West» en tres registros de `docs/master/`, así que el instrumento no está ciego).
El panel de Railway no lo ve ninguna sesión. Lo único que miré desde fuera fue una petición de sólo
lectura a la portada de `yaqu.app` a las 07:17:07Z: contesta 200, entra por Cloudflare en Madrid
(`CF-RAY …-MAD`) y lleva `x-railway-edge: bcn1`. **Eso dice por dónde entra la petición, no dónde
viven la aplicación ni la base.** No prueba el traslado y no lo desmiente.

## El censo

**Población:** `docs/legal/`, 20 ficheros seguidos por git (19 `.md` y `fuentes/aeat-errores.properties`).
**Instrumento:** una búsqueda de 30 términos (Railway, región, California, Ámsterdam, transferencia
internacional, EE. UU., UE, Irlanda, alojar, servidor, SCC, cláusulas, DPA, Resend, Anthropic, Meta,
sub-encargado…). **Casa 85 líneas en 15 ficheros.** Leídas las 85: **33 están en
`RGPD_TRATAMIENTO_DATOS.md`** y 52 fuera. De esas 52, **10 hablan de privacidad sin decir lugar** (van
en la tabla B, salvo `ALCANCE_BETA.md` línea 46, que sólo remite al DPA) y **42 son ruido** («servidor»
como pieza del programa, «UE» dentro de «Reglamento (UE) 910/2014», «Railway» como sitio donde se
despliega). Una segunda sonda con otras palabras (nube,
infraestructura, tercer país, Unión Europea, ubicación) no añadió ninguna frase nueva sobre el asunto.
**Los 5 ficheros que no casan no los he leído enteros.**

### A · Lo que el traslado cambia (1 línea, y es media)

| Fichero | Línea | Qué dice | Qué pasa hoy |
|---|---|---|---|
| `RGPD_TRATAMIENTO_DATOS.md` | 73 | «Verificar región de datos (EU vs. US) y DPA de Railway» | **La mitad «región» tiene respuesta** (EU West, según el ticket). **La mitad «DPA de Railway» sigue sin hacer:** nadie lo ha localizado ni guardado. Mover la región no la contesta. |

### B · Lo que sigue exactamente igual (el traslado no lo toca)

| Fichero | Línea | Qué dice | Por qué sigue |
|---|---|---|---|
| `RGPD_TRATAMIENTO_DATOS.md` | 71 | Meta Platforms (Irlanda/EE. UU.), «Transferencia internacional — SCC de Meta / marco vigente EU-US» | WhatsApp sigue saliendo por Meta (`graph.facebook.com`). |
| `RGPD_TRATAMIENTO_DATOS.md` | 72 | Resend: «Verificar región de procesamiento (histórico: infra en EE. UU.) → SCC» | El correo sigue saliendo por Resend (`api.resend.com`). **Y la verificación sigue sin hacerse.** |
| `RGPD_TRATAMIENTO_DATOS.md` | 75 | Stripe y Mercado Pago, responsables independientes de los datos de pago | No dependen de dónde esté Railway. La fila **no dice** dónde tratan los datos ni si hay transferencia. |
| `RGPD_TRATAMIENTO_DATOS.md` | 79-83 | «hoy no hay constancia guardada de haberlos aceptado explícitamente ni de las cláusulas de transferencia internacional» | No he encontrado en el repositorio ningún registro de DPA aceptados (4 ficheros fuera de `docs/legal/` nombran «DPA»; leí las líneas de dos y son pendientes; los otros dos, **sin leer**). |
| `RGPD_TRATAMIENTO_DATOS.md` | 277, 284 | El registro de actividades debe llevar «transferencias internacionales y garantías» | Genérico. Sigue. |
| `ENVIO_ASESOR_2026-09-28.md` | 505-507 | Pregunta G3 (4): si bastan los contratos estándar de «mensajería, correo, inteligencia artificial» o hacen falta cláusulas tipo o una evaluación de transferencias | **Sigue abierta y «SIN RESPUESTA».** Es lo que se envió el 28-sep; no se toca. No nombra el alojamiento: **por el alojamiento en EE. UU. nunca se preguntó.** |
| `PREGUNTAS_ASESOR.md` | 57-63 | Punto 9, privacidad + DPA + cookies | No habla de lugar. Sigue. |
| `PREGUNTAS_ASESOR_POR_ESPECIALISTA.md` | 386-406 | P3, modelo de privacidad | No habla de lugar. Sigue. |
| `DECLARACION_RESPONSABLE.md` | 46-47 | «alojada en `[INFRAESTRUCTURA, ej. Railway]`» | Es un hueco por rellenar y no dice región. Sigue. Documento fiscal: no se toca. |
| `PREGUNTAS_ASESOR.md` · `PREGUNTAS_ASESOR_POR_ESPECIALISTA.md` | 1128 · 275 | El disco de Railway es efímero entre despliegues | Habla del disco, no de la región. **No he medido si sigue igual tras el traslado.** |

### C · Lo que nunca se midió y sigue sin medirse

| Qué | Dónde se ve el hueco |
|---|---|
| **El DPA de Railway** | Línea 73, segunda mitad. |
| **Si «dato en reposo en la UE» equivale a «sin transferencia» con este proveedor.** Dónde tiene Railway su sede y desde dónde accede su personal o su plano de control: sin medir aquí. | No lo dice ningún documento. Es pregunta de asesor, no de sesión. |
| **Si quedó copia en California.** Volumen viejo, instantáneas o copias del proveedor tras la mudanza. | El ticket dice que no se perdió ninguna fila; **no dice que la copia de origen se borrara.** |
| **Dónde acaban las copias de seguridad.** `scripts/backup-dump.mjs` deja el fichero cifrado en una carpeta y dice que la subida a un destino externo no está construida y que «hay que moverlo a mano fuera de la máquina». | Dónde se guardan hoy esos ficheros: sin medir. |
| **Las bases de staging y de desarrollo.** El ticket habla de `Postgres` y de la aplicación. | Si staging o dev guardan datos personales reales y en qué región están: sin medir. |
| **La región de Resend** | Línea 72: «verificar», desde julio. |
| **Qué cláusulas tiene Meta y cuáles hemos aceptado** | Línea 71 las nombra; línea 79-83 dice que no hay constancia. |
| **Google (Gemini) y Cloudflare** | La tabla interna **no tiene fila** para ninguno de los dos. La política publicada sí los nombra. |
| **Con qué condiciones de uso de datos funciona Gemini.** El código lo llama «tier gratuito» (`src/integrations/gemini.ts`, línea 1). | Qué hace Google con lo que recibe en esa modalidad: **sin medir; no lo afirmo.** Va al asesor. |
| **Si Anthropic recibe algo en producción.** El código llama a Gemini si hay clave de Gemini, y a Anthropic sólo si no la hay (`src/modules/ai/domain/ai.service.ts`, líneas 39-43). | Qué claves hay puestas en producción: sin medir (panel de Railway). |
| **Stripe y Mercado Pago: dónde y con qué garantías** | Línea 75 no lo dice; la política publicada los nombra sin la marca «transferencia internacional». |

### D · Lo que ha caducado, pero NO por el traslado

| Fichero | Línea | Qué dice | Desde cuándo no es así |
|---|---|---|---|
| `RGPD_TRATAMIENTO_DATOS.md` | 74 | «Prompts a IA… Anthropic = encargado» | La política publicada nombra a Google (Gemini) y dejó de nombrar a Anthropic el **30-sep-2026** (commit `bfd23a1ca`, SCRUM-1154). El código pone a Gemini primero. |
| `RGPD_TRATAMIENTO_DATOS.md` | 77-78 | «encargados que YaQu necesita tener formalizados: Meta, Resend, Railway, Anthropic, Stripe, Mercado Pago» | Faltan Cloudflare (entró en la política el 30-sep-2026, commit `716e5fd55`, SCRUM-1196) y Google. |
| `RGPD_TRATAMIENTO_DATOS.md` | 318-320 | Pregunta 5 al asesor: «(Meta, Resend, Anthropic — todos con infraestructura parcial en EE. UU.)» | La misma lista vieja: sin Google ni Cloudflare. Y **Railway no estaba**, aunque entonces alojaba en EE. UU. (US West, dato del fundador recogido en `docs/master/SCRUM-863.md`, líneas 200-201). |
| `RGPD_TRATAMIENTO_DATOS.md` | 97-199 | El bloque «texto de reemplazo» de la política | Es el texto del **23-jul-2026**. La política publicada cambió después (su fecha dice 30 de septiembre de 2026). El bloque es historia; **no se toca** (regla 39). |

El documento no se edita desde el 3-ago-2026 (`648ea1562`): todo lo de la sección D le pasó por encima.

## ⛔ La política de privacidad: qué hay que señalar, y pido firma. No redacto nada.

Texto que ve el usuario: `public/privacidad.html`. No he tocado ni una palabra, ni ahí ni en el bloque
de las líneas 97-199 del documento legal. Lo que hay que saber:

1. **Hoy no hay que cambiarla.** Nada de lo que dice ha pasado a ser falso por el traslado.
2. **Decisión del fundador, con su asesor:** si la política debe decir **dónde** se alojan los datos.
   Hoy no lo dice. **Mi recomendación es no añadirlo ahora:** sería una afirmación nueva, y qué
   significa jurídicamente es justo lo que se va a preguntar en la llamada.
3. **Un hecho para el asesor, sin valorar:** mientras la base estuvo en California, la línea de Railway
   de la política publicada no llevaba la marca «transferencia internacional» que sí llevan Meta,
   Resend, Cloudflare y Google.
4. **Una comprobación que sólo puede hacer el fundador:** si en producción hay clave de Anthropic y no
   de Gemini, el producto estaría mandando texto a un proveedor que la política ya no nombra. Con clave
   de Gemini puesta, Anthropic no recibe nada.

## Las notas fechadas que propongo — NO están aplicadas

Las cuatro van en `docs/legal/RGPD_TRATAMIENTO_DATOS.md`, que es documento interno (borrador para el
asesor), **fuera** del bloque de la política. Siguen el principio de SCRUM-1521 `c.19153`: no se
reescribe la frase, se le pone la fecha al lado. **No las he escrito en el fichero:** el encargo pide
propuesta, y los literales los firma el fundador.

**Dónde irían, y por qué ahí: al final de una línea que ya existe, sin añadir ninguna.** Medido: dos
citas del repositorio apuntan a este fichero por número de línea, la 49 y la 201 (las dos desde
`AUDITLOG_FISCAL_CONTRATO.md`, líneas 556 y 759, y las dos recogidas en la evidencia de SCRUM-1524).
Una línea nueva por encima de la 201 movería esa cita. Las notas 1, 2 y 3 caen por encima. Ninguna
toca las líneas 49 ni 201. El fichero tiene 332 líneas y seguiría teniendo 332.

**Nota 1 — al final de la línea 73 (dentro de la última celda):**

> **[Nota del 13-oct-2026, SCRUM-1533:** la mitad «región» de esta pregunta tiene respuesta: ese día el fundador movió la base y la aplicación de US West (California) a EU West (Ámsterdam). Consta en el ticket; ninguna sesión ve el panel de Railway. La otra mitad, el DPA de Railway, sigue sin localizar. Dónde está el dato en reposo no contesta si hay transferencia: eso va al asesor.**]**

**Nota 2 — al final de la línea 74 (dentro de la última celda):**

> **[Nota del 13-oct-2026, SCRUM-1533:** esta fila es del 23-jul-2026. Desde el 30-sep-2026 la política publicada nombra a Google (Gemini) y no a Anthropic (SCRUM-1154), y el programa llama a Gemini si tiene su clave y a Anthropic sólo si no la tiene. Qué clave hay en producción no está medido.**]**

**Nota 3 — al final de la línea 86 (cierra el párrafo «(b) Resumen»):**

> **[Nota del 13-oct-2026, SCRUM-1533:** la lista de seis es del 23-jul-2026. La política publicada nombra además a Cloudflare y a Google (Gemini) desde el 30-sep-2026, y esta tabla no tiene fila para ninguno de los dos.**]**

**Nota 4 — al final de la línea 320 (cierra la pregunta 5):**

> **[Nota del 13-oct-2026, SCRUM-1533:** la lista del paréntesis es del 23-jul-2026. A día de hoy la política publicada marca como transferencia internacional a Meta, Resend, Cloudflare y Google (Gemini). Railway, que no estaba en esta lista, aloja desde hoy en EU West (Ámsterdam). La pregunta sigue abierta para los cuatro, y para Railway, Anthropic, Stripe y Mercado Pago no está medido si hace falta algo.**]**

**Una quinta que dejo a decisión, porque está pegada a la política:** al final de la línea 204 (la que
cierra el párrafo de después del bloque, no la 201), una nota que diga sólo que el bloque de arriba es
el texto del 23-jul-2026 y que el que vale es `public/privacidad.html`. No propongo literal: si se
quiere, se pide.

Lo que **no** propongo: ninguna nota en `ENVIO_ASESOR_2026-09-28.md` (es lo que se envió ese día), ni en
`DECLARACION_RESPONSABLE.md` (fiscal, y no dice región), ni en los registros de `docs/master/` que dicen
«US West» (SCRUM-728 y SCRUM-863: son mediciones fechadas, y eran ciertas).

## Para la llamada con el asesor: lo que el repositorio permite decir

- **Sí:** la base y la aplicación están desde hoy en EU West, según el fundador. **Como hecho de
  infraestructura, y nada más.**
- **No:** que con eso «los datos están en la UE». WhatsApp (Meta), el correo (Resend), todo el tráfico
  web (Cloudflare) y los textos, dictados y fotos de tickets que van a la IA (Google) siguen saliendo
  igual que ayer, y la propia política lo dice.
- **Lo que hay por escrito de esos cuatro:** nada guardado. El documento lo reconoce desde julio.
- **Lo que falta preguntar y no está en la pregunta enviada el 28-sep:** el alojamiento (Railway)
  nunca estuvo en la lista; Cloudflare tampoco; y la IA que se nombra en la tabla interna no es la que
  nombra la política.

## Los controles

- **Positivo del censo:** la línea 73 de `RGPD_TRATAMIENTO_DATOS.md` tiene que salir, y sale (1).
- **Positivo sembrado:** un fichero fabricado con una frase de región da 1; quitando la frase, 0.
- **Cero derivado:** dos términos con una letra cambiada dan 0 ficheros.
- **Citas por línea:** el patrón que las busca ve citas de ese tipo a otros documentos de `docs/legal/`
  en más de diez ficheros, así que el «2» de este fichero no es ceguera.
- **Política publicada:** «Anthropic» da 0 líneas en `public/privacidad.html` y «Gemini» da 1 en la
  misma pasada.

## Lo que NO he medido

El traslado en sí. El panel de Railway y sus variables. Staging y dev. Dónde están las copias de
seguridad. Los términos de ningún proveedor (ni Railway, ni Google, ni Meta, ni Resend, ni Cloudflare,
ni Stripe, ni Mercado Pago): no he abierto ninguna página suya. Los 5 ficheros de `docs/legal/` que la
búsqueda no casó. El resto del repositorio fuera de `docs/legal/`, salvo la búsqueda de región. No he
corrido la tanda completa: este PR añade un fichero de `docs/master/`.

## Lo que me salió mal

- La segunda sonda llevaba «localiz» y casó decenas de líneas de «normas localizadas» y
  «geolocalización». Ruido leído y descartado; no cambió el censo.
- Leí la cabecera `x-railway-edge` esperando que dijera la región. No la dice, y lo escribo arriba para
  que nadie la use como prueba.

## Aceptación → dónde se ve

El ticket no trae lista de «Aceptación»; uso sus tres puntos de «Lo que se pide».

| Lo que se pide (literal) | Dónde se ve |
|---|---|
| «Censar qué dice hoy `docs/legal/` sobre dónde viven los datos, dónde está alojado el producto, y qué transferencias internacionales declara. Por fichero y por línea.» | Este fichero, «El censo», tablas A a D. |
| «Separar tres cosas» | Tablas A (cambia), B (sigue) y C (nunca se midió). Y una cuarta que el ticket no pedía: D (caducó por otra causa). |
| «Proponer la redacción de las notas fechadas.» | Este fichero, «Las notas fechadas que propongo». **NO HECHO → aplicarlas:** espera la firma del fundador sobre los literales. |
