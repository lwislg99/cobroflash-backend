# SCRUM-1551 · Lo que `/legal/alcance-beta` promete HOY, y cómo decirlo sin prometerlo

**Medido contra:** `origin/main` = `c30729832c18b65c3793917ca836868e6cfdaa6e` · 2026-10-14T03:57:00Z

A9: aviso → cicatriz J4 «mi sonda de la versión del documento dio el mismo hash para dos textos distintos: cambiaba de carpeta DESPUÉS de cargar el módulo, y la carpeta de los documentos se fija AL cargarlo» — no se pudo comprobar: la sonda es de un solo uso y vive fuera del repo; lo cazó que dos textos distintos no pueden dar la misma huella

14-oct-2026 · **J4** (sesión `jv-j4d`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J4. El encargo se leyó en Jira: SCRUM-1551 entero, descripción y c.19537.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD»; medido por el orquestador, es SCRUM-1549, y
se construye con su orden. Etiquetas leídas en el ticket: `area-j4`, `equipo-javier`, `decision-jefe`,
`fundador`, `legal`, `microcopy`, `sin-firma`, `verifactu`. Ninguna de equipo-luis, `area-s*` ni `esperando-*`.

**Es una medición y una PROPUESTA. No se aplica nada.** No se toca `docs/legal/`, ni `src/`, ni `public/`,
ni el esquema, ni ningún guard o workflow. No se ha tocado ninguna base. No se ha pedido ni usado ninguna
credencial. Lo único que entra es este registro y una línea en `docs/equipo/cicatrices/J4.md`.

---

## ① Barrido en el presente

### Qué se sirve, por la RUTA

| comprobación | resultado |
|---|---|
| quién lee `docs/legal/` en `src/` | sólo `readLegalDoc` (`src/modules/system/app/routes/legalPages.routes.ts:46`) |
| con qué fichero se llama `readLegalDoc` | `ALCANCE_BETA.md`, en sus tres llamadas: `legalPages.routes.ts:98` y `subscriptions.routes.ts:48` y `:82` |
| rutas que monta ese router | una: `GET /legal/alcance-beta` (`legalPages.routes.ts:97`), montada en `app.ts:369` |
| `docs/` servido de otra forma | no: el estático es `public/` (`app.ts:262`) y `/outbox` fuera de producción (`app.ts:187`) |
| `GET https://yaqu.app/legal/alcance-beta`, hoy 03:54Z | HTTP 200, 4.298 bytes |

**Población:** 20 ficheros versionados en `docs/legal/` (19 `.md` y `fuentes/aeat-errores.properties`).
**Se sirve UNO: `ALCANCE_BETA.md`.** El ticket habla de «dos documentos servidos»: medido hoy, por la ruta,
hay uno. Las dos frases están en ese mismo documento.

### Dónde está el documento a la vista de un comercio (no sólo de quien tenga el enlace)

- `public/dashboard/js/plansView.js:232`: el modal de alta founding lo enseña en un `iframe`, y
  `:235` lo enlaza en otra pestaña. El botón «Aceptar y continuar al pago» exige marcar
  «He leído y acepto el alcance de la beta» (`:239-243`).
- `plansView.js:40`: la oferta founding se enseña según las plazas y el plan. **El modo de emisión no
  cuenta.** Un comercio español con `INVOICING_ES_ENABLED` en OFF (`receipt`) llega a ese modal.
- La ruta es pública (`publicAccessDeclarations.ts:91`): la abre cualquiera, sin sesión.

Esto contesta uno de los «no medidos» de SCRUM-534 («si la página está enlazada desde algún sitio»).

### Producción sirve el fichero de `main`: re-comprobado hoy, no copiado

El orquestador pidió no apoyarse en el `4deaa1a6d479` de `SCRUM-534.md:1343`, que se midió el 14-oct a las
02:10Z. Medido otra vez a las 03:54Z, y **con el `readLegalDoc` real** transpilado (no con una réplica):

| qué | versión |
|---|---|
| la que imprime `yaqu.app/legal/alcance-beta` en su pie | `4deaa1a6d479` |
| `readLegalDoc` sobre el fichero de `main` (`c30729832`) | `4deaa1a6d479` |
| el cuerpo HTML servido frente al que genera `main` | **idéntico**, 2.558 de 2.558 caracteres |

### Las líneas que empiezan por `>` NO se sirven: sigue siendo así

`legalPages.routes.ts:27`: `if (/^\s*>/.test(line)) continue;`. Medido sobre la página servida hoy:

| texto | en el fichero | en la página servida |
|---|---|---|
| «BORRADOR para revisión del asesor» (L3) | sí | **no** |
| «NO usar con clientes hasta el visto bueno del asesor» (L5-6) | sí | **no** |
| «[REVISAR ASESOR: …]» (L32, L40, L46) | sí | **sí** |
| «[Nombre/Razón social del titular de YaQu]», «[NIF]», «[fecha]» (L13-14) | sí | **sí** |

**En qué documentos pasa:** sólo puede pasar en un documento servido, y se sirve uno. Las 5 líneas `>` de
`ALCANCE_BETA.md` (L3-L7) son la cabecera entera de «borrador». Lo que ve el comercio es un contrato con
las partes en blanco y tres «[REVISAR ASESOR]» a la vista, **sin el aviso de que es un borrador**, y con
una casilla para aceptarlo antes de pagar. (Los otros seis documentos con las frases tienen líneas `>`,
pero no se sirven, así que ahí no hay nada que se oculte.)

### Dónde aparece cada frase: población entera de `docs/legal/`

Patrón `cobro integrado|justificantes? de cobro`, sin distinguir mayúsculas, sobre los 19 `.md`. Control
positivo: casa en `ALCANCE_BETA.md` L21, L22 y L30. El documento servido, además, **se leyó entero**
(53 líneas), porque una frase partida entre dos líneas el patrón no la ve.

| fichero | se sirve | «cobro integrado» | «justificante(s) de cobro» | líneas |
|---|---|---|---|---|
| `ALCANCE_BETA.md` | **SÍ** | 1 | 2 | L21, L22, L30 |
| `EMAIL_ASESOR.md` | no | 0 | 1 | L21 |
| `ENVIO_ASESOR_2026-09-28.md` | no | 0 | 1 | L116 |
| `INVENTARIO_AFIRMACIONES_VERIFACTU.md` | no | 0 | 1 | L427 |
| `LITERALES_COBRO_WEB_PENDIENTES.md` | no | 1 | 0 | L50 |
| `PREGUNTAS_ASESOR.md` | no | 0 | 2 | L419, L637 |
| `PREGUNTAS_ASESOR_POR_ESPECIALISTA.md` | no | 0 | 3 | L40, L157, L158 |
| los otros 12 `.md` | no | 0 | 0 | — |

Los seis que no se sirven son papeles para el asesor o inventarios: citan la frase para hablar de ella,
o describen el justificante como algo que existió. Que alguno haya salido del repo (por correo, en una
demo) **no se puede saber desde aquí**, y no se deduce de no haberlo visto.

**De paso, y fuera de `docs/legal/`** (no es la población pedida; se nombra para que no se pierda):
`public/terminos.html:48` dice, en presente, que YaQu permite «emitir facturas y gestionar cobros».
Es un texto legal servido en `/terminos`. No se ha leído entero ni se propone nada sobre él aquí.

---

## ② Qué es claim prohibido, por unidad visible

La vara es la regla 24, literal (`YAQU_MASTER.md`, Parte I): «Con el interruptor en OFF, YaQu no emite
ningún documento para ese merchant —ni factura, ni justificante, ni ningún otro documento de cobro— y no
cobra por YaQu a sus clientes: ni enlace de pago, ni señal al aceptar el presupuesto, ni recordatorios de
pago […]. Presupuestos, firma, albaranes y partes siguen igual. El profesional cobra por fuera de YaQu
hasta que exista la factura.» Y la 18: tarjeta y Bizum/transferencia, «en España, … solo en un merchant
con `INVOICING_ES_ENABLED` en ON».

Lo que ve el comercio, unidad por unidad (texto servido, no el fichero):

| # | unidad visible (servida) | frase | veredicto |
|---|---|---|---|
| A | §1 «Qué incluye HOY tu suscripción Founding», viñeta 3 (L21) | «**Cobro integrado**: tu cliente paga desde el móvil; recordatorios automáticos de cobro.» | 🔴 **PROHIBIDO.** Bajo un título que dice HOY. Promete justo dos cosas que la regla 24 nombra: enlace de pago y recordatorios. Nada en la unidad lo condiciona. |
| B | §1, viñeta 4 (L22) | «**Justificantes de cobro** por cada pago recibido (documento no fiscal).» | 🔴 **PROHIBIDO, y además FALSO hoy.** La regla 24 nombra el justificante. Y el código ya no lo emite: con `receipt`, `invoiceNumber.service.ts:448` lanza `invoicing_es_disabled`, y el generador `J-` lo retiró SCRUM-825 (comentario 17446, D1). «(documento no fiscal)» no lo salva: la regla prohíbe «ningún otro documento de cobro». |
| C | §2 «Qué NO incluye todavía», viñeta 1 (L29-30) | «Hasta ese momento YaQu emite justificantes de cobro (no facturas fiscales)» | 🔴 **PROHIBIDO y FALSO**, por lo mismo que B. Que vaya bajo «Qué NO incluye» no lo arregla: la frase dice en presente lo que SÍ se hace mientras tanto. |
| D | §2, viñeta 2 (L33-34) | «El cobro con **tarjeta** se activará al completar el alta de cobros (Stripe); mientras tanto, Bizum y transferencia.» | 🔴 **PROHIBIDO en su segunda mitad.** «Mientras tanto, Bizum y transferencia» presenta un cobro por YaQu que existe hoy. Con OFF no hay ninguno (reglas 18 y 24). La primera mitad es cierta como condición (regla 18), pero se queda corta: también hace falta el interruptor. |
| E | §1, viñeta 5 (L23-24) | «…soporte por email y WhatsApp.» | 🟠 **No es de la regla 24, pero es falso.** SCRUM-406 midió que ese WhatsApp de soporte no existe, y lo retiró de `plansView.js` (`:113-115`, hoy «Soporte por email»). Aquí sigue. Y su guard (`tests/scrum406-canal-prometido-existe.test.mjs`) no lo ve: busca en `public/` y la página servida sale de `docs/legal/`, que queda fuera de su población. Lo que se sirve desde `docs/legal/` no lo mira ningún guard de «lo prometido existe». |
| F | §2, viñeta 1 (L28-29) | «facturación con sistema VERI*FACTU se activará al cerrar la certificación» | ⚪ **No es de este ticket.** Es P1/P2 de SCRUM-534, firmada (c.19531), y la aplica `jv-j4c` en `scrum-534q-aplica-las-siete`. Se nombra porque comparte unidad con C. |

**Lo que hace grave A y B** es el contraste dentro de la MISMA pantalla. SCRUM-1029 ya ocultó en
`plansView.js:102-116`, para `receipt`, la fila «Cobro integrado: el cliente paga desde el móvil» de la
lista del plan. Y en ese mismo modal, el `iframe` sigue enseñando «**Cobro integrado**: tu cliente paga
desde el móvil» al comercio al que se le escondió. Es más: se le pide que marque que lo ha leído y lo
acepta antes de pagar.

**Lo que no se ha medido:** si un comercio de fuera de España ve este documento. Para él, A y D podrían
ser ciertas: el interruptor no gobierna fuera de España, y la regla 24 habla de «merchants ES». La
unidad visible no dice país. La propuesta de abajo está escrita para España, que es España-first.

---

## ③ Las aceptaciones

Lo midió el fundador en producción (c.19537): 4 filas en `legal_acceptances`, todas del comercio 6, con
`doc_key` `alcance-beta`, `team_member_id` nulo y versión `48e3140b2083`, el 6-jul-2026 entre las 14:07 y
las 14:16.

**Medido hoy, y es nuevo:** `48e3140b2083` **sí sale del repo** si se calcula. No está escrito en
ninguna parte, pero es la huella que da `readLegalDoc` sobre el fichero del commit `328c18838` (5-jul,
«A10.1: contratación founding con aceptación del ALCANCE BETA»). La historia entera del fichero y del router:

| commit | fecha | qué cambia | versión servida |
|---|---|---|---|
| `54bef6705` | 13-jun | nace el borrador | — (la ruta aún no existía) |
| `328c18838` | 5-jul | nacen la ruta y la aceptación | **`48e3140b2083`** ← las 4 filas |
| `e52a4a445` | 8-jul | precio: «**14,50 €/mes** … (50 % del precio de lista, **29 €/mes**)» → «9,90 €/mes … 19,90 €/mes» | **`4deaa1a6d479`** ← la de hoy |
| `c30729832` (`main`) | 14-oct | — | `4deaa1a6d479` (control: igual que la de arriba) |

(El router `legalPages.routes.ts` no ha cambiado desde `328c18838`. Su función de huella es la misma en
las tres filas.)

Consecuencias:

1. **El freno del ticket no aplica.** Ninguna de las cuatro aceptaciones vale hoy para el checkout: el
   checkout busca la versión servida (`subscriptions.routes.ts:85`), y nadie ha aceptado `4deaa1a6d479`
   *según la consulta del fundador de ~04:00Z*. Cambiar el texto **no invalida ninguna aceptación vigente**.
2. **Lo que aceptó el comercio 6 no es sólo un texto anterior: es otro PRECIO.** Aceptó 14,50 €/mes de por
   vida sobre un precio de lista de 29 €. Si eso tiene valor de consentimiento, la pregunta que abrió
   c.19537 («un comercio aceptó en julio un texto que ya no es el que servimos») tiene un contenido
   concreto. **No es de este ticket**, como ya dijo c.19537. Se deja el dato.
3. **Antes de aplicar, la consulta se repite**, porque puede haber filas nuevas desde las ~04:00Z. Está
   en UNA sola sentencia, con el control dentro (la fila `total_tabla` sale aunque no haya ninguna de
   `alcance-beta`), y es de SÓLO LECTURA:

```sql
SELECT 'total_tabla' AS fila, NULL AS version, count(*) AS n, count(DISTINCT merchant_id) AS comercios, min(created_at) AS primera, max(created_at) AS ultima FROM legal_acceptances UNION ALL SELECT 'alcance-beta', version, count(*), count(DISTINCT merchant_id), min(created_at), max(created_at) FROM legal_acceptances WHERE doc_key = 'alcance-beta' GROUP BY version ORDER BY 1 DESC, 2;
```

   Qué se espera hoy: `total_tabla` = 4, y una fila `alcance-beta | 48e3140b2083 | 4 | 1`. **Si aparece
   `4deaa1a6d479`, alguien ya aceptó el texto de hoy, y cambiarlo SÍ le costaría esa aceptación.** Los
   nombres de columna salen de `prisma/schema.prisma:1299-1311`, que sólo se ha leído.

---

## ④ Propuesta de redacción (SIN APLICAR)

La base es la frase **ya firmada** de V0-6 (`YAQU_MASTER.md:1006`): «presupuestos+firma+**albaranes**;
**el cobro a tus clientes y** la facturación VeriFactu se activa**n** al cerrar la declaración responsable
del fabricante, sin cambio de precio». Y la regla 24, que dice qué sigue igual y que «el profesional cobra
por fuera de YaQu». Ninguna propuesta nombra VeriFactu ni la AEAT: así no hace falta el triple de la
regla 26. La única frase de §2 que los nombra es la de SCRUM-534 P2, y no se toca.

**Se escriben sobre el texto de la rama de `jv-j4c`** (`scrum-534q-aplica-las-siete` @ `c4531733`), que ya
pone P2 en la línea 29 sin mover líneas. Por eso se citan **por contenido**, no sólo por línea.

### R1 · §1, viñeta 3 (L21) — «Cobro integrado» sale de lo que incluye HOY

Hoy:

    - **Cobro integrado**: tu cliente paga desde el móvil; recordatorios automáticos de cobro.

Propuesto:

    - **Albaranes y partes de trabajo** de cada trabajo.

Son palabras de la regla 24 («albaranes y partes siguen igual») y de V0-6 («presupuestos+firma+albaranes»).
El cobro no desaparece del documento: pasa a §2 (R4), que es donde lo pone V0-6. No mueve líneas.

### R2 · §1, viñeta 4 (L22) — el justificante, fuera

Hoy:

    - **Justificantes de cobro** por cada pago recibido (documento no fiscal).

Propuesto: **quitar la línea**. Es el precedente de SCRUM-1029 y SCRUM-406: lo que no existe se retira,
no se reescribe. Mueve una línea hacia arriba todo lo que viene detrás (ver «coste»).

### R3 · §1, viñeta 5 (L23-24) — el soporte que existe

Hoy: «…tus datos siempre exportables; soporte / por email y WhatsApp.»
Propuesto: «…tus datos siempre exportables; soporte / por email.» Es la misma retirada de SCRUM-406
(`plansView.js:113-115`). No mueve líneas.

### R4 · §2, viñeta nueva al principio — el cobro, con su estado real al lado (la que recomiendo)

Propuesto, como primera viñeta de «2. Qué NO incluye todavía»:

    - El **cobro a tus clientes a través de YaQu** (enlace de pago, señal y recordatorios de cobro) se
      activará a la vez que la facturación del punto siguiente, **sin cambio de precio**. Hasta
      entonces YaQu no cobra por ti: cobras a tu cliente por tus medios de siempre.

«Se activará a la vez que la facturación» es V0-6 («el cobro a tus clientes y la facturación … se
activan»). «Cobras a tu cliente por tus medios de siempre» es la regla 24 («cobra por fuera de YaQu»)
dicho con las palabras que la cláusula ya usa más abajo («tu gestoría o tu sistema de siempre»). Y el
estado real («hoy no cobra por ti») va en la misma unidad que la promesa (regla 26). Añade tres líneas.

⚠️ «del punto siguiente» sólo es cierto si R4 va DELANTE de la viñeta de facturación. Si se pone detrás,
la frase es «del punto anterior».

### R5 · §2, viñeta de facturación — la cola de la frase P2 (L29-30 de la rama 534q)

Hoy, en la rama 534q (P2 ya puesto delante):

    …que publicaremos en cuanto el envío esté terminado. Hasta ese momento YaQu emite
      justificantes de cobro (no facturas fiscales); la facturación fiscal de tu actividad

Propuesto:

    …que publicaremos en cuanto el envío esté terminado. Hasta ese momento YaQu no emite
      facturas ni ningún otro documento de cobro; la facturación fiscal de tu actividad

«Ningún otro documento de cobro» es literal de la regla 24. **No toca nada de P2**: empieza en «YaQu»,
después del punto. No mueve líneas.

### R6 · §2, viñeta de tarjeta (L33-34) — sin el «mientras tanto»

Hoy:

    - El cobro con **tarjeta** se activará al completar el alta de cobros (Stripe);
      mientras tanto, Bizum y transferencia.

Propuesto:

    - Cuando el cobro se active, el pago con **tarjeta** necesitará además que completes
      el alta de cobros (Stripe).

Es la regla 18 (tarjeta sólo con Connect activo en ese comercio). Y no hay «mientras tanto» que prometer.
No mueve líneas.

### D1 · Una DECISIÓN, no una redacción: el aviso de borrador que no se ve

Las R1-R6 corrigen lo que el documento dice. No corrigen que la página sea **un borrador que se da a
aceptar sin decir que lo es**: partes en blanco, tres «[REVISAR ASESOR]» a la vista, y la cabecera que
lo advierte, oculta por ser cita. Hay tres salidas, y ninguna es de J4:

- (a) **Que se vea.** Sacar de la cita una línea visible: «Borrador pendiente de revisión legal: estas
  condiciones pueden cambiar antes de que se te cobre.» Es texto de usuario (regla 39) y no arregla las
  partes en blanco.
- (b) **Cerrar la aceptación** hasta el visto bueno del asesor. Es código (`subscriptions.routes.ts` /
  `plansView.js`), así que es de otro carril y del dinero de producción: STOP.
- (c) **Dejarlo como está**, sabiendo lo que se ve.

No recomiendo entre (a) y (b): cambia qué se vende hoy, y eso lo decide el fundador.

### Coste de aplicar

| qué | coste |
|---|---|
| aceptaciones vigentes que se pierden | **0** según la consulta de ~04:00Z: ninguna es de `4deaa1a6d479` (repetir la de ③ antes) |
| versión del documento | cambia. Con la rama 534q sola pasaría a `17275d59e185` (calculado); con R1-R6 encima, a otra. **Se recomienda aplicar todo en UN solo PR**: un único cambio de versión, y el comercio que acepte después lo hace sobre el texto bueno |
| quién cita `ALCANCE_BETA.md` por línea | `INVENTARIO_AFIRMACIONES_VERIFACTU.md` (C9: L28-29, según SCRUM-534) y el comentario de `tests/scrum341-condicion-precio-publicada.test.mjs:4` («ALCANCE_BETA.md:38», la condición del precio; medido hoy). R2 resta una línea y R4 suma tres, así que la L38 pasaría a ser la L40. El test lee el TEXTO de la condición, no la línea; el comentario quedaría desfasado. **Antes de aplicar se re-mide** quién cita qué línea |
| `MICROCOPY_BLOQUEADA` (`tests/scrum302-rotulos-completos.test.mjs`) | medido hoy: **0** apariciones de «cobro integrado», «justificante(s) de cobro», «alcance», «soporte por email y WhatsApp» o «Bizum y transferencia». Ninguna R espera al asesor por esa lista |

### Lo que la propuesta NO arregla

- La negrita rota de «VERI*FACTU» (el asterisco parte el par y salen asteriscos a la vista). Está en la
  frase de P1/P2, que no es de aquí. Ya la dijo SCRUM-534 §6.
- `public/terminos.html:48` («emitir facturas y gestionar cobros»): fuera de `docs/legal/`, sin leer entero.
- Que el texto esté bien como DERECHO. Se mide que cada frase es cierta contra el código y el máster.
  La cláusula entera sigue marcada para el asesor.
- Qué pasa con la aceptación de julio del comercio 6 (③.2).

---

## Lo que NO he medido

- Ninguna base: el ③ es la consulta del fundador y la de arriba, sin ejecutar.
- Si algún documento de `docs/legal/` salió del repo.
- Lo que ve un comercio de fuera de España.
- La pantalla real en un navegador. El recorrido modal → `iframe` sale de leer `plansView.js`, no de
  pulsarlo.
- `npm test`: este árbol no tiene dependencias ni `dist/`. Se corrieron a mano los guards que leen
  ficheros (abajo).

## Un error mío, contado

Para comprobar el `48e3140b2083` escribí una sonda que transpila el `readLegalDoc` real y lo ejecuta sobre
el fichero de cada commit. La primera pasada dio la **misma huella** para el texto de 14,50 € y para el de
9,90 €. La causa: cambiaba de carpeta DESPUÉS de cargar el módulo, y `LEGAL_DIR`
(`legalPages.routes.ts:13`) se fija con `process.cwd()` AL cargarlo. Las dos veces había medido el fichero
de `main`. Lo cazó que dos textos distintos no pueden dar la misma huella; corregida, salieron `48e3140b2083`
y `4deaa1a6d479`. Si los dos commits hubieran tenido el mismo texto, el error habría pasado callado.
Va a mis cicatrices (línea A9 de arriba).

## Aceptación → dónde se ve

| lo pedido | dónde se ve |
|---|---|
| ① barrer en el presente, por la ruta, con población | ① |
| la trampa de `>`, re-comprobada | ①, «Las líneas que empiezan por `>`» |
| ② claim prohibido o no, con contexto visible | ② |
| ③ aceptaciones, y re-comprobar `4deaa1a6d479` | ③ (más el origen de `48e3140b2083`, que es nuevo) |
| ④ proponer redacción con estado real y coste | ④, R1-R6, D1 y «Coste de aplicar» |
| aplicar | **NO HECHO, por mandato**: espera la firma del fundador sobre R1-R6 y su decisión sobre D1 |

---

# APÉNDICE · 22-oct-2026 · SCRUM-1551b · R1-R6 y D1 (a) aplicadas en `/legal/alcance-beta`

**Medido contra:** `origin/main` = `75884928b170ec0ec02e35921426e5bd711cbb0f` · 2026-10-22T09:03:57Z

A9: aviso → cicatriz J4 «en el cotejo de las R1-R6 puse «WhatsApp» a secas entre los textos que tenían que haber desaparecido, y el documento lo dice con razón en otra viñeta: el control habría dado «NO COINCIDE» para siempre, y al arreglar el fallo habría tentado quitar el control entero» — no se pudo comprobar: el cotejo es de un solo uso y vive fuera del repo

**Quién:** jv-j4j (puesto J4, equipo de Javier), por encargo del orquestador `cobroflash-backend-5f`.
Carril a mano: el hook de inicio dijo «SIN IDENTIDAD» (SCRUM-1498); se construye con la orden del
orquestador. Etiquetas leídas en el ticket: `area-j4`, `equipo-javier`, `decision-jefe`, `fundador`,
`legal`, `microcopy`, `sin-firma`, `verifactu`. Ninguna de equipo-luis.

## 1 · Las firmas, leídas en Jira

- `SCRUM-1551 c.20208` (22-oct, escrito por el orquestador; la firma es del fundador, dada en el
  chat): **«Firmo todas»** sobre R1-R6 de §④ de este registro.
- `SCRUM-1551 c.20217` (22-oct, igual): D1 → **«1-A»**, la opción (a), con el literal de §④ D1. En el
  mismo PR que R1-R6, un solo cambio de versión. (b) y (c), descartadas.

Los siete textos se han copiado de §④ de este registro, no de los comentarios ni del encargo.

## 2 · PASO 0

- SCRUM-534q **sí está en `main`**: `#2415`, merge `11ca1e05f`; la línea 29 de `main` ya llevaba P2.
  R5 se apoya en texto que `main` tiene.
- R1-R6 y D1 no estaban aplicadas: en el `ALCANCE_BETA.md` de `main` seguían «Cobro integrado»,
  «Justificantes de cobro», «email y WhatsApp», «YaQu emite justificantes» y «mientras tanto», y el
  único aviso de borrador estaba en la cabecera `>`, que no se sirve.
- Ninguna rama `scrum-1551<letra>-` en el remoto; el único PR con ese prefijo es `#2418` (MERGED).

## 3 · Lo aplicado: un solo cambio de versión

| qué | texto | líneas (antes → después) |
|---|---|---|
| D1 (a) | «Borrador pendiente de revisión legal: …», párrafo propio, FUERA de la cita `>` | — → L9 (+ L10 en blanco) |
| R1 | «Cobro integrado…» → «**Albaranes y partes de trabajo** de cada trabajo.» | L21 → L23 |
| R2 | fuera la viñeta «Justificantes de cobro…» | L22 → — |
| R3 | «soporte / por email y WhatsApp.» → «soporte / por email.» | L23-24 → L24-25 |
| R4 | viñeta nueva, primera de §2, DELANTE de la facturación («del punto siguiente» es cierto) | — → L29-31 |
| R5 | «YaQu emite / justificantes de cobro (no facturas fiscales)» → «YaQu no emite / facturas ni ningún otro documento de cobro» | L29-30 → L33-34 |
| R6 | tarjeta, sin el «mientras tanto» | L33-34 → L37-38 |

El documento pasa de 53 a 57 líneas. Fin de línea LF, sin BOM, como estaba.

**Dónde va D1, y por qué ahí:** es la primera línea que se sirve después del título. Servida por el
`readLegalDoc` real sale como `<h1>` → `<p>Borrador pendiente…</p>` → `<hr/>` → el contrato: se lee
antes de las partes, de §1-§5 y de la casilla de aceptar. Va como texto llano, sin negrita: el literal
firmado no la lleva.

**Cotejo byte a byte con §④** (scripts de un solo uso, fuera del repo):
- R1, R4, R5, R6: extrae los cuatro bloques «Propuesto» con sangría de §④ y los busca literales; R3
  por su frase con el salto; R2 por ausencia; y que no quede ninguna de las cinco frases retiradas.
  Sobre la rama: **4 de 4, R2 y R3 sí, 0 retiradas → COINCIDE.** Controles: el fichero de `main` →
  NO COINCIDE (0 de 4); la rama con UNA tilde quitada («señal» → «senal») → NO COINCIDE.
- D1: el literal se EXTRAE de §④ D1 por programa (96 caracteres, con el salto de línea del registro
  hecho espacio) y se inserta tal cual; aparece 1 vez en el documento.

## 4 · La versión del documento

Con el `readLegalDoc` REAL de `dist` (compilado con `tsc --noCheck`), cambiando de carpeta ANTES de
cargar el módulo (la cicatriz de 1551):

| qué | versión |
|---|---|
| fichero de `main` | `597cbb48f4b9` |
| `GET https://yaqu.app/legal/alcance-beta`, 22-oct ~08:59Z: HTTP 200, 4.563 B | `597cbb48f4b9` (producción sirve `main`) |
| esta rama (R1-R6 + D1) | **`ac7349fd0b84`** |

En el texto servido de la rama, «Cobro integrado» ya no se ve y «Albaranes y partes» sí; en el de
`main`, al revés.

## 5 · Citas por línea, re-medidas

`git grep` de `ALCANCE_BETA` seguido de `:N`, `L`, «línea» o `§`, fuera de `docs/master/`: 3 citas.
D1 suma dos líneas antes de todo, R2 resta una y R4 suma tres.

| quién | antes | ahora | qué se hizo |
|---|---|---|---|
| `docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md:320` (C9) | `:28-29` | `:32-33` | corregida (sólo el número; la cita de C9 es un texto viejo y no se toca) |
| `tests/scrum341-condicion-precio-publicada.test.mjs:4` (comentario) | `:38` | `:42` | corregida; el test lee el TEXTO de la condición, no la línea |
| `docs/go-live/puerta.json:35`, fila 4 CERRADA | `:28` | — | **no se toca**: es el motivo de un cierre del 14-oct y describe la línea de aquel día |

`MICROCOPY_BLOQUEADA` (`tests/scrum302-rotulos-completos.test.mjs:78`): una sola entrada,
`btnConvertirFactura`. Ningún texto de aquí espera al asesor por esa lista.

## 6 · Lo que NO se ha hecho

- **La consulta de aceptaciones de ③ NO se ha lanzado**: es contra producción. Queda pendiente y la
  pide el orquestador. Hasta tenerla, que nadie haya aceptado `597cbb48f4b9` no está medido.
- Las filas 2 (R1-R6) y 3 (D1) de `docs/go-live/puerta.json` siguen `abierta`: cerrarlas pide el sha
  de merge, que no existe hasta que entre.
- D1 hace visible el aviso; NO arregla las partes en blanco ni los tres «[REVISAR ASESOR]» (§④ D1 ya
  lo decía).
- `public/terminos.html` (c.20051) y el `<p>` partido de las viñetas largas (fila 9 de la puerta: R4
  tiene tres líneas y se servirá partida igual que las demás) no son de este tramo.
- La página con el texto nuevo en `yaqu.app`: hasta el merge, producción sirve `597cbb48f4b9`.

## 7 · Aceptación → dónde se ve

| aceptación (del encargo) | dónde se ve |
|---|---|
| re-medir quién cita `ALCANCE_BETA.md` por línea y corregir las que se mueven | §5; diff de C9 y de `scrum341:4` |
| R1-R6 (y D1, c.20217) en UN commit / PR, un único cambio de versión | `docs/legal/ALCANCE_BETA.md` en esta rama; §4 (`ac7349fd0b84`) |
| consulta de aceptaciones de ③ | NO HECHO → contra producción; la pide el orquestador |
| tests que leen el documento y guards de microcopy y legales en verde | §8 |

## 8 · Tests

Corridos en este árbol con `dist` de `tsc --noCheck`, sobre 283 ficheros (los que leen `docs/legal/`,
`docs/master/` o las cicatrices, los de anclas, y 1554c, 406, 273, 237, 850, 1294, 1572). Recuento en
el comentario de entrega de Jira.

## Dos errores míos, contados

1. En el cotejo puse «WhatsApp» a secas entre las frases que tenían que haber desaparecido. El
   documento la dice, con razón, en otra viñeta («envío al cliente final por WhatsApp», L18): el
   cotejo salía «NO COINCIDE» con el texto ya bien puesto. Lo cacé leyendo qué línea casaba antes de
   tocar el documento; el término pasó a ser la frase retirada entera, «email y WhatsApp». Va a mis
   cicatrices.
2. En la primera versión de este tramo, la línea `A9:` citaba un TROZO de esa cicatriz. El guard de la
   A9 (`tests/scrum1294-a9-leccion-en-a10.test.mjs`) compara la frase ENTERA y cayó: lo cazó el guard,
   no yo. Ahora va la frase entera.

---

# APÉNDICE · 22-oct-2026 · SCRUM-1551c · Lo servido FUERA de `docs/legal/`: qué choca con la regla 24 y con R1-R6, y cómo decirlo (SIN APLICAR)

**Medido contra:** `origin/main` = `0077bd1d51a7cb64b1c18d85781117b71936fd38` · 2026-10-22T10:04:14Z

A9: aviso → cicatriz J4 «mi barrido de la landing leyó el HTML servido sin mirar el atributo hidden y sacó como frases a la vista las de #gremios y #comparativa, que en un navegador no se ven; casi las llevo a firma como promesas vivas» — no se pudo comprobar: el barrido es de un solo uso y vive fuera del repo; lo cazó leer antes de proponer el censo de SCRUM-1158, que midió la visibilidad en un navegador

**Quién:** jv-j4l (puesto J4, equipo de Javier), por encargo del orquestador `cobroflash-backend-5f`.
Carril a mano: el hook de inicio dijo «SIN IDENTIDAD» (SCRUM-1498). Etiquetas leídas en el ticket:
`area-j4`, `equipo-javier`, `decision-jefe`, `fundador`, `legal`, `microcopy`, `sin-firma`, `verifactu`.
Ninguna de equipo-luis. Se leyó SCRUM-1551 entero en Jira (descripción y 9 comentarios, hasta c.20232).

**Es una medición y una PROPUESTA. No se aplica nada.** No se toca `public/`, ni `src/`, ni
`docs/legal/`, ni ningún guard o workflow. No se ha tocado ninguna base ni ninguna credencial. Sólo
entran este tramo y una línea en `docs/equipo/cicatrices/J4.md`.

## 1 · Lo primero: producción NO es `main` (y lo de 1551b no está servido)

| qué | medido (22-oct, ~09:57Z y 10:03Z, hora de GitHub) |
|---|---|
| `GET yaqu.app/version` | `fe65a8b7fca8b1e42448c8134e26d880d96b9ba7` (merge del 20-oct, 15:35Z) |
| último despliegue de «production» (`gh api …/deployments`) | `fe65a8b7f`, creado 2026-10-20T15:35:37Z; ninguno después |
| `GET yaqu.app/legal/alcance-beta` | «Versión del documento: `597cbb48f4b9`»: el texto ANTERIOR a 1551b; sigue diciendo «Cobro integrado» y «Justificantes de cobro» |

La causa no es de este carril ni la he mirado; según el orquestador, Railway tiene los despliegues
en pausa por un problema de su lado. Consecuencia para este tramo: **todo se mide dos veces**, lo que
sirve producción (la RUTA, que es lo que ve el usuario hoy) y el fichero de `main` (lo que verá al
desplegar). Para lo de abajo coinciden en el texto:

- `/terminos`, `/privacidad`, `/precios`: idénticos al fichero de `main` salvo el ofuscado de correo
  que inyecta Cloudflare (`/cdn-cgi/l/email-protection`). Medido con `diff`.
- `/` (landing): idéntica a `public/index.html` de `fe65a8b7f`. `main` le suma 15 líneas, todas de CSS
  (SCRUM-1570c, fuentes de reserva): **ni una palabra visible cambia**, pero los números de línea sí.
  Por eso cito la landing con las dos líneas: `fe65a8b7f` / `main`.

## 2 · Población, y cómo se eligió

**Por la ruta.** Rutas pedidas a `yaqu.app`: `/`, `/precios`, `/terminos`, `/privacidad`,
`/legal/alcance-beta` (200 las cinco) · `/login` y `/register` (404: no se sirven por ese nombre) ·
`/admin` (401) · `/dashboard` (301, detrás del acceso: fuera; lo de dentro lo censó SCRUM-1029).

**Instrumento:** el HTML de cada ruta, sin `<script>`, `<style>` ni comentarios, partido en unidades
de bloque (`p`, `li`, `h*`, `td`, `summary`, `a`, `button`…), más los atributos que se leen
(`title`, `aria-label`, `alt`, `placeholder`) y los `meta` de descripción. Casa contra
`factur|cobr|justificant|veri*factu|hacienda|aeat|bizum|transferencia|tarjeta|stripe|recibo|por ti|pago|pagar|paga|señal`.

| página | unidades visibles | casan |
|---|---|---|
| `/terminos` | 47 (+1 sembrada) | 7 (+1) |
| `/privacidad` | 51 | 13 |
| `/precios` | 24 | 1 |
| `/` | 228 | 20 |
| `/legal/alcance-beta` (producción, control) | 37 | 8 |
| **total** | **387** | **50** (+1 sembrada) |

**Controles:**
- POSITIVO SEMBRADO: el instrumento inyecta en la primera página una frase propia («…YaQu cobra por ti
  y emite facturas…») y exige verla; sin ella sale con código 2 y «CIEGO». Corrido las dos formas: con
  ella, VISTO; quitándola, CIEGO (exit 2).
- Natural: en `/legal/alcance-beta` de producción salen «Cobro integrado» y «Justificantes de cobro»,
  que hoy están ahí (punto 1). Es el control de que el lector ve lo que se sirve; no se usa como
  positivo porque desaparece al desplegar.
- ⚠️ Límite medido, y error mío (cicatriz): el instrumento **no distingue `hidden`**. En la landing hay
  tres secciones ocultas que se sirven en el HTML (`#heroe-f4`, `#gremios`, `#comparativa`). Su
  visibilidad la midió SCRUM-1158 en un navegador real (Edge, a 1280 y 360, 15-oct): se ven el
  subtítulo vivo, la tarjeta «Cobros», el `aria-label` de la animación y la llamada final; no se ven
  `#gremios` ni `#comparativa`. Para eso me fío de su medición, no de la mía, y lo digo.

**Emails transaccionales:** no se pueden pedir por una ruta; se leyeron en el CÓDIGO (texto de
plantilla), no en un correo recibido. Ficheros: `lifecycle.service.ts`, `weeklyDigest.service.ts`,
`auth.service.ts`, `email.service.ts`, `merchantNotifications.ts`, `team.service.ts`, `avisoDeCorreo.ts`,
`avisoConstancia.ts`, `constanciaCorreo.ts` (9). Que una línea esté detrás de una condición se ha leído;
que esa condición se cumpla o no para un comercio ES con el interruptor en OFF **no se ha ejecutado**.

**Fuera de la población:** el panel (`/dashboard`, detrás del acceso), los PDF, el bot y las
plantillas de WhatsApp (lo censó SCRUM-1236, S4); `docs/legal/` (es 1551 y 1551b).

## 3 · Veredicto por unidad visible, y propuesta

Vara: la regla 24, literal (`YAQU_MASTER.md:246`, leída entera: 2.922 caracteres): «Con el interruptor
en OFF, YaQu no emite ningún documento para ese merchant —ni factura, ni justificante, ni ningún otro
documento de cobro— y no cobra por YaQu a sus clientes: ni enlace de pago, ni señal al aceptar el
presupuesto, ni recordatorios de pago […]. Presupuestos, firma, albaranes y partes siguen igual. El
profesional cobra por fuera de YaQu hasta que exista la factura.»

⚠️ **La regla 24 gobierna a un comercio ES con el interruptor en OFF**, no a la plataforma. Los términos
y la privacidad los lee todo el mundo (también el demo, que sí emite con marca de agua). Por eso las
propuestas de los términos dicen «En España»: es la única palabra que añado, y la señalo.

Las palabras de las propuestas salen de lo ya firmado en `SCRUM-1551 c.20208` (R1-R6, copiadas de §④
de este registro) y de la regla 24. Ninguna nombra VeriFactu, la AEAT ni Hacienda: no hace falta el
triple de la regla 26. Ninguna lleva fecha.

### T1 · `/terminos` §1 «Descripción del servicio» (`public/terminos.html:48`) — 🔴 CHOCA

Hoy:

    YaQu es una plataforma SaaS que permite a profesionales de servicios crear cotizaciones, enviarlas
    por WhatsApp, recoger firmas digitales, emitir facturas y gestionar cobros. El servicio se presta
    «tal cual» y puede evolucionar con el tiempo.

Por qué: es la descripción del servicio CONTRATADO, en presente. «emitir facturas» contradice «no
emite ningún documento»; «gestionar cobros», «no cobra por YaQu». Ya está en la puerta de go-live
(fila 7); aquí va leído entero y con su propuesta.

Propuesto (recomendada, T1a):

    YaQu es una plataforma SaaS que permite a profesionales de servicios crear cotizaciones, enviarlas
    por WhatsApp y recoger firmas digitales. En España, el cobro a tus clientes a través de YaQu se
    activará a la vez que la facturación; hasta entonces YaQu no cobra por ti y no emite facturas ni
    ningún otro documento de cobro. El servicio se presta «tal cual» y puede evolucionar con el tiempo.

Sale de R4 («El cobro a tus clientes a través de YaQu […] se activará a la vez que la facturación […].
Hasta entonces YaQu no cobra por ti») y de R5 («YaQu no emite facturas ni ningún otro documento de
cobro»). Quito de R4 «sin cambio de precio» A PROPÓSITO: en `/legal/alcance-beta` es una promesa a los
founding; en los términos generales sería la misma promesa a TODO suscriptor, y eso no está firmado.
Si el jefe la quiere, es T1b = T1a + «, sin cambio de precio» detrás de «la facturación».

### T2 · `/terminos` §6 «Facturación y cumplimiento fiscal» (`public/terminos.html:80`) — 🔴 CHOCA

Hoy:

    YaQu te ayuda a generar documentos de cotización y factura, pero la responsabilidad del
    cumplimiento fiscal y de la veracidad de los importes recae en ti como profesional. YaQu no presta
    asesoramiento fiscal ni legal.

Por qué: «factura», en presente (lo encontró S0, `SCRUM-1551 c.20051`). Es la misma familia que T1 y
se firman juntas.

Propuesto:

    YaQu te ayuda a generar documentos de cotización. En España, hasta que se active la facturación,
    YaQu no emite facturas ni ningún otro documento de cobro. La responsabilidad del cumplimiento
    fiscal y de la veracidad de los importes recae en ti como profesional. YaQu no presta
    asesoramiento fiscal ni legal.

R5 literal en medio; el resto es la frase de hoy sin tocar. El título «6. Facturación y cumplimiento
fiscal» se queda: nombra el asunto, no promete nada.

⚠️ T1 y T2: la fecha «Última actualización: 3 de junio de 2026» (`terminos.html:43`) quedaría falsa.
Cambiarla es texto que ve el usuario y la pongo como T3, sin literal: la fecha la da quien aplica, el
día que aplica. Y §10 dice que «el uso continuado […] implica su aceptación»: si eso vale como
derecho es pregunta del asesor, no de aquí.

### L · La landing (`/`) — lo visible ya está censado; quedan dos sin censar

Ya en la puerta de go-live (no se repiten aquí; se citan para que la firma vaya junta):

| fila de la puerta | unidad (líneas `fe65a8b7f` / `main`) | estado |
|---|---|---|
| 14 | subtítulo vivo `:427` / `:442`, «…y te paga — con tarjeta, Bizum o transferencia. Y llevas clientes, gastos y facturas en el mismo sitio.» | recambio YA firmado (SCRUM-1016); falta aplicarlo, J3 |
| 11 | tarjeta «Cobros» `:638` / `:653`, «Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.» | abierta; además de «Tarjeta», choca con la regla 24 entera (recordatorios de pago, pantalla de Cobros) |
| 12 | `aria-label` «Demostración: de presupuesto a cobro» | abierta |
| 13 | llamada final | abierta (no es de la regla 24) |

Ocultas (`hidden`) y servidas en el HTML: la primera frase del héroe oculto (`:507` / `:522`, sin firmar;
SCRUM-1016l la deja al fundador), los cinco de `#gremios` («cobras al terminar», «La señal entra antes
de que compres la pintura»…) y `#comparativa` («Tu libreta no firma, no cobra y no avisa», «La factura
lleva tres semanas sin pagarse…»). No se ven hoy; el día que alguien quite el `hidden`, sí. No propongo
texto para ellas: están marcadas `PENDIENTE_FUNDADOR` / `microcopy-sin-aprobar` y tienen su ticket.

**Las dos que NO están en la puerta ni en SCRUM-1016 con su texto de hoy** (buscadas por cadena exacta en
`docs/master/`, `docs/go-live/` y `docs/microcopy/`; cero resultados con esa cadena no prueba que nadie
las haya firmado con otra redacción):

**L1 · FAQ «Ya mando presupuestos por WhatsApp gratis. ¿Para qué esto?»** (`:731` / `:746`, visible,
`<details open>`) — 🔴 CHOCA en su última frase:

    Hoy:       …Y aquí además llevas clientes, gastos y facturas en el mismo sitio.
    Propuesto: …Y aquí además llevas clientes, gastos y albaranes en el mismo sitio.

«albaranes» es de R1 y de la regla 24 («Presupuestos, firma, albaranes y partes siguen igual»).

**L2 · `meta` de descripción** (`:7` y `:15`, iguales en los dos) — 🔴 CHOCAN, y además viajan SUELTOS
(buscador, redes): nunca llevan matiz consigo.

    description, hoy:      …tu cliente los firma desde el móvil. Clientes, gastos, facturas y bot — todo en un sitio.
    description, propuesto: …tu cliente los firma desde el móvil. Clientes, gastos, albaranes y bot — todo en un sitio.
    og:description, hoy:      …firma desde el móvil. Clientes, gastos y facturas en el mismo sitio.
    og:description, propuesto: …firma desde el móvil. Clientes, gastos y albaranes en el mismo sitio.

`twitter:description` («Y toda la gestión en un sitio.») no choca.

🟡 **No choca, y no propongo cambio:** FAQ «¿Y si un día lo dejo?» (`:734` / `:749`): «…clientes,
presupuestos, facturas, cobros, trabajos y gastos se exportan en CSV cuando quieras». Promete exportar
lo que haya, no emitirlo; y su núcleo es la respuesta de objeción del máster (`YAQU_MASTER.md:232`,
«Tus datos se exportan en CSV cuando quieras»). Lo señalo por si el jefe prefiere quitar «facturas,
cobros» por coherencia.

### P · `/privacidad` — 🟡 no choca; no propongo cambio

Trece unidades nombran facturas o cobros («crear y enviar presupuestos, partes de trabajo, facturas y
recordatorios de cobro», «Procesar cobros y tu suscripción», «presupuestos y cobros», «páginas de
presupuesto, firma y pago»…). Mi lectura, para que la decida un jefe: **una política de privacidad no
promete un servicio, declara los tratamientos que la plataforma PUEDE hacer**, y la plataforma los
hace (demo, comercios fuera de España, interruptor en ON). Quitar un fin que existe es el error
peligroso en RGPD; declarar uno que a un comercio concreto hoy no le aplica, no. Si el jefe quiere
matizarla, es pregunta del asesor (`docs/legal/PREGUNTAS_ASESOR.md`), no una redacción mía.

### `/precios` — sin choque

Una unidad casa: «Sin tarjeta para empezar · Cancelas cuando quieras». Habla de la suscripción.

### Emails (leídos en el código) — sin propuesta

- `lifecycle.service.ts` (J3): las frases de cobro («cobrar antes de empezar», «Las facturas se
  generan solas al cobrar») van detrás de `getEmissionMode(m) !== 'receipt'` (`:141`, `:164`, `:205`).
- `weeklyDigest.service.ts` (J3): oculta en `receipt` el bloque «Firmado y sin facturar» (`:118`), pero
  pinta siempre «💰 Cobrado», «🧾 Facturas emitidas» y, con cero, «✅ ¡No tienes facturas pendientes de
  cobro!». SCRUM-1029 §5 lo dio por bueno («informes de hechos pasados, no promesas»). No lo reabro;
  digo sólo que la línea verde de cada lunes es la que más se lee como capacidad del producto.
- `email.service.ts` («justificante de cobro» / «factura», `:91`) y `merchantNotifications.ts` («💰 ¡Pago
  recibido!», `:54`; «Ya puedes emitir la factura» detrás de `puedeEmitirFactura`, `:140`): **carril S1,
  equipo de Luis**. Salen al emitir o al cobrar; con OFF no debería ocurrir ninguna de las dos cosas,
  pero que sean INALCANZABLES no lo he ejecutado: está leído, no medido.

## 4 · La negrita rota de VERI*FACTU — ya está arreglada (PASO 0)

§④ de este registro la daba por pendiente. **No lo está:** SCRUM-534r (PR #2425, merge `cd99c7139`)
cambió `ALCANCE_BETA.md` a `VERI*****FACTU`, y lo vigila `tests/scrum534r-el-p1-se-ve-entero.test.mjs`
(en `main`). La fila 4 de la puerta está `cerrada`.

Medido hoy en producción (`fe65a8b7f`, que ya lo lleva): sale
`<strong>facturación con sistema VERI</strong>*<strong>FACTU se activará al cerrar la declaración responsable</strong>`.
En pantalla se lee «La facturación con sistema VERI*FACTU se activará…»: **un solo asterisco, el del
nombre**, en peso normal entre dos negritas. No quedan asteriscos sueltos.

**¿Es texto firmado?** Sí: es el P1/P2 de `SCRUM-534 c.19531`, y el arreglo de la negrita lo autorizó
`SCRUM-534 c.19585` («Ok»). No hay nada que proponer. Lo único que queda del mismo sitio es la fila 9
de la puerta (la continuación de la viñeta sale como `<p>` suelto), que es del renderizador (J3).

Fuera de `docs/legal/`, `VERI*FACTU` no aparece en ninguna página servida de la población.

## 5 · Carril de cada fichero (`docs/equipo/dos-equipos.md` §3)

| fichero | carril | qué le toca |
|---|---|---|
| `public/terminos.html` (T1, T2, T3) | **J3** construye; J4 propone; firma un jefe | `:148` |
| `public/privacidad.html` | J3 / J4 | sin cambio propuesto |
| `public/index.html` (L1, L2 y filas 11-14) | **J3** | `:147`; el texto de la landing es N5 (regla 30): cambiarlo es cambio de máster |
| `public/precios.html` | J3 | nada |
| `lifecycle.service.ts`, `weeklyDigest.service.ts` | J3 | `:126`; nada propuesto |
| `email.service.ts`, `merchantNotifications.ts` | **S1 — equipo de Luis** | `:136` («el resto de messaging»); nada propuesto; sólo la alcanzabilidad sin medir |
| `legalPages.routes.ts` (fila 9) | J3 | `:129` |

## 6 · Lo que NO he medido

- Por qué no despliega producción (punto 1): no tengo acceso a Railway ni lo he intentado.
- La visibilidad de la landing en un navegador: me fío de SCRUM-1158 (15-oct) y del mapa de
  `<section hidden>` de `fe65a8b7f`; no he abierto un navegador.
- Ningún email recibido: los textos están leídos en el código.
- Que T1, T2, L1 y L2 no estén ya firmadas con otra redacción en Jira: lo busqué en el repo, no en Jira.
- Si «En España» y el «sin cambio de precio» de T1b son correctos como DERECHO: es del asesor.

## 7 · Aceptación → dónde se ve

| aceptación (del encargo) | dónde se ve |
|---|---|
| barrido de lo servido fuera de `docs/legal/`, por la ruta, con población y positivo | §2 |
| por frase: dónde, por qué choca y propuesta con palabras de R1-R6/D1 | §3 (T1, T2, L1, L2; T3 sin literal) |
| la negrita rota de VERI*FACTU: dónde se ve, propuesta, si es firmada | §4: ya arreglada (SCRUM-534r); firmada en c.19531/c.19585 |
| carril de cada fichero; lo del equipo de Luis, listado | §5 |
| firma de T1, T2, L1, L2 | **NO HECHO** → la lleva el orquestador al fundador; aplicar es de J3 |

---

# APÉNDICE · 22-oct-2026 · SCRUM-1551d · T1, T2, L1 y L2 aplicados (firma c.20256), y T3

**Medido contra:** `origin/main` = `82f3ea4115723db78ca56c4b2e1c426a810a0433` · 2026-10-22T15:02:43Z

A9: sin fallo que generalice — el único rojo del tramo (`scrum564`, 3 casos) era la consecuencia esperada de cambiar un texto que su catálogo declara, y se arregló actualizando el texto declarado; no quedó ninguna lección que no esté ya en A10

**Skill UI:** cargada

**Quién:** jv-j3ab (puesto J3, equipo de Javier), por encargo del orquestador `cobroflash-backend-62`; aplica en
local lo que dejó jv-j3aa (commit `2ddbb37986aa7e87676400585bf34b6895de26a4`). Carril a mano: el hook de inicio
dijo «SIN IDENTIDAD» (SCRUM-1498). `public/terminos.html` y `public/index.html` son de J3 (§5 de 1551c).

## 1 · Qué entra

| propuesta (tramo 1551c) | fichero | cambio |
|---|---|---|
| T1 (T1a, sin «sin cambio de precio») | `public/terminos.html:48` | §1 «Descripción del servicio», el literal propuesto entero |
| T2 | `public/terminos.html:80` | §6, el literal propuesto entero; el título de §6 se queda |
| T3 | `public/terminos.html:43` | «Última actualización: 3 de junio de 2026» → «22 de octubre de 2026» |
| L1 | `public/index.html:746` | FAQ «¿Para qué esto?»: «facturas» → «albaranes» |
| L2 | `public/index.html:7` y `:15` | `description` y `og:description`: «facturas» → «albaranes» |
| consecuencia de L1 | `scripts/_afirmaciones-publicadas.mjs` (`faq/div#1`) | el texto declarado pasa a ser el del marcado; mismas anclas |

Sólo cambia texto: ninguna clase, ningún estilo, ninguna etiqueta. Ni `src/`, ni `docs/legal/`, ni el esquema.

## 2 · El literal, cotejado por programa

Los cinco literales se sacaron del §3 del tramo 1551c (los bloques «Propuesto») y se buscaron tal cual en
`public/`: **5 de 5 casan**. Control positivo sembrado (una frase de T2 que no cambia): casa. Control negativo
(«emitir facturas y gestionar cobros», el texto viejo de T1): no casa.

**Contra Jira, cotejado por jv-j3ah el 23-oct** (jv-j3ab no pudo: su MCP de Atlassian no conectaba). Leído
SCRUM-1551 entero (13 comentarios, el último c.20334). La T1 que firma c.20256 es la **T1a** (lo dice: «sin
"sin cambio de precio" a propósito»). **T3 firmada en c.20334** («Sí vale», a la fecha «22 de octubre de 2026»).
Siete frases copiadas de la respuesta de Jira (T1, T2 ×2, T3, L1, las dos de L2) y buscadas con `grep -F` en
`public/`: **7 de 7 casan, una vez cada una**. Control negativo (T2 con una tilde quitada): 0. Los textos viejos
de T1, T2, T3 y de `description`, y «sin cambio de precio»: 0. «gastos y facturas» sigue 2 veces, en `:35` y
`:442`, las dos del §4.

## 3 · `scrum564`: qué compara y por qué no es relajarlo

`tests/scrum564-afirmaciones-publicadas.test.mjs` compara el catálogo `ANCLAS_564` con el marcado de la landing
de ESTE árbol (`leerLanding`, no un commit). Con L1 aplicado caían 3 casos: `faq/div#1` dejaba de estar declarada
y su texto ya no era el del marcado. Se cambió la palabra en el texto declarado. Ningún caso quitado, ninguna
entrada borrada, ningún número tocado (19 afirmaciones; 14 / 2 / 1 / 2 por grupo). Después: 25 de 25 (564 y 564b).

## 4 · Lo que sigue diciendo «facturas» y NO se toca (fuera de lo firmado)

- `public/index.html:35` · JSON-LD: «…gestión de clientes, gastos y facturas.»
- `public/index.html:442` · subtítulo: «…Y llevas clientes, gastos y facturas en el mismo sitio.» (fila 14 de la
  puerta; recambio firmado en SCRUM-1016, sin aplicar)
- `public/index.html:749` · FAQ «¿Y si un día lo dejo?»: «…presupuestos, facturas, cobros, trabajos y gastos se
  exportan en CSV…» (1551c lo da por no chocante)

## 5 · Tests

Mini-tanda en local sobre el árbol fusionado con `82f3ea41…`: los 213 ficheros que leen `index.html`,
`terminos`, el catálogo de 564 o `public/`, más 267, 273, 1294, 811c, 976, 237, 812, 850, 299 y 400. Antes de este
tramo: 1.968 casos · 1.961 pasan · 5 se saltan · 2 caen (`scrum811c`/1340, que pide este tramo con su
`**Skill UI:**`, y `scrum976` ④, que corre esos guards). Después, con este tramo comiteado: 1.968 casos ·
1.963 pasan · 5 se saltan · 0 caen (las tres cifras suman el total; 1.968 líneas `ok` de primer nivel en el TAP).

## 6 · Lo que NO se ha hecho

- Verificar en yaqu.app: producción no despliega desde el 20-oct 15:35Z. Nada de esto está servido.
- Abrir un navegador: el cambio es de palabras dentro de nodos que ya existían.

## 7 · Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| T1, T2, L1, L2 aplicados con el literal firmado | `public/terminos.html:48`, `:80`; `public/index.html:7`, `:15`, `:746` |
| la fecha de los términos, al día | `public/terminos.html:43` |
| el catálogo de 564 dice lo que dice la landing | `tests/scrum564-afirmaciones-publicadas.test.mjs` |
| servido en yaqu.app | **NO HECHO** → producción sin desplegar desde el 20-oct; lo mira quien despliegue |

---

# APÉNDICE · 23-oct-2026 · SCRUM-1551e · J1, C1 y S3 aplicados en la landing (firma c.20437)

**Medido contra:** `origin/main` = `a34ce744b28c389c480791158b976e2b3caf0b49` · 2026-10-23T09:51:00Z

A9: sin fallo que generalice — el único rojo propio del tramo (`scrum564`, por C1) era la consecuencia esperada de cambiar un texto que su catálogo declara, y se resolvió actualizando el texto declarado con la misma ancla; los otros dos rojos (`scrum1340`, `scrum976` ④) pedían este mismo tramo

**Skill UI:** cargada

**Quién:** jv-j3aq (puesto J3, equipo de Javier), por encargo del orquestador `cobroflash-backend-62`. Carril a
mano: el hook de inicio dijo «SIN IDENTIDAD» (SCRUM-1498). `public/index.html` → J3
(`node scripts/carriles.mjs de public/index.html`, `dos-equipos.md:147`). La skill `yaqu-premium-ui` se cargó
ANTES de tocar la página. Cambio sólo de texto: ni clases, ni tokens, ni estructura.

## 1 · Qué entra

| sitio | firma | hoy → firmado |
|---|---|---|
| `public/index.html:35` (JSON-LD, `description`) | J1 | «…gestión de clientes, gastos y facturas.» → «…gestión de clientes, gastos y albaranes.» |
| `public/index.html:442` (subtítulo visible del héroe) | S3 | «Crea el presupuesto en 30 segundos, tu cliente lo firma desde el móvil y te paga — con tarjeta, Bizum o transferencia. Y llevas clientes, gastos y facturas en el mismo sitio.» → «Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Y llevas clientes, gastos y albaranes en el mismo sitio.» |
| `public/index.html:749` (FAQ «¿Y si un día lo dejo?») | C1 | «…clientes, presupuestos, facturas, cobros, trabajos y gastos…» → «…clientes, presupuestos, trabajos y gastos…» |
| `scripts/_afirmaciones-publicadas.mjs` (`faq/div#4`) | — | el texto declarado pasa a ser C1; MISMA ancla (`CSV`), ningún caso quitado |
| `docs/go-live/puerta.json`, fila 14 | — | sólo `condicion`: «Aplicarlo, sin firma nueva.» → superada por S3 (c.20437); el recambio de c.19607 NO se aplica |

## 2 · El literal, extraído por programa

Los tres «Hoy» y J1, C1 y S3 se sacaron por programa del cuerpo de **c.20377** (la propuesta de jv-j4m), devuelto
por el MCP de Jira; c.20437 dice «se copian de c.20377 byte a byte». J1 es un fragmento con «…» delante: se
ancló al «Hoy» de J por su comienzo común. Cada «Hoy» casó **exactamente 1 vez** en `public/index.html` antes de
sustituirse (si no, el programa sale con rojo y no escribe). Los tres nuevos coinciden con los que repite c.20437.

PASO 0: en `origin/main` no había ningún commit con «1551e», ni rama `scrum-1551[a-z]?-` viva; los PR de 1551
(#2418, #2657, #2678, #2697) están todos MERGED. Los tres textos de hoy seguían en :35, :442 y :749.

## 3 · Guards que miran estos textos

- `scrum564` (`_afirmaciones-publicadas.mjs`): declaraba el texto viejo de la FAQ del CSV. Igual que hizo 1551d con
  `faq/div#1`, se actualiza el texto declarado al literal FIRMADO, citando c.20437, sin quitar casos ni anclas.
- `tests/scrum331-heroe.test.mjs`: **verde** con S3. S3 no nombra AEAT, Hacienda ni VeriFactu, así que su lista
  negra del :121 no aplica. El dato del 14-oct (bloqueaba el recambio de c.19607) era de OTRO texto, que no entra.
- El subtítulo ESPEJO (`_registro-de-lo-aprobado.mjs:66`, `censo-anclas-bloque-f.mjs:140`) NO se toca: es otra
  frase («…No hace falta que te fíes…»), firmada en SCRUM-1016 c.19608.
- `scrum299:115-117` y `scrum400:65-66` citan «gastos y facturas» como cadenas de sus controles fabricados, no
  leyendo el fichero: verdes.
- `scrum1554c` (la puerta): verde con la fila 14 cambiada. La fila sigue `abierta`: el guard exige el sha para
  cerrarla, y el del merge todavía no existe.

## 4 · Tests

Mini-tanda en el worktree, con `dist` compilado con `tsc --noCheck` (árbol anidado sin `node_modules` propio):
los **414 ficheros** que nombran `index.html`, `public/`, `_afirmaciones-publicadas`, `_registro-de-lo-aprobado`,
`puerta.json` o `_copy-publico`, más 1294, 273, 237, 976, 850, 811c y 267. Sin este tramo:
**3.895 casos · 3.888 pasan · 5 saltados · 2 caen** (3.888 + 5 + 2 = 3.895). Los 2: `scrum1340` (PR que toca
`public/` sin `**Skill UI:**` en su registro) y `scrum976` ④ (que corre esos guards). Los dos piden este tramo.
El resultado con el tramo comiteado y el del obligatorio van en el comentario de Jira de la entrega.

## 5 · Lo que NO se ha hecho

- **Servido en yaqu.app:** no mirado; se mira tras el despliegue del merge (`/` → el subtítulo, el JSON-LD y la FAQ).
- **Cerrar la fila 14** de la puerta: con el sha del merge, quien cierre.
- `index.html:696` («La factura lleva tres semanas…») sigue, dentro de `#comparativa` (`hidden`), fuera de lo
  firmado: es la factura del profesional, no un documento de YaQu (c.20377 §0).

## 6 · Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| J1, C1, S3 literales (c.20437 sobre c.20377) | `public/index.html:35`, `:442`, `:749` |
| guards de landing / microcopy / claims / 564 / 331 en verde, sin quitar casos | `scripts/_afirmaciones-publicadas.mjs` (`faq/div#4`); §4 |
| fila 14 de la puerta actualizada a la firma | `docs/go-live/puerta.json`, fila 14, `condicion` |
| servido en yaqu.app | **NO HECHO** → tras el despliegue |

---

# APÉNDICE · 23-oct-2026 · SCRUM-1551f · la fila 14 de la puerta, cerrada con el sha del merge de #2711

**Medido contra:** `origin/main` = `180e19746b2c3b38bc953d81ec23d1c7c4019249` · 2026-10-23T10:15:17Z

A9: sin fallo que generalice — el tramo sólo cierra una entrada por el camino que el guard prescribe, y el rojo previo (fila cerrada sin declarar) se vio caer antes de declararla

**Quién:** jv-j3ar (puesto J3, equipo de Javier), por encargo del orquestador `cobroflash-backend-62`. Carril a
mano: el hook de inicio dijo «SIN IDENTIDAD» (SCRUM-1498). `docs/go-live/puerta.json` no tiene dueño en §3
(`carriles.mjs de`: «sin fila en §3: nadie lo reclama»); lo toca J3 porque la fila 14 es la del subtítulo, carril J3.

## 1 · Qué entra

| sitio | cambio |
|---|---|
| `docs/go-live/puerta.json`, entrada 14 | `estado`: `abierta` → `cerrada`, con `cerrada: {por, motivo, sha, fecha}`; `sha` = `809527fa691056443c545901152443d0d2a072dc` (merge del PR #2711, `gh pr view 2711 --json mergeCommit`, mergeado 2026-10-23T10:07:48Z). `condicion` no se toca |
| `tests/scrum1554c-puerta-de-go-live.test.mjs` | `CERRADAS`: se añade `14`. Es el paso que el propio guard exige al cerrar una entrada («añádela a CERRADAS, así el diff dice cuál salió»); `TOTAL` no cambia (23) y ningún caso se quita |

## 2 · El efecto, medido antes de cerrar

- `https://yaqu.app/health` → `version` = `180e19746b2c3b38bc953d81ec23d1c7c4019249`; `git merge-base --is-ancestor 809527fa6 180e19746` = sí.
- `https://yaqu.app/` (89.737 B): «Y llevas clientes, gastos y albaranes en el mismo sitio.» aparece **1** vez (positivo);
  «gastos y facturas» **0** veces. Cabecera `Date:` de yaqu.app: 23-oct-2026 10:14:56 GMT.

## 3 · Tests

- Rojo primero: con la entrada cerrada y `CERRADAS` sin el 14, `scrum1554c` da 13/14 y el caído dice «la entrada 14
  está cerrada y el guard no lo declara». Con el 14 declarado, verde (cifras de la mini-tanda en el comentario de Jira).

## 4 · Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| fila 14 cerrada con el sha del merge de 1551e | `docs/go-live/puerta.json`, entrada 14; `tests/scrum1554c-puerta-de-go-live.test.mjs` (`CERRADAS`) |
| S3 servido en yaqu.app | `https://yaqu.app/` (§2) |
