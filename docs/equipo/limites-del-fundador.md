# LÍMITES DEL FUNDADOR — decisiones dichas, nunca escritas

Estas decisiones las tomó el fundador de viva voz. No están en el máster ni en las
normas, y por eso se pierden en cada traspaso. No se relajan sin que él lo diga
otra vez, y «no lo veo escrito» no es motivo para saltárselas.

## 🔴 Desde el 18-sep-2026: los límites de los DOS JEFES

**Decisión del fundador (18-sep-2026 ~11:50Z):** Luis y Javier son los dos jefes. Desde ese día:

- **Donde este fichero dice que algo «vuelve al fundador» o que «el sí lo escribe el fundador», vale
  cualquiera de los dos jefes.** Cada jefe habla con SU orquestador (`dos-equipos.md`).
- **Las decisiones de abajo siguen en vigor** tal como están escritas: el cambio es quién puede dar un sí,
  no lo que ya se decidió. Si un jefe puede cambiar una decisión que tomó el otro está **PENDIENTE** de
  decidir (`dos-equipos.md` §1); mientras tanto, una decisión escrita solo la cambia quien la tomó.
- **Una decisión nueva se escribe con quién la tomó y la fecha** («Javier, 20-sep-2026: …»). La escribe el
  orquestador de Luis, dueño de este fichero; el de Javier se la pasa por Jira (`dos-equipos.md` §3.3 y §5).
- La **delegación permanente** de más abajo la dio el fundador a su orquestador. Si Javier delega lo mismo en
  el suyo, se escribe aparte, con su fecha: no se supone.

## Seguridad y secretos

- La credencial de staging que quedó expuesta **NO se rota**. Decisión suya,
  consciente, como fundador. No se vuelve a proponer.
- Las variables `VERIFACTU_PRODUCTOR_*` **se quedan en Railway**, aunque hoy no
  las lea nadie. «Por si se usan en un futuro.»
- **NUNCA se pega en el chat una cadena de conexión, un usuario o una contraseña.
  Ni real ni de ejemplo.** Solo resultados de consultas. Ninguna sesión escribe,
  imprime ni inventa una cadena de conexión con forma realista en ningún sitio.
- Una sesión **no toca el `.env` de otro worktree**. Nunca.
- El secreto del webhook de Resend va del panel de Resend **directamente a
  Railway**, sin pasar por el chat.
- La clave privada `.pem` y el token `sk-ant-oat` **no se pegan jamás en el chat**,
  y el `.pem` se borra de Descargas después de usarlo.
- Ninguna clave de Stripe se escribe en ningún sitio, ni real ni de ejemplo.
- `assertSafeStagingUrl` es una lista blanca de hosts y es **fail-closed. No se
  relaja.**

## Datos

- **Todos los datos de producción de hoy son de prueba. No hay merchants reales.**
  Eso es lo que hace que decisiones como «mover la infraestructura» sean baratas
  hoy y caras mañana — y lo que hace que la mayoría de hallazgos NO tengan víctima
  todavía (regla 37).
- Las facturas antiguas de producción no representan a ningún cliente real.

## Delegación permanente

El fundador ha delegado, por escrito y de forma permanente:

- **Los textos de microcopy que haya que aprobar los aprueba el orquestador**
  (dentro de la regla 30: siguen sin poder inventarse a nivel de sesión).
- **Lo que sea claramente decisión del orquestador, la toma el orquestador** y le
  dice qué ha decidido, en vez de devolverle la pregunta.
- Sus palabras: «todo lo que dices que es mío decídelo tú si puedes».

**Javier, 25-sep-2026:** los textos de microcopy que haya que aprobar los aprueba **su**
orquestador (dentro de la regla 30: siguen sin poder inventarse a nivel de sesión). Referencia:
SCRUM-1121. Delegación aparte de la de Luis (línea de arriba): dos jefes, dos delegaciones
distintas, nunca una sola frase para las dos.

**Javier, 22-sep-2026** (SCRUM-997, comentario 16373; escrito aquí el 13-oct-2026, tres semanas después).
Su literal, como lo dejó en el chat de su orquestador:

> «delego en mi orquestador la aprobación de los textos que no sean legales ni fiscales, y las decisiones
> de producto y de proceso que sean claramente suyas. Siguen siendo míos el coste nuevo, el camino de
> emisión fiscal, la infraestructura de producción y los permisos.»

- **Qué es:** una delegación, tres días anterior a la del 25-sep de arriba. **No dicen lo mismo.** Ésta
  excluye los textos legales y los fiscales y añade las decisiones de producto y de proceso; la del 25-sep
  («te lo delego», SCRUM-1121) habla de «microcopy» sin excluir nada.
- **Cuál de las dos manda sobre un texto fiscal no lo ha dicho Javier.** Aquí quedan las dos, cada una con
  su fecha; la pregunta es suya y le llega por su orquestador. *Lectura de la Sesión 0, no palabras de
  Javier:* la del 25-sep contestaba a si firmaba él cada literal, y nada en ella retira la exclusión del
  22-sep.
- **Mecanismo: ninguno para la exclusión.** El oráculo de microcopy (`delegacionVigente`, en
  `tests/_microcopy-aprobada.mjs`) comprueba UNA línea de esta sección: la viñeta de Luis. No lee ninguna de
  las dos líneas de Javier, no distingue qué orquestador firma y no sabe si un texto es legal o fiscal.
  Ejecutado el 13-oct-2026 sobre copias de este fichero: sin ninguna línea que nombre a Javier, la
  delegación sigue saliendo vigente; sin la viñeta de Luis, deja de estarlo
  (`docs/master/evidencias/SCRUM-997/vigencia.mjs`). Que un texto fiscal del equipo de Javier suba a
  Javier lo sostiene hoy quien firma.
- **Desde SCRUM-997d el oráculo lo dice en vez de callarlo.** Una firma delegada ya no sale «aprobada» a
  secas: sale `aprobada-sin-comprobar` (hasta SCRUM-1546c se llamaba `aprobada-por-delegacion-sin-comprobar`;
  hoy lo comparte con la firma del fundador, que tampoco se comprueba), con la lista de lo que no se ha mirado de ella
  (`NO_COMPROBADO_EN_UNA_DELEGADA`, en `tests/_microcopy-aprobada.mjs`). **Sigue contando como aprobada**:
  decirlo no es comprobarlo, y la exclusión de arriba sigue sin mecanismo. A quién alcanza cada delegación
  lo decide cada jefe.

Lo que NO está delegado y vuelve siempre a él: coste nuevo o dependencia nueva,
el camino de emisión fiscal y cualquier cambio de infraestructura de producción (la regla 36 del máster es otra cosa: plugins, skills y hooks de terceros; y la 38 dice que un test que solo LEE el camino fiscal NO es STOP. Estas reservas vienen de las STOP CONDITIONS de CLAUDE.md y de lo que el fundador ha dicho; se citaban mal, lo cazó la auditoría de la Sesión 0 del 17-sep).
El dinero tiene un matiz desde el 17-sep: ver «Delegaciones del 17-sep-2026».

## 🔴🔴 CÓMO VIAJA UN «SÍ» DEL FUNDADOR (13-oct-2026, de viva voz)

**El problema que esto resuelve, con su fecha.** El 13-oct el fundador dio GO para SCRUM-1404
(enganchar el reintento de sellado en `cron.ts`, camino de emisión fiscal). El orquestador se lo
transmitió a S1, y **S1 se negó a construir**: «el GO me llegó retransmitido por otra sesión. No lo
tomo como autorización: que el fundador lo escriba a la sesión que lo vaya a construir».

**S1 hizo bien, y era la tercera vez que una sesión paraba así.** El motivo es estructural y no
desaparece: **en Jira la cuenta del fundador y la del orquestador son la misma**, así que una sesión
no puede distinguir «lo dijo él» de «lo dice el orquestador». En el camino fiscal esa diferencia es
justo la que importa.

**Pero la alternativa era peor:** que cada permiso suyo exigiera que él entrara a Jira a escribirlo.
Eso lo convierte en el cuello de botella de cada arreglo fiscal, que es exactamente lo que llevamos
meses intentando quitar.

### LA REGLA, que la pidió él y la dio él

🔴 **Cuando el orquestador cite las palabras LITERALES del fundador, con su fecha, eso CUENTA como
la autorización del fundador y una sesión puede construir sobre ella.** Sus palabras al darla:
«si te doy la regla permanente» (13-oct-2026, de viva voz, tras leer las tres salidas posibles).

### 🔴 CÓMO LO COMPRUEBA LA SESIÓN, SIN FIARSE DEL ORQUESTADOR

**Esto lo añadió S1 el mismo día, y es lo que hace que la regla valga.** La primera versión decía
que bastaba con que el orquestador citara la frase. S1 lo rechazó con el argumento correcto:

> «f5e727e73 existe en la rama, su autor es *Luis*, la firma de git de todas las sesiones de esta
> máquina: distingue lo mismo que Jira, nada. **La regla me llega por el mismo canal que la regla
> viene a validar.**»

Tenía razón: era circular. **Una regla que dice «mi palabra cuenta», firmada con la misma identidad
que usa cualquier sesión, no demuestra nada.**

**La vía que SÍ se comprueba, y es la que ya usaron S0 y S5 con el umbral de los 300k:** el turno
del fundador vive en la transcripción del orquestador como una entrada `type:"user"`, que es de otra
clase que lo que escribe un modelo. **La sesión lo lee en el origen, con su marca de tiempo.**

🔴 **Así que una cita del orquestador SÓLO activa la regla si viene con su localizador:** el fichero
de transcripción y la marca de tiempo del turno. Sin localizador, es una cita sin más y la sesión
hace bien en no construir.

```bash
# Las palabras del fundador, leídas en el origen. <jsonl> = la transcripción del orquestador,
# en ~/.claude/projects/<proyecto>/<sessionId>.jsonl
node -e "const fs=require('fs');for(const l of fs.readFileSync(process.argv[1],'utf8').split('
').filter(Boolean)){try{const o=JSON.parse(l);if(o.type!=='user'||!o.message)continue;const c=o.message.content;const t=typeof c==='string'?c:(Array.isArray(c)?c.filter(x=>x&&x.type==='text').map(x=>x.text).join(' '):'');if(t&&!t.startsWith('<'))console.log((o.timestamp||'').slice(0,19),JSON.stringify(t.slice(0,160)))}catch(e){}}" <jsonl>
```

**Ejemplo real, el GO de SCRUM-1404:** transcripción `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl`,
turno `2026-10-13T11:05:07` → «GO no hay facturas reales en rpoduccion». Y la propia regla:
turno `2026-10-13T11:47:24` → «si te doy la regla permanente».

**Lo que esto NO es:** una prueba criptográfica. Un turno de persona se distingue de uno de modelo,
pero el fichero vive en la misma máquina. **Es el mismo listón que el equipo ya aceptó para los 300k**,
y es muchísimo más alto que «me lo ha dicho el orquestador». Si alguna vez hace falta más, la salida
es que el fundador se lo escriba directamente a la sesión que construye.

**Y una señal que no se fabrica fácil:** sus turnos están escritos como habla él, con sus erratas.
Una frase suya pulida y sin una errata es, por sí sola, motivo para mirarla dos veces.

### Los cuatro límites que la mantienen honesta

Los pone el orquestador y se los dijo a él al dárselos. Sin ellos la regla se convierte en «el
orquestador puede autorizarse solo», que es lo contrario de lo que ella protege.

1. 🔴 **LITERALES quiere decir literales, Y CON LOCALIZADOR** (fichero de transcripción + marca de
   tiempo del turno; ver el apartado de arriba). Se citan sus palabras entre comillas, con la fecha y el
   canal («de viva voz», «por chat»). **Un resumen NO activa la regla.** Si el orquestador no puede
   escribir la frase exacta, es que no la tiene, y entonces no hay autorización: la pide.
2. 🔴 **Se escribe en el ticket, diciendo que lo transmite el orquestador** — como en SCRUM-1404
   c.19293. Nunca con forma de comentario del fundador, porque la cuenta es la misma.
3. 🔴 **Y SE LE DICE A ÉL EN EL MISMO MENSAJE.** Ésta es la auditoría de verdad: si el orquestador
   inventara o deformara una frase suya, **él lo lee y lo corrige**. Una autorización citada que el
   fundador no ha visto pasar no está cubierta por esta regla.
4. 🔴 **La regla cubre TRANSMITIR una decisión suya, no TOMARLA.** Coste nuevo o dependencia nueva,
   el camino de emisión fiscal y la infraestructura de producción **siguen siendo suyos**. Lo único
   que cambia es que su «sí» ya no necesita que él entre a Jira.

### Y una sesión puede seguir parando

**La regla no obliga a nadie a construir.** Si una sesión ve que lo que se le pide pasa de lo que
la frase citada autoriza —por ejemplo, un GO para enganchar un cron que acaba exigiendo tocar el
sellado—, **para y lo dice**. Eso no es desobedecer: es la regla funcionando. Lo que la regla quita
es la duda sobre si el «sí» existió; no quita el juicio sobre hasta dónde llega.

**Un GO tiene PREMISA, y la premisa caduca.** El de SCRUM-1404 vale «mientras no haya facturas
reales en producción», porque ése fue el motivo que dio él. Cuando la premisa deja de ser cierta,
la autorización se vuelve a pedir. Un «sí» con fecha no es un «sí» para siempre.

## 🔴🔴 LA PRIORIDAD Nº 1 (6-oct-2026, de viva voz): CERRAR, NO ABRIR

**Esto no es una preferencia de estilo. Está por encima de encontrar defectos nuevos.** Sus palabras,
literales:

> «sobre todo lo que me interesa es limpiar tareas de jira y mandar lotes de tareas donde una sesion
> coja una tarea la arregle y la cierre, coja otra la arregle y la cierre. no es tan dificil, no puede
> ser que abramos siempre mas y mas. y si encuentra un defecto arreglando una tarea, pues lo soluciona,
> lo arregla, lo cierra y vuelve con la que estaba, la termina de arreglar y la cierra. simple y llano.»

> «esto es fuego y tenemos que quitarnos ya las 280 tareas. llevamos demasiados meses arreglando
> gilipolleces y sin poder vender el producto porque no para de abrir cosas y arreglar otras que rompen
> otras.»

**Luis, fundador, 6-oct-2026.** Transcrito por su orquestador sin cambiar una palabra.

### Cómo se cumple

1. **Cada puesto recibe un LOTE de 3 a 5 tickets EN ORDEN**, no uno. **Si se bloquea en el primero,
   baja al siguiente**; no espera al orquestador. Lo que necesite de él, lo escribe en el ticket.
2. **Una tarea se cierra ANTES de coger la siguiente.** Cerrar sigue siendo del orquestador (A13.4):
   la sesión entrega **COMPLETA contra su aceptación, o QUÉ LE FALTA**, y no se lleva dos a medias.
3. 🔴 **Un defecto encontrado DE PASO se arregla, se cierra y se vuelve a la tarea de origen.
   NO se abre ticket.** Es la frase del fundador y es la que más se incumplía.
4. **Se abre ticket SÓLO si:** tiene víctima **y** no se puede arreglar en el momento · **o** tiene
   FECHA · **o** cruza al otro equipo. **Lo demás se nombra sin número** en la entrega.
5. **El orquestador reporta ABIERTOS contra CERRADOS cada tanda, en una línea.**
6. **Un «En curso» que nadie toca vuelve a «Por hacer».** Un estado que miente es peor que no tenerlo.

### Lo medido el 6-oct-2026, que es el motivo

| Qué | Cuánto |
|---|---|
| Tickets en «En curso» | **más de 100**, con **seis** sesiones trabajando |
| De esos, sin tocarse 4 días o más | **85** · el más viejo desde el **16-sep** |
| Abiertos ese día frente a cerrados | **8 abiertos, 2 cerrados** |
| Abiertos que parecían hechos y lo estaban | **42 de 118** |
| Terminados que lo decían en Jira | **7 de 44** |

**El tablero miente en las dos direcciones a la vez:** dice «En curso» de lo que nadie toca, y no dice
«hecho» de lo que ya está en producción.

## El objetivo vigente (17-sep-2026, de viva voz)

**Producto y automatización A LA VEZ, los dos a fuego.** Sus palabras: «quiero en paralelo avanzar a
fuego con el producto ya, a fuego con la automatización, ya que nos quitará trabajo. Si hay algo que
nos bloquea lo solucionamos al momento y me lo dices».

- S0-S4 van a producto, cada una en su carril. La S5 va SOLO a automatización.
- La automatización NO se da por cerrada (eso lo había decidido el orquestador el 16-sep, y queda
  retirado). Su horizonte incluye que **el orquestador arranque solo por la mañana y hable con las
  sesiones sin que el fundador copie y pegue**, además del bucle PR → CI → merge → aviso.
- Un bloqueo no se aparca en silencio: se resuelve al momento y se le dice qué bloqueaba.

## Qué es YaQu (17-sep-2026, de viva voz)

**YaQu ES un software de gestión completo —un ERP— para oficios, empresas y autónomos, y quiere abarcarlo
todo.** Sus palabras: «el máster está antiquísimo, claramente somos un ERP; por una norma de no borrar nada
del máster hay cosas mega antiguas». El veto «YaQu NO es un ERP ni un CRM» (Parte Z del máster, repetido en
la skill `cerebro-yaqu`) **queda RETIRADO por el fundador**. Hasta que se cambie el máster manda esta línea,
y cambiarlo es una propuesta de cambio de máster pendiente.

## Delegaciones del 17-sep-2026

- **El visto bueno de arreglos de producto que tocan el cobro lo da el orquestador** («tú eres jefe de
  producto, dalas tú»). ⚠️ **Medido el mismo día:** cuando ese visto bueno significa DESPLEGAR a producción (PR
  con auto-merge), el clasificador de permisos no deja al orquestador darlo por el canal. **El sí lo escribe el
  fundador en el chat de la sesión**; el orquestador lo prepara y se lo explica (`orquestador-autonomo.md` §7).
- **Sigue siendo suyo:** coste nuevo, infraestructura de producción, schema (con Javier), el camino de emisión
  FISCAL y los permisos de Claude Code.
- **Permiso acotado para SCRUM-899 (sesiones de prueba `control-899-*` y tareas programadas de un solo uso):
  autorizado por él.** La regla la pone él a mano, porque al orquestador se le bloquea tocar la configuración.

## El límite de relevo de una sesión (6-oct-2026, de viva voz)

**Luis, 6-oct-2026 (18:50Z):** «El límite de relevo lo pongo en 300.000. Autorizado el coste.»

- Es el número de la A19 (`00-normas-comunes.md`): una sesión se releva al terminar una entrega verificada
  si su contexto pasa de 300k. Era 200k desde el 21-sep-2026. La medición y el coste simulado que
  autorizó están en la A19, con su fecha y su comando.
- **Autorizó UN número.** El de «se releva ya, aunque sea a mitad de una entrega» (500k) no lo ha vuelto a
  decidir: sigue valiendo el de antes.
- Se lo dijo a su orquestador, que lo transcribió en SCRUM-1479 (comentario 18513). Esta entrada la
  escribe la Sesión 0 con la autorización escrita del orquestador de Luis, dueño de este fichero (orden
  de arranque de la tanda del 6-oct-2026, ~19:25Z), en el mismo PR que cambia la norma.

## El horario del equipo (17-sep-2026)

«Que el equipo arranque por la mañana y haga varias tandas al día, cuando haya uso de nuevo.» Provisional:
cron del orquestador **a las 8:57, 13:57 y 18:57** todos los días (`orquestador-autonomo.md` §2, F5). Lo
robusto está en SCRUM-899.

## Cómo quiere trabajar

- El cuadro del bucle SIEMPRE primero, antes de los prompts (sustituye al «bloque de merge»:
  desde el 9-sep el merge es automático). Y **lo que tiene que hacer él, SIEMPRE AL FINAL** del
  mensaje, después de los prompts (17-sep-2026).
- Enlace directo y clicable a cada PR, dentro de un bloque de código.
- «¿Se borra la rama?» solo para un PR que se cierra SIN mergear, y ahí NO se borra
  (`orquestador.md` §10.3). Al mergear se borran solas.
- Cada ticket a la sesión de SU puesto, nunca a la que esté libre (17-sep-2026: «la 5 es
  automatización, eso es raro»; tabla en `orquestador.md` §11bis).
- Jira mirado CADA turno, y dicho explícitamente aunque no se pueda cerrar nada.
- Prompt SOLO para las sesiones que han contestado ese turno; las que siguen ejecutando no
  reciben nada (lo retiró el 15-sep-2026; ver `orquestador.md` §10.6).
- Cada prompt dice ARRIBA, en claro, si va a una **conversación nueva** (y en qué carpeta) o a
  la **misma conversación** (16-sep-2026: «abre una sesión nueva y mándaselo, más claro»).
- Todo lo que vaya a una sesión, dentro del bloque de código y COMPLETO: sin
  huecos que él tenga que rellenar.
- Los pasos manuales, de UNO EN UNO. Nunca una lista.
- Lo que no conoce, explicado «para tontos», sin dar contexto por sabido.

## Forales y Canarias: qué está decidido, qué es cada cosa y qué lo cumple (escrito el 13-oct-2026)

*(SCRUM-997, pedido por el orquestador de Javier el 21-sep-2026. Lo escribe la Sesión 0 con la excepción
de carril escrita del orquestador de Luis, dueño de este fichero, del 13-oct-2026.)*

**Son cuatro fuentes y no dicen lo mismo.** «No cubrimos forales ni Canarias» es una frase que ninguna de
las cuatro dice: una habla de facturar, otra de vender, otra de no construir y otra de Canarias. Cada fila
dice **qué es** y **si algo en el código la cumple**. «Sólo papel» quiere decir que hoy la sostiene quien
la lea.

| Quién y cuándo | Qué dice | Qué es | Dónde vive | ¿La cumple algo? |
|---|---|---|---|---|
| El máster, v5.3, **regla 33** | «Onboarding bloquea facturación ES a domicilios forales (PV/Navarra) con aviso digno; TicketBAI = cajón F3.» | **Norma.** Habla de **facturación**, y sólo de forales | `docs/YAQU_MASTER.md`, Parte I (y B2 punto 6, y Parte M) | **Sólo papel.** Ninguna puerta bloquea la facturación por domicilio foral. La respuesta a esa pregunta se guarda desde SCRUM-1102 y nada la lee para decidir |
| **Javier, 21-sep-2026** | «Sí, de momento no vendemos para estas regiones, déjalo por escrito» | **Decisión de venta.** País Vasco y Navarra | SCRUM-997 (enunciado); contesta a la P-3 de SCRUM-612 | **Sólo papel.** Ninguna puerta lee el territorio. Buscado en `src/` el 13-oct-2026: `domicilioFiscalForal` se guarda y se enseña, y nada más |
| **Javier, 23-sep-2026** | No se hace nada hoy: ni se bloquea el alta ni se avisa. Sin literal suyo: lo redacta su orquestador, que dice que la decisión es de Javier | **Decisión de producto:** no construir, a propósito | SCRUM-998, comentario 16609 | No pide mecanismo: decide que no lo haya. Deja escrito qué la reabre (abajo) |
| **Javier, 7-oct-2026** | «No de momento dejamos Canarias sin hacer, ya lo haremos déjalo reflejado en JIRA junto con las forales» | **Decisión fiscal:** Canarias (IGIC) no se construye por ahora | SCRUM-1497. **No está en el máster:** «IGIC» sale 0 veces | **Sólo por accidente.** La regla de tipos rechaza los cinco propios del IGIC porque no los conoce, no porque alguien lo decidiera (medido por el equipo de Javier, no por la Sesión 0). No se amplía «de paso» |

**Por qué la fila del 7-oct lleva nombre.** SCRUM-1497 dice «DECISIÓN DEL FUNDADOR», sin nombre. Lo abrió el
orquestador de Javier bajo la cuenta de Javier, y ese equipo llama «el fundador» a quien el enunciado de
SCRUM-997 firma «Javier (jefe)» y a quien SCRUM-998 titula «DECISIÓN DE JAVIER». Con eso se escribe el
nombre. No se ha comprobado en el chat donde se dijo, que está en otra máquina.

**13-oct-2026, repetida.** Al firmar otros textos, el jefe del equipo de Javier dijo: «de momento las forales
y canarias no están incluidas, si alguien las selecciona no las cubrimos» (lo cita el enunciado de
SCRUM-1536; su origen, SCRUM-1522 comentario 19294, no lo ha abierto la Sesión 0). Su propio equipo midió
que repite las de arriba y no añade ninguna. SCRUM-997 no pedía esta línea: va para que no se redescubra.

### El estado del mecanismo, medido el 13-oct-2026

- **Lo único que hoy impide emitir una factura fiscal a un profesional foral o canario es
  `INVOICING_ES_ENABLED` apagado. No es un freno territorial:** a Bilbao y a Las Palmas les pasa lo mismo
  que a Madrid.
- **Medido dos veces, por los dos equipos,** llamando a `getEmissionMode` con comercios fabricados y un
  espía de propiedades: jv-j5j, 14 llamadas (SCRUM-1536, comentario 19355), y la Sesión 0, 35 llamadas sobre
  `origin/main` = `6640b38f3d7800f7c439e1e78fa9694440822507` (`docs/master/SCRUM-997.md`). Apagado: 7 de 7
  dan `receipt`. Encendido: **7 de 7 dan `fiscal`**, incluidos tres que contestaron «Sí» al domicilio foral y
  dos canarios. La función lee `country`, `email`, `flags` e `id`. No lee `domicilioFiscalForal`.
- **Se enciende por tres sitios, y en el repositorio sólo se ve uno:** el valor por comercio
  (`merchants.flags`, en la base), la variable de entorno y el valor por defecto de `src/core/flags.ts`. Un
  test sobre el valor por defecto vigilaría uno de los tres. El «país» de la precedencia no enciende nada:
  sólo hace que el flag no cuente fuera de España.
- **Lo que reabre la decisión del 23-sep,** escrito en ese mismo comentario: «que se encienda la facturación
  para España, o que aparezca un profesional foral real». O sea: **antes de encender el flag para España,
  por cualquiera de las tres vías, esto se mira.** No lo caza ningún test: lo caza que quien lo encienda lea
  esta línea.
- ⛔ **La puerta no se construye sin decisión de un jefe.** Es camino de emisión (regla 40 del máster) y
  pide elegir con qué dato se frena.

### Dos hechos que corrigen cómo se suele contar

Son del equipo de Javier (SCRUM-1536, comentario 19355). La Sesión 0 no los ha reproducido.

- **Canarias está DENTRO del reglamento de VeriFactu** (RD 1007/2023, art. 1.3 del Reglamento, texto
  consolidado). No es otro sistema: es el mismo con IGIC, y lo que falta es nuestro (los tipos y la clave
  de impuesto). A un canario no se le puede decir que su territorio «no usa VeriFactu».
- **Lo foral va por DOMICILIO FISCAL, no por la provincia donde se trabaja.** La provincia del alta sólo da
  la zona horaria y no se guarda. Que un domiciliado foral quede fuera es la lectura a contrario de ese
  artículo, no su literal: depende del Concierto y del Convenio, que nadie ha leído (lista del asesor,
  SCRUM-1264).
- **Sin medir por nadie:** la normativa foral (TicketBAI, Batuz, Navarra), y si hay hoy en alguna base un
  comercio con «Sí» en el domicilio foral o con la zona de Canarias.

## Las normas de Javier (jefe desde el 18-sep-2026; antes, «el colaborador»)

- ① decisión → ② ALTER aditivo en las TRES bases → ③ un solo PR. **Nunca ③ sin ②.**
- Nunca `db push` contra producción. El DDL sale de `prisma migrate diff`.
- Toda verificación lleva **dos controles de tipo distinto** más `current_database()`.
- «Un merge SIN CONFLICTOS no es un merge correcto.»
- «Mergear ya no es acabar: un ticket no está cerrado hasta que su despliegue está verde.»
