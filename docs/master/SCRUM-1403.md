# SCRUM-1403 · Las otras dos puertas: fichas de presupuesto y ficha de cliente — y lo que este PR NO cierra

**CRUCE DE CARRIL:** el ticket es `area-j2` y lo trabaja J4 por encargo del orquestador, porque J2 estaba con SCRUM-1400 (declarado en Jira, c.18037).

**Medido contra:** `origin/main` = `35e1060e365a4cc11f16e4ccee393581679e73d9` · 2026-10-02T05:47:22Z

2-oct-2026 · **J4b** (puesto J4, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J4b. Las frases del fundador las cito de Jira, leídas allí: SCRUM-1346 c.17932 y c.17952,
SCRUM-1390 c.17962. Las respuestas del orquestador que cito me llegaron por mensaje el 2-oct.]

A9: aviso → cicatriz J4 «imprimí como control de una sonda que la garantía retenida viajaba en 0 fichas de 6 sin haber sembrado ninguna garantía: un cero que no podía fallar, puesto al lado de siete cifras que sí medían» — no se pudo comprobar: la sonda era mía y de un solo uso, y un control que no puede fallar no lo distingue nadie desde fuera sin saber qué se sembró.

## 🔴 Lo primero: este PR NO cierra el ticket

Las dos frases, enfrentadas, como en el registro de SCRUM-1397:

- ⛔ **FALSO:** «el Técnico ya no reconstruye el total del negocio».
- ✅ **VERDADERO:** «el Técnico ya no lo reconstruye **por las rutas de factura, ni por las fichas de
  presupuesto, ni por la pestaña de documentos de la ficha de cliente**».

**`stats.totalPaid` de la ficha de cliente SIGUE dando 1.050 de 1.050.** Qué recibe un Técnico de las
cifras de esa ficha es decisión del fundador; está pedida (2-oct-2026) y sin contestar. El control ④
del ticket («repetir la sonda completa de J2a y que ninguna de las tres cifras salga») **hoy no se
cumple**: salen dos de tres. El test lo sujeta con un aserto que dice esto mismo y que pasará a
`notEqual` cuando haya decisión.

## Ⓐ La medición que pedía el ticket: la ficha de cliente

Cómo: `dist/` de `35e1060e`, la app real por HTTP, sesión de Técnica, Prisma de verdad sobre un banco
desechable. El negocio es el FABRICADO de J2i (4 clientes, 4 presupuestos, 4 facturas; el panel dice
1.050 y 900 de Blas), y encima un gasto de 30, tres eventos «Pago recibido» sembrados a mano con la
forma que escribe `psp.routes.ts` (ese camino se leyó, no se ejecutó), un cliente C5 que da de alta la
propia Técnica por HTTP y un C6 con un Trabajo suyo. Seis clientes.

**Los dos límites:** el negocio es fabricado, así que esto no dice nada de los datos de ninguna cuenta;
y el banco es PGlite (Postgres 18.3), no el Postgres 16 del check obligatorio.

**Reproducido** con la sonda de J2a sin tocar: 100 de 1.050 por la lista de facturas, 1.050 de 1.050
por las fichas de cliente, 900 de 900 por las de presupuesto (`sonda-de-j2a.ANTES.salida.txt`).

**Y no es una cifra: son siete.** Sumando las seis fichas, la Técnica saca del negocio entero, exactas:

| de dónde | cifra | cómo se llama en pantalla |
|---|---|---|
| `stats.totalPaid` | 1.050 de 1.050 | «Cobrado» |
| `stats.totalBilled` | 1.450 de 1.450 | «Facturado» |
| `stats.totalPending` | 400 de 400 | «Pendiente de cobro» |
| `stats.profit` | 1.020 de 1.020 | «Beneficio» |
| `stats.totalExpenses` | 30 de 30 | viaja y no se pinta |
| las facturas de la pestaña (20 por ficha) | 1.050 de 1.050 | lista |
| los eventos «Pago recibido» (50 por ficha) | 1.050 de 1.050 | historial: el importe va dentro del TEXTO |

«Cobrado» y «Beneficio» por cliente son lo que la tabla firmada de la Parte S1 le niega en Inicio. En
la LISTA de clientes no viaja dinero (0 claves): eso ya lo cerró SCRUM-1043.

**Las tres salidas**, calculadas con la puerta real de SCRUM-1397 contra la misma base (ninguna está
construida: es una cuenta hecha con el criterio de verdad, no un comportamiento visto):

| salida | suma por `totalPaid` | fichas que abre | lo que cuesta |
|---|---|---|---|
| 1 · no recibe los agregados | 0 de 1.050 | 6 de 6 | Servidor: no mandarle las cinco cifras. Pantalla: quitarle cuatro tarjetas, sin texto nuevo. Mismo criterio que ya aplica este fichero al saldo de la lista (SCRUM-1043) y a la garantía retenida (SCRUM-1108). |
| 2 · los recibe sólo sobre lo suyo | 100 de 1.050 | 6 de 6 | En 2 de 6 fichas «Cobrado» diría una cifra que no es lo que el cliente ha pagado, bajo el mismo rótulo: o el rótulo miente o hace falta texto firmado. «Beneficio sobre lo suyo» no tiene criterio: nadie ha decidido qué gasto es suyo. |
| 3 · la ficha ajena no se abre | 100 de 1.050 | 2 de 6 | Deja de abrir C2, C3, C4 y **C5, el cliente que ella acaba de dar de alta**: `Customer` no guarda quién lo creó, y contarlo pide columna nueva (regla 40). Contradice «el técnico ve la cartera entera» (SCRUM-979) y el motivo con que la ruta está abierta, «la ficha del cliente que va a visitar». |

**Los eventos van aparte de las tres**, porque con cualquiera la ficha seguiría dando 1.050: seis
sitios de `src/` escriben el importe dentro del texto del evento (pago recibido en dos, factura
emitida, presupuesto enviado en dos, disputa) y sólo un tipo guarda a qué documento se refiere. No se
pueden recortar por «suyo», sólo por tipo. Tampoco lo decido yo: va al fundador con sus tres salidas
(no mandarle los tipos con importe, mandárselos sin el detalle, o dejarlo y decirlo).

Sonda y salida: `docs/evidencias/scrum1403/sonda-ficha-de-cliente.*`.

## Ⓑ Qué se ha construido

- **Presupuestos, lista y ficha** (rutas 2 y 3 del censo de SCRUM-1390). Una puerta hermana de la de
  las facturas, `src/core/documentos/accesoAlPresupuesto.ts`: el Técnico ve un presupuesto si es su
  autor, si lo tiene asignado como documento o si el Trabajo es suyo (el que lo abrió, o un adicional).
  La lista recibe el recorte en `AND`, así que ni buscar ni filtrar por autor abren la puerta: pedir
  los de un compañero devuelve, de esos, los que además son suyos. La ficha ajena contesta 404, igual
  que la que no existe.
- **Ficha de cliente, pestaña de documentos:** sus 20 presupuestos y sus 20 facturas pasan por esas dos
  puertas. La ficha se le sigue abriendo entera. Aprobado por el orquestador: es la regla ya firmada, y
  el máster nombra «la ficha del cliente» entre los diez sitios.
- **Cómo comparte criterio con la puerta de SCRUM-1397** (el ticket pedía no escribir una segunda): quién
  ve todo lo dice `seesAllJobs` en las dos, y «los Trabajos de la persona» se leen en un solo sitio,
  `trabajosDeLaPersona`, que he sacado de `whereFacturasVisibles` sin cambiar lo que hace. No va todo
  en el mismo fichero porque el banco de mutaciones de 1397 exige que cada ancla aparezca UNA vez en él.

**Dos cosas que no estaban pedidas, y son del lado laxo (c.17932):**

1. **Las revisiones.** Al revisar un presupuesto se copian el autor y el Trabajo, pero no los asignados
   al documento: quien lo lleva por asignación perdía justo la versión vigente. Es suyo todo el grupo
   {merchant, número} de uno suyo. Aceptado por el orquestador.
2. **Las facturas dentro de la ficha de un presupuesto suyo** se le enseñan todas, aunque la puerta de
   facturas no le dejaría abrir alguna por su ruta (el caso: presupuesto suyo sólo por asignación al
   documento). No he tocado el criterio de 1397; si esa puerta tiene que ganar ese eje, es otro ticket.

**Tocado fuera de lo mío, y dicho:**

- `tests/scrum1397-el-tecnico-ve-sus-facturas.test.mjs`: tenía un suelo puesto por J2a para este día
  («la lista de presupuestos por autor ya no contesta; re-mide qué prueba este caso») y saltó. Re-medido:
  los ids del compañero se le dan al cálculo desde lo sembrado (el peor caso) y el suelo exige ahora que
  la lista siga vacía. El caso sigue cayendo con «1050 = 1050» si la lista de facturas se abre.
- `tests/scrum1108-aviso-garantia-retenida.test.mjs`: su doble de Prisma no tenía `job.findMany`, que
  la ficha 360 de un Técnico ahora llama; contestaba 500. Añadido al doble, sin tocar ningún aserto.

**Sin tocar:** `stats` y los eventos de la ficha de cliente; `prisma/schema.prisma`; `requireRole`; el
camino de emisión (en `quotesAdmin.routes.ts` sólo cambian los dos `GET` de lectura y un import); ningún
texto de usuario; ningún workflow. Y fuera de este ticket: el PDF, las notas, aceptar, rechazar y
enviar de un presupuesto ajeno (ruta 4 y las cinco de acción del censo de SCRUM-1390) siguen abiertas.

## Ⓒ Lo corrido

Todo en local contra PGlite 18.3, un banco nuevo por pasada. **El veredicto que cuenta es el del check
obligatorio, contra `postgres:16` y sobre el merge.**

- **Rojo primero** (commit `0cea365b`, el test solo contra el `src` de `main`): 6 caen de 6
  (`rojo-contra-src-de-main.salida.txt`). ⚠️ Dos de los seis —los dos últimos sin base— caen sólo porque
  el fichero de la puerta no existe: es un rojo por ausencia, más débil que los otros cuatro.
- **Verde:** `tests/scrum1403-el-tecnico-y-las-otras-puertas.test.mjs`, 6 de 6, 0 saltos. El de
  SCRUM-1397, 5 de 5.
- **La sonda de J2a, completa y sin tocar, después** (`sonda-de-j2a.DESPUES.salida.txt`): facturas 100
  de 1.050 · fichas de presupuesto 0 de 900 · facturas de la pestaña del cliente 100 de 1.050 ·
  🔴 `totalPaid` 1.050 de 1.050.
- **El banco de mutaciones de SCRUM-1397** (`tests/banco-scrum1397/mutar.mjs`), para saber si mi
  extracción lo dejaba ciego: 18 caen de 18 · 0 mudas · 0 vivas · 0 ciegas · sus dos controles como
  deben · árbol intacto (`banco-de-1397-tras-la-extracción`: el fichero es
  `banco-de-1397-tras-la-extraccion.salida.txt`). Con el turno del orquestador.
- **Mi sonda, después** (`sonda-ficha-de-cliente.DESPUES.salida.txt`): las cinco cifras de `stats` y los
  eventos siguen EXACTOS; las facturas de la pestaña bajan a 100 de 1.050 y los documentos ajenos, a 0
  de 3 y 0 de 3. ⚠️ La salida de ANTES conserva la línea del control de la garantía que no valía (está
  tal como se midió); el guion subido ya no la imprime. Y la última frase que imprime el guion («la
  pestaña… sigue trayendo lo ajeno») describe el ANTES: en la salida de DESPUÉS ya no es verdad para la
  pestaña, sí para los eventos.
- **Los que nombran mis ficheros**, de uno en uno y sin base: 37 ficheros, 276 casos, 1 caía (el doble
  de scrum1108, arriba) y 2 saltan por `QA_DB_TEST`; con el doble arreglado, scrum1108 8 de 8. Otros 11
  elegidos por tocar rutas de presupuesto o cliente como Técnico, más scrum237, scrum409 y scrum836: 97
  casos, 0 caen, 2 saltos.

**NO corrido, y por qué:**

- **La dirigida** (`node scripts/tests-que-cubren.mjs`: 304 ficheros de 1.202). Decisión del
  orquestador: en local diría que pasan; el obligatorio prueba el merge y corre los 1.202.
- **Los gateados por `QA_DB_TEST`** (staging). Leídos: `tenancy-permisos` y `scrum148` piden las rutas
  de presupuesto con sesión de ADMIN, a la que la puerta no recorta. No ejecutados.
- **Un banco de mutaciones propio** para la puerta de presupuestos. No está escrito. Lo que hay es el
  rojo de arriba y los casos con nombre por camino; qué mutaciones de `accesoAlPresupuesto.ts` quedarían
  vivas está sin medir.
- **Nada visto en navegador ni en yaqu.app.** Qué pinta la pantalla de Presupuestos de un Técnico sin
  ninguno suyo, y qué enseña la ficha de un presupuesto ajeno abierta por enlace (ahora 404), sin mirar.

## Ⓓ Mis errores

- El control de la garantía retenida que no podía fallar (línea `A9:`). El orquestador lo dijo mejor
  que yo: un control que no puede fallar es un comentario, no un control.
- Mi primer control positivo del «¿hay ya rama de este ticket?» usó la rama de SCRUM-1388, que ya
  estaba mergeada y borrada: salió vacío y no probaba nada. Lo repetí con una rama viva (la de 1334).
- Medí mi contexto por primera vez a 361.789; el encargo pedía avisar a 200.000.
