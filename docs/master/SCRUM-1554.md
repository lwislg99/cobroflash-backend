# SCRUM-1554 · Puerta de go-live

## 23-oct-2026 · SCRUM-1554g · Las condiciones de TEXTO, contra lo que SIRVE yaqu.app hoy — sólo medida, no toca `puerta.json`

**Medido contra:** `origin/main` = `6c8706daef7399513e69e6872068aa7bed25b760` · 2026-10-23T12:45:52Z (cabecera `Date:` de GitHub al escribir; las medidas, de 12:27Z a 12:45Z)

A9: aviso → cicatriz S0 «En 1554d conté como resuelta la entrada 3 de la puerta con una medida que confirmaba el defecto que la entrada denuncia» — no se pudo comprobar: es la lectura de una columna, y ningún test lee qué significa un veredicto escrito en un registro

S0, equipo de Luis, encargo del orquestador (23-oct). **Producción** = `https://yaqu.app/version` y `/health` →
`6c8706daef7399513e69e6872068aa7bed25b760`, el mismo sha que `origin/main` y que este worktree (12:27:49Z). Sólo GET
públicos y un navegador sin sesión (Playwright); **no he entrado con la cuenta QA**. No se tocó
`docs/go-live/puerta.json`, ningún flag, ningún guard, nada de `src/` ni de `public/`.

### La respuesta corta

1. **Hoy árbol y producción NO discrepan en nada de lo que se lee sin sesión.** Tres sondas independientes:
   **137 de 137** ficheros de `public/` iguales byte a byte a lo servido (quitando dos transformaciones del camino,
   abajo) · `/legal/alcance-beta` con la misma versión en los dos (`ac7349fd0b84`) y el cuerpo contenido entero ·
   el texto VISIBLE renderizado en un navegador, frase por frase.
2. **Desde el censo del 19-oct (1554d), en producción se han arreglado tres condiciones de texto enteras y dos a
   medias:** la **2** (R1–R6), la **7** (las dos frases de `terminos.html`) y la **14** (el subtítulo del héroe,
   ya cerrada en la lista) — y la **3** (el aviso de borrador ya se sirve; los marcadores internos, no) y la **16**
   (el PDF del albarán; lo que queda es del camino de emisión). **En `puerta.json` la 2, la 3, la 7 y la 16 siguen
   `abierta`**: la lista va por detrás de lo que sirve producción.
3. **La pregunta del deshielo: SÍ hubo arreglos dados por hechos en `main` y que producción no servía.** **Entre
   el 20-oct 15:35:37Z y el 23-oct 02:49:24Z no hay NINGÚN despliegue registrado** en GitHub: no fallaron, no
   existen (`gh api …/deployments`, 100 últimos). Así que **R1–R6 + D1** (en `main` el 22-oct 09:18:14Z, #2657)
   y el **PDF del albarán** (22-oct 11:26:01Z, #2675) estuvieron **~17 h 34 min y ~15 h 26 min** «arreglados» en
   el árbol mientras `yaqu.app/legal/alcance-beta` seguía sirviendo «Cobro integrado», «Justificantes de cobro» y
   «soporte por email y WhatsApp». Llegaron a producción con el primer despliegue del deshielo, `f749dee46`
   (`in_progress` 02:49:24Z → `success` 02:52:17Z). **Nadie los dio por cerrados en la lista** —1554f, el 22-oct,
   medía si la puerta estaba completa, no si cada entrada era verdad—, así que el error no llegó a escribirse.
   **Al revés (producción bien y árbol mal): ninguno.**
4. **Dos datos del encargo ya no son ciertos, y gana lo medido:** `terminos.html:79-80` ya NO dice «…documentos
   de cotización y factura…» (dice «YaQu te ayuda a generar documentos de cotización. En España, hasta que se
   active la facturación, YaQu no emite facturas ni ningún otro documento de cobro.»), y el subtítulo VISIBLE ya
   NO promete «te paga — con tarjeta, Bizum o transferencia»: esa frase sólo queda en los bytes de
   `#heroe-f4`, una propuesta con `hidden` (`display: none` medido) y `data-microcopy="PENDIENTE_FUNDADOR"`.
5. **Siguen igual que el 19-oct, y servidas:** 6, 9, 11, 12, 13, 15, 19, 20, 22, 23 (y la 5, que es una firma).
   La **9 ha empeorado en lo que parte**: ahora corta en dos bloques la frase R4 recién firmada.

### Las sondas, y sus controles

| sonda | población | resultado | control |
|---|---|---|---|
| ① `public/` byte a byte (`comparar-public.mjs`) | **137** ficheros de `git ls-files public` en HEAD | 134 idénticos · 3 distintos | los 3 distintos demuestran que la sonda ve diferencias; deshechas dos transformaciones conocidas (`normalizar.mjs`), **los 3 quedan idénticos**: 4 correos de `terminos`/`privacidad` reescritos por la *Email Obfuscation* de Cloudflare, y 103 sellos `?v=` + `__BUILD_ID__` en `dashboard/index.html` |
| ② `/legal/alcance-beta` (`legal.mjs`) | el único documento de `docs/legal/` que se sirve (`git grep readLegalDoc -- src`: `legalPages.routes.ts` y `subscriptions.routes.ts`, los dos `ALCANCE_BETA.md`) | versión árbol `ac7349fd0b84` = versión servida; el HTML renderizado está contenido entero en lo servido | la versión es el sha-256 del HTML: un solo carácter distinto la cambia |
| ③ texto VISIBLE (Playwright, `document.body.innerText`, sin sesión) | `/`, `/terminos`, `/legal/alcance-beta` | por frase, abajo | la frase NUEVA de cada arreglo sale 1 vez (control positivo de que ve la página), y `#heroe-f4` sale 0 en lo visible y 1 en los bytes |
| ④ las mismas frases en tres versiones del código (`frases.mjs`) | `fe65a8b7f` (la producción congelada) · `808af5b44` (el `main` de 1554f) · HEAD | tabla en `docs/master/evidencias/SCRUM-1554g/` | las frases que deben APARECER tras un arreglo pasan de 0 a 1 |

Todo en `docs/master/evidencias/SCRUM-1554g/` (sondas + salidas: `public-vs-prod.json`, `despliegues.txt`).

### La tabla, por condición

**«¿Sigue siendo falsa?»** pregunta si el DEFECTO que describe la entrada sigue presente en lo que sirve producción.
«Árbol» = HEAD (`6c8706dae`); «producción» = lo servido y, donde dice «visible», lo que pinta el navegador.

| # | condición | qué dice el árbol | 🔴 qué dice PRODUCCIÓN | ¿coinciden? | ¿sigue siendo falsa? | vs 1554d (19-oct) |
|---|---|---|---|---|---|---|
| 2 | R1–R6 del documento legal | `ALCANCE_BETA.md`: 0 «Cobro integrado», 0 «Justificantes de cobro», soporte «por email.», 0 «mientras tanto», 1 «no emite … documento de cobro» | visible igual; versión `ac7349fd0b84` | sí | **NO: arreglada en producción** desde el 23-oct ~02:52Z. Sólo queda cómo se PARTE la R4 (es la 9) | **cambió** (6118056b1, #2657) |
| 3 | D1: el aviso de borrador no se sirve; sí 3 [REVISAR ASESOR] y los huecos | aviso en la línea 9, fuera de la cita `>` | visible: 1 «Borrador pendiente de revisión legal…» · 3 «[REVISAR ASESOR» · 2 «[NIF]» · 1 «[fecha]» · 2 «[Nombre…» | sí | **A MEDIAS:** el aviso ya se ve; los marcadores internos y los huecos, también (SCRUM-1551.md §6: D1 «NO arregla» eso) | **cambió a medias** (mismo commit) · y ver el A9 de arriba |
| 4 | P1 con asteriscos sueltos (cerrada) | — | visible: 0 «**», 1 «VERI*FACTU» | sí | no | igual |
| 7 | `terminos.html:48` y `:79-80` en presente | `:48` «…YaQu no cobra por ti y no emite facturas ni ningún otro documento de cobro»; `:80`, la frase del punto 4 de arriba | visible: 0 «emitir facturas y gestionar cobros» · 0 «cotización y factura» · 2 «no emite facturas ni ningún otro documento de cobro» · «Última actualización: 22 de octubre de 2026» | sí | **NO: arreglada en producción** (#2697, 1551d T1/T2, en `main` el 23-oct 02:50:09Z; su despliegue `d09951f48` se creó a las 02:50:14Z, su estado no lo he leído) | **cambió** |
| 8 | el guard de SCRUM-406 no ve `docs/legal` | `tests/scrum406-…` sin commits desde el 19-oct | la frase que se coló ya no se sirve («soporte por email.») | sí | **el síntoma, no; el agujero, sí**: el guard sigue sin recorrer `docs/legal/` | síntoma corregido por R3 |
| 9 | `readLegalDoc` parte las viñetas | `legalPages.routes.ts` sin commits | visible: **5 viñetas partidas** (9 líneas de continuación servidas como `<p>`), y una es R4: «…Hasta ese momento YaQu no emite» \| «facturas ni ningún otro documento de cobro; …» en dos bloques | sí | **SÍ** — y ahora corta una frase firmada | igual (lo que parte, peor) |
| 11 | `index.html` tarjeta «Cobros»: «Tarjeta, Bizum o transferencia» | 1 | visible 1: «Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.» | sí | **SÍ**, con la reserva de 1554d: el valor de Connect no lo he intentado medir (S4 sugiere que la API autenticada contesta cosas de este tipo) | igual |
| 12 | `aria-label` «…de presupuesto a cobro» | 1 | en el DOM servido: «Demostración: de presupuesto a cobro»; la animación acaba en «Firmado» | sí | **SÍ** | igual |
| 13 | llamada final «…sin perseguir presupuestos» | 1 | visible 1 | sí | **SÍ**, si es cierto que no hay clientes reales: eso es un dato del equipo, no medido por mí | igual (era «no pude mirar») |
| 14 | subtítulo del héroe (cerrada el 23-oct) | héroe visible: «…Y llevas clientes, gastos y albaranes en el mismo sitio.»; 0 «gastos y facturas» | visible: esa frase 1 vez; «te paga» 0 visibles, 1 en bytes (en `#heroe-f4`, `hidden`) | sí | **no, en lo visible.** En la producción congelada (`fe65a8b7f`) «te paga — con tarjeta» salía 2 veces, una visible: hasta el despliegue `809527fa6` del 23-oct 10:07:53Z el dato del encargo era verdad | **cambió** (8b069ba50, #2711) |
| 15 | bot «¡Estás al día! No tienes ningún pago pendiente con…» | `botFlow.service.ts`, la cadena 1 vez | no se ve por GET; el código que corre es el del árbol (mismo sha) | sí, por sha | **SÍ** | igual |
| 16 | fechas impresas del albarán en UTC | PDF: emisión, ejecución y «Firmado el» en la zona del negocio (`albaranPdf.service.ts:144`, `:379`) | corre ese código (sha contiene `15a844f0e`) desde el 23-oct ~02:52Z. **No observable en vivo:** la cuenta QA tiene `timezone: null` (medido por S4 hoy) y a esta hora UTC y Madrid dan el mismo día | sí, por sha | **lo de «entra el primer cliente», no.** Quedan el concepto de la factura (`albaranes.routes.ts:1349`, `:1601`, sin `timeZone`) y el sello «(hora del servidor)»: los dos FA, camino de emisión, fuera de 1445 a propósito | **cambió a medias** (#2675) |
| 19 | textos del albarán y del libro registro | `libroRegistroView.js` sin commits | servido = árbol (sonda ①) | sí | **SÍ** | igual |
| 20 | Stripe en inglés, `connect.routes.ts:70` | sin commits; antepone `err?.message` | no observable sin Connect | sí, por sha | **SÍ** (con el matiz de 1554d) | igual |
| 22 | «Trabajos CSV» sin año | `exportView.js` sin commits | servido = árbol | sí | **SÍ** | igual |
| 23 | `sendInvoiceEmail` dice «ok» sin proveedor | `email.service.ts` sin commits | corre el mismo código | sí, por sha | **SÍ** (STOP del fundador) | igual |
| 5 | cinco marcas «aprobado» sin firma que conste | el JS servido = árbol | — | sí | es una FIRMA, no un texto: no se mide aquí | no re-medido |
| 6 | la oferta founding enseña el iframe de cobro con OFF | `plansView.js` y `founding.ts` sin commits | servido = árbol; **no lo he intentado con sesión** | sí | **SÍ** por código. S4 midió hoy que la cuenta QA (merchant 46) está en `receipt`: con ella se puede ver en pantalla | igual |
| 1 · 10 · 17 · 18 · 21 | firma en bloque · cicatrices · sellado · preguntas fiscales · claves de BD | — | no son texto servido | — | no medidas en este tramo | — |

**Recuento sobre las 17 que 1554d dio «igual que el día que se apuntaron»** (1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 14,
15, 16, 19, 20, 22, 23): hoy **3 arregladas en producción** (2, 7 y 14; la 14 ya cerrada en la lista, la 2 y la 7
no), **1 a medias** (16), **1 con el síntoma corregido y el agujero abierto** (8) y **12 igual** (1, 5, 6, 9, 10,
11, 12, 15, 19, 20, 22, 23): 3 + 1 + 1 + 12 = 17. Y la **3**, que 1554d contó entre las verdaderas, estaba abierta
(A9 de arriba) y hoy está a medias.

### Lo que este tramo NO dice

- Que la variable global `INVOICING_ES_ENABLED` esté en OFF. S4 midió `"modoEmision": "receipt"` en el merchant 46:
  vale para ESE merchant, porque `merchants.flags` manda sobre el entorno (`src/core/flags.ts`).
- Nada del panel con sesión, ni del bot: ahí «coinciden» quiere decir «mismo sha», no «lo he visto».
- Por qué no hubo despliegues entre el 20-oct 15:35Z y el 23-oct 02:49Z: sólo que **no consta ninguno**.
- Cloudflare reescribe `hola@yaqu.app` en `terminos` y `privacidad`: con JavaScript se lee bien (medido: 1 visible,
  0 «email protected»); un lector sin JavaScript ve «[email protected]». No es una condición de la puerta.

### Hallazgos de otros carriles (sin tocar)

- `#heroe-f4` (`public/index.html:517-522`, J3): la propuesta oculta todavía promete «te paga — con tarjeta, Bizum
  o transferencia». Si alguien la enciende, la 14 vuelve.
- `puerta.json` (sin dueño; S5 la pide): la 2 y la 7 se pueden cerrar con el sha de su merge; la 3 y la 16, partir.
  Es la firma del fundador; aquí sólo se mide.

## SCRUM-1554b · Los 57 que «esperan al fundador», por tipo de decisión: 27 esperan de verdad, 27 ya no hace falta decidirlos, 3 están aparcados en esta misma puerta

**Medido contra:** `origin/main` = `76c29b57c871584b04c8206c11571f9c56c9d699` · 2026-10-14T07:02:30Z

A9: aviso → A10 «La lista que decide qué se mira es la única que nadie mira.» — no se pudo comprobar: las etiquetas viven en Jira y no en el árbol, ningún test del repositorio puede leer Jira, y saber si una decisión «ya está tomada» es leer un literal, no contar algo

Sesión `jv-j4f` del equipo de Javier, carril `area-j3` (auditoría), por encargo de su orquestador
(`cobroflash-backend-2e`). El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1549); se construyó con la orden
escrita del orquestador. **Es LECTURA:** no se ha tocado ninguna etiqueta, comentario ajeno ni transición en
Jira, ni `src/`, `public/`, tests, guards o workflows. Entran este registro y `docs/master/evidencias/SCRUM-1554b/`.

### 0 · La respuesta corta

| Veredicto | Cuántos |
| --- | --- |
| 🔴 **ESPERA una decisión** (de él o de otro: ver la columna QUIÉN) | **27** |
| ✅ **YA NO HACE FALTA DECIDIRLO**: hay un literal suyo citado, o se quedó sin objeto. La etiqueta miente | **25**, más **2** dudosos (524, 1109) = **27** |
| 🚪 **APLAZADO A ESTA PUERTA**: espera su firma, pero el 14-oct él dijo que no se le pregunta hasta el go-live | **3** (1502, 1551, 1554) |
| NO SE DEJA RESUMIR / NO PUDE MIRAR | **0** |

**Población:** consulta `project = SCRUM AND statusCategory != Done AND labels = "equipo-javier" AND labels IN
("decision-jefe","fundador","sin-firma","stop-fundador")`, re-medida hoy: **57** (`totalCount` 57,
`hasNextPage: false`). La foto con las etiquetas está en `evidencias/SCRUM-1554b/foto-jira-57-2026-10-14.tsv`.
**Se clasificaron los 57.**

**Los 27 que esperan de verdad, por tipo:**

| Tipo de decisión | Cuántos | Cuáles | ¿Le toca a él? |
| --- | --- | --- | --- |
| **Algo que solo puede hacer o contestar él** (hablar con el asesor, la SL, Railway o Resend, dónde viven las preguntas) | 4 | 1264 · 143 · 1115 · 1316 | sí |
| **STOP fiscal** (regla 40, el camino de emisión) | 4 | 1129 · 1240 · 1260 · 1314 | sí; 1314, además, después del asesor |
| **Espera a un tercero** (el asesor), no a él | 2 | 142 · 825 | solo mandar la pregunta: está dentro de 1264 |
| **STOP de dinero o de canal** (Mercado Pago, regla 28, escrituras que fallan en silencio) | 3 | 1449 · 1509 · 1508 | sí |
| **Elegir entre opciones de producto ya medidas** (qué ve el Técnico, el límite del trial) | 2 | 1403 · 1406 | sí |
| **Firmar un texto** | 1 | 1132 | sí |
| **Cambio de máster** | 1 | 1499 | sí |
| **Cómo trabaja el equipo** (CI, guards, puerta de sesiones, esquema sin fuente) | 10 | 1549 · 1393 · 1387 · 1498 · 1310 · 1501 · 1410 · 1506 · 1510 · 1511 | **solo 6.** 1510 y 1511 los decide el orquestador o un jefe; 1506 es de S5 (equipo de Luis); 1410 no está maduro (antes hay que medir) |

### 1 · Qué cuesta no decidir: lo que ordena la lista

De mayor a menor coste. Solo los que bloquean algo; el resto «puede esperar» (columna COSTE del §3).

1. **SCRUM-1264: mandar las preguntas al asesor.** Es la que más bloquea. La fecha la puso él: c.17682
   (1-oct), «3-Cita con el asesor en las proximas dos semanas», que **vence el 15-oct**. Antes de mandarlas
   quedan cuatro decisiones suyas «SIN TOMAR» (c.17456). De su respuesta dependen **1129, 1240, 1314, 1316, 142
   y 825**, y la política F2 de 1258.
2. **SCRUM-143: la SL.** Sin ella, SIF-1 no llega a 8/8 «por mucho código que se escriba» (c.17681). La fecha
   también es suya: «2-SL a lo largo de este mes» (c.17681). Arrastra a 870 en el go-live.
3. **SCRUM-1115: el remitente del correo.** **Pasa hoy, en producción:** todo correo sale como «PresuFácil
   <noreply@presufacil.online>» (c.17376, leído en Railway). No es «será falso al lanzar»: ya es así.
4. **SCRUM-1549: la puerta de sesiones, muerta desde el 28-sep.** Todas las sesiones arrancan «SIN IDENTIDAD»,
   y esta también. Arrastra a 1506 (la cerradura de carril depende de la mesa).
5. **SCRUM-1509 + 1508: las mismas salidas A–E.** Bloquean el go-live por la regla 28: el máster promete un
   «tope duro» de plantillas que no existe (c.18897).
6. **SCRUM-1129 + 1240: el mismo sitio del mismo fichero.** Mientras no se decidan, el registro de la AEAT diría
   `01` donde el libro dice «caja». Se despachan juntos. Bloquean el go-live fiscal.
7. **SCRUM-1316: tiene fecha, el 1-dic-2026** (el IVA del 10 % ligado al medio de pago).

### 2 · Hallazgos

- **La etiqueta miente en 25 de 57** (más 2 dudosos): la decisión ya está tomada, con su literal, y la etiqueta
  sigue puesta. Son 534 · 612 · 870 · 998 · 1016 · 1022 · 1023 · 1106 · 1116 · 1247 · 1253 · 1257 · 1258 · 1304 ·
  1319 · 1330 · 1341 · 1346 · 1347 · 1390 · 1402 · 1404 · 1405 · 1497 · 1552. **No se ha tocado ninguna** (A13).
- **Decidido y sin aplicar, que no es una decisión sino trabajo:**
  - **1016**: el titular está firmado desde el 23-sep (c.16564) y `public/index.html:6` todavía sirve
    «Del presupuesto al cobro».
  - **1347**: firmado el 1-oct («1-Sí firmo») y `docs/YAQU_MASTER.md:670` todavía dice «productos crear-ver ✅ ✅»
    para el Técnico.
- **La etiqueta dice «fundador» y quien decide es otro, en 7 de los 27:** el asesor en 142 y 825; el
  orquestador o un jefe en 1510 y 1511; S5 (equipo de Luis) en 1506; en 1410 antes tiene que medir una sesión;
  y en 1498 decide S5 con el fundador.
- **No se encontró ninguna que conste SOLO en la etiqueta:** las 27 tienen la decisión escrita en la
  descripción o en un comentario. Dos la tienen solo en la descripción, sin ningún comentario: 1499 y 1501.
- **1387**: lo que pedía la etiqueta está decidido (c.18016, c.19383). Lo que queda es una pregunta NUEVA
  (c.19527, 14-oct: si el meta-guard pasa a ser obligatorio) que consta escrita, pero **no consta que se le
  haya hecho**.
- **870 y 1506 llevan también `equipo-luis`.** Entran en la consulta porque tienen las dos etiquetas.
- **Dos de los 57 cuentan como «ya no hace falta» y solo son DUDOSOS:**
  - **524**: lo resolvió el código al construir (`sif.cola.ts:17`, `:128-129`), sin un literal suyo que apruebe
    esa forma.
  - **1109**: «ya está montada» se deduce de un registro del 25-sep (SCRUM-1114.md); no se comprobó que la
    tarea siga corriendo.

### 3 · Los 57, uno por uno

Leído por cuatro lectores (subagentes, de 14 o 15 tickets cada uno), con una regla fija: veredicto solo con
cita (`c.<id>` con su fecha, o `fichero:línea` de `76c29b57c`). «Literal suyo» quiere decir que el texto lo
atribuye al fundador. ⚠️ La cuenta de Jira no dice quién escribe, y casi todos los literales los transcribe un
orquestador (§5).

#### 3.1 · ESPERA (27)

| Ticket | Tipo | Qué tiene que decidir | Dónde consta | Quién | Coste de no decidirlo |
| --- | --- | --- | --- | --- | --- |
| 1264 | SOLO-ÉL | Cuatro cosas antes de mandar las preguntas al asesor: quién escribió las «ASESOR» del 23-sep; si se mandan también las que respondió una IA; si se repite la del Convenio 017; si algún profesional real recibió un justificante. Y pedir la cita | c.17456 (29-sep) «Cuatro decisiones de Javier, antes de enviar — SIN TOMAR»; c.17682 (1-oct) plazo de dos semanas | él, después el asesor | vence el 15-oct. Bloquea 1129, 1240, 1314, 1316, 142, 825 y la F2 de 1258. Hay dos versiones vivas de las preguntas (31 aquí, 35 en su documento, según 1316 c.18758) |
| 143 | SOLO-ÉL | Constituir la SL, sacar el certificado de representante y tramitar el Convenio 017 (el Modelo A ya está decidido) | c.17681 (1-oct) «2-SL a lo largo de este mes» | él (y Luis, como socio) | sin la SL, SIF-1 no llega a 8/8 y no hay go-live fiscal. Arrastra a 870 |
| 1115 | SOLO-ÉL | Verificar yaqu.app en Resend, cambiar `EMAIL_FROM` en Railway y firmar el remitente | c.17376 (28-sep) «EMAIL_FROM = PresuFácil …»; c.17374 «parece Luis» (dominio y cuenta) | él, y probablemente Luis | **hoy en producción**: los correos salen con la marca vieja desde otro dominio («se parece mucho a un fraude», c.16977) |
| 1316 | SOLO-ÉL + TERCERO | Dónde viven las preguntas al asesor (el repo o su documento), y mandar la E6 sobre el IVA del 10 % según el medio de pago | c.18758 (7-oct) «Decidir dónde viven es del fundador» | él, después el asesor | tiene fecha: 1-dic-2026 (RDL 29/2026, sin convalidar) |
| 1129 | STOP-FISCAL | De dónde sale el régimen de IVA de cada profesional (un campo nuevo con su pregunta en el alta, o deducirlo de lo que ya hay) y el GO para tocar el builder | c.17405 (28-sep) «Faltan dos cosas, y ninguna es construible hoy» | él (y el asesor, para la clave 18) | todo registro sale como `01` (`registro.builder.ts:313`, `:328`, re-medido). Bloquea encender lo fiscal en ES. Va junto con 1240 |
| 1240 | STOP-FISCAL | GO para que el builder ponga caja (`07`) en cada operación, y la firma de la mención «régimen especial del criterio de caja» en el PDF | c.17410 (28-sep) «también hace falta un texto firmado … Sigue siendo STOP de regla 40» | él (y el asesor, B6) | el libro registro diría «caja» y la AEAT `01`. Va junto con 1129 |
| 1260 | STOP-FISCAL | La rama que todavía escribe `type 'JUST'` y ya no se puede alcanzar: A, retirarla; B, dejarla como red | descripción «Necesita GO expreso del fundador»; sin comentarios | él | nada: puede esperar. Se midió inalcanzable (330 combinaciones, 0 «J-») |
| 1314 | STOP-FISCAL / ELEGIR | La anulación sellada sobre una factura que sigue cobrada: A, sellar después del estado; B, un estado nuevo en la Parte L; C, aceptarlo y documentarlo | descripción «Lo que hay que decidir (a)/(b)/(c)»; es la A5 de 1264 | él, después del asesor | se puede alcanzar hoy (`psp.routes.ts:187` queda fuera del flag), aunque no hay profesionales reales |
| 142 | TERCERO | El dictamen P1: cuándo se emite la factura de anticipo y con qué fecha | descripción «NO se construye hasta tener el dictamen de P1»; c.11058 (27-jul) | el asesor | bloquea la factura de anticipo, que hará falta si en el go-live se cobran señales |
| 825 | TERCERO | D5.1, 5.2, 5.3 y 5.5: si P11 vale sin un asesor humano, si el PDF de la F1 lleva NIF y domicilio, y si se construye la F2 | c.17446 (28-sep) «Ok con que el resto lo vea el asesor» | el asesor (D3 es del equipo de Luis) | «Nada de D5 se construye hasta que el asesor conteste» |
| 1449 | DINERO-O-CANAL | Pago con Mercado Pago: A, si se avisa al cliente cuando el pago se rechaza; B, si se mantiene `/pay/mp/<token>`, a la que hoy no lleva ningún enlace | c.18771 (7-oct) «dos decisiones que no son texto» | él | J2 no puede construir las dos páginas. Riesgo bajo hoy |
| 1509 | DINERO-O-CANAL | La salida A–E para el recordatorio de facturas; una salida nueva para el tope de plantillas (deja pasar 10 de 10); y el límite delante del webhook de entrantes | c.18881 (8-oct) «siguen esperando la decisión entre A-E»; c.18897 | él (regla 28) | al llegar el primer cliente: 48 plantillas en 48 h, y que Meta marque la WABA. Bloquea el go-live |
| 1508 | ELEGIR (canal) | `recordAudit` y otras 40 escrituras se tragan su error: salidas A–E. Y antes, quién tiene que mirar `encolado_fallido` | c.18868 (8-oct) «Sin elegir» | él y los jefes; la D es de S1 | las mismas salidas que 1509: se despachan juntos |
| 1403 | ELEGIR | Qué cifras ve un Técnico en la ficha de cliente: A, ninguna; B, solo lo suyo (rótulos nuevos, con firma); C, la ficha ajena no se le abre (pide un ALTER). Y qué pasa con los eventos que llevan el importe en el texto | c.18040 (2-oct); `docs/master/SCRUM-1403.md:22` «pedida (2-oct-2026) y sin contestar» | él | un Técnico puede reconstruir lo cobrado por todo el negocio (1.050 de 1.050). Hoy no afecta a nadie |
| 1406 | ELEGIR | Cuántos usuarios da el plan `trial` (hoy 1), qué pasa con los creados si después contrata Pro, y si eso pasa a constar en el máster | descripción «SIN DECISIÓN TODAVÍA: el fundador ha pedido expresamente que se abra sin ella» | él | hoy nada; cuesta altas en cuanto haya pruebas reales |
| 1132 | FIRMA-TEXTO | Las notas del cliente: firmar 4 literales («Notas», «Sin notas», «Añadir nota», «No se pudo guardar: ») y elegir A (la nota solo en la tarjeta) o B (solo en la cabecera) | c.19538 (14-oct) «Firma de los cuatro literales … y elegir (a) o (b)» | él | la función no existe en pantalla. Lleva cuatro repartos rebotando |
| 1499 | CAMBIO-DE-MÁSTER | `WhatsAppMessage` escribe `inbound` y `received`, que el máster no tiene, y nunca escribe `queued`: A, se amplía el máster; B, se corrige el código | descripción «① Decidir, que es del fundador»; sin comentarios | él | bloquea los comentarios de `schema.prisma:1270`, `:1274` y `whatsappLog.service.ts` |
| 1549 | PROCESO / REPARTO | La puerta de sesiones: A, una sesión por puesto (y el orquestador cambia cómo reparte); B, la puerta aprende a nombrar varias por puesto | descripción «Esto es una DECISIÓN del fundador, no un arreglo» | él (`sesion.mjs` es de S5) | todas las sesiones arrancan sin identidad. Arrastra a 1506 |
| 1393 | PROCESO | Quién vigila `main`: A, una sesión; B, un workflow programado; C, un workflow que salta al acabar cada corrida; D, que Railway espere al CI; E, nada | c.18787 (7-oct) «No elijo»; `docs/master/SCRUM-1393.md:125-133` | él (B y C, además, S5) | en 30 días se sirvieron 21 commits con el obligatorio en rojo |
| 1387 | PROCESO | Si el meta-guard pasa a ser check obligatorio: A, sí; B, sigue informativo | c.19527 (14-oct) «es decisión del fundador … Se deja escrito» | él | 10 mutaciones del #2413 que nadie ha visto correr enteras. ⚠️ No consta que se le haya preguntado |
| 1498 | PROCESO | Si el siguiente commit de `main` tiene que esperar a dos jobs que no son obligatorios: salidas A–D | c.18769 (7-oct) | S5 y él | latencia: 24,8 min de mediana. No bloquea tickets |
| 1310 | PROCESO / esquema | Si se pasa a ficheros versionados el DDL que hoy solo vive en producción (13 de 37 claves ajenas) | c.17665 (1-oct) «La (ii) sigue abierta» | él | «No es urgente, pero cada `db push` la agranda». Bloquea el guard de 1307 |
| 1501 | PROCESO | Qué vigila el guard scrum475: A, solo la estructura; B, también los comentarios (y entonces cuál de los tres sitios manda) | descripción «es una DECISIÓN antes que un arreglo»; sin comentarios | él | bloquea dos líneas de comentario ya firmadas en 1401 |
| 1410 | PROCESO | Cuándo llama a `@claude` el avisador de PR en rojo, y si `claude[bot]` puede rearmar el auto-merge | descripción «Tráelas con su coste; no elijas» | **todavía no es suya**: antes una sesión tiene que medir el ① | `claude[bot]` puede volver a empujar a una rama con una sesión viva |
| 1506 | PROCESO | La cerradura de carril deja pasar a las `jv-jN`: A, que resuelva esos nombres; B, que un nombre que no resuelve sea un error | descripción «Decidid vosotros: el fichero es vuestro» | **S5, equipo de Luis** | depende de 1549 |
| 1510 | PROCESO | Si se arregla el guard scrum205 o se declara su límite | descripción «la decisión, que no es de una sesión»; c.18965 | **el orquestador** o quien sea dueño de 205 | nada: puede esperar |
| 1511 | PROCESO | Un mecanismo para las anclas nuevas del trinquete de firmas: A, solo proceso; B, exigirlo; C, nada | c.18962 (8-oct) «decide un jefe» | **un jefe** u orquestador | nada: hoy, 0 de 15 |

#### 3.2 · YA NO HACE FALTA DECIDIRLO (25 + 2 dudosos)

| Ticket | Qué se decidió | Cita |
| --- | --- | --- |
| 534 | P2 firmado y aplicado (#2415 mergeado) | c.19531 (14-oct) «Ok vamos con tu recomendación»; c.19585 «Ok autorizo» |
| 612 | expediente del justificante completo | c.16184 (21-sep) «las 7 preguntas, contestadas»; #1593 |
| 870 | el productor de pruebas es él (vuelve con la SL, 143) | c.16599 (23-sep) «Sí soy yo el productor de pruebas» |
| 998 | forales: hoy no se hace nada | c.16609 (23-sep) «DECISIÓN DE JAVIER … NO se hace nada hoy» |
| 1016 | titular firmado. ⚠️ **Sin aplicar**: `public/index.html:6` | c.16564 «CANDIDATO 1»; c.16648 «Okey te la firmo» |
| 1022 | la dependencia de .xlsx, autorizada y construida | c.16597 (23-sep) «Sí que entre»; #1786 |
| 1023 | lo sustituyen sus cuatro decisiones del 30-sep (SCRUM-1261) | `docs/master/SCRUM-1261.md`, vuelta 3 |
| 1106 | la retención emitida se aparca | SCRUM-1053 c.16660 «Ok aparca» |
| 1116 | texto del digest firmado y mergeado | c.16979 (25-sep) «TEXTO FIRMADO POR EL FUNDADOR»; #1798 |
| 1247 | firmado por delegación y superado por SCRUM-1154 | c.17425; `docs/microcopy/2026-09-29-SCRUM-1154-encargados-privacidad.md:3-24` |
| 1253 | el justificante se quita | c.17441 (28-sep) «1-Sí quitalo…» |
| 1257 | P1–P8 firmados por delegación | c.17444; c.17676 |
| 1258 | GO dado y construido | c.17705 (1-oct) «1-Ok, Go»; #2048 |
| 1304 | GO dado y construido | c.17639 «4-Go»; c.17704; dentro de #2053 |
| 1319 | autorizado y en main | descripción «5-Sí te autorizo»; #2040 |
| 1330 | GO; en main | c.17724 (1-oct) «1-GO»; #2053 |
| 1341 | la B, y el rótulo firmado | c.17827 «1-Ese esta bien»; #2112 |
| 1346 | el Técnico ve aquello de lo que es autor o lo que tiene asignado | c.17828 «1-Ok la B»; c.17932; c.17952 |
| 1347 | firmado. ⚠️ **Sin aplicar**: `YAQU_MASTER.md:670` | descripción «1-Sí firmo» |
| 1390 | las tres, firmadas | c.17962 «1-Sí» · «2-Ok firmo» · «3-El admin conserva sí» |
| 1402 | la A | c.18019 (2-oct) «1-Ok A»; #2222 |
| 1404 | GO, mientras no haya facturas reales | c.19293 (13-oct) «GO, no hay facturas reales en producción» |
| 1405 | la salida C (pendiente de construir) | c.19584 (14-oct) «Ok la C» — contrastado |
| 1497 | Canarias y forales: no por ahora | descripción «No de momento dejamos Canarias sin hacer» |
| 1552 | reglas 43 y 44 en el máster (#2422). Sigue abierto, sin dueño, quién escribe la línea de la 44 | c.19550 «En la que estimes conveniente» |
| 524 *(dudoso)* | «aceptado con errores» lo resolvió el código, sin un literal suyo | `src/modules/fiscal/verifactu/sif.cola.ts:17`, `:128-129` |
| 1109 *(dudoso)* | «Vamos con el 3»; que esté montada se deduce del 25-sep | descripción; `docs/master/SCRUM-1114.md` |

#### 3.3 · APLAZADO A ESTA PUERTA (3)

| Ticket | Qué espera | Cita |
| --- | --- | --- |
| 1551 | R1–R6 y la D1 del documento legal servido | c.19547 (14-oct) «en la puerta de go-live (SCRUM-1554), no en la mesa del fundador» |
| 1502 | si reconoce las 5 marcas «aprobado por el fundador» que no constan: es la fila 5 de la tabla de esta puerta. ⚠️ Le queda además una decisión de proceso que **no** está aplazada: `sinCitas` en `tests/_respaldo-de-firma.mjs`, «lo decide un jefe» (c.18797) | c.19543 (14-oct); descripción de SCRUM-1554, fila 5 |
| 1554 | cuándo es la revisión de go-live, y si la lista lleva un mecanismo | descripción «Lo que falta decidir, y es del fundador — EN LA REVISIÓN, no ahora» |

### 4 · Los controles

| Control | Esperado | Salió |
| --- | --- | --- |
| 🔴 POSITIVO a ciegas · SCRUM-1050 en el lote A. No está entre los 57; SCRUM-1553 lo dio por decidido (c.16593) | YA NO HACE FALTA | **YA NO HACE FALTA**, c.16593 ✅ |
| 🔴 POSITIVO a ciegas · SCRUM-1246 en el lote B. No está entre los 57; SCRUM-1553 lo dio por YA ESTÁ | YA NO HACE FALTA | **YA NO HACE FALTA**, «1-Okey la dejamos en firma» ✅ |
| NEGATIVO del censo de la casa · SCRUM-9999, en la misma pasada | NADA EN MAIN | NADA EN MAIN ✅ |
| ¿Este registro absuelve alguna marca? Contiene «aprobado por el fundador», así que el índice de `_respaldo-de-firma.mjs` lo cuenta como fuente que atribuye | lo mismo con él que sin él | `porNivel()` de scrum921c, con él y sin él: documental 24 · sin-respaldo 27 en las dos pasadas ✅. ⚠️ Sin control positivo sembrado: no se ha comprobado que esta comparación sepa ver una absolución |
| Contraste mío de cuatro citas de los lectores | lo que dicen | 1405 c.19584 «Ok la C» ✅ · 1116 c.16979 ✅ · `registro.builder.ts:313`/`:328` con `CLAVE_REGIMEN_GENERAL` ✅ · `YAQU_MASTER.md:670` sin corregir ✅ |

**El censo de la casa, reusado sin escribir otro:** `node docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs
--jira <foto> --ref 76c29b57c…` salió con código 0 en 2 min 55 s: **39 ALGO EN MAIN · 18 NADA EN MAIN · 0 NO HE
PODIDO MIRAR**. Está entero en `evidencias/SCRUM-1554b/tabla-ya-esta-76c29b57c.md`. ⚠️ «ALGO EN MAIN» no
contesta la pregunta de este encargo, que es si queda una DECISIÓN pendiente. Eso solo lo dice leer el texto.

### 5 · Lo que NO contesta, y los errores míos

- **Casi todos los literales «del fundador» los transcribe un orquestador** bajo la cuenta de Javier. Se
  contaron como decisión tomada cuando el texto se los atribuye a él, como pedía el encargo, pero ninguno es
  de su puño (lo marcó el lector B).
- **Si las decisiones fiscales (1129, 1240) quedan aparcadas por esta puerta.** No son textos falsos sino
  defectos de emisión, y la puerta no los lista: se quedan en ESPERA.
- **No se miró:** si 1507 (S1) construyó ya la pieza (b) de 1509; si 1346 y 1390 midieron lo que dejaban
  abierto; si la tarea de 1109 sigue corriendo; si yaqu.app se verificó en Resend después del 28-sep (1115).
- **Error mío:** a los lectores les di un vocabulario de tipos para que las filas casaran. Eso empuja a encajar
  en esas casillas, que es justo lo que el encargo pedía no hacer. Los lectores usaron `OTRO:` tres veces, en
  524, 1022 y 1316, y en la tabla final he fundido esas filas con los tipos vecinos. **Los grupos son míos y
  no han salido de los datos a ciegas.**
- **Error de los lectores, cazado al cruzar:** el lector D dio 1502 por ESPERA sin ver que sus cinco marcas
  son la fila 5 de esta misma puerta. El lector A dio 524 por «ya no hace falta» con solo el código; lo he
  bajado a dudoso, porque el código que lo cumple no puede ser a la vez el que firma la condición.
## 22-oct-2026 · SCRUM-1554f · ¿Está COMPLETA la puerta? Censo de lo que falta — PROPUESTA, no toca `puerta.json`

**Medido contra:** `origin/main` = `808af5b4466d2649a1006d4c554d1f22e7eba47c` · 2026-10-22T10:15Z (`Date:` de
`gh api -i zen`). S0, equipo de Luis, por encargo del orquestador. Sólo lectura: no se ha tocado `puerta.json`,
ni su test, ni `.claude/carriles.json`, ni ninguna etiqueta de Jira. **El contenido de la puerta lo firma el
fundador; esto es una propuesta.**

> Este tramo va ARRIBA, no al final, a propósito: 1554d y 1554e añaden al final de este mismo fichero en la
> rama `scrum-1554e-redactar-17-y-18`, que aún no está en `main`. Escrito arriba, las dos ramas se unen sin
> conflicto (A17: no se apila).

A9: sin fallo que generalice — los tres falsos positivos por subcadena del cruce se cazaron leyendo cada entrada antes de escribir, y quedan dichos abajo

### La respuesta corta

**La puerta NO está completa, y el motivo no son entradas sueltas: mide otra cosa.** Por su definición
(regla 43, descripción de SCRUM-1554) es la lista de **lo que hoy es FALSO porque aún no está construido**
—textos, promesas—. Pero `puerta.json` se presenta como «lo que tiene que ser verdad antes de encender
`INVOICING_ES_ENABLED`», y para eso le falta **la condición que el propio máster pone a ese interruptor**:
SIF-1 v2 con las 8 en ✅ (Parte P, fila del flag; U1.3, «Solo con 8/8 ✅»; regla 24; B2.1). **Ninguna de las 23
entradas la nombra.**

- **De lo que ya mide (falsedades de texto):** no he encontrado ningún hueco nuevo de esa clase fuera de los ya
  conocidos (`terminos.html:79-80`, de 1554d). Eso NO quiere decir que no los haya: no he barrido textos.
- **De lo que dice medir (condiciones previas al interruptor):** **9 que faltan**, más 1 que el instrumento no
  puede ver (el valor real del flag en producción). Las piezas fiscales sueltas (declaración responsable,
  productor, asesor, AEAT) ya viven en otra lista —U1.3 del máster— y se cubren con UNA entrada (F1) que la cite.

### Cómo elegí la población (y qué NO miré)

**Jira**, cuatro consultas, todas con su recuento devuelto por la propia API (`searchResultMode: all`):

| consulta | recuento | qué trae |
|---|---|---|
| `labels = "go-live"` (todas, abiertas y cerradas) | **2** | SCRUM-1554 (la propia puerta) y **SCRUM-1566** |
| `labels in ("puerta", "golive", "go_live", "antes-sif1", "antes-de-sif1", "pre-sif1", "sif-1", "sif1", "bloquea-go-live", "go-live-bloqueante", "lanzamiento")` | **27** | 5 de **ROAD** con etiqueta `puerta` (ROAD-4, 5, 6, 12, 19) y 22 con `sif-1` (13 abiertas) |
| `labels in ("parado-hasta-go-live", "hasta-go-live", "antes-go-live", "pre-go-live", "go-live-pendiente", "bomba-con-fecha")` | **5** | SCRUM-1028 (`parado-hasta-go-live`), 1226, 1258, 1316, 1330 |
| texto: `"go-live"`, `"puerta de go-live"`, `"antes de SIF-1"`, `"antes de encender"`, `"primer negocio/cliente/merchant real"`, `"primer euro"`, `"INVOICING_ES_ENABLED"` en resumen, abiertas | **12 + 14 + 10** (con solape) | SCRUM-41, 143, 523, 534, 665, 678, 870, 1016, 1028, 1236, 1509, 1536, 1551, 1552, 1573… |

⚠️ **La etiqueta `go-live` no es una población:** sólo la llevan 2 tickets, y uno es la propia puerta. Las
etiquetas de esta casa no se eligen de un vocabulario cerrado (SCRUM-1554b ya midió que «la etiqueta miente en
25 de 57»), así que las variantes de arriba son **las que se me ocurrieron**: una etiqueta con otro nombre no
sale. Lo que sale con `labels in (…)` de una etiqueta que no existe es 0, igual que una que existe y está vacía.

**Máster** (`git show origin/main:docs/YAQU_MASTER.md`): reglas 7 de CLAUDE.md, 17, 18, 24, 25, 26, 28, 29, 32
y 33 de la Parte I; B2 (checklist regulatorio España); la fila de `INVOICING_ES_ENABLED` de la Parte P; la
**excepción The Pioneer** (Parte P); y U1.3. **CLAUDE.md:** los siete STOP.

**NO miré:** los textos servidos (landing, panel, PDFs, bot) en busca de falsedades nuevas · el cuerpo de
SCRUM-1264 (la lista del asesor) · el estado real de cada ticket candidato en `main` más allá de un
`git log --grep` (se dice en cada fila).

### El instrumento, y sus controles

El cruce condición → entrada es `cruce-puerta.mjs` (en el temporal de esta tanda, no en el repo): busca las
claves de cada condición (números de ticket y palabras) en `que`, `de_donde`, `consta_en` y `condicion` de las
23 entradas.

- **Controles positivos, los tres encontrados:** SCRUM-1558 / `sendInvoiceEmail` → **23** ✔ · SCRUM-418 →
  **21** ✔ · «Cobro integrado» → **2** ✔.
- **Control negativo:** una clave inventada → **0** ✔.
- Salida: `población: 23 entradas · condiciones: 26 (4 de control) · fallos de control: 0 · EXIT=0`.
- 🔴 **El instrumento da falsos positivos por subcadena, y los he quitado A MANO leyendo la entrada:**
  `scrum-41` casaba con la 21 (es `scrum-418`) · «llamada» casaba con la 13 (es «llamada final» de la landing,
  no la llamada al Pioneer) · «asesor» casaba con la 3 (es «[REVISAR ASESOR]» del documento legal, no las
  respuestas de SCRUM-1264). **Un «casa» de este cruce no es un «está»: se lee.**

### 1 · Etiquetados frente a la puerta (las dos direcciones)

**Etiquetados que NO están:** **SCRUM-1566** (`go-live`), confirmado: ni su número ni «céntimo» ni «redondeo»
aparecen en las 23. Y, con etiqueta equivalente, **ROAD-6** (`puerta`: «Copia de seguridad probada, no solo
configurada»), que es exactamente el hueco del respaldo que midió S5. ROAD-4 (la SL), ROAD-5 («Hacienda
resuelta»), ROAD-12 y ROAD-19 son puertas **de negocio** de otro proyecto (ROAD-12 y 19 son posteriores al
primer negocio, por definición). **SCRUM-1028** (`parado-hasta-go-live`) sí está, sin su número: es la misma
materia que la entrada 2 (SCRUM-1551).

**Entradas sin ticket propio:** **18** («no lo dice el comentario»; 1554e lo encontró: SCRUM-619, 623, 624) ·
**19** («no lo dice el comentario»; 1554d lo encontró: SCRUM-1428 c.18325) · **20** (sólo una ruta de fichero) ·
**10** (apunta a la propia SCRUM-1554). Las otras 19 citan un ticket de origen.

### 2 y 3 · Las condiciones que faltan, en la tabla

«¿En la puerta?» es el cruce de arriba **leído**. «¿Etiqueta?» es si el ticket lleva `go-live` o una de las
equivalentes de la población. «De quién» sale de las etiquetas de área del ticket; donde no hay ticket, del
máster.

| # | condición | ¿en la puerta? | ¿ticket con etiqueta? | cómo se mediría | de quién sería |
|---|---|---|---|---|---|
| F1 | **SIF-1 v2 con las 8 en ✅** (S1-0…S1-H). Es LA condición del interruptor en la Parte P, U1.3 y la regla 24. Hoy U1.3 dice S1-D 🟡, S1-E 🟡, S1-F ⏳, S1-G ⏳, S1-H 🟡 | **NO** | sí, `sif-1` en sus piezas (13 abiertas); ninguna `go-live` | la línea de resumen de SIF-1 (U1.3) del máster con las 8 en ✅; SCRUM-1323 ya construye el guard que impide que resumen y detalle se contradigan | fundador + equipo de Javier (J1); la entrada la escribe quien mantenga la puerta |
| F2 | **1566 · base + IVA = total** (22,50 € al 21 % da 4,72 y no 4,73; sale en la `CuotaTotal` del XML) | **NO** | **sí, `go-live`** | un test que, para 22,50 € al 21 %, espere cuota 4,73 y base + cuota = total | J1 (`area-j1`), con STOP del fundador |
| F3 | **Regla 29 · una factura sellada no se re-sella** (SCRUM-1330) | **NO** | `sif-1`, `bomba-con-fecha` | `tests/scrum1330-una-sellada-no-se-resella.test.mjs` existe en `main` y el PR #2053 entró; Jira la tiene «En curso». **No lo he corrido**: si ya está, la entrada nace cerrada | J1 |
| F4 | **Regla 29 · el PDF de una emitida no se regenera con el código y los datos de hoy** (SCRUM-665) | **NO** | ninguna | hay `tests/scrum665a/b/e-…` en `main`; Jira «En curso». Se mide con el PDF de una emitida servido igual antes y después de cambiar los datos del negocio | J1 |
| F5 | **Regla 28 · los recordatorios de cobro respetan J6** (SCRUM-1509; 1508). Con el interruptor en OFF no hay recordatorios (regla 24): **encenderlo es lo que los despierta**. 1554b ya escribió que «bloquean el go-live» | **NO** | `stop-fundador`; ninguna `go-live` | el caso de 1509 (escritura que falla en silencio → 48 plantillas en 48 pasadas) devuelve 1 | J2 (`area-j2`) |
| F6 | **Excepción The Pioneer** (Parte P): llamada hecha **y anotada** antes de encender; encendido sólo por la llave `cambiar-flag-fiscal.mjs`, por merchant; **la variable global sin tocar**; caduca el 31-ene-2027. Si el primer negocio real es él, **esta** es su puerta y no la 8/8 | **NO** | ninguno | fila `cambio_flag` en el AuditLog para ese merchant + la nota con fecha de la llamada en el apartado de la Parte P + `INVOICING_ES_ENABLED` sin definir en Railway | fundador |
| F7 | **Copia de seguridad de producción probada** (restaurada, no sólo configurada) | **NO** (S5: 0 coincidencias) | **sí, `puerta` (ROAD-6)** | una restauración con fecha, a una base desechable, con su recuento de filas | fundador (Railway) |
| F8 | **El cierre en ejecución** (mitad B de 1554c): con una entrada abierta, el interruptor no se enciende. Hoy ni `puerta.mjs` ni la llave lo impiden: la llave no lee la puerta (`scripts/cambiar-flag-fiscal.mjs`, sin ninguna referencia a ella) | **NO** | no | interruptor en ON + una entrada abierta → `isFlagEnabled` da `false` (lo que 1554c B ya describe) | S5, con GO del fundador (flag global de la Parte P) |
| F9 | **Regla 33 nueva · el alta excluye forales y Canarias** (SCRUM-1536, decisión del 22-oct, c.20218/c.20225) | **NO** | no | un alta con provincia foral o canaria no crea merchant (test del alta) | equipo de Javier (`area-fiscal`) |
| F10 | **El valor REAL de `INVOICING_ES_ENABLED` en producción** (SCRUM-1097; 1109 lo quería automático) | **NO** | `sif-1`, `stop-fundador` | el guard de 1097 contra producción. ⚠️ **No se puede medir desde un árbol** (SCRUM-418: ningún worktree tiene credenciales de producción) | fundador |

**Lo que he mirado y NO propongo como entrada nueva**, con su motivo:

| condición | por qué no |
|---|---|
| Declaración responsable publicada (regla 17, S1-E, SCRUM-523) · nombre real del productor en el XML (SCRUM-870) · revisión del asesor y anticipos/IVA (S1-F, regla 32) · producción AEAT con una factura real (S1-G) | **caen dentro de F1**: son piezas de las 8. Repetirlas aquí serían dos listas que divergen |
| La SL (ROAD-4, SCRUM-143) | ROAD-4 dice «NO bloquea VeriFactu: hay Modelo C»; lo que sí bloquea (el productor, la vía de colaborador social) cae en F1 |
| Tarjeta sólo con Connect (reglas 18 y 23) | ya está la 11 (el texto «Tarjeta»), y la regla la hace cumplir un flag que está en OFF (`PAYMENTS_CONNECT_ENABLED`) |
| Stripe en live (SCRUM-41) y secretos de webhook (SCRUM-678) | son para cobrar la suscripción a YaQu o la tarjeta, no para el interruptor de facturación. Si la puerta pasa a ser «antes del primer negocio real» en general, entonces sí |
| Guion H2 (regla 26) | la 1 viene de SCRUM-534, que es justo el ticket del H2. No he comprobado si cubre las dos falsedades del H2 o sólo los literales de P2 |
| Privacidad + DPA publicadas antes del primer pagante (B2.4) | hay texto (`public/privacidad.html`; `docs/legal/RGPD_TRATAMIENTO_DATOS.md`, 21 menciones de encargado del tratamiento). **No he medido** si está publicado ni revisado: es una pregunta, no un hueco |
| Plantillas de WhatsApp de factura y recordatorio aprobadas en la WABA de producción (STOP de Meta) | **no medido**: no se ve desde el repo |

### Lo que esto pide decidir (es del fundador, en la revisión)

1. **¿Qué es la puerta: la lista de falsedades (regla 43) o la lista de lo previo al interruptor?** Hoy es la
   primera con el nombre de la segunda. Si es la segunda, F1 es la entrada que falta, y basta UNA que cite U1.3.
2. **¿Quién es el primer negocio real: The Pioneer, con su excepción (F6), o uno cualquiera tras el 8/8 (F1)?**
   Las dos puertas son distintas, y la puerta de hoy no tiene ninguna de las dos.

### Anexo (misma tanda, 10:24Z según Jira, c.20283; pedido por el orquestador) · Las otras puertas: no son dos, son CUATRO

**Población:** ROAD-4, 5, 6, 12 y 19 leídas enteras (descripción, comentarios, autor, fechas); `project = ROAD`
entero (**56** tickets); `project = ROAD AND updated >= 2026-09-01` → **0**, con control positivo: el mismo
proyecto sin el filtro de fecha devuelve 56, y el más reciente es ROAD-56, del 20-ago. En el repo,
`git grep -i "scrum-390"` en `src/ scripts/ tests/ .github/` → 6 ficheros, y se leyeron los dos de `src/`.

**Las cinco de ROAD.** Las creó la cuenta de Javier el **14-ago-2026, entre las 20:27 y las 20:29**. Son
épicas de un plan por etapas (ROAD-1 «Poner la casa en orden», ROAD-2 «El primer usuario», ROAD-3
«Repetirlo»). La última edición de cualquiera de ellas es del 19-ago. Son **de antes de los dos equipos**:
`docs/equipo/` nace el 7-sep (`1e8014a0b`) y `dos-equipos.md` el 18-sep (`5e9096f7a`). Es el mismo caso que
los dos ficheros de `scripts/` sin dueño.

| ROAD | qué exige («Hecho =») | ¿en `puerta.json`? | ¿en algún ticket SCRUM? | estado |
|---|---|---|---|---|
| **4** · La sociedad existe | escritura + CIF + cuenta a nombre de la SL. Dice que NO bloquea VeriFactu (Modelo C), y que la SL hace falta para el Modelo A y para Stripe en live | no | SCRUM-143 (Acción del fundador), SCRUM-870 (el productor espera el NIF de la SL), SCRUM-41 | **sin empezar**, en lo que consta en Jira (los fundadores decidieron reparto y objeto social el 17-ago) |
| **5** · Hacienda resuelta | «respuesta escrita a todas, dada por alguien que responde de ella»: ventana sin VeriFactu hasta enero (contestada el 17-ago), y ABIERTAS la fecha exacta, si YaQu factura al profesional, el IVA de la suscripción, si YaQu toca el dinero, cuántos años se conservan las facturas, el contrato de encargado del tratamiento | no | en parte: SCRUM-1264 (la lista del asesor) y la entrada 18 de la puerta. **No he comprobado** cuáles de las cinco abiertas están en 1264 | **a medias** (1 de 6 contestada) |
| **6** · Copia de seguridad probada | las cuatro: copia automática · se sabe cada cuánto y cuánto se guarda · restaurada en un entorno aparte · escrito quién la restaura y cómo | **no** | **SCRUM-242** (Finalizada, cerrada por una de sus cuatro partes) → **SCRUM-1525** (Por hacer: «la COPIA no se dispara») | **a medias**: según el código, la restauración está probada (§R14, `scripts/backup-restore.mjs`) y la copia no existe. En `src/core/cron/cron.ts`, `.github/` y `package.json` hay **0** referencias a `backup`; el control, `avisarSiEntroClienteReal` en `cron.ts`, sale 3. Si se lanza desde Railway, no se ve desde aquí: **no medido** |
| **12** · Un profesional real ha hecho el ciclo entero | filas en producción de un profesional que no es ninguno de los dos fundadores, con presupuesto → firma del cliente → **factura emitida desde YaQu**, y el cobro fuera de YaQu (redacción del 19-ago, ROAD-37) | no | ninguno | **sin empezar**. 🔴 **No es una condición previa: es el RESULTADO.** Exige que el interruptor ya esté encendido para ese merchant |
| **19** · Usuarios 2 y 3 cobrando sin captación uno a uno | dos profesionales más cobrando, y que la respuesta a «¿cómo se enteró?» no sea «nos lo dijeron» | no | ninguno | **sin empezar**. Es posterior al primer negocio real por definición |

**🔴 La puerta que nadie había nombrado hoy, y que SÍ corre en producción: SCRUM-390,
`src/modules/system/domain/puertaClienteReal.ts`.** La evalúa el cron diario (`src/core/cron/cron.ts:97`) y
se abre sola con dos señales: un merchant con suscripción de Stripe, o más merchants que las
`CUENTAS_DE_PRUEBA_DECLARADAS` (= 13). Al abrirse manda un WhatsApp al fundador con sus cláusulas
(`avisoPuerta.service.ts:26-44`). Son cuatro: la regla fechada de los datos de producción del máster, el
backfill de `MIGRATIONS_PENDING.md`, la microcopy de Bizum de SCRUM-402 y **«SCRUM-242 — hay copia de
seguridad de la base (restaurar ya está probado; la COPIA no existe)»**. ⇒ **El respaldo SÍ estaba en una
puerta: en ésta.** El «0 coincidencias» de S5 es cierto para `puerta.json` y no para el proyecto.

**¿Son la misma lista con dos nombres? No. Son cuatro listas, y cada una salta con otra cosa:**

| lista | qué contiene | qué la dispara | ¿mecanismo? | desde |
|---|---|---|---|---|
| **A** · `docs/go-live/puerta.json` (SCRUM-1554) | textos falsos hasta que esté construido (regla 43) | encender `INVOICING_ES_ENABLED` | un guard de CI que sólo comprueba que la lista está bien formada; la mitad B no está construida | 14-oct |
| **B** · `puertaClienteReal.ts` (SCRUM-390) | 4 decisiones tomadas «mientras no haya cliente real», el respaldo entre ellas | detecta que ha entrado el primer cliente real (paga, o hay más de 13 merchants) | **SÍ**: cron diario + WhatsApp. Avisa, no impide | 9/10-ago |
| **C** · U1.3 del máster (SIF-1 v2, 8/8) | lo fiscal: AEAT, declaración, asesor, evidencias | encender `INVOICING_ES_ENABLED` a reales | ninguno: texto | jun |
| **D** · ROAD, etiqueta `puerta` | hitos de empresa por etapas (SL, Hacienda, respaldo, primer usuario, usuarios 2-3) | ninguno | ninguno; dormido desde el 20-ago | 14-ago |

**Dónde se solapan, medido:** el **respaldo** está en B (cláusula), en D (ROAD-6) y en SCRUM-1525, y **no está
en A**. Lo de **Hacienda** está a la vez en D (ROAD-5), en C (S1-F, el asesor) y en A (la 18). **La SL** está
en D (ROAD-4) y, a través del productor, en C. Fuera de eso no se tocan: ROAD-12 y ROAD-19 son resultados,
no condiciones, y lo que da A (textos) no lo tiene ninguna de las otras tres.

⇒ **No hay que unificar dos listas, ni elegir una de las dos.** Hay **dos instantes** —«entra el primer
cliente real» (B, que salta ANTES si el alta del Pioneer sube el padrón a 14; el padrón de hoy no lo he medido) y «se enciende la
facturación» (A y C)— y **cuatro listas** que reparten condiciones entre ellos sin saber unas de otras. La
decisión que queda es de qué lista cuelga cada condición. Mi lectura, no medida: lo que exige un
mecanismo cuelga de A y B, que lo tienen o lo tendrán, y C y D se citan desde ahí en vez de repetirse.

### Anexo 2 · UNA tabla, por CONDICIÓN — la que sirve para decidir (pedida por el orquestador)

**Población:** las 23 entradas de A (`puerta.json` en `origin/main`), las 10 de 1554f (F1–F10), las 5 de ROAD (D)
y las 4 cláusulas de B (`CLAUSULAS_DEPENDIENTES`, `avisoPuerta.service.ts:26-44`): **42**. Quedan en **40 filas**
porque una condición está en tres sitios: el respaldo es F7, ROAD-6 y la cláusula 4 de B. C (U1.3) entra entera
como F1. «De quién» sale de `node scripts/carriles.mjs de <fichero>` cuando la entrada nombra un fichero (la
ruta real, comprobada con `git ls-files`); si no, de la etiqueta de área del ticket o del máster.

**Las columnas:**
- **Momento** es **MI LECTURA**, no una medida. **CR** = «entra el primer cliente real» (lo ve o lo sufre un
  profesional desde el alta, con el interruptor aún apagado). **FA** = «se enciende la facturación». **—** =
  ninguno de los dos.
- **¿Lo impide algo?** pregunta si hay algo que IMPIDA llegar a ese momento con la condición sin cumplir.
- **¿Lo vigila algo?** distingue «avisa» (B: cron diario + WhatsApp al fundador), «lista» (A: un guard de CI
  que sólo comprueba que la lista está bien formada y que ninguna entrada desaparece) y «nada».

| # | condición | momento | listas | ¿lo impide algo? | ¿lo vigila algo? | de quién |
|---|---|---|---|---|---|---|
| A1 | los 7 literales de P2 (ALCANCE_BETA), sin firma | CR | A | no | lista | fundador (firma) · `docs/legal/` lo propone J4 |
| A2 | R1–R6 del documento legal servido | CR | A | no | lista | fundador (firma) · J4 |
| A3 | D1: el BORRADOR no se sirve; sí los [REVISAR ASESOR] | CR | A | no | lista | J4 |
| A4 | P1 con asteriscos sueltos | — | A | **cerrada** (#2425) | lista | — |
| A5 | cinco marcas de microcopy sin firma (el 409 al emitir es FA) | CR | A | no | lista | fundador (firma), varios carriles |
| A6 | la oferta founding enseña el iframe de cobro con OFF | CR | A | no | lista | J3 (`founding.ts`) |
| A7 | `terminos.html:48` en presente (y `:79-80`, sin entrada) | CR | A | no | lista | J3 + firma |
| A8 | el guard de SCRUM-406 no ve `docs/legal` | CR | A | no | lista | no medido |
| A9 | `readLegalDoc` parte las viñetas | CR | A | no | lista | J3 (`legalPages.routes.ts`) |
| A10 | las cicatrices de puesto no las lee nadie | — | A | no | lista | orquestador |
| A11 | `index.html:638` «Tarjeta» sin Connect | CR | A | no | lista | J3 |
| A12 | `index.html:432` aria-label «a cobro» | CR | A | no | lista | J3 + firma |
| A13 | `index.html:739` llamada final | CR | A | no | lista | J3 + firma |
| A14 | `index.html:427` subtítulo firmado sin aplicar | CR | A | no | lista | J3 |
| A15 | bot «¡Estás al día!» (otro interruptor: `BOT_INBOUND_ENABLED`) | — | A | no | lista | J2 + máster K1 |
| A16 | fechas del albarán en UTC | CR | A | no | lista | S1 (`albaranPdf.service.ts`) |
| A17 | dos líneas bajo el sellado (1554e: **sobra**) | FA | A | no | lista | S1 + OK del fundador |
| A18 | las tres preguntas fiscales (suplidos, 0 %, redondeo) | FA | A · tema compartido con C (S1-F) y D (ROAD-5) | no | lista | asesor + fundador |
| A19 | textos del albarán (CR) y del libro registro (FA) | CR+FA | A | no | lista | S1 · J1 (`libroRegistroView.js`) |
| A20 | Stripe en inglés, `connect.routes.ts:70` | FA | A | no | lista | J2 |
| A21 | la puerta de producción de SCRUM-418 | CR | A | no | lista | fundador |
| A22 | «Trabajos CSV» sin año (SCRUM-1183) | CR | A | no | lista | S2 + firma |
| A23 | `sendInvoiceEmail` dice «enviado» sin proveedor | FA | A | no | lista | S1 (`email.service.ts`) · STOP del fundador |
| F1 | SIF-1 v2 8/8 (U1.3) | FA | C | no | nada | fundador + J1 |
| F2 | 1566: base + IVA = total | FA | ninguna (sólo la etiqueta `go-live`) | no | nada | J1 |
| F3 | una sellada no se re-sella (1330) | FA | ninguna | no | nada | J1 |
| F4 | el PDF de una emitida no se regenera (665) | FA | ninguna | no | nada | J1 |
| F5 | los recordatorios de cobro cumplen J6 (1509) | FA | ninguna | no | nada | J2 |
| F6 | excepción The Pioneer: llamada anotada, llave por merchant, variable global sin tocar | FA | ninguna (texto de la Parte P) | no | nada | fundador |
| **F7 = D6 = B4** | **copia de seguridad que existe y está probada** | **CR** | **B · D · (SCRUM-1525)**; **no en A** | no | **avisa** | fundador (Railway) · J6 (los scripts, 1525b) |
| F8 | mitad B: con una entrada abierta, el interruptor no se enciende | FA | ninguna | **no: es justo lo que falta** | nada | S1 (`src/core/flags.ts`) con GO; la propuesta es de S5 |
| F9 | el alta excluye forales y Canarias (1536) | CR | ninguna | no | nada | equipo de Javier (`area-fiscal`) |
| F10 | el valor real del flag en producción (1097) | FA | ninguna | no | nada | fundador |
| D4 | la SL existe | FA (Modelo A) | D · C (el productor, S1-E / SCRUM-870) | no | nada | fundadores |
| D5 | Hacienda resuelta: 6 preguntas, 1 contestada | FA | D · tema compartido con C (S1-F) y A18 | no | nada | fundadores + asesor |
| D12 | un profesional real con factura emitida desde YaQu | después (es el resultado) | D | — | nada | fundadores |
| D19 | usuarios 2 y 3 sin captación a mano | después | D | — | nada | fundadores |
| B1 | la regla fechada de los datos de producción (máster) | CR | B | no | avisa | fundador |
| B2 | el backfill de `MIGRATIONS_PENDING.md` | CR | B | no | avisa | **nadie** (`carriles.mjs`: «sin fila en §3») |
| B3 | microcopy de Bizum (SCRUM-402) antes de encender la bandera | FA (Bizum) | B | no | avisa | fundador (firma). ⚠️ 402 está Finalizada y la cláusula sigue: **no he comprobado** si sigue haciendo falta |

**Recuento (columna «¿lo impide algo?»): 0 de 37.** Las 37 son las 40 filas menos A4 (cerrada) y D12/D19 (no
son condiciones). Ninguna, en ninguna de las cuatro listas, tiene algo que impida llegar a su momento sin
cumplirla: **4 avisan** (B), **22 viven en una lista** que nadie lee al encender (A) y **11 no las vigila nada**
(4 + 22 + 11 = 37).
⇒ **Hoy el fundador no tiene una puerta: tiene cuatro listas de deseos.** Lo único que de verdad para algo es el
propio interruptor apagado (regla 24), y lo que lo enciende —la llave `cambiar-flag-fiscal.mjs`— no mira
ninguna de las cuatro.

**Momento (mi lectura), sobre las 40 filas: CR 19 · FA 15 · CR+FA 1 (A19) · después 2 · ninguno 3** (A4, A10,
A15). 🔴 **De las 22 abiertas de A, 15 son CR**, una es mixta (A19), y sólo 4 son FA (A17, A18, A20, A23): son textos que lee un profesional desde el alta (landing, documentos legales, panel, albarán) con el
interruptor aún apagado. A se definió como «antes de encender», y la mayor parte de lo que contiene llega
**antes**, el día que entra el primer cliente real. Ese día lo detecta B, y B no las nombra.

**Solapes, medidos:** el respaldo en B, D y 1525, y no en A · Hacienda en D, C y A18, con preguntas DISTINTAS
(A18 trae suplidos, 0 % y redondeo; ROAD-5, enero, quién factura, el IVA de la suscripción, el dinero, la
conservación y el encargado): mismo tema, no la misma condición · la SL en D y en C (vía el productor).

**PROPUESTA — MI LECTURA, no forma parte de la medida.**
1. **Dos momentos, dos listas con mecanismo:** lo CR cuelga de **B**, que ya salta sola en producción; lo FA,
   de **A**, que se convierte en puerta de verdad cuando exista la mitad B (F8). C y D no se copian: **se citan**
   desde la fila que les toca (F1 cita U1.3; F7 cita ROAD-6 y SCRUM-1525).
2. **B nombra a A:** que su aviso diga «y las N de `puerta.json` que son CR siguen abiertas». Así el día que
   entra el primer cliente real llegan las 15 CR de A con él, y no se quedan esperando a un interruptor que
   igual tarda semanas.
3. **ROAD se cierra o se cita**, pero no se mantiene como cuarta lista: está dormida desde el 20-ago y es
   anterior a los dos equipos.

## 19-oct-2026 · SCRUM-1554c · La puerta en un fichero, con un guard que no deja borrar renglones (A); el cierre en ejecución, sólo propuesto (B)

**Medido contra:** `origin/main` = `8ff423895024c7d2ce1c6bcb96054da11a227b90` (base de la rama) · 2026-10-19T07:26Z (hora real, cabecera
`Date:` de `gh api -i zen`). S5, equipo de Luis. El orquestador da OK a A y dice NO a construir B (mensaje
del 19-oct). El carril: el ticket es de `equipo-javier`, pero `docs/go-live/` es nuevo y el guard es nuestro.
El orquestador avisa a su equipo.

A9: comprobación → `tests/scrum1554c-puerta-de-go-live.test.mjs`

### ⚠️ Este fichero choca con el PR #2428 (SCRUM-1554b, equipo de Javier)
#2428 también CREA `docs/master/SCRUM-1554.md`. Lleva abierto desde el 14-oct, con `build + tests` en rojo,
y nadie lo ha tocado desde entonces. **Quien entre segundo resuelve el conflicto juntando las dos
secciones**, sin borrar ninguna. 1554b y 1554c no se solapan en contenido:

| | SCRUM-1554b (Javier, #2428) | SCRUM-1554c (esto) |
|---|---|---|
| Qué es | Clasifica los **57 tickets de Jira** que «esperan al fundador», por tipo de decisión | La **lista de entradas** de la puerta, en un fichero, y un guard sobre ella |
| Toca | Sólo este registro y `docs/master/evidencias/SCRUM-1554b/` | `docs/go-live/puerta.json`, `scripts/go-live/puerta.mjs` y su test |
| Relación con la puerta | Cuenta 3 tickets aparcados en ella (1502, 1551, 1554) | Recoge sus entradas (1–23) |

### Lo medido antes de construir (y cambia lo que se puede prometer)
- **`INVOICING_ES_ENABLED` se enciende por la VARIABLE DE ENTORNO de Railway o por `merchants.flags` en la BD,
  a mano** (`src/core/flags.ts`: merchant > país > env > default). **Ninguno de los dos caminos pasa por la CI.**
  Por eso un guard de CI **no puede impedir** que se encienda: como mucho avisa. El requisito 1 de
  c.19645 («que impida, no que avise») no se puede cumplir desde la CI. Sólo se cumple en ejecución (B).
- **La lista no vivía en ningún fichero.** Estaba en el cuerpo del ticket (filas 1–8) y en sus comentarios
  (9, 10, 11–15). c.19645 nombra otros seis grupos «movidos» sin redactarlos, y **dos entradas sólo constaban
  en registros ajenos**: `SCRUM-1183.md:66` (el botón de exportar sin año) y `SCRUM-1558.md:29`
  (`sendInvoiceEmail` dice `ok` sin enviar; el registro dice «el orquestador lo apunta en la puerta», pero
  en el ticket NO consta). Así que el requisito 2 (autocontenido) tampoco se cumplía.

### A · Lo que entra
1. **`docs/go-live/puerta.json`**: 23 entradas, cada una con `numero`, `que`, `de_donde` y `consta_en`
   (dónde se escribió), y `condicion` cuando la fuente la da. **22 abiertas y 1 cerrada**: la 4, el P1 con
   asteriscos, por PR #2425 (`cd99c713994f`, ancestro de main, comprobado), con su motivo de c.19593/19594.
   Las 18 y 19 dicen «no lo dice el comentario» en `de_donde`: c.19645 no da el ticket de origen. No me lo
   invento.
2. **`scripts/go-live/puerta.mjs`**: `juzgarPuerta`, `leerPuerta` y `recuento`, y línea de órdenes:
   **0** = ninguna abierta · **1** = hay abiertas · **2** = NO PUDE LEER (nunca 0 por no poder leer).
   Hoy: `PUERTA DE GO-LIVE · 22 abierta(s) de 23 · cerradas: 4`, salida 1.
3. **El guard**, que corre en la tanda (`build + tests`, el obligatorio). Declara `TOTAL = 23` y
   `CERRADAS = [4]`, y cae **en los dos sentidos**:
   - una entrada que **desaparece**, aunque se renumere el resto → rojo («una entrada NUNCA se borra»);
   - una entrada **cerrada sin** `{por, motivo, sha, fecha}`, o con un sha que no se puede buscar → rojo;
   - una entrada **nueva**, o una **cerrada que el guard no declara**, o una **reabierta** → rojo, hasta que
     el mismo cambio suba `TOTAL` o toque `CERRADAS`. **Así el diff dice cuál salió** (requisito 3), y su
     motivo queda en la lista.

### Comprobado
| corrida | resultado |
|---|---|
| test nuevo | **14/14** |
| test nuevo + 1349 + 1415 + 824 + 723 | **46/46** |
| **mutantes sobre la lista DE VERDAD** (cambio y `git restore`; árbol limpio al acabar) | **borrar la 23 → cae**, con «faltan 1 entrada(s) (23)…» · **cerrar la 1 sin `cerrada`** → cae, con «cerrada sin {por, motivo, sha, fecha}» y «el guard no lo declara» |
| los 163 ficheros de test que barren `scripts/` o `tests/`, CONTRA LA BASE (la misma tanda en `8ff423895` sin el cambio) | base 85 caídos, rama 87. **Los 2 de más eran míos: `SCRUM-1349`.** Mi `spawnSync` dejaba pasar `FORCE_COLOR`; arreglado donde nace. Los 85 de la base son los de siempre en un árbol sin `dist/` (`scrum1398`, `scrum1262`…) |

### B · El cierre en ejecución: SÓLO PROPUESTA. NO construido
**Por qué no se construye:** cambiar `isFlagEnabled` es tocar un flag de la Parte P a nivel global, y eso es
un STOP del CLAUDE.md. **Lo lleva el orquestador al fundador con la pregunta sola, y nadie lo construye
hasta que haya una cita suya.**

**El diseño** (en `src/core/flags.ts`, dentro de `isFlagEnabled`, justo antes de devolver):
```ts
// SCRUM-1554 · LA PUERTA DE GO-LIVE: INVOICING_ES_ENABLED no se enciende con entradas abiertas.
// Fail-closed: si la lista no se puede leer o no tiene su forma, cuenta como CERRADA la puerta (OFF).
function puertaDeGoLiveLibre(): boolean {
  if (cachePuerta !== undefined) return cachePuerta;
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs', 'go-live', 'puerta.json'), 'utf8'));
    cachePuerta = Array.isArray(doc.entradas)
      && doc.entradas.length > 0
      && doc.entradas.every((e: any) => e && e.estado === 'cerrada');
  } catch { cachePuerta = false; }
  return cachePuerta;
}
// …y al final de isFlagEnabled, para este flag y sólo cuando el resultado sería true:
//   if (flag === 'INVOICING_ES_ENABLED' && resultado && !puertaDeGoLiveLibre()) return false;
```
- **`docs/` viaja al despliegue**: `legalPages.routes.ts:13` ya lee `path.join(process.cwd(), 'docs', 'legal')`
  en producción. La lista sólo cambia con un despliegue, así que se lee **una vez por proceso**.
- **Cierra los dos caminos a la vez** (env de Railway y `merchants.flags`), porque los dos pasan por
  `isFlagEnabled`. Y no toca el camino de emisión: lo que cambia es la respuesta del interruptor.

**🔴 Lo que hay que decidir ANTES de construirlo, medido:**
1. **33 ficheros de `tests/` encienden `INVOICING_ES_ENABLED`** (por env o por override) y esperan que
   emita. Con B tal cual, con 22 abiertas, **caen todos**. Hace falta una salida para los tests que **no sea
   un agujero en producción**. Una variable de entorno que salte la puerta es justo el camino que Railway
   puede poner. Opciones, sin elegir: (a) la puerta sólo rige con `NODE_ENV=production` (⚠️ staging
   también lo tiene, según SCRUM-1558, y el de producción no lo he medido); (b) los tests inyectan la
   lista por un parámetro de `FlagContext` que en producción nadie rellena.
2. **Si alguna cuenta tiene hoy el flag encendido** por `merchants.flags` (la demo, por ejemplo), **B se lo
   apaga al desplegar**. No lo puedo medir: ningún árbol tiene credenciales de producción (SCRUM-418).
   ⚠️ **Eximir a las cuentas de prueba es el agujero**: no se propone.
3. **El ratón y el gato del guard**: una entrada cerrada sin arreglar de verdad pasa el guard igual. B no lo
   arregla; lo que lo sujeta es que el cierre lleve `por`, `motivo` y `sha`, y que el diff lo vea un humano.

**🔢 La cifra de los 33, medida después (19-oct, sólo lectura, sobre `8ff423895`).** La pidió el orquestador
para que el fundador no decida B a ciegas:

| cómo encienden el flag | ficheros |
|---|---|
| **`merchant.flags = { INVOICING_ES_ENABLED: true }`** en un objeto que el test pasa a funciones de dominio (`getEmissionMode`, `allocateInvoiceNumber`, `modoDocumentoSuelto`…), o en un Prisma falso o en el banco desechable | **31** (incluidos `_banco-emision-con-estado.mjs`, `scrum974` con su `ENCENDIDA` y `scrum1097`, que es un guard que mide comercios encendidos) |
| **`process.env.INVOICING_ES_ENABLED = 'true'`** | **2** (`emission.test.mjs`, `flags.test.mjs`; el segundo prueba además el override) |
| sustituyen `isFlagEnabled` o su módulo | **0** |

Lo que eso dice de las dos salidas para los tests:
- **(a) la puerta sólo rige con `NODE_ENV=production`**: no toca ninguno de los 33, porque ninguno pone
  `NODE_ENV=production`. ⚠️ Sigue sin medir qué `NODE_ENV` tienen staging y producción.
- **(b) inyectar la lista por `FlagContext`**: 31 de los 33 NO llaman a `isFlagEnabled`: llegan a él a través
  del dominio. Habría que pasar el parámetro por cada función, y eso es mucho más invasivo de lo que parecía.
  Una variante menos invasiva es un interruptor en memoria exportado por `flags.ts` que sólo llaman los tests.
  No se puede poner desde Railway, pero sí desde cualquier código del proceso. Tampoco se elige aquí.

**Dos cosas que YA existen y cambian la pregunta:**
- **`scripts/guard-acreditacion-invoicing-es.mjs` (SCRUM-1097)** es de sólo lectura (lo verifica por AST) y
  contesta la duda 2: si hay hoy algún comercio ES, que no sea la demo, con el override encendido o con alguna
  factura fiscal emitida. **El fundador puede correrlo contra producción antes de decidir B**, sin escribir
  nada nuevo. Dice en su cabecera que no ve la variable de entorno; para eso tiene su brazo (b): ¿se ha emitido
  algo fiscal?
- **Ese guard EXCLUYE A LA DEMO (id=1) a propósito, por la regla 8.** B, tal como está escrita arriba, le
  apagaría la facturación a la demo si tiene el override encendido. Si la regla 8 la deja fuera de la puerta,
  eso lo decide el fundador. Una excepción por id fijo no es el agujero de «eximir cuentas de prueba» (no
  depende de ningún dato que se pueda poner desde fuera), pero tampoco lo propongo yo.
- **`scripts/cambiar-flag-fiscal.mjs`** es, según SCRUM-1097/1099, **la única vía humana y deliberada** de
  encender el override por comercio. Que ese guion se niegue con entradas abiertas cerraría UNO de los dos
  caminos sin tocar `flags.ts` (la variable de Railway seguiría abierta). Se nombra; no se propone ni se ha
  leído entero.

### Lo que NO hace
- **No impide encender el interruptor.** Hasta que exista B, esto es una lista vigilada, no una puerta.
  **La fila c3-17 de la página del fundador NO se cierra con A**: queda a medias, y la cierra B.
- **No está completa.** Recoge lo que consta escrito en el ticket y en los registros de `main` que mandan
  algo a esta puerta (`git grep` de «puerta de go-live» y «SCRUM-1554» en `docs src public tests scripts`).
  Lo que se aparcó sólo de palabra, o en Jira de otro ticket sin registro, no está.
- **No lee Jira.** Una entrada nueva hay que escribirla en el fichero. Si sólo se escribe en el ticket, el
  guard no la ve.
- No he redactado las seis que c.19645 sólo nombra (16–21): llevan el nombre que les dio el comentario.

#### Arreglo del check obligatorio (mismo día, antes de mergear)
El `build + tests` del PR #2601 caía con `not ok 3440 - SCRUM-1480f`: `scripts/go-live/puerta.mjs` (creado en
este mismo PR) es un script NUEVO sin fila en `docs/equipo/dos-equipos.md` §3.3. Medido el motivo: SCRUM-1554
lleva las etiquetas `decision-jefe, equipo-javier, fundador, go-live, legal, microcopy` — NINGUNA es
`area-*`. Por «Cómo nace la fila de un fichero de `scripts/`» (SCRUM-1480), un ticket sin UNA etiqueta de
área hace que el criterio calle: no se le puede dar fila a un puesto. Declarado en
`scripts/_sin-fila-declarados.json` (caso 2: lo crea el equipo de Luis en un ticket sin etiqueta de área).
`tests/scrum1480f-un-script-nuevo-no-entra-sin-fila.test.mjs`: 6/6 verde tras el cambio.
El rojo de `guards de navegador (fuera de la tanda)` (34 verdes, 3 rojos, 1 ciego) es PREEXISTENTE: medido
también en rojo en el último run de `main` (39218813067, el mismo job, misma conclusión `failure`), y
ninguno de los 4 ficheros de este PR toca `public/` ni el dashboard. No es de este PR; no se toca aquí.

## 19-oct-2026 (tarde) · SCRUM-1554d · ¿Cuáles de las 23 son VERDAD hoy? Medido una por una, sólo lectura

**Por qué este tramo y no un «¿cuántas quedan?» sobre el guard.** El guard de SCRUM-1554c ya dice `22 abierta(s)
de 23`: eso es lo que DECLARA la lista. Lo que faltaba — y lo que pidió el orquestador — es si cada declaración
SIGUE siendo verdad hoy, una por una, contra el árbol y contra producción, porque una entrada «abierta» en el
JSON no se vuelve a comprobar sola. **No se tocó `docs/go-live/puerta.json` ni el guard: esto es sólo la medida.**

**Medido contra:** `origin/main` = `eee7d2b4bcea348a05d0020a1e912db73a894cfe` · 2026-10-19T12:10:48Z (hora del commit `9708bbaa3`; la medida es anterior)

Producción (`https://yaqu.app/version`) = el mismo `eee7d2b4b`: **el deploy está al día**, así que lo leído en el árbol vale
también para lo que sirve yaqu.app hoy en las páginas públicas. S0, equipo de Luis, con 4 sesiones en paralelo
(una por bloque de entradas), todas sólo lectura: sin tocar `src/`, `public/`, el esquema, ningún flag, ningún
guard, sin login en producción, sin Playwright.

**La pregunta que importa, contestada:** de las 23, **sólo 3 son hoy verdad** (la 3, la 4 —ya cerrada antes de
hoy— y la 21, con una brecha declarada). **17 siguen siendo el mismo defecto que el día en que se apuntaron.**
Y **3 no se pudieron comprobar desde aquí** (13, 17, 18) — con su motivo, no por no haberlo intentado.

| # | condición (resumen) | ¿es verdad HOY? | cómo se midió | qué falta / de quién depende |
|---|---|---|---|---|
| 1 | Los 7 literales de P2 (#2415), sin firma en bloque | **NO** (esperado: nada roto, falta la firma) | `git log --grep=534`: PR #2415 (`c45317338`) sigue en `docs/legal/ALCANCE_BETA.md`, sin revertir. Jira SCRUM-1554 entero (6 comentarios): ninguno dice que la firma en bloque ya ocurrió | La revisión de go-live (fundador/orquestador) todavía no ha empezado — es la condición esperada mientras tanto, no una regresión nueva |
| 2 | R1–R6 del documento legal servido | **NO** | `docs/legal/ALCANCE_BETA.md` + `Invoke-WebRequest https://yaqu.app/legal/alcance-beta`: siguen «Cobro integrado», «Justificantes de cobro», «soporte por email y WhatsApp» (no «sólo email»), «mientras tanto» Bizum/transferencia. La frase «no emite facturas ni ningún otro documento de cobro» no existe en `docs/legal/` | Redactar y firmar (regla 39) las 6; carril **J3** |
| 3 | D1: aviso BORRADOR no se sirve; sí 3×[REVISAR ASESOR] + huecos | **SÍ** | `legalPages.routes.ts:27` omite líneas `>` (el aviso lo es); confirmado en vivo: el HTML de yaqu.app no dice «BORRADOR», y sí aparecen los 3 `[REVISAR ASESOR]` y los huecos (`[NIF]`, `[fecha]`…) | Nada pendiente en esta entrada |
| 4 | El P1 con asteriscos sueltos | **CERRADA** (ya antes de hoy) | Sin cambios desde el cierre declarado en `puerta.json` (PR #2425, `cd99c713994f`) | — |
| 5 | 5 marcas de microcopy «aprobado por el fundador» sin cita que conste | **NO** | `docs/master/SCRUM-1502.md`: las 5 (409 al emitir, desglose por empleado, rótulos del raíl, los 10 de Configuración, bloqueo de serie) siguen cada una en su ticket de origen como «sin aprobar»/«pendiente». `git log --since=2026-10-14` sobre los 5 ficheros: ningún commit añade la cita | Falta localizar o pedir la cita literal del fundador por cada marca; sin carril único, cada una tiene su dueño propio |
| 6 | La oferta *founding* no comprueba el modo `receipt` | **NO** | `plansView.js`: `openAlcanceModal()` pinta el iframe de `/legal/alcance-beta` sin ningún `if` sobre el modo; `founding.ts` no referencia `receipt`/`INVOICING_ES_ENABLED` | Añadir el guard en `plansView.js`; carril **J3** |
| 7 | `terminos.html:48`, «emitir facturas y gestionar cobros» en presente | **NO** (y hay una 2ª frase nueva) | `public/terminos.html:48` y producción, idénticas. **Hallazgo nuevo, fuera de la población medida por SCRUM-1551:** `terminos.html:79-80`, sección 6, «YaQu te ayuda a generar documentos de cotización y factura…», también en presente y también servida en vivo | Reescribir las DOS frases, con firma; carril **J3** |
| 8 | El guard de SCRUM-406 no ve `docs/legal` | **NO** | `tests/scrum406-canal-prometido-existe.test.mjs`: `promesasDeSoporte()` sólo recorre `public/`. La frase «soporte por email y WhatsApp» sigue en `ALCANCE_BETA.md:23-24`, y el propio test declara `whatsapp: false` (el canal no existe) | Extender el guard a `docs/legal/`, o quitar «WhatsApp» del texto; dueño del guard, carril **S1/J3** según el fichero |
| 9 | `readLegalDoc`/`mdToHtml` parte líneas de continuación en `<p>` sueltos | **NO** | `legalPages.routes.ts:20-38`: cualquier línea sin viñeta propia cierra la lista y sale como párrafo. Confirmado en vivo (el P1 y la frase de soporte salen partidos). Sin elegir entre arreglar el renderizador o unir líneas en el `.md` (ya lo decía SCRUM-1554c) | Decisión + arreglo; carril **J3** |
| 10 | Las cicatrices de puesto no las lee nadie | **NO** (mitigado, no cerrado) | `.claude/hooks/identidad.mjs` (hook `SessionStart`, `.claude/settings.json:8`) ya pega el CONTENIDO de `docs/equipo/cicatrices/<puesto>.md` en el arranque — no sólo la ruta. Pero no hay guard que compruebe que una sesión USÓ lo que se le pegó | Falta un mecanismo que convierta un fallo conocido en rojo, no sólo en párrafo (ya lo decía c.19594); puesto S0/orquestador |
| 11 | `index.html:638` «Tarjeta, Bizum o transferencia» sin Connect | **NO**, con reserva | El texto sigue igual en código y en producción. Stripe Connect SÍ está construido (`src/modules/payments/connect/`), pero `PAYMENTS_CONNECT_ENABLED` tiene default `false` en `src/core/flags.ts`, y el propio `CLAUDE.md` (regla 8) dice que hoy no hay cobro con tarjeta activo | **NO PUDE MIRAR** si Railway o `merchants.flags` lo contradicen: eso vive fuera del repo. El NO se apoya en el código + el máster vigente, no en una lectura de producción con credenciales |
| 12 | `aria-label` de la animación dice «cobro», termina en «Firmado» | **NO** | `index.html:432` sigue con «…a cobro»; `:433`/`:465` siguen terminando en «Firmado» | Cambiar el `aria-label`; carril **J3** |
| 13 | CTA final «sin perseguir presupuestos» — ¿hay clientes y cifra? | **NO PUDE MIRAR** | El texto de código no cambió (confirmado), pero la condición de fondo es un HECHO DE NEGOCIO (clientes reales + una cifra enseñable) que no se puede ver desde el repo sin login ni acceso a producción | Lo decide el fundador: si hay cifra, se publica; si no, se aplica el recambio sin firmar |
| 14 | Subtítulo vivo de `index.html:427`, recambio YA firmado (SCRUM-1016 c.19607) | **NO** | El subtítulo sigue sin el literal firmado y sigue prometiendo «te paga — con tarjeta, Bizum o transferencia» (regla 24). El H1 (`:426`) SÍ se aplicó; el subtítulo (`:427`) y su espejo (`:508`) no | Aplicar el literal YA firmado, sin pedir firma nueva; carril **J3** |
| 15 | Bot: «ningún pago pendiente con…», sólo ve cobros internos | **NO** | `botFlow.service.ts:582` idéntico al denunciado, sin el recambio («…por YaQu con…») | Aplicar el recambio + cambio de máster K1; carril **J2**. El valor de `BOT_INBOUND_ENABLED` en Railway: NO PUDE MIRAR, no cambia el veredicto sobre el texto |
| 16 | Fechas de albarán en UTC, no en la zona del negocio | **NO** | `albaranPdf.service.ts:129-131,362` y `albaranes.routes.ts:1349,1601`: `toLocaleDateString` sin `timeZone`. El PDF del PRESUPUESTO sí se arregló (`zonaDelMerchant`, SCRUM-1470); el ALBARÁN se quedó fuera | Aplicar el mismo patrón al albarán; SCRUM-1445 no tiene ficha propia en `docs/master/` |
| 17 | «Las dos líneas bajo el sellado» (SCRUM-1490) | **NO PUDE MIRAR** | `docs/master/SCRUM-1490.md` entero trata de la serie anual de presupuestos (`seriesYear`), nada sobre texto bajo un sellado VeriFactu. `git grep "bajo el sellado"`: nada | El enunciado de esta entrada es ambiguo incluso dentro de la propia puerta; hace falta que quien la movió (c.19645) la redacte |
| 18 | «Las tres preguntas fiscales» | **NO PUDE MIRAR** | La propia puerta admite `"de_donde": "no lo dice el comentario"`. `git grep` no encuentra el concepto como tal | Nada que medir sin que se redacte primero |
| 19 | Los textos del albarán y del libro registro | **NO** | Coincide con `docs/equipo/para-javier.md` §26.2 (SCRUM-1428): 15 claves de `libroRegistroView.js` firmadas por el fundador el 19-ago sin marca en el código; el comentario de cabecera que dice «ni un rótulo… está aprobado» sigue siendo falso | Carril **J1**; decisión ya tomada (SCRUM-1428 c.18325), sólo falta aplicar la marca |
| 20 | Texto de Stripe en inglés, `connect.routes.ts:70` | **NO**, con matiz | El fallback literal YA está en español («Error creando el onboarding»), pero antepone `err?.message` — el mensaje crudo de la librería Stripe, normalmente en inglés — así que lo que de verdad llega al usuario puede seguir en inglés | Envolver siempre `err?.message` en un texto propio en español; si la entrada se refería a la página de Stripe alojada fuera del repo, eso es aparte y NO PUDE MIRARSE |
| 21 | La puerta de producción de SCRUM-418 (ningún worktree con credenciales de prod) | **SÍ**, con brecha declarada | `scripts/comprobar-claves-bd.mjs` + `scripts/_clave-vs-destino.mjs` existen y tienen test (`scrum418`, `scrum418c`, 17 casos, sin gate, corren en `npm test`) | El propio SCRUM-418.md declara que el barrido no corre solo contra los `.env` REALES de cada worktree (no está en CI); decisión pendiente de un hook/paso de arranque |
| 22 | Botón de exportar sin año | **NO** | `docs/master/SCRUM-1183.md` (1183b, 16-oct): decidido explícitamente que esto se manda a ESTA puerta y no se construye sin firma. 1183d (18-oct) no la toca | Firma del fundador eligiendo (b) o (c); hasta entonces sigue bajando CSV vacío |
| 23 | `sendInvoiceEmail` escribe `.eml` y devuelve `ok` sin proveedor | **NO** (confirmado, no tocado) | `email.service.ts:28-169`: sin `RESEND_API_KEY`/`SMTP_URL`, usa `streamTransport` y escribe `storage/outbox/invoice-<n>.eml`, devuelve `{ok:true}`. `docs/master/SCRUM-1558.md:29` ya lo marca «GEMELO CONOCIDO, STOP DEL FUNDADOR» — el gemelo de presupuestos SÍ se arregló; éste se dejó aparte a propósito (regla 40, camino de emisión) | GO escrito del fundador para tocar el camino de emisión; mientras `INVOICING_ES_ENABLED` esté OFF para ES no muerde |

**Resumen en una frase:** de las 23, **2 son verdad hoy sin reparo** (3, 21-con-brecha) + **1 ya cerrada antes de
hoy** (4) = **3 resueltas**; **17 siguen con el mismo defecto del día en que se apuntaron**; **3 no se pudieron
comprobar desde este repo** (13 es un hecho de negocio; 17 y 18 son entradas cuyo propio enunciado no da con qué
medirlas). **Ningún veredicto forzado:** donde la condición dependía de Railway, de `merchants.flags` o de un
hecho de negocio sin ver, la fila dice NO PUDE MIRAR en vez de adivinar.

**Hallazgo nuevo que no estaba en la lista** (de la entrada 7): `public/terminos.html:79-80` («YaQu te ayuda a
generar documentos de cotización y factura…», presente, servida en vivo) es la misma familia de claim que la
entrada 7 y no estaba censada. **No se añade aquí como entrada 24**: eso es tocar `docs/go-live/puerta.json`,
y este tramo es sólo la medida. Queda señalado para quien mantenga el fichero.

**Lo que NO se tocó:** `docs/go-live/puerta.json`, `scripts/go-live/puerta.mjs`, ningún flag (`INVOICING_ES_ENABLED`,
`PAYMENTS_CONNECT_ENABLED`, `BOT_INBOUND_ENABLED`), ninguna variable de Railway, ninguna fila de `merchants.flags`,
ningún test. Sin login en producción (sólo GET públicos a páginas sin sesión) y sin Playwright.

A9: sin fallo que generalice — tramo de sólo lectura (corregido el 22-oct en 1554e: decía «comprobación → ninguna», que no es ninguno de los cuatro formatos y tumbaba `scrum1294`).

## 22-oct-2026 · SCRUM-1554e · Las entradas 17 y 18, redactadas para que se puedan medir — PROPUESTA, no toca `puerta.json`

**Medido contra:** `origin/main` = `cef60b27265f7354fdd683f019f6da84de2dfe04` · 2026-10-22T09:57Z (`Date:` de GitHub)

S0, equipo de Luis, por encargo del orquestador. **Sólo lectura:** repo, Jira y las transcripciones del
orquestador. No se ha tocado `docs/go-live/puerta.json`, ni su guard, ni `src/`. Lo que dice una condición de la
puerta decide cuándo se puede facturar: **esto se propone, y lo firma el fundador.**

**Este PR trae además el tramo 1554d**, que llevaba desde el 19-oct en la rama `s0-scrum1554-puerta-golive`
(`9708bbaa3`) **sin PR y fuera de `main`**: `pr-automatico.yml` sólo abre PR a ramas `scrum-*`. Al traerlo, su
línea A9 no tenía formato válido y `scrum1294` caía; se ha corregido esa línea y su ancla, nada más.

### De dónde salen las dos (el origen común)

c.19645 dice que el orquestador «movió siete puntos de la lista del fundador». Esa lista es `yaqu-jefe.json`, un
fichero del orquestador que **no está en el repo**. En su transcripción del 14-oct a las 08:05Z las dos entradas
se llamaban así:

- «SCRUM-1490 · dos líneas en albaranes.routes.ts, DEBAJO del sellado»
- «Las tres preguntas fiscales para la asesora»

Al pasar a c.19645 perdieron el fichero y la palabra «asesora». Por eso 1554d no las encontró: buscó «bajo el
sellado» en el repo, y la frase sólo estaba en Jira y con otra palabra («debajo»).

### Entrada 17 · «Las dos líneas bajo el sellado» → **SOBRA como condición de go-live**

| | |
|---|---|
| **Qué dice hoy** | «Las dos líneas bajo el sellado.» · `de_donde`: SCRUM-1490 |
| **De dónde salió** | SCRUM-1490 c.19429 (13-oct, S1): «OK del fundador para dos líneas (`const { seq: quoteNumber, year: seriesYear } = …` y `seriesYear` en el `data`)». c.20041 (19-oct) las sitúa en `albaranes.routes.ts:1707` y `:1710`, 22 líneas por debajo de `sellarTrasEmision` (`:1685`). **Comprobado hoy en `cef60b272`: siguen en esas tres líneas.** |
| **Qué quiso decir** | El OK del fundador para tocar el camino de emisión (reglas 38 y 40). Con él, el presupuesto ADICIONAL que nace en `POST /admin/albaranes/:id/convertir-en-factura` guardaría el año de su serie. Hoy nace con `seriesYear` a NULL. Lo declara `SIN_ANIO_POR_SER_CAMINO_DE_EMISION` (`tests/scrum1490-el-anio-de-la-serie.test.mjs:306`), que es exacto en los dos sentidos. |
| **¿Es falso algo el día del go-live sin esas dos líneas?** | **No.** Una fila sin año se lee con `anioDeLaSerie` (`src/core/documentos/grupoDelPresupuesto.ts:40-50`), que toma el año del `createdAt` **en la zona del negocio**. `allocateQuoteNumber` numera en esa misma zona. Misma zona y mismo instante dan el mismo año. Sólo se leería mal si la zona **cambiara después** de numerar. |
| **¿Puede cambiar la zona hoy?** | No. Desde el 13-oct (`409e05317`, SCRUM-1522e) la zona **se escribe una sola vez, en el alta** (`auth.service.ts:344-355`). Busqué en `src/` todos los sitios que escriben `timezone` y sólo sale ese: `timezone:` con un valor que no sea `true`, y la forma abreviada `timezone,`/`timezone}`. El control es que la misma búsqueda sí encuentra el `create` del alta. Ninguna ruta la actualiza. |
| **Propuesta** | **Cerrarla:** `"estado": "cerrada"` y `cerrada: {por, motivo, sha, fecha}`, con este motivo: «No es condición de go-live: la zona se fija en el alta y nada la cambia, así que el adicional sin año se lee en la misma zona en que se numeró. El OK pendiente sigue en SCRUM-1490 ("Acción del fundador") y en la excepción exacta de `scrum1490:306`. Lo que de verdad dispara el riesgo es la primera ruta que permita CAMBIAR `Merchant.timezone`, y eso no es este interruptor.» Además hay que añadir `17` a `CERRADAS` en `tests/scrum1554c-puerta-de-go-live.test.mjs`. |
| **Si el fundador prefiere mantenerla** | Redacción medible: «El presupuesto adicional de `convertir-en-factura` guarda el año de su serie: `SIN_ANIO_POR_SER_CAMINO_DE_EMISION` es `[]` en `origin/main`. Necesita el OK del fundador para `albaranes.routes.ts:1707` y `:1710`.» **Cómo se comprueba:** leer esa constante en `origin/main`. El test cae si las líneas entran y la constante no se vacía, así que no puede mentir en ninguno de los dos sentidos. |

### Entrada 18 · «Las tres preguntas fiscales» → **SE QUEDA, redactada, y le falta una pregunta que no está escrita en ningún sitio**

| | |
|---|---|
| **Qué dice hoy** | «Las tres preguntas fiscales.» · `de_donde`: «no lo dice el comentario» |
| **De dónde salió** | La frase es anterior a la puerta. SCRUM-624 c.14046 (1-sep): «NO SE TOCA mientras las tres preguntas fiscales sigan sin contestar», y el céntimo «es la tercera pregunta para la asesoría». c.14322 (3-sep): «va a la asesoría con SCRUM-619 y SCRUM-623». Desde el 2-oct a las 18:19Z, el orquestador la lleva en la lista del fundador como «las tres preguntas fiscales juntas para la asesora (las dos del IVA más el céntimo del papel)». |
| **Cuáles son** | (a) **SCRUM-619**, los suplidos → **SCRUM-1264 B4**. (b) **SCRUM-623**, la base al 0 % (exenta, no sujeta o con inversión del sujeto pasivo) → **SCRUM-1264 B3**. (c) **SCRUM-624**, qué redondeo gobierna el total y la cuota de una factura, y por tanto qué número vale cuando el papel y el registro difieren en un céntimo (c.14405 ②: «NO se decide todavía CUÁL de los dos números es el correcto») → **no está en SCRUM-1264.** |
| **Estado hoy** | B3 y B4: «Lo que ya tenemos: IA · 22-sep». El propio SCRUM-1264 dice que eso **no es una respuesta**. (c) **no está preguntada**. En Jira, la búsqueda de «céntimo» entre los tickets del asesor no devuelve 1264 (control: sí devuelve 1048 y 16). En el repo, `git grep -i "céntimo\|redondeo\|624"` sobre `docs/legal/*ASESOR*` no da ninguna línea sobre esto (control: «redondeo» sí sale en `PREGUNTAS_ASESOR.md:689`, de otro tema). |
| **Por qué no sobra** | Es una condición previa al interruptor escrita en el propio ticket. SCRUM-624 c.14405 ③, rotulada «DECISIÓN DEL FUNDADOR», dice: «Ésta es la única ventana que va a existir… Va a la lista de lo que tiene que estar cerrado **antes** de levantar `INVOICING_ES_ENABLED`». ⚠️ Ese comentario está publicado con la cuenta que comparten el fundador y el orquestador: la autoría humana no la he comprobado en la transcripción. |
| **Riesgo de leerla mal** | Desde el 19-oct hay **otro trío**. c.20049 dice que 1566, 623 re-encuadrado (PDF frente al XML, 13,7 %) y 624② (hasta el 30 % por tramos) «se deciden juntas o no se deciden». Por eso la redacción nombra cada pregunta por su ticket y su letra en 1264, no por un número. |
| **Redacción nueva** (`que`) | «Las tres preguntas fiscales para la asesoría, contestadas por un asesor identificado: (a) los suplidos, SCRUM-1264 B4 (de SCRUM-619); (b) el 0 % — exenta, no sujeta o inversión del sujeto pasivo —, SCRUM-1264 B3 (de SCRUM-623); (c) qué redondeo gobierna el total y la cuota de una factura, y qué número vale cuando el papel y el registro difieren en un céntimo (SCRUM-624 c.14405 ②; arrastra SCRUM-623 re-encuadrado y SCRUM-1566, que se deciden juntos, c.20049). La (c) hay que añadirla primero a SCRUM-1264.» · `de_donde`: «SCRUM-624 c.14046, c.14322 y c.14405» |
| **Cómo se comprueba, y con qué** | Se lee la descripción de SCRUM-1264 (`getJiraIssue`). **Cada una** de B3, B4 y la pregunta nueva (c) tiene su línea «**Lo que ya tenemos:**» empezando por `ASESOR · <fecha>`, con el autor nombrado. No valen `IA · 22-sep` ni `«ASESOR» · 23-sep`: es la clasificación que el propio 1264 ya usa. Para (c) hace falta además un comentario en SCRUM-624 con la decisión del fundador sobre qué número gobierna, citando esa respuesta. **Cerrada** sólo con las tres. Si una respuesta obliga a construir algo (B4: «hoy la aplicación no lo tiene»), eso entra como **entrada nueva** en el mismo cambio que cierra la 18. |
| **Lo que no puede ver el guard** | Esto vive en Jira, que es el «sitio único» por decisión de 1264. El guard de la puerta no lee Jira (c.19645, punto 2), así que esta condición la comprueba **una persona en la revisión**, no la CI. Queda dicho para que nadie la tome por automatizada. |

### Quién lo aplicaría (carriles medidos con `node scripts/carriles.mjs de …`)

| fichero | carril | quién lo creó |
|---|---|---|
| `docs/go-live/puerta.json` | **sin fila en §3: nadie lo reclama** | S5, SCRUM-1554c (`f9f832ebc`, 19-oct) |
| `tests/scrum1554c-puerta-de-go-live.test.mjs` (hay que tocar `CERRADAS` para cerrar la 17) | **sin fila en §3** | S5, SCRUM-1554c |
| `scripts/go-live/puerta.mjs` (no hay que tocarlo) | sólo la fila general de `scripts/`: «S0, sólo verificación o censo de consulta»; **su dueño no lo ha decidido nadie** | S5, SCRUM-1554c |

Para aplicarlo hace falta que **el orquestador dé fila a esos dos ficheros** (por autoría, S5) y que **el fundador
firme el contenido**. El guard no vigila el texto de una entrada, sólo cuántas hay y cómo se cierran: reescribir la
18 no lo pone en rojo, y cerrar la 17 sólo si `CERRADAS` no lo dice.

### Hallazgos de otros carriles (anotados, sin tocar)

- **S1 · `src/core/documentos/grupoDelPresupuesto.ts:29`** dice «Hoy nadie escribe `Merchant.timezone`». **Es
  falso desde el 13-oct** (`409e05317`): lo escribe el alta. La conclusión del comentario sigue en pie, porque el
  riesgo está en *cambiar* la zona y no en escribirla. Pero «la pantalla que lo permita no debe salir antes del
  relleno» es **sólo un comentario**: ningún test hace el censo de quién actualiza `timezone` (`scrum1522e` comprueba
  el alta, no que nadie más la escriba). La misma premisa vieja está en SCRUM-1490 c.19446 y c.20041.
- **SCRUM-1566** lleva las etiquetas `go-live` y `stop-fundador` y **no está en la puerta**. Con la redacción (c)
  de la 18 quedaría cubierto. Sin ella, nada en `puerta.json` lo nombra.
- **SCRUM-1264 es del equipo de Javier** (`equipo-javier`). Añadirle la pregunta (c) y subir su contador de 28 a 29
  cruza de equipo y va por los jefes. S0 no lo escribe.

A9: sin fallo que generalice — tramo de redacción y sólo lectura; lo que falló (1554d sin PR por el nombre de su rama) ya lo dice `pr-automatico.yml:9` y lo enseña `npm run ramas:sin-mergear`.
