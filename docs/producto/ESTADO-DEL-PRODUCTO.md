# Estado del producto · YaQu

**Última medida: 29-oct-2026, 17:50Z-18:10Z** (`Date:` de GitHub) · `origin/main` = `eafca9fe1` · producción: **NO MEDIDA en esta pasada** (no se leyó `/version`) · la escribió S0 (SCRUM-1563g). Recontadas las filas que movieron los 10 PR entrados desde `d12e9978` (2.4, 2.9, 2.11, 2.12, 3.18, 3.21, 5.3, 6.14, 6.15, 6.16); **§1, §4 y §4b NO se han re-medido** y siguen con la medida de la mañana. 🔵 **Las decisiones del fundador, en dos listas (hoy / go-live) y separadas de las que puede tomar el orquestador: `docs/producto/DECISIONES-DEL-FUNDADOR.md`.** La anterior, de las 10:20Z-10:50Z (SCRUM-1563f, sobre `d12e9978`): **`main` se movió tres veces mientras se medía:** al empezar (10:20Z) estaba en `503f0d86`; a las 10:3xZ entró #2962 (SCRUM-1620, el `meta-guard` por partes, `fd24ce09`), y a las 10:40Z #2983 (SCRUM-1594) y #2982 (SCRUM-1626). Producción siguió a cada uno. Las anteriores (18-oct a las 17:13Z y 18:46Z; 19-oct a las 06:43Z; 27-oct a las 18:41Z) siguen en el historial de git. **La de las 07:50Z del 19-oct (SCRUM-1563d, PR #2604) sigue sin entrar**: 10 días abierta, obligatorio en rojo y ahora también en conflicto (§4b).

**🔵 Re-medida a las 18:12Z-18:20Z del 29-oct** (`Date:` de GitHub; S0, SCRUM-1563i) · `origin/main` = `c93f26a76` · **producción (`/version`) = `c93f26a7`, el mismo, leído a las 18:15Z**: cierra el «NO MEDIDA» de la línea de arriba. **Re-medidos §1 ③ y ④, §4 y §4b. §2 NO se ha recontado en esta pasada** (sigue la cuenta de las 17:5xZ).

**Qué es:** UN documento que se ACTUALIZA, no un informe nuevo cada vez. Dice qué le falta al producto para estar completo, de quién depende cada cosa, qué la bloquea y cómo va. Lo pidió el fundador el 18-oct-2026: «molaría sacar un informe con todas las tareas que tenemos que cerrar para el producto y ver cómo las vamos cerrando, para tener algo controlado». Y lo volvió a preguntar el 27-oct: «como va nuestra hoja de ruta con las cosas para tener el proyecto al 100% estamos avanzando queda mucho? lo estás siguiendo? está creciendo cada vez más el jira? estamos cerca de ser esto ya usable por una empresa?» (SCRUM-1563 c.21195). **§1 contesta esas cuatro preguntas.**

**Cómo se lee:**
- Una fila es **una cosa que le falta al producto**, no un ticket.
- **Depende de:** NOSOTROS (equipo de Luis, S0-S5) · JAVIER (equipo de Javier, J1-J6) · FUNDADOR (Luis) · ASESOR.
- **Bloqueo:** lo que hay que conseguir, con su nombre. Si dice «ninguno», la fila sólo espera a que alguien la trabaje.
- **Fuente:** de dónde sale la fila. «c.NNNNN» es el último comentario del ticket que se leyó. Un PR con fecha está comprobado en GitHub.
- **Los números de fila no cambian.** Una fila hecha pasa a §8 con su número; una nueva toma el siguiente libre de su bloque. Así la página del fundador y este fichero siguen hablando de la misma fila.

⚠️ **«Fundador» en los comentarios del equipo de Javier puede ser JAVIER**, no Luis: SCRUM-1525 c.19365 llama «la cuenta del fundador» a la de Javier, y en SCRUM-1522, 1536 y 1562 las decisiones «del fundador» son de Javier. Aquí FUNDADOR es siempre Luis. Donde la decisión es de Javier, la fila dice JAVIER.

⚠️ **Lo medido por otra sesión va con su nombre.** «Medido por S2» quiere decir que lo midió S2 y que S0 no lo ha repetido. Lo que S0 ha medido él mismo lo dice («medido por S0», con la hora). **«Leído por un lector»** quiere decir que el último comentario lo leyó un subagente de sólo lectura de S0 el 27-oct y S0 no lo ha releído entero.

---

## 1 · La respuesta corta: las cuatro preguntas del fundador (27-oct)

### ① ¿Estamos cerca de que una empresa lo use?

| qué hace el profesional | ¿funciona hoy en yaqu.app? | qué lo impide | de quién depende |
|---|---|---|---|
| **Presupuestar** | sí | — (lo que falta, §2 bloque 1) | — |
| **Enviar por WhatsApp y que el cliente firme** | 🔴 **sí, pero el enlace de firma llegó ROTO el 18-oct** (2.9), y las otras tres plantillas con enlace, entre ellas la del presupuesto, **no se han mirado en Meta** (2.10) | **ya tiene ticket (SCRUM-1632, En curso) y dos arreglos, uno de cada lado:** (a) la dirección del botón en WhatsApp Manager, con la tabla de las cuatro escrita por S4 (#2979, en `main` desde las 10:17Z del 29-oct); (b) **uno NUESTRO**: la página de firma no limpia el token, y la del presupuesto sí. (b) espera un GO de una línea | **FUNDADOR** (Meta y el GO de b) |
| **Facturar en España** | **no**, a propósito (regla 24) | SIF-1 8/8 + una factura real aceptada por la AEAT. **Hoy, 3 de 8** (§1b) | **FUNDADOR** en los 5 tramos que faltan; JAVIER en 2 de ellos |
| **Cobrar al cliente en España** | **no** (regla 24 + Stripe en modo real) | lo mismo que facturar, más Stripe real (4.1), que cuelga de la S.L. | **FUNDADOR** |
| **Que el profesional nos pague** | **no** en modo real | Stripe real (5.1), que cuelga de la S.L. El fin de periodo de la suscripción ya se escribe (5.2 → §8) | **FUNDADOR** |
| **Enseñar el producto con la cuenta DEMO** | 🔴 **no**: crear un presupuesto da 403 `trial_expired` (7.8) | devolverle el acceso a la cuenta y que su correo llegue a algún buzón. **Sin ticket ni movimiento desde el 18-oct** | **FUNDADOR** |

**En una frase:** para un profesional que sólo quiera presupuestar y hacer firmar, lo que falta es que el enlace del WhatsApp funcione (2.9 y 2.10: ya con ticket, SCRUM-1632, abierto después de la medida del 27-oct, y con un arreglo nuestro que sólo espera un GO). **Para facturar y cobrar en España, la fecha la marca la S.L. inscrita en el Registro Mercantil, no el equipo:** de ella cuelgan 4 de los 5 tramos de SIF-1 que faltan (§1b). La gestoría del fundador estimaba la S.L. para «mediados de noviembre»; al 20-oct iban 3 de 8 pasos, con notario la semana del 26-oct (SCRUM-1264 c.20088, SCRUM-143 c.20865, leído por un lector). **Cuánto tarda después (asesor, Convenio 017, ≥10 envíos, revisión externa) NO se puede sacar del repositorio, y no se estima aquí.**

### ② ¿De quién depende?

**De las 74 cosas que faltan (§2), 49 necesitan al fundador y 29 dependen SÓLO de él.** Contado por máquina (§3). **Baja una (30 → 29) y no porque él la haya movido:** la 2.9, el enlace de firma, tiene ahora un arreglo nuestro (S1) además del suyo. Sigue esperando su GO.

🔴 **(27-oct)** **Las 29 que el 19-oct dependían sólo de él siguen las 29 aquí, ocho días después, con el mismo dueño.** Ninguna ha salido de la lista. Alguna se ha movido por dentro (la S.L. tiene notario; el productor tiene sus cinco respuestas), pero ninguna se ha desbloqueado. Y se ha sumado una (6.12). **Mientras eso no cambie, lo que entregue el equipo no acerca la fecha de vender en España.**

**SIF-1, que es lo que separa a YaQu de vender en España, depende del fundador en los cinco tramos que faltan, y en cuatro de ellos a través de la S.L.** El detalle, en §1b.

### ③ ¿Crece el Jira?

| ventana | todo el proyecto | equipo de Luis + sin etiqueta | sólo equipo de Javier (por diferencia) |
|---|---|---|---|
| **desde las 10:30Z hasta las 18:1xZ del 29-oct (~8 h)** | 9 cerrados · 6 creados · **−3** | 9 cerrados (1588, 1589, 1594, 1602, 1603, 1608, 1623, 1626, 1627) · 6 creados (1634-1639) · **−3** | **0 cerrados** · 0 creados · 0 |
| abiertos el 29-oct a las 18:1xZ | **175** | **111** | **64** |
| **desde las 18:41Z del 27-oct hasta las 10:3xZ del 29-oct (~40 h)** | 3 cerrados · 2 creados · **−1** | 3 cerrados (1087, 1088, 1593) · 2 creados (1632, 1633) · **−1** | **0 cerrados** · 0 creados · 0 |
| abiertos el 29-oct a las 10:3xZ | **178** | **119** (73 + 46) | **59** |
| últimas 24 h (hasta las 18:4xZ del 27-oct) | 39 cerrados · 22 creados · **−17** | 7 cerrados · 12 creados · **+5** | 32 cerrados · 10 creados · **−22** |
| desde las 07:50Z del 19-oct (8 días) | 151 cerrados · 66 creados · **−85** | 9 cerrados · 31 creados · **+22** | 142 cerrados · 35 creados · **−107** |
| abiertos hoy | **179** (eran 264 el 19-oct) | **121** (67 + 54; eran 99) | **58** (eran 165) |

**29-oct, 18:1xZ (S0, 1563i):** en 8 horas, **−3, y los 9 cierres y los 6 tickets nuevos son del equipo de Luis.** **Control:** 178 − 9 + 6 = 175, exacto. **El equipo de Javier pasa de 59 a 64 sin crear ni cerrar ninguno:** cinco tickets han ganado la etiqueta `equipo-javier` (Luis + sin etiqueta: 119 − 9 + 6 = 116, y hay **111**). **NO medido cuáles** son los cinco. Consulta: `statusCategory != Done` (todo) y `… AND labels = equipo-javier`, la columna del medio por diferencia; cierres y altas por `resolved` / `created` ≥ 29-oct 11:30 hora de Madrid.

**29-oct:** en 40 horas el Jira **casi no se ha movido**: −1 en todo el proyecto, y los tres cierres son nuestros, los tres del triaje de S0 de esta mañana (§4). **El equipo de Javier no ha cerrado ninguno.** **Control:** 179 − 3 + 2 = 178, exacto; 73 + 59 + 46 = 178, exacto. Luis + sin etiqueta da 121 − 3 + 2 = 120 y hay **119**: SCRUM-1631 pasó de no tener etiqueta a `equipo-javier`, que por eso sube de 58 a 59 sin crear nada.

🔴 **(27-oct)** **El total baja, y baja entero por el equipo de Javier. Lo del equipo de Luis CRECE:** +22 en ocho días, +5 en las últimas 24 h. La cifra «39 cerrados, 22 abiertos, −17» del orquestador es correcta para el proyecto entero y no dice esto. **Control:** 264 − 151 + 66 = 179, y 99 − 9 + 31 = 121, las dos exactas. **NO medido:** cuántos de los 142 cierres de Javier son por efecto y cuántos limpieza de duplicados o superados.

### ④ ¿Avanzamos? ¿Lo está siguiendo alguien?

- **Producto:** desde el 19-oct salieron de §2 **nueve filas** (§8): la fecha de fin de periodo de la suscripción (5.2), las casillas de pago (6.10), los CSV (6.11), los textos legales que prometían cobro (7.4), el guion H2 (7.2), la portada (7.5) y tres defectos fiscales (3.11, 3.12 y 3.13, que es la factura doble). **Siete de las nueve las hizo el equipo de Javier.** Entraron **diecisiete nuevas**, doce de ellas con el equipo de Luis dentro.
- **29-oct:** salen de §2 **una fila**, la 4.3 (SCRUM-1292: el arreglo estaba en `main` desde el 30-sep y la fila decía «espera GO de dinero»), y entra una, la 3.21 (SCRUM-1566, autorizada por el fundador). **Lo que más pesa hoy no es una fila que falta, es trabajo hecho que no llega: 12 PR en conflicto (§4b).** → **18:1xZ: 13** (entra #2738; §4b).
- **Este documento es el seguimiento.** El 27-oct llevaba 8 días sin actualizarse: la actualización del 19-oct por la tarde (#2604) se quedó en rojo y nadie la vio. **Que el fundador tuviera que preguntar dos veces lo mismo es eso.**

### Lo que el equipo de Luis puede mover HOY sin esperar a nadie

| fila | qué | quién | por qué importa |
|---|---|---|---|
| **6.3** | 🔴 **SCRUM-914:** las DOS piezas nuestras de «Equipos del cliente»: `model Equipment` y los cuatro `equipmentId` en `schema.prisma`, y `'equipment'` en `MODELOS_POR_MERCHANT` | **S1** | **la tabla lleva aplicada en las tres bases desde el 29-sep — un MES sin una línea de código que la use.** La rama de J3 existe desde el 20-oct (#2621) y lleva 9 días en conflicto esperando esto. Ya no es «abrir la rama»: es escribir dos piezas |
| **2.9** | 🔴 **SCRUM-1632, arreglo (b):** que la página de firma limpie el token como ya lo hace la del presupuesto (`parseToken`) | **S1**, tras el GO | **es el enlace del que depende firmar.** Espera un GO de una línea del fundador (c.21202). → **18:1xZ: GO DADO** (el fundador delegó en el orquestador) **y construido: PR #2998, ABIERTO, sin mergear** |
| ~~3.18~~ | SCRUM-1594: traer `llevaLibrosPorSii` en los 6 `select` de S1 | **S1** | 🔵 **HECHO de nuestro lado:** #2983 MERGEADO a las 10:40Z del 29-oct. Ahora J1 puede empujar la comprobación del SII de SIF-1 (SCRUM-1585). Falta cerrar 1594 |
| **2.4** | SCRUM-1518: el CHIP que pinta «Enviado» lo que no conoce | **S2** | el servidor ya está en `main` (#2688); falta la pantalla. Encargado a S2 el 29-oct (dato del orquestador) |
| 1.13 · 1.15 · 2.14 · 6.13 · 6.17 | cinco defectos nuevos del equipo de Luis, sin bloqueo de fuera | S1 · S2 | §3 |
| 2.7 · ~~2.12 · 6.14~~ | arreglos ya en `main`: falta verlos en producción con la cuenta QA y cerrar. **18:1xZ: 2.12 (1589) y 6.14 (1608) Finalizadas a las 11:22Z y 11:15Z; queda 2.7 (1562, de Javier)** | quien tenga la cuenta QA | §4 |

### Lo que el encargo del 29-oct traía y no aguantó la medida

Medido por S0 entre las 10:20Z y las 10:45Z. **De once afirmaciones, seis aguantan enteras; dos eran ciertas a su hora y ya no (producción y el CI); tres aguantan con una corrección (la rama de 1566, la cifra de 1632 y la hora de los cierres).**

| lo que se afirmó (encargo del orquestador, 29-oct) | lo que se midió | cómo |
|---|---|---|
| «producción = `main` = `5deff8b3b`» | **cierto a su hora; ya no:** a las 10:17Z entró #2979 (`503f0d86`) y a las 10:3xZ #2962 (`fd24ce09`). Producción siguió a los dos | `yaqu.app/version` a las 10:20Z y a las 10:39Z |
| 🔴 «el CI está VACÍO: 40 de 40 completadas, cero en cola» | **ya no:** de las 40 últimas pasadas, 23 completadas, 7 en marcha, 2 pendientes y **8 en cola**. El propio orquestador lo corrigió a las 10:3xZ: estaba vacío a las 09:28Z y se llenó al empujar los seis puestos | `gh api …/actions/runs?status=queued` y `?per_page=40`, 10:2xZ |
| «en el commit desplegado, `meta-guard` ROJO y el OBLIGATORIO VERDE» | **cierto en `5deff8b3b`**: `meta-guard` failure, `build + tests (con banco desechable)` success. Su arreglo (#2962, SCRUM-1620) **entró a las 10:3xZ**. Producción estuvo comprobada donde importa | check-runs del commit |
| «12 PR en conflicto, de 2 a 16 días; ocho de Javier y cuatro nuestros» | **cierto, los doce y el reparto** (§4b). El equipo, por la etiqueta del ticket de cada PR | `gh pr list` + `mergeable`, y Jira |
| «#2690 (962) y #2392 (876), los dos de tickets ya Finalizada» | **cierto:** SCRUM-962 cerrado el 22-sep, SCRUM-876 el 13-oct | Jira |
| 🔴 «SCRUM-914: la rama la empujó J el 20-oct; #2621, nueve días en conflicto con los 10 ficheros; faltan dos piezas nuestras; la tabla, aplicada en las tres bases desde el 29-sep» | **cierto.** `model Equipment` y `equipmentId`: **0** en `schema.prisma` y en `src/` (control: `model Albaran` sí sale). #2621: CONFLICTING, 10 ficheros, abierto el 20-oct a las 09:57Z. La forma de la tabla en las tres bases la midió el equipo de Javier (c.20085, «producción 17/17, staging 17/17, dev 17/17»): **S0 no ha mirado ninguna base** | `git grep`, `gh pr view 2621`, SCRUM-914 c.20085 y c.21207 |
| «SCRUM-1566: el fundador autorizó B y C antes del SIF-1 (c.21019) y la subida de `VERIFACTU_VERSION` (c.21031); B va hoy en `conjunto-1566-b-y-c`» | **las dos autorizaciones, ciertas y literales.** **La rama, NO existe en `origin`** a las 10:2xZ: «va hoy» es un plan, no un hecho. «C, construido por J1 sin empujar»: NO CONSTA en lo que S0 leyó | SCRUM-1566 c.21019, c.21031, c.21199; `git ls-remote --heads origin` |
| 🔴 «SCRUM-1632: `parseToken` tolera el `{{1}}` y lo usan los 4 sitios del camino del presupuesto; el de la firma no lo usa» | **cierto, con una cifra que corregir:** son **5** usos, no 4 (`quotes.routes.ts:357` y cuatro en `quoteDecisionLanding.routes.ts`). En `src/modules/jobs/`, **0**; `albaranPublic.routes.ts:251` y `:381` pasan `req.params.token` en crudo | `git grep parseToken -- src` |
| «los siete sin etiqueta (1626-1632) ya la tienen» | **cierto.** Y 1631 la tiene de `equipo-javier`, que mueve las cuentas de ③ | Jira |
| «1087, 1088 y 1593 cerrados a las ~11:2xZ» | **cerrados, pero a las 10:14Z.** «11:14» es la hora de Madrid que da Jira (`+0100`), no la Z | `resolutiondate` en Jira |
| «4.3 → §8: el GO se dio hace un mes» | **la fila sale, y lo que lo prueba es el merge:** #2006 MERGEADO el 30-sep a las 20:44Z. **Por qué la fila estaba mal:** el último comentario del ticket (c.17637, de Javier) es de las 20:38Z, **seis minutos ANTES del merge**, y dice que no hay nada construido. El GO en sí NO CONSTA en lo que S0 leyó | `gh pr view 2006`, SCRUM-1292 c.17637 |

### Lo que el encargo del 27-oct traía y no aguantó la medida

| lo que se afirmó (SCRUM-1563 c.21195 y el encargo) | lo que se midió | dónde |
|---|---|---|
| «este documento no existe» | existe desde el 18-oct (#2564) y se actualizó tres veces; la cuarta (#2604) está en rojo desde el 19-oct | `git log origin/main -- docs/producto/ESTADO-DEL-PRODUCTO.md` |
| la cita con el asesor «la fijó él el 1-oct para las dos semanas siguientes: llevan casi cuatro semanas» | superado tres veces: el 14-oct movió el plazo al 15-nov (c.19609); ese día dijo «No, no tenemos asesor fiscal» (c.19623); y el 20-oct «Ok no te preocupes lo arreglo cuando tengamos la SL» (c.20088). **No es una cita olvidada: es un asesor que no existe, aplazado a propósito hasta la S.L. inscrita.** `YAQU_MASTER.md:986` sigue diciendo lo del 1-oct | SCRUM-1264, leído por S0 entero |
| «S1-D · El envío a la AEAT → El equipo» | el envío es carril **J1** (`src/modules/fiscal/**`, `dos-equipos.md:117`), **no tiene ticket abierto** (SCRUM-1110 se cerró el 20-oct por el alta de S1-0 y SCRUM-1296 el 1-oct por el encolado) y el certificado no viaja a ninguna sesión: **también necesita al fundador** | §1b, fila S1-D |
| «tres de los cuatro que faltan son suyos» | faltan **cinco** tramos (D, E, F, G, H: E y H son dos) y **los cinco** necesitan al fundador | §1b |
| «39 cerrados, 22 abiertos. Saldo −17» | **correcto** para el proyecto; para el equipo de Luis + sin etiqueta es **+5** | ③ |
| la auditoría del 19-ago: «la cola de remisión y el envío no se han construido nunca» | **ya no es verdad:** emitir encola desde el 30-sep, y el procesador y el cliente de envío están en `main`. Lo que falta es ENCHUFARLOS | §1b, fila S1-D |
| SIF-1, «3 de 8» y «hay 3 aceptados» | **correcto** | `YAQU_MASTER.md:986`; SCRUM-1110, leído por un lector |

---

## 1b · SIF-1 tramo a tramo

La puerta: **8/8 (S1-A a S1-H) + una factura real aceptada por la AEAT** (`YAQU_MASTER.md:997`). El marcador sale de `YAQU_MASTER.md:986` (última corrección: 1-oct, SCRUM-1319) y cada tramo que falta se ha vuelto a medir el 27-oct en el árbol y en su ticket. **29-oct, S1-D re-medido por S0 en `fd24ce09`: sin cambios** — `enviarSobre` sigue con una definición y ninguna llamada (fuera de `sif.client.ts` sólo sale en comentarios de `sif.procesador.ts` y `modoVisible.ts`), y el procesador sigue diciendo «NO LO LLAMA NINGÚN CRON» (`sif.procesador.ts:13`).

| tramo | estado | lo que hay de verdad (27-oct) | de quién depende | bloqueo |
|---|---|---|---|---|
| S1-0 · humano previo | 🟡 | certificado FNMT ✅ (15-jun); alta en el entorno de pruebas ✅ (24-sep, SCRUM-1110, cerrado el 20-oct); **asesor fiscal: no hay** | **FUNDADOR** | **aplazado por él hasta la S.L. inscrita** (SCRUM-1264 c.20088, 20-oct) |
| S1-A · huella | ✅ | — | — | — |
| S1-B · modalidad VERI*FACTU | ✅ | — | — | — |
| S1-C · registros contra XSD | ✅ | — | — | — |
| **S1-D · envío a la AEAT** (≥10 registros aceptados seguidos) | 🟡 | **medido por S0 en `42c458e1`:** emitir **encola** (`selladoEstado.ts:173` → `encolarRemision.ts`, SCRUM-1296, 30-sep); el **procesador** de la cola existe (`sif.procesador.ts`) y dice de sí mismo «NO LO LLAMA NINGÚN CRON»; el **cliente** existe (`enviarSobre`, `sif.client.ts:355`) y **ningún fichero de `src/` lo llama**. Envíos a la AEAT de pruebas: **3 aceptados** (1 «Correcto» y 2 «Aceptado con errores», en SCRUM-1110, leído por un lector) contra los ≥10 seguidos que pide | **JAVIER (J1)** + **FUNDADOR** | **sin ticket abierto que lo siga.** Cablear el procesador y el envío es J1. El certificado no viaja a ninguna sesión (decisión del 16-sep, `:986`), así que los envíos de prueba los hace una persona. Para PRODUCCIÓN, la vía decidida es colaborador social, que exige el Convenio 017, que exige la S.L. (3.1). **MI LECTURA, sin medir:** los ≥10 de PRUEBAS no necesitan la S.L., porque los 3 de hoy se hicieron sin ella |
| **S1-E · declaración responsable** | 🟡 | borrador (`docs/legal/DECLARACION_RESPONSABLE.md`, 23-sep). La versión con dos firmantes es el PR #2881, en borrador | **FUNDADOR** + ASESOR | **la S.L.**: el fundador, literal, «Esto lo hacemos cuando ya esté la SL» (SCRUM-523 c.21064, leído por un lector). Firman los dos administradores |
| **S1-F · revisión fiscal externa** | ⏳ | sin empezar: no hay asesor | **FUNDADOR** | el asesor, **aplazado hasta la S.L. inscrita** (S1-0). 36 preguntas esperan en SCRUM-1264 |
| **S1-G · producción AEAT + factura real aceptada** | ⏳ | sin empezar | **FUNDADOR** + JAVIER | el Convenio 017 (3.1), que exige la S.L. inscrita y el certificado de representante |
| **S1-H · pack gestoría** | 🟡 | borrador (`docs/legal/PACK_GESTORIA.md`, 23-sep) con `[NIF]` y «[VALIDAR ASESOR]» dentro | **FUNDADOR** + ASESOR | el NIF del productor (3.2, «el NIF DEFINITIVO de la S.L.») y el asesor |

**La cuenta: 3 de 8. Los 5 que faltan necesitan al fundador. Cuatro (E, F, G, H) no se mueven hasta que la S.L. esté inscrita (paso 5 de 8 de su hoja de ruta; c.20088 avisa de que la firma del notario NO basta). El quinto (D) puede avanzar antes, pero lo cablea el equipo de Javier y no tiene ticket.**

Además de los ocho tramos, hay piezas de SIF-1 que tienen que estar antes de encender un profesional real: 3.9, 3.10, 3.14, 3.17, 3.18, 3.19 y 3.20 de §2.

---

## 2 · Qué le falta, por bloque

### 0 · Antes de todo: la empresa

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 0.1 | Constituir la S.L. (con NIF) | SCRUM-1561 · SCRUM-143 | FUNDADOR | — (es el bloqueo de los demás). **Lo que desbloquea no es la notaría, es la inscripción en el Registro Mercantil (paso 5 de 8)** | SCRUM-1264 c.20088 (20-oct): 3 de 8 pasos, notario la semana del 26-oct, «mediados de noviembre». SCRUM-143 c.20865 (26-oct, leído por un lector): el objeto social ya incluye desarrollo de software (lo exige la AEAT para el 017) y firman los dos administradores mancomunados. SCRUM-1561 sin cambios desde el 17-oct |
| 0.2 | Ceder a la S.L. los derechos del código | SCRUM-1283 | FUNDADOR | «S.L. sin constituir» | descripción (0 comentarios); sin cambios desde el 29-sep |
| 0.3 | Tener asesor fiscal | SCRUM-1264 | FUNDADOR | **aplazado por él hasta la S.L. inscrita**: «Ok no te preocupes lo arreglo cuando tengamos la SL» | c.20088 (20-oct). Ya son **36 preguntas** esperando (c.21181, 27-oct). Leído por S0 entero |

### 1 · Presupuestar (funciona hoy; esto es lo que falta)

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 1.1 | 🔴 **CON FECHA, 1-ene-2027:** la ficha de un presupuesto cuya secuencia se repite da 500 | SCRUM-1490 | FUNDADOR | «consulta de sólo lectura en producción + OK a 2 líneas del camino de emisión (`albaranes.routes.ts`)» | aceptaciones 1-5 en producción; falta la 6 (la consulta está probada en un Postgres desechable, no contra producción). Leído por un lector |
| 1.2 | El presupuesto rápido sale al 0 % de IVA: falta construir «lo tecleado es precio final» | SCRUM-1439 | ASESOR | «desglose hacia atrás al 21 %: dictamen» | c.18224 |
| 1.3 | Qué dice un documento cuando el IVA no está indicado («IVA 0 %») | SCRUM-1438 | ASESOR + FUNDADOR | «claim fiscal» | descripción (0 comentarios) |
| 1.4 | En la página de aceptar, las líneas de cada opción van sin impuesto y el total con impuesto (hoy el panel no lo produce) | SCRUM-1433 | FUNDADOR | «decisión de qué enseña la línea» | c.18156 |
| 1.5 | Una cabecera de apartado dentro de una opción se pinta «NaN EUR» **en el PDF** (sólo por API). La página pública ya está bien | SCRUM-1442 | JAVIER (J1) | ninguno: el aviso a J1 está en `para-javier.md` §25. NO CONSTA que J1 lo haya cogido | página pública: #2559 (18-oct), vista por S2. PDF: medido por S2. Jira sin cambios desde el 2-oct |
| 1.6 | El profesional no lee en ningún sitio lo de los 1-2 céntimos entre presupuesto y facturas | SCRUM-1451 | FUNDADOR | «firma de texto (regla 39)» | 1451 y 1451b (22 y 23-oct, sondas sin código): un céntimo cobrado de menos queda «Parcial / Te falta por cobrar 0,01 €». Jira sin cambios desde el 2-oct |
| 1.7 | Copiar el enlace entrega el presupuesto, pero su estado sigue en `draft` | SCRUM-1297 | FUNDADOR | «cambio de máster (Parte L)» | descripción (0 comentarios) |
| 1.8 | Un Técnico podía abrir y aceptar presupuestos ajenos: arreglado, y sin verificar con un Técnico de verdad | SCRUM-1555 | FUNDADOR | «test-login sólo abre propietarios; el plan de prueba admite 1 usuario» | c.19743 (#2456 en producción); sin cambios desde el 14-oct |
| 1.9 | Guardar como plantilla un presupuesto de 3 opciones | SCRUM-1545 | NOSOTROS + FUNDADOR | el punto 3 ya está (#2607, 19-oct). **Los puntos 1, 2, 4 y 5 siguen sin hacer** y esperan el «encargo de diseño» | c.20042 (19-oct), leído por un lector |
| 1.11 | Aviso del 40 % de materiales en una reforma de vivienda | SCRUM-1074 | ASESOR + JAVIER | «Q-C1 y SCRUM-1052» | descripción (0 comentarios) |
| 1.12 | El «mensaje con IA» del presupuesto está construido desde el 22-may y no tiene botón | SCRUM-1182 | FUNDADOR | «decidir: enchufarlo o retirarlo» | descripción (0 comentarios) |
| 1.13 | **NUEVA · Tres búsquedas en un mapa aceptan nombres como `constructor` o `__proto__`:** se pierde el motivo de rechazo, se rompe el recuento de motivos y sale una unidad vacía | SCRUM-1580 | NOSOTROS (S1) | ninguno | título (23-oct); no leído |
| 1.14 | **NUEVA · El recordatorio de PRESUPUESTOS reenvía en bucle si no puede guardar su candado** (48 en 48 h); en facturas ya está arreglado con la forma «A» | SCRUM-1586 | NOSOTROS (S1) + FUNDADOR | etiqueta `stop-fundador` (es un envío automático: regla 28) | título (23-oct); no leído |
| 1.15 | **NUEVA · Lectores que leen el cliente VIVO donde deberían leer el congelado en el documento:** albarán (6), buscador y `invoices.csv` | SCRUM-1595 | NOSOTROS (S1) | ninguno | título (23-oct); sale de SCRUM-1576c; no leído |

### 2 · Enviar y firmar

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 2.3 | El correo puede decir «ok» sin salir, y ninguna pantalla enseña el rebote | SCRUM-1558 | NOSOTROS (S1 + S2) + FUNDADOR | (a) ya está en `main` (#2522). Queda (b), el rebote, que necesita «firma de texto», y 1558b, que espera `LOG_MAGIC_LINKS=true` en staging | sin cambios desde el 16-oct |
| 2.4 | Lo que escribe el CLIENTE salía en su ficha como un envío nuestro | SCRUM-1518 (En curso) | NOSOTROS (S2) | ninguno: **las dos mitades están en `main`**, el servidor (#2688, 22-oct, 1518b) y el CHIP (#2986, 1518c, MERGEADO el 29-oct a las 11:09:48Z). Falta verlo en producción y cerrar | merge comprobado en GitHub por S0 a las 17:5xZ del 29-oct; ticket En curso |
| 2.5 | Firmar sin cobertura: sin red no se crea albarán ni parte, no van las fotos, y al reabrir manda a `/login` | SCRUM-307 | NOSOTROS (S2) | «prueba con un iPhone de verdad» | c.16463 (22-sep) |
| 2.6 | «Voy de camino», aviso de visita y el portal en el pie del WhatsApp | SCRUM-975 · 981 · 1143 | FUNDADOR | «plantillas de Meta: una sola visita para las tres» | c.16051 · c.16297 · descripción; sin cambios |
| 2.7 | Con teclado no se abría una factura | SCRUM-1562 | NOSOTROS + JAVIER | ninguno: **Facturas entró hoy** (#2959, 1562g, MERGEADO a las 18:13:12Z; producción `42c458e1` lo contiene, medido por S0). Falta verlo en producción y cerrar | Trabajos y Partes, vistos en producción el 18-oct. El ticket sigue abierto |
| 2.8 | El tope de plantillas por cliente se puede rebasar en una ráfaga | SCRUM-1513 | JAVIER (J2) | ninguno | c.19002; sin cambios desde el 8-oct |
| 2.9 | 🔴 **El enlace de FIRMA que llega por WhatsApp no funciona:** llegó `yaqu.app/albaran/%7B%7B1%7D%7D<token>`, el marcador `{{1}}` escrito tal cual y el token pegado detrás. El cliente ve un 404 | SCRUM-1632 (En curso) | FUNDADOR + NOSOTROS (S1) | **dos arreglos, y hacen falta los dos** (c.21202): **(a)** corregir el botón de `albaran_para_firmar_es` en WhatsApp Manager, con la dirección exacta que dejó S4 (`docs/master/SCRUM-1632.md`, #2979); **(b) NUESTRO:** que `albaranPublic.routes.ts:251` y `:381` limpien el token con `parseToken` (`utils.ts:288`), como ya hacen los 5 usos del presupuesto. (b) es el que impide que vuelva a pasar, y **espera un GO de una línea**. **Las guías ya no mandan teclear las llaves:** #2985 (1632b), MERGEADO el 29-oct a las 10:49:09Z | `git grep parseToken`: **sigue en 0** en `src/modules/jobs/` (medido por S0 en `eafca9fe1`, 17:5xZ). **MI LECTURA de S4, sin confirmar contra Meta:** la causa de origen pueden ser nuestras propias guías, que mandan teclear el `{{1}}` en la base (`docs/WHATSAPP_TEMPLATES.md:52`); encargado a S4 (dato del orquestador) |
| 2.10 | 🔴 **Las otras tres plantillas con enlace pueden tener el mismo defecto, y no está mirado en Meta:** `quote_decision_es` (el botón del PRESUPUESTO), `payment_request_es` y `payment_confirmation_invoice_es` | SCRUM-1632 | FUNDADOR | **mirar en WhatsApp Manager los tres botones** contra la tabla de S4 (`docs/master/SCRUM-1632.md`: tipo «Dinámica», la base SIN `{{1}}`). Ninguna sesión ve el panel de Meta | la del presupuesto tolera el `{{1}}` en el servidor (`parseToken`); **las de pago (`/pay/invoice/`) y recibo (`/recibo/`): NO MEDIDO** si lo toleran |
| 2.11 | Los programas que mandan correo pueden salir todavía con la marca vieja («PresuFácil») | SCRUM-1115 | FUNDADOR | **mirar `EMAIL_FROM` en los TRES servicios de Railway** (tres clics). **El código ya no tiene nada que arreglar**: sólo falta la variable | **medido por el orquestador** el 29-oct por la tarde (SCRUM-1115 c.21240); S0 no lo ha repetido |
| 2.13 | **NUEVA · El registro del fallo de WhatsApp se escribe sin esperar** (`logFailure`): la función vuelve antes de que la fila exista | SCRUM-1631 | JAVIER (J2) | ninguno | título (27-oct); no leído |
| 2.14 | **NUEVA · El correo de la factura dice «Tu factura está lista»** (de SCRUM-1252) | SCRUM-1622 | NOSOTROS (S1) | NO CONSTA si el texto nuevo está firmado | título (27-oct): pieza que deja abierto un ticket de J; no leído |

### 3 · Facturar (SIF-1 · regla 24)

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 3.1 | El Convenio 017 con la AEAT (exige sociedad mercantil) | SCRUM-143 | FUNDADOR | «S.L. inscrita → certificado de representante → solicitud del 017» | c.20865 (26-oct), leído por un lector |
| 3.2 | El nombre del productor que viaja a Hacienda | SCRUM-870 | FUNDADOR | «NIF DEFINITIVO de la S.L. (tras la inscripción)»: el fundador contestó las cinco preguntas; «se cambia una sola vez» | c.21022 (27-oct), leído por un lector |
| 3.3 | El certificado de entidad en el servidor | sin ticket | FUNDADOR | «S.L. constituida» | SCRUM-1561: el fundador dijo el 13-oct que llega «en un mes» |
| 3.4 | Enviar a la AEAT desde el servidor (S1-D): enchufar el procesador de la cola y el cliente, anulación, R1 y ≥10 registros seguidos | **sin ticket abierto** (SCRUM-1110 cerrado el 20-oct por S1-0; SCRUM-1296 cerrado el 1-oct por el encolado) | JAVIER (J1) + FUNDADOR | para PRUEBAS, cablearlo (J1) y que una persona con el certificado haga los envíos; para PRODUCCIÓN, el Convenio 017 | §1b, medido por S0 en `42c458e1` |
| 3.5 | La declaración responsable del productor (S1-E) | SCRUM-523 | FUNDADOR + JAVIER (J1) | «la S.L.»: «Esto lo hacemos cuando ya esté la SL». El texto con dos firmantes es el PR #2881, en borrador | c.21064 (27-oct), leído por un lector |
| 3.6 | La revisión fiscal externa (S1-F) | sin ticket | FUNDADOR | «no hay asesor fiscal, aplazado hasta la S.L.» (0.3) | SCRUM-1264 c.20088 |
| 3.7 | El paso a producción de la AEAT, con una factura real aceptada (S1-G) | sin ticket | FUNDADOR + JAVIER | «Convenio 017» | Parte U del máster, fila 3 |
| 3.8 | Reintentar un sellado que falló | SCRUM-1507 (Finalizada el 26-oct) | JAVIER (J1) | **la línea del cron ya está** (`cron.ts:163`, #2669, 22-oct) **y sale INACTIVA**; ver el aviso en los registros de Railway sigue sin hacer. **NO CONSTA quién lo activa:** el comentario de cierre lo remitía a SCRUM-1404, que se cerró el 27-oct | c.20914 (26-oct), leído por un lector |
| 3.9 | `ClaveRegimen` va fija a «01» para todos | SCRUM-1129 | JAVIER (J1) + FUNDADOR | «GO regla 40 + ALTER + firma de texto». J6 añadió un trinquete que lo declara DEFECTO CONOCIDO (#2971, el último merge de `main`) | c.21173 (27-oct), leído por un lector |
| 3.10 | El criterio de caja no llega al registro ni al PDF (mención ROF 6.1.p) | SCRUM-1240 | JAVIER (J1) + FUNDADOR + ASESOR | «GO regla 40 + firma de texto» | c.21172 (27-oct), leído por un lector |
| 3.14 | Acreditar en producción que ningún profesional real emite (el interruptor apagado) | SCRUM-1097 · 1109 (1101 Finalizada) | JAVIER (J6) + FUNDADOR | el guard está en `main` (#2707, SCRUM-1101) y **no se ha corrido contra ninguna base**: falta «la credencial de sólo lectura de producción», del fundador | SCRUM-1101 c.20560 (23-oct), leído por un lector |
| 3.15 | Las retenciones en el resumen del trimestre | SCRUM-1146 | FUNDADOR | «GO para el camino de emisión» | c.19788; sin cambios desde el 15-oct |
| 3.16 | Quitar «[PENDIENTE]» del libro y de la exportación | SCRUM-1041 | ASESOR | «dictamen (PREGUNTAS_ASESOR §21)» | c.17186 |
| 3.17 | La puerta de go-live: lo que tiene que ser verdad antes de encender la facturación | SCRUM-1554 | NOSOTROS + JAVIER + FUNDADOR | «hay cuatro listas de deseos, no una puerta»: 4 listas sin unificar y **0 de 37 condiciones** con un mecanismo que impida encender. Falta que el fundador decida unificarlas | c.20293 (22-oct), leído por un lector |
| 3.18 | 🔴 **NUEVA · Comprobar el SII en cada emisión** (quien declare SII después de encendido deja de emitir): **construido por J1 en una rama local, sin empujar, esperando a SCRUM-1594, que es NUESTRO** | SCRUM-1585 (J1) · SCRUM-1594 (S1, en `main`) | JAVIER (J1) | **ninguno de fuera.** 🔵 **1594 está en `main` y FINALIZADA** (#2983, MERGEADO el 29-oct a las 10:40:15Z). **La pelota es de J1**, que puede empujar 1585 (Por hacer a las 17:5xZ) | SCRUM-1594 c.21211 (29-oct, S1: «6 sitios con `llevaLibrosPorSii`, 6208 tests 0 fail»), leído por un lector; merge comprobado en GitHub |
| 3.21 | **NUEVA · El motor de IVA no cuadra con su propio total por un empate de medio céntimo** (22,50 € al 21 % da 4,72 y no 4,73), y de ahí sale la `CuotaTotal` del XML de VeriFactu | SCRUM-1566 | JAVIER (J1) + NOSOTROS (S1) | **autorizado por el fundador:** «B y C antes del SIF-1», juntos y nunca B sin C (c.21019), y la subida de `VERIFACTU_VERSION` con C (c.21031). B es de S1 y va en la rama compartida `conjunto-1566-b-y-c` (c.21199). **Corregido a las 17:5xZ:** la rama **SÍ está en `origin`** (`8f6becbd2`, `git ls-remote` por S0) y **no es PR a propósito** (decisión del orquestador). C es de J1; que esté construido NO CONSTA en lo leído | SCRUM-1566 c.21019, c.21031, c.21199, leídos por un lector con cita literal; `git ls-remote` por S0 |
| 3.19 | **NUEVA · Subsanar un registro «aceptado con errores» por la AEAT,** y el aviso al profesional del art. 16.4 | SCRUM-1612 | JAVIER (J1) + FUNDADOR | «diseño y GO antes de construir» (`stop-fundador`) | título; no leído |
| 3.20 | **NUEVA (era §6 «sin leer») · El PDF de una factura emitida se regenera con el código y los datos de hoy** (regla 29) | SCRUM-665 | JAVIER (J1) | ninguno: el fundador decidió el 27-oct la opción A (el PDF se guarda al emitir y se sirve siempre ése) | SCRUM-1264 c.21184 (27-oct), leído por S0; SCRUM-665 En curso |

### 4 · Cobrar al cliente (CONNECT-1)

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 4.1 | Stripe en modo real | SCRUM-41 | FUNDADOR | «S.L. constituida + SIF-1» | c.16294 (21-sep); sin cambios |
| 4.2 | Dos secretos de webhook en Railway (Connect y Mercado Pago) | SCRUM-678 | FUNDADOR | ninguno: hacen falta antes de encender Connect o Mercado Pago | c.19059; sin cambios desde el 9-oct |
| 4.4 | Una factura cobrada a mano sigue como deuda, con el enlace de pago vivo | SCRUM-1429 | JAVIER (J1/J2) | «decisión sobre el cobro (Charge)» | c.18211; sin cambios desde el 2-oct |
| 4.5 | Cancelar un cobro: el estado existe y nadie llega a él | SCRUM-1532 | FUNDADOR | «GO + 2 decisiones (el dinero que entra y la factura)» | c.19235; sin cambios desde el 13-oct |

### 5 · Que nos paguen (PRECIOS-1)

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 5.1 | La suscripción en modo real (claves reales y precios recreados) | 🔴 sin ticket propio; cuelga de SCRUM-41 | FUNDADOR | «S.L. + Stripe en modo real» | SCRUM-1561, descripción |
| 5.4 | **NUEVA · Ninguna cuenta QA puede tener un plan que sólo escribe el webhook de Stripe** (`equipo`, `founding`): todo ticket de planes queda sin ver en pantalla. Sale de 5.3 | SCRUM-1638 | NOSOTROS (S1) | ninguno de fuera; **si la receta pasa por una suscripción de prueba en producción, es STOP** (flujo de cobro) | abierto por S0 el 29-oct a las 17:55Z; el plan sólo lo escribe `stripe.routes.ts:138/202/219`, medido por S0 en `eafca9fe1` |

### 6 · Gestionar

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 6.1 | Encender los mantenimientos (construidos y apagados) | SCRUM-911 | FUNDADOR | «GO escrito + plantilla de Meta» | c.19807; sin cambios desde el 15-oct |
| 6.2 | Fichaje (registro de jornada) | SCRUM-913 | JAVIER + FUNDADOR | «ALTER + decisiones de ubicación, interruptor, textos y plan» | c.19821; sin cambios desde el 15-oct |
| 6.3 | Equipos del cliente | SCRUM-914 | **NOSOTROS (S1)** + JAVIER | 🔴 **espera a S1, pero NO a que abra una rama.** **Corregido el 29-oct:** esta fila decía «espera a que S1 abra la rama compartida», y la rama la empujó el equipo de Javier el 20-oct: `scrum-914-j3-borrado-y-anonimizado-equipos`, **PR #2621, 9 días en CONFLICTO** con sus 10 ficheros. Lo que falta son **dos piezas NUESTRAS:** `model Equipment` y los cuatro `equipmentId` en `schema.prisma`, y `'equipment'` en `MODELOS_POR_MERCHANT`. **La tabla está aplicada en las tres bases desde el 29-sep: un MES sin una línea de código que la use** | SCRUM-914 c.21207 (29-oct) y c.20085 (forma de la tabla columna a columna, «17/17» en las tres, medida por el equipo de Javier; S0 no ha mirado ninguna base). `git grep -i equipment` en `schema.prisma` y `src/`: **0** (control: `model Albaran` sí sale). #2621 comprobado en GitHub |
| 6.4 | «Volver a llamar» dentro del cliente | SCRUM-1056 | JAVIER (J2/J3) + FUNDADOR | lo que falta no es de S2: el ALTER (sólo está en dev), las rutas y el montaje (J2) y el anonimizado (J3) | 1056e (19-oct): `974068d33` |
| 6.5 | Preguntar la actividad junto a la retención de IRPF | SCRUM-1072 | NOSOTROS (S2) + JAVIER (contenedor J3) + ASESOR | el campo se guarda de verdad (**visto en yaqu.app** el 23-oct). Falta que salga en el Resumen del trimestre: espera la Q-C5 del asesor | c.20510 (23-oct), leído por un lector |
| 6.6 | Leer el ticket con IA y que el gasto entre por WhatsApp | SCRUM-961 · 971 | FUNDADOR | «5 fotos reales de tickets» | c.19330 · c.16053; sin cambios |
| 6.7 | Bandeja de gastos con estados | SCRUM-1069 | FUNDADOR | «cambio de máster (estados)» | descripción (0 comentarios) |
| 6.8 | Las fechas que se imprimen van en UTC (un albarán de las 00:30 lleva la víspera) | SCRUM-1445 | FUNDADOR + NOSOTROS + JAVIER | «firma de las 3 líneas del concepto» | 1445c (23-oct), visto en producción: el comercio QA tiene `timezone` vacío y las dos fechas salen en UTC. Jira sin cambios desde el 13-oct |
| 6.9 | La pantalla de provincia | SCRUM-1522 | JAVIER | ninguno: SCRUM-1536 se cerró el 24-oct; J6 mira si el ticket se cierra parte a parte | c.21047 (27-oct), leído por un lector |
| 6.12 | **NUEVA · Un Técnico podía bajarse el calendario (`.ics`) de un Trabajo AJENO**: arreglado y sin verificar con un Técnico de verdad | SCRUM-1390 (J4, En curso; tramo 1390b) | FUNDADOR | **#2603 MERGEADO el 19-oct a las 07:52Z.** Verlo en yaqu.app necesita un Técnico de verdad: la misma limitación que 1.8 | la escribió la medida 1563d, que no entró; PR comprobado en GitHub. SCRUM-1390 c.21146 (27-oct): «QA no tiene sesión de Técnico» |
| 6.13 | **NUEVA · Tres puertas más por las que el Técnico lee o escribe sobre el documento de un compañero** (adjuntos, mensaje IA, gasto imputado) | SCRUM-1582 | NOSOTROS (S1) | ninguno | título (23-oct); medidas en SCRUM-1390d; no leído |
| 6.16 | La tarjeta «Paquete del trimestre» **ya está** (1602); **falta que diga de qué periodo descarga** | SCRUM-1629 (Por hacer) | NOSOTROS (S2) + FUNDADOR | 1629: «FIRMA DEL FUNDADOR (sin prisa)». 1602 FINALIZADA (#2972, MERGEADO el 29-oct a las 11:15:53Z) | merge comprobado en GitHub; 1629 por título |
| 6.17 | **NUEVA · Ocho controles táctiles cortos** que llevaban meses sin verse (Avisos, Marca, Equipo, Facturación) | SCRUM-1630 | NOSOTROS | «repartirlos por dueño» | título (27-oct); no leído |

### 7 · Para salir a vender

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 7.1 | La decisión de posicionamiento (no se puede vender facturación que no se puede usar) | SCRUM-328 | FUNDADOR | «enmienda A4.1 del máster sin redactar» (SCRUM-534, que la acompañaba, se cerró el 27-oct) | c.16771 (24-sep); sin cambios |
| 7.3 | Textos falsos en la landing pública y en el bot | SCRUM-1236 | FUNDADOR | «firmar los recambios #4, #6, #7 y #9, y el B1 del bot» | c.19863; sin cambios en Jira desde el 16-oct |
| 7.6 | El respaldo de producción: el volcado no está programado | SCRUM-1525 | JAVIER + FUNDADOR | «3 decisiones: retención, RPO/RTO, tarea de Railway». Hay un volcado a mano del 13-oct; **la restauración no se ha probado** | último comentario del 22-oct, leído por un lector |
| 7.7 | Apagar `test-login` en producción antes de lanzar | SCRUM-1210 | FUNDADOR | ninguno: se cierra el día que se apague | descripción (0 comentarios) |
| 7.8 | 🔴 **La cuenta DEMO no puede crear un presupuesto:** `POST /quote/create` contesta 403 `trial_expired` (su prueba venció el 5-jun-2026). **Y al fundador no le llega el correo de `demo@yaqu.app`** (lo dice el orquestador, 19-oct; S0 no lo ha medido) | **sin ticket** | FUNDADOR | decidir cómo se le devuelve el acceso y hacer que el correo llegue a algún buzón. **Sin movimiento desde el 19-oct** (la búsqueda de 2.9 tampoco encuentra nada de esto) | medido por S2 el 18-oct, con control. `yaqu.app` tiene MX de Cloudflare (medido por S0 el 19-oct) |
| 7.9 | **NUEVA · Los cinco guiones comerciales** (la P1 de SCRUM-1016) pasan a la puerta de go-live | SCRUM-1554 (fila 24) | JAVIER + FUNDADOR | «decisión de c.20778» | SCRUM-1016 c.20883 (26-oct), leído por un lector |

---

## 3 · De quién depende

Sobre las **71 filas** de §2 (74 de la mañana del 29-oct − 2.12, 5.3, 6.14 y 6.15, hechas + 5.4, nueva). Una fila puede depender de más de uno, así que las columnas no suman 71.

| | filas en las que aparece | filas que dependen SÓLO de él | el 29-oct (10:50Z) | el 27-oct (18:41Z) | el 19-oct (06:43Z) |
|---|---|---|---|---|---|
| **FUNDADOR** | **48** | **29** | 49 / 29 | 50 / 30 | 44 / 29 |
| JAVIER | 26 | **8** | 26 / 8 | 26 / 7 | 28 / 12 |
| NOSOTROS | 19 | 8 | 22 / 10 | 21 / 10 | 11 / 4 |
| ASESOR (hoy no hay) | 6 | 2 | 6 / 2 | 6 / 2 | 6 / 2 |

**Lo que cambió el 29-oct por la tarde (17:5xZ):** salen 2.12, 6.14 y 6.15 (las tres sólo NOSOTROS) y 5.3 (NOSOTROS + FUNDADOR); entra 5.4 (sólo NOSOTROS, SCRUM-1638). **FUNDADOR 48 = 49 − 1; NOSOTROS 19 = 22 − 4 + 1 y sólo-NOSOTROS 8 = 10 − 3 + 1.** ⚠️ **De las 48 del fundador, la hoja de decisiones cuenta 3 que no le tocan** (1.8, 6.12, 3.17) y 11 que no son decisión sino espera de la S.L.: **le quedan 3 para hoy y 31 para la revisión de go-live.** La columna «depende de» de §2 **no se ha cambiado** para esas 3: lo decide el orquestador.

Contado por máquina sobre la columna «depende de» de §2: `node docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs docs/producto/ESTADO-DEL-PRODUCTO.md`. Se vuelve a correr en cada actualización. **Control (29-oct):** el mismo comando sobre la versión del 27-oct (`git show 503f0d86:docs/producto/ESTADO-DEL-PRODUCTO.md`) da lo que se publicó entonces: 74 filas · 50/30 · 26/7 · 21/10 · 6/2.

**Lo que cambió el 29-oct:** sale 4.3 (JAVIER + FUNDADOR); entra 3.21 (JAVIER + NOSOTROS); 2.9 pasa de FUNDADOR a FUNDADOR + NOSOTROS (el arreglo (b) es nuestro); y 3.18 pasa de NOSOTROS + JAVIER a sólo JAVIER (1594 entró a las 10:40Z). Eso es todo: **JAVIER 26 = 26 − 1 + 1 y sólo-JAVIER 8 = 7 + 1; NOSOTROS 22 = 21 + 2 − 1; FUNDADOR 49 = 50 − 1 y sólo-FUNDADOR 29 = 30 − 1.**

**Lo que cambió desde el 19-oct** (comparado fila a fila por máquina, las dos versiones con el mismo contador):
- 🔴 **Las 29 filas que dependían SÓLO del fundador el 19-oct siguen las 29 en §2, con el mismo dueño.** Se suma la 6.12 (verla necesita un Técnico de verdad): **30**.
- **Las nueve que salieron:** siete del equipo de Javier (3.11, 3.12, 3.13, 5.2, 7.2, 7.5, y 7.4 con el fundador) y dos nuestras (6.10 y 6.11).
- **NOSOTROS sube de 11 a 21:** doce filas nuevas nos tienen dentro, 2.7 pasa a ser también nuestra (Facturas lo hizo S2), y salen 6.10, 6.11 y 3.8.
- **Cambian de dueño:** 3.4 (JAVIER → JAVIER + FUNDADOR, por el certificado), 6.4 (JAVIER → + FUNDADOR, por el ALTER), 6.9 (FUNDADOR + JAVIER → JAVIER: su bloqueo, SCRUM-1536, se cerró) y 3.8 (deja de esperarnos: la línea del cron ya está).

### Lo que el equipo de Luis puede mover HOY sin esperar a nadie

| | filas |
|---|---|
| **desbloquean al equipo de Javier** (lo más urgente) | **6.3** (SCRUM-914, S1: dos piezas, PR de J3 con 9 días en conflicto) · **3.21** (SCRUM-1566, la mitad B de S1). **3.18 ya está:** 1594 entró a las 10:40Z |
| **desbloquea firmar** | **2.9** (b) (SCRUM-1632, S1), en cuanto haya GO |
| arreglo en `main`, falta verlo en producción y cerrar | 2.7 (SCRUM-1562) · 2.4 (SCRUM-1518: servidor y chip, #2986) |
| falta el dato de prueba | 5.4 (SCRUM-1638: una cuenta QA con plan `equipo` y otra `founding`; destraba también 1.8 y 6.12) |
| defectos nuevos nuestros sin bloqueo de fuera | 1.13 · 1.15 · 2.14 · 6.13 · 6.17 |
| **trabajo hecho que no llega** | los 4 PR nuestros en conflicto (§4b): #2392 y #2690 (tickets ya Finalizada), #2604, #2621 |

⚠️ **2.14 puede necesitar firma:** NO CONSTA si el texto nuevo del correo está firmado.

**Las nuestras que esperan a alguien:** 1.9, 2.3 y 1.14 (fundador), 5.3 y 6.16 (firma del fundador), 3.17 (go-live), 6.5 (J3 y el asesor), 6.8 (firma). Y 2.5, que espera un iPhone de verdad y no tiene dueño.

---

## 4 · Arreglos ya en `main` con el ticket todavía abierto

Puede que estén acabados y sólo falte cerrarlos. Lo cierra el orquestador del equipo dueño (A13). **Re-medido el 29-oct:** estado leído en Jira a las 10:2xZ.

| ticket | equipo | qué entró | qué falta | estado (27-oct → 29-oct) |
|---|---|---|---|---|
| SCRUM-1589 | Luis | **#2731** | verlo en producción (2.12) | En curso → En curso. **Cerrable tras verlo** (triaje de S0) |
| SCRUM-1608 | Luis | **#2943** | verlo en producción (6.14) | En curso → En curso. **Cerrable tras verlo** (triaje de S0) |
| SCRUM-1623 | Luis | **#2960, 29-oct 10:15Z** | verlo en producción (5.3) | En curso |
| SCRUM-1626 | Luis | **#2982, 29-oct 10:40Z** | verlo en producción (5.3); su literal, sin firmar el 27-oct | En curso |
| SCRUM-1594 | Luis | **#2983, 29-oct 10:40Z** | nada en nuestro lado (3.18): cerrar | En curso |
| SCRUM-1292 | sin etiqueta (es de J2) | **#2006, 30-sep 20:44Z** | NADA que conste: la fila 4.3 sale a §8 | Tareas por hacer, sin cambios desde el 30-sep. **Cerrable, para Javier** (triaje de S0; se lo pasa el orquestador) |
| SCRUM-1518 | sin etiqueta | **#2688, 22-oct** (1518b, el servidor) | **el chip de S2** (2.4): no es sólo verlo | Tareas por hacer → **sin cambios desde el 8-oct** |
| SCRUM-1562 | **Javier** (desde el 27-oct sólo lleva `equipo-javier`) | **#2959, 27-oct 18:13Z** (Facturas) | verlo en producción | Tareas por hacer → Tareas por hacer |
| SCRUM-1233 | Luis | #2588 (18-oct) | NO CONSTA: es un censo de pantallas | En curso → En curso |
| SCRUM-1444 | sin etiqueta de equipo | #2584 (18-oct) | NO CONSTA: es un censo de ~90 sitios | En curso → En curso |
| SCRUM-1442 | Luis + Javier | #2559 (página pública) | el PDF, de J1 (1.5) | Tareas por hacer → Tareas por hacer |
| SCRUM-1558 | Luis | #2522 (la mitad a) | (b) con firma; 1558b con staging (2.3) | Tareas por hacer → Tareas por hacer |
| SCRUM-1072 | Luis | #2506 (el servidor), **visto en yaqu.app el 23-oct** | el Resumen del trimestre (6.5) | En curso → En curso |
| SCRUM-1115 | Javier | #2433 (el veredicto) | los dos cron (2.11) | Tareas por hacer → Tareas por hacer |
| SCRUM-1513 | Javier | #2325 | la ráfaga | Tareas por hacer → Tareas por hacer |
| SCRUM-1525 | Javier | #2370 (el correo) | programar el volcado (7.6) | Tareas por hacer → Tareas por hacer |

**🔵 Re-medido el 29-oct a las 18:1xZ (S0, 1563i; Jira con `fields: key, status, labels, resolutiondate`):** **salen cinco, Finalizadas:** SCRUM-1594 (11:06Z), 1623 (11:06Z), 1626 (11:06Z), 1608 (11:15Z) y 1589 (11:22Z). **SCRUM-1518 cambia:** ya está En curso y las dos mitades están en `main` (el chip, #2986, a las 11:09Z): **le falta verlo y cerrar, no el chip.** El resto, igual que a las 10:2xZ: 1292, 1442, 1512, 1513, 1525, 1558, 1562 y 1115 en «Tareas por hacer»; 1072, 1233 y 1444 en «En curso». **Los tres «para Javier» del triaje (1292, 1512, 1529) siguen abiertos**, y 1529 ya no es cerrable: va como pregunta al fundador (`DECISIONES-DEL-FUNDADOR.md`, final de la parte D).

**Salen de la tabla desde el 19-oct, cerrados:** SCRUM-529 (20-oct), 1258 y 1304 (19-oct), 534 (27-oct), 1564 (19-oct) y 1265 (19-oct). **Entran el 27-oct:** 1518 y 1562 (Facturas). **Entran el 29-oct:** 1589, 1608, 1623 y 1292.

**El triaje se repitió el 29-oct** (S0, sesión anterior, ~10:1xZ): **80 tickets abiertos leídos**, y cada «cerrable» re-verificado por S0 —de los 6 que dieron sus lectores, tumbó 2 releyendo el último comentario (SCRUM-1603 tiene una fila «NO HECHO»; SCRUM-1529 es de J3)—. Resultado: **3 cerrables nuestros, ya CERRADOS** por el orquestador a las 10:14Z (1087, 1088, 1593 → §8) · **2 tras verlos en producción** (1589, 1608) · **3 para Javier** (1292, 1512, 1529; se los pasa el orquestador). ⚠️ **La tabla completa del triaje viajó en un mensaje al orquestador y no está en ningún fichero del repo**: lo que queda escrito es este párrafo. Es el mismo patrón que el triaje del 19-oct (§4b, nota final).

---

## 4b · Trabajo hecho que no llega: 13 PR en CONFLICTO (12 a las 10:2xZ)

**Medido por S0 el 29-oct a las 10:2xZ**, sobre `503f0d86`: de 23 PR abiertos, **12 en `CONFLICTING`**. El equipo sale de la etiqueta del ticket de cada PR. Un PR en conflicto no se mezcla aunque su obligatorio pase: **es trabajo terminado que no llega a producción.**

| PR | rama | abierto | días | obligatorio (última pasada) | equipo | nota |
|---|---|---|---|---|---|---|
| **#2392** | `scrum-876h-scrum17-al-banco` | 13-oct | **16** | verde (13-oct) | **Luis** (S3) | borrador. **SCRUM-876 está Finalizada desde el 13-oct** |
| **#2604** | `scrum-1563d-estado-19oct-tarde` | 19-oct | 10 | rojo (19-oct) | **Luis** (S0) | la medida de este documento que no entró. Lo que traía se volvió a medir el 27-oct |
| **#2621** | `scrum-914-j3-borrado-y-anonimizado-equipos` | 20-oct | 9 | rojo (20-oct) | **Luis** (ticket) · el código es de J3 | **6.3:** espera las dos piezas de S1 |
| **#2690** | `scrum-962e-censo-tactil-cuatro-averias` | 22-oct | 7 | sin pasada con ese nombre | **Luis** (S2) | **SCRUM-962 está Finalizada desde el 22-sep** |
| #2841 | `scrum-1498c-grupo-propio-jobs-largos` | 24-oct | 5 | verde (24-oct) | Javier (J3) | borrador |
| #2881 | `scrum-523c-declaracion-dos-firmantes` | 26-oct | 3 | rojo (26-oct) | Javier (J1) | borrador; es la declaración responsable de S1-E (3.5) |
| #2940 | `scrum-1393g-cierre-con-ciegos-dichos` | 27-oct | 2 | rojo | Javier | — |
| #2949 | `scrum-1396-censo-mkdtemp-por-variable` | 27-oct | 2 | rojo | Javier (J6) | — |
| #2965 | `scrum-1396d-lote-1-temporales` | 27-oct | 2 | rojo | Javier (J6) | — |
| #2969 | `scrum-1396e-lote-2-temporales` | 27-oct | 2 | rojo | Javier (J6) | — |
| #2974 | `scrum-1051d-suelta-conserva-causa` | 27-oct | 2 | verde | Javier (J1) | — |
| #2975 | `scrum-1252h-ancla-firma-correo` | 27-oct | 2 | verde | Javier (J1) | SCRUM-1252 está Finalizada |
| **#2738** · *entra 18:1xZ* | `scrum-935e-ci-solo-docs` | 23-oct | 6 | **rojo (23-oct, 13:53Z)** | sin etiqueta (SCRUM-935, **Finalizada**) | lo abrió `yaqu-bot`; título «MEDIDO y no se construye» |

**🔵 Re-medido el 29-oct a las 18:1xZ (S0, 1563i), sobre `c93f26a76`:** de **25** PR abiertos, **13 en `CONFLICTING`** y 12 `MERGEABLE`. **Los doce de arriba siguen en conflicto, y entra #2738.** ⚠️ **Cómo se midió, porque la primera pasada mentía:** `gh pr list --json mergeable` dio **20 `UNKNOWN`** (GitHub calcula el estado al pedirlo); se volvió a pedir PR a PR con `gh pr view <n> --json mergeable` y entonces dio 13 + 12 = 25, ninguno `UNKNOWN`. Un `UNKNOWN` leído como «sin conflicto» habría dado **cero**.

**Ocho del equipo de Javier y cuatro nuestros** (a las 10:2xZ; a las 18:1xZ, más #2738, sin etiqueta). De los cuatro nuestros, **dos son de tickets ya Finalizada** (#2392 y #2690): o su trabajo ya no hace falta y el PR sobra, o el ticket se cerró sin él. **NO CONSTA cuál** de las dos: no se ha mirado el contenido de esos dos PR contra `main`.

**El obligatorio en rojo, aparte del conflicto** (los 23 abiertos): 2 del 19-oct (#2604, #2616), 1 del 20-oct (#2621), 1 del 23-oct (#2738), 1 del 26-oct (#2881) y **6 del 27-oct** (#2940, #2949, #2950, #2965, #2969, #2973). El encargo decía «ocho desde el 27-oct»: S0 cuenta **seis** con esa fecha a las 10:2xZ; #2962 estaba re-corriendo y entró a las 10:3xZ. Más **#2980** (1628b, S0), rojo a las 10:24Z por una línea A9 que faltaba: arreglado y re-empujado a las 10:4xZ (`2f4889b6`).

**Nota · el triaje del 19-oct no se perdió por accidente.** La rama `scrum-1529-censo-equipo-javier-27` (S0, 19-oct: un censo de 23 tickets de Javier con merge sin cerrar, `para-javier.md` §27) tiene su PR #2606 **CERRADO sin mergear**, y `para-javier.md` sigue acabando en §26. **Lo cerró el orquestador del equipo de Javier el 26-oct a las 15:17Z, por decisión de Javier:** «es una foto del 19-oct, desfasada, que nadie cita. El censo de tickets con merge sin cerrar se rehace cuando hace falta (auditor de cierre del 24-oct)». Es decir: **se cerró a propósito, y nadie del equipo de Luis lo supo hasta el 29-oct.** Lo que sí es el patrón de SCRUM-1632 es lo segundo: una decisión sobre trabajo nuestro escrita en un sitio que nuestro equipo no lee.

---

## 5 · Cómo va

Una fila por medida. **No se borra ninguna:** se añade la nueva arriba.

| medida (hora de GitHub) | abiertos en SCRUM | del equipo de Luis | sólo de Javier | sin etiqueta de equipo | cerrados desde el 14-oct (Luis + sin etiqueta) | creados desde el 14-oct (Luis + sin etiqueta) | filas de §2: hechas / quedan |
|---|---|---|---|---|---|---|---|
| 29-oct-2026 10:3xZ | **178** | **73** | **59** | **46** | 61 | 41 | 1 hecha / 74 (entra 1 nueva) |
| 27-oct-2026 18:3xZ | **179** | **67** | **58** | **54** | 58 | 40 | 9 hechas / 74 (entran 17 nuevas) |
| 19-oct-2026 07:4xZ (#2604, sin mergear) | 264 | 50 | 165 | 49 | 49 | 10 | 2 hechas / 65 (entra 1 nueva) |
| 19-oct-2026 06:4xZ | 268 | 53 | 165 | 50 | 45 | 10 | 1 hecha / 66 (entra 1 nueva) |
| 18-oct-2026 18:4xZ | 271 | 56 | 164 | 51 | 41 | 10 | 2 hechas / 66 (entran 5 nuevas) |
| 18-oct-2026 17:09Z | 273 | 58 | 164 | 51 | 38 | 9 | 0 / 63 (primera foto) |

**Entre las 18:41Z del 27 y las 10:3xZ del 29:** 3 cerrados y 2 creados en todo el proyecto: 179 − 3 + 2 = **178**, exacto. **Control:** 73 + 59 + 46 = 178. Los «creados desde el 14-oct» suben sólo de 40 a 41 con dos tickets nuevos porque 1631, sin etiqueta el 27-oct, ahora es de Javier y sale de la cuenta.

**Entre las 07:50Z del 19 y las 18:4xZ del 27:** se cerraron **151** y se crearon **66** en todo el proyecto: 264 − 151 + 66 = **179**, exacto. Del equipo de Luis + sin etiqueta, **9** cerrados y **31** creados: 99 − 9 + 31 = **121** = 67 + 54, exacto. **Control:** 67 + 58 + 54 = 179.

**Últimas 24 h** (`resolved >= -24h` y `created >= -24h`): todo el proyecto, 39 cerrados y 22 creados (**−17**); equipo de Luis + sin etiqueta, 7 y 12 (**+5**).

**Las consultas** (JQL, siempre por id de estado: por nombre dan 0 en falso):
- abiertos: `project = SCRUM AND status != 10004`
- del equipo de Luis: `… AND labels = equipo-luis`
- sólo de Javier: `… AND labels = equipo-javier AND labels != equipo-luis`
- sin etiqueta de equipo: `… AND (labels is EMPTY OR labels not in (equipo-luis, equipo-javier))`
- cerrados desde el 14-oct: `project = SCRUM AND status = 10004 AND resolved >= "2026-10-14" AND (labels = equipo-luis OR labels is EMPTY OR labels not in (equipo-javier))`
- creados desde el 14-oct: la misma, con `created >= "2026-10-14"` y sin el estado.
- desde la medida anterior: las mismas con `>= "2026-10-19 09:50"`.

Las fechas de JQL van en la hora de Madrid.

---

## 6 · Lo que NO está medido

- **Cómo están registradas en Meta las cuatro plantillas con enlace** (2.9 y 2.10). Ninguna sesión ve WhatsApp Manager. Desde el 29-oct hay en `main` la dirección que DEBE llevar cada botón (S4, `docs/master/SCRUM-1632.md`); lo que lleva HOY, no lo ha visto nadie del equipo.
- **Si `/pay/invoice/` y `/recibo/` toleran el `{{1}}`** como la página del presupuesto (2.10): no medido.
- **El contenido de #2392 y #2690 contra `main`** (§4b): sus tickets están Finalizada y no se sabe si su trabajo sigue haciendo falta.
- **Ninguna base de datos:** que la tabla `equipments` esté en las tres (6.3) lo midió el equipo de Javier (SCRUM-914 c.20085), no S0.
- **El valor de los interruptores y variables en Railway** (`INVOICING_ES_ENABLED`, `E2E_TEST_LOGIN_*`, los secretos de webhook, `LOG_MAGIC_LINKS` en staging). Ninguna sesión lo ve.
- **El estado de la cuenta demo** (7.8) y su correo: no se ha repetido desde el 18-19-oct.
- **El remitente de los dos cron que mandan correo** (2.11).
- **Lo que «vio en producción» otra sesión**: sale de sus registros. S0 no lo ha repetido.
- **2.7, 2.12, 5.3 (1623), 6.14, 6.12 y 1.8 en yaqu.app**: los cuatro primeros se pueden mirar con la cuenta QA; 6.12 y 1.8 necesitan un Técnico de verdad, que no hay. **2.4 ya no está en esta lista:** antes de verlo falta el chip de S2.
- **Las filas «leído por un lector»**: el último comentario lo leyó un subagente de sólo lectura el 27-oct. S0 releyó entero sólo SCRUM-1264 y SCRUM-1563.
- **Las filas nuevas marcadas «no leído»**: salen sólo del título del ticket.
- **Los 59 sólo de Javier**, salvo los que nombra esta tabla. **Los 46 sin etiqueta**, lo mismo. Los siete que el 27-oct no llevaban ninguna etiqueta (SCRUM-1626 a 1632) **ya la llevan** (29-oct): seis `equipo-luis` y 1631 `equipo-javier`.
- **Si los 142 cierres de Javier desde el 19-oct son por efecto o limpieza.**
- **Tickets nuevos del equipo de Luis que NO son fila** porque no le faltan al producto, sino a las herramientas del equipo: 1590, 1591 (anclas de firma en el código), 1593, 1603 (bancos táctiles), 1605, 1606, 1620, 1621, 1627, 1628 (CI y sesiones).

---

## 7 · Cómo se actualiza (cada tanda de S0, o cuando lo pida el orquestador)

1. La cabecera, con la hora de GitHub (`gh api -i zen`) y el SHA de `origin/main` (`node scripts/equipo/ancla.mjs`).
2. Una fila nueva **arriba** de la tabla de §5, con las seis consultas, **y el saldo del equipo de Luis aparte del total** (§1 ③): el total puede bajar mientras lo nuestro sube.
3. Cada fila de §2 se vuelve a mirar en el ÚLTIMO comentario de su ticket y en `main` (`npm run ya-esta -- <números>`, o `git log origin/main --merges --grep=scrum-<n>`). Si está hecha, **no se borra**: pasa a §8 «Hecho», con su número, la fecha y la evidencia.
4. Una cosa nueva que le falte al producto entra como fila, en su bloque, con el siguiente número libre, aunque no tenga ticket. **Sin ticket es justo lo que hay que ver** (así estuvo la S.L. semanas: SCRUM-1561; y así siguen 2.9, 2.10, 3.4 y 7.8).
5. Lo que no se sepa se escribe «NO CONSTA». Nunca se rellena.
6. ⚠️ **Las cifras del orquestador, y las de este documento, se comprueban como las de cualquiera.** El 27-oct, de siete afirmaciones del encargo, cuatro no aguantaron la medida (§1).
7. **Antes de escribir que algo es movible hoy, se mira en `main`.**
8. 🔴 **La tabla de SIF-1 (§1b) se re-mide en el árbol, no en el máster.** `YAQU_MASTER.md:986` y la auditoría del 19-ago se quedan atrás: el 27-oct el máster decía «falta la cita con el asesor» de un asesor que no existe, y la auditoría decía que la cola no estaba construida.
9. **Después de empujar, se mira que el PR entre.** La medida del 19-oct por la tarde (#2604) se quedó 8 días en rojo y nadie lo vio.

---

## 8 · Hecho

Lo que estaba en §2 y ya no falta. **No se borra.** Una fila que entra y sale el mismo día también se apunta aquí.

| # | qué era | cuándo | evidencia |
|---|---|---|---|
| 1.10 | «Presupuesto adicional» sobre un Trabajo ya en marcha (SCRUM-1190) | 18-oct-2026, cerrado 17:14Z | servidor #2495 (16-oct) y pantalla #2523 (17-oct 19:39Z), los dos en `main`. **Visto en producción por S2** sobre el build `57b0bc82`, a 1280 y 390 (SCRUM-1190 c.19951) |
| 2.1 | El WhatsApp de PRODUCCIÓN (el número de la casa, con sus plantillas) | 18-oct-2026, 17:53Z | el fundador pulsó «Enviar para firmar» con un móvil real y Meta contestó con un código suyo: filas 451 y 452 del historial del cliente 83, `albaran_para_firmar_es`, `failed`, `131026: Message undeliverable` (`docs/master/SCRUM-1236.md:158-162`, medido por S4). Con el móvil del fundador, la fila 453 salió entregada (traspaso de S4). **Lo que destapó, el enlace roto, queda en §2 como 2.9** |
| 2.2 | Enviar a un cliente sin correo: la pantalla parecía que lo enviaba (SCRUM-1237) | 18-oct-2026, cerrado 19:06:56Z | arreglo #2521 (16-oct 13:10Z) en `main`. **Visto en producción por S2** contra la aceptación del c.19870. Tramo 1237b de `docs/master/SCRUM-1237.md`, #2590. **No medido, y lo dice el registro:** los dos errores de WhatsApp de la modal |
| — | Los CSV de exportación se servían sin sesión desde la caché de Cloudflare (no era fila: entró y salió el 18-oct) | 18-oct-2026 | **medido por S0 a las 18:39:38Z**: los 7 CSV de `/admin/exports/` sin cookie dan **401** con `cf-cache-status: DYNAMIC`. Lo cierra la regla de Cloudflare del fundador (SCRUM-1564) |
| 6.10 | Las casillas de métodos de pago medían 20 px (SCRUM-1265) | 19-oct-2026, cerrado 07:37Z | el orquestador decidió el patrón; **#2595 MERGEADO a las 07:13:55Z** (comprobado en GitHub el 27-oct) y visto en producción (SCRUM-1265 c.20006). S0 no lo ha repetido |
| 6.11 | Los CSV sólo los protegía la regla de Cloudflare (faltaba la mitad del origen) | 19-oct-2026; SCRUM-1564 cerrado a las 07:16Z | #2568 MERGEADO a las 06:48:54Z y su VISTO **con sesión**, de S2, en #2599 (MERGEADO a las 07:32:29Z; los dos comprobados en GitHub el 27-oct). S0 sólo midió el lado sin sesión |
| 3.11 | Tipo F2 con una huella calculada sobre F1 (SCRUM-1258) | 19-oct-2026, cerrado 11:58Z | #2048 (1-oct); tipo del registro = tipo de la huella, 8/8 tests (c.20047, leído por un lector). Residual declarado: documentos «latentes» sin medir |
| 3.13 | Un cobro con tarjeta podía emitir dos facturas (SCRUM-1304) | 19-oct-2026, cerrado 11:58Z | #2053 (1-oct); deduplicación por `chargeId`, 18/18 tests (c.20048, leído por un lector) |
| 3.12 | Re-sellar pisaba la huella de una factura emitida (SCRUM-1330) | 26-oct-2026, cerrado 22:25Z | guardas A+B (#2053) en `main`, 0 duplicadas en producción, `scrum173` corrido con la guarda B (#2889). Límite aceptado por el fundador: contra una base de pruebas, no staging (c.20942, leído por un lector) |
| 5.2 | Al suscribirse no se escribía la fecha de fin de periodo (`planExpiresAt`) (SCRUM-1565) | 23-oct-2026, cerrado 03:41Z | «las tres partes en `main`» (c.20389, leído por un lector). ⚠️ **NO CONSTA que se haya visto en producción**: el comentario de cierre no lo dice |
| 7.2 | El guion H2 sobre VeriFactu decía cosas falsas (SCRUM-534) | 27-oct-2026, cerrado 13:06Z | H2 firmado; #2425 (14-oct) en `main` (c.21018, leído por un lector). Queda un cambio de máster aparte (diseño de `VfSubmission`) que no bloquea |
| 7.4 | Documentos legales servidos que prometían cobro (SCRUM-1551 · 1028) | 26 y 27-oct-2026 | #2931 en `main` y **visto en yaqu.app**: 0 «Cobro integrado» / «Justificantes de cobro» en alcance-beta, términos y privacidad (c.21109, c.20911, leídos por un lector). ⚠️ **Queda uno fuera:** `plansView.js:103,109` sigue diciendo «Cobro integrado», oculto en modo justificante; los tickets que cita (1029 y 1086) están cerrados desde el 23-sep |
| 7.5 | El `title` y los dos H1 de la landing (SCRUM-1016) | 26-oct-2026, cerrado 15:42Z | en `main` y visto en yaqu.app (c.20883, leído por un lector). Su P1, los guiones comerciales, pasa a §2 como 7.9 |
| 4.3 | Un Bizum ya pagado podía pasar a «caducado» (SCRUM-1292) | **30-sep-2026**, #2006 MERGEADO a las 20:44Z; **la fila sale el 29-oct** | arreglo y test en `main` (`estadoDelCobro.ts`, `tests/scrum1292-cobro-pagado-no-retrocede.test.mjs`). **La fila estuvo un mes de más** porque su fuente era el último comentario de Jira (c.17637), escrito **6 minutos antes** del merge. ⚠️ **El ticket sigue abierto** (§4): cerrable, para Javier |
| — | Dos preguntas urgentes para el asesor (SCRUM-1087) y cotejar las 14 marcas ⚠ de PREGUNTAS_ASESOR (SCRUM-1088). No eran fila | 29-oct-2026, cerrados a las 10:14Z | triaje de S0 del 29-oct, re-verificado por S0; el orquestador comprobó sus PR mergeados (#1691, #1693) antes de cerrar |
| — | El censo táctil no abría las pestañas ocultas (SCRUM-1593). Herramienta del equipo, no fila | 29-oct-2026, cerrado a las 10:14Z | lo mismo; PR #2970. Lo que destapó (ocho controles cortos) sigue en §2 como 6.17 |
| 2.12 | La imagen de la firma invadía la línea «Firmado por:» en el PDF del albarán (SCRUM-1589) | 29-oct-2026, Finalizada | #2731 en `main`; cumplido línea a línea contra `main` por la sesión anterior de S0 (auditoría de cierres del 29-oct) |
| 5.3 | El nombre del plan en la barra lateral: «Plan Equipo» y «Plan Fundador» (SCRUM-1623 · 1626) | 29-oct-2026, Finalizadas | #2960 (10:15:42Z) y #2982 (10:40:53Z), `app.js:184`. ⚠️ **VERIFICADO EN CÓDIGO, NO EN PANTALLA:** esos planes sólo los escribe el webhook de Stripe y ninguna cuenta QA los tiene (c.21244 y c.21245). El hueco sigue en §2 como 5.4 |
| 6.14 | El tipo de IVA se redondeaba a entero en cuatro pantallas (SCRUM-1608) | 29-oct-2026, Finalizada | #2943 en `main`; cumplido contra `main` por la sesión anterior de S0 |
| 6.15 | La categoría de gasto «Alquiler de local» (SCRUM-1588) | 29-oct-2026, Finalizada a las 17:38Z | sus dos tramos en `main`: #2988 (categorías) y #2984 (pantalla, el último merge de `main`, `eafca9fe1`) |
