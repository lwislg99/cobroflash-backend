# SCRUM-1525b · El respaldo sale por correo, y quien lo lanza sobrevive a su muerte

**Medido contra:** `origin/main` = `6f35b50901fac64347d862255ec755a036ca1f0d` · 2026-10-13T11:04:25Z

A9: comprobación → `tests/scrum1525b-el-respaldo-por-correo.test.mjs`

13-oct-2026 · **J6** (sesión `jv-j6g`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J6. El encargo se leyó en Jira: SCRUM-1525 entero, c.19223, c.19224 y c.19226.]

**Carril a mano, instrumentos (J6).** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como
manda la ficha común del 13-oct. No se ha lanzado ningún volcado contra ninguna base, no se ha leído ni
pedido ninguna clave, y no se ha creado la tarea de Railway.

## Qué entra

| fichero | qué es |
| --- | --- |
| `scripts/respaldo-programado.mjs` | NUEVO. El comando de la tarea de Railway: lanza el volcado como hijo, busca el fichero y lo manda |
| `tests/scrum1525b-el-respaldo-por-correo.test.mjs` | NUEVO. 16 casos; 9 son el camino en que algo falla |
| `scripts/aviso-programado-acreditacion-invoicing-es.mjs` | `crearTransportadorResend` acepta `attachments`. Sin adjuntos, el cuerpo es el de antes (lo fija su test de SCRUM-1114, intacto) |
| `scripts/backup-dump.mjs` | sólo el comentario de cabecera (4 líneas por 4: ninguna línea se mueve). El volcado no cambia |
| `docs/master/evidencias/SCRUM-1525/banco-tope-del-adjunto.mjs` | el banco de «qué pasa al pasarse» |

Ninguna dependencia nueva: `nodemailer` ya estaba, y Resend se llama con `fetch`.

## Lo que se pidió distinto de como se ha hecho, y por qué

**El encargo decía «que `backup-dump.mjs` pueda enviar». El envío NO va dentro de `backup-dump.mjs`.**
Va en un guion que lo lanza como hijo. El motivo es la propia medición de c.19223: el volcado puede morir
por memoria, y esa muerte aborta sin pasar por su `catch`. Un envío metido al final de `main()` moriría con
él. Desde fuera, es un hijo que termina mal, y se cuenta. Así el punto 4 del encargo («tu envío no se
ejecutaría») deja de ser cierto para la muerte del volcado: sale un correo «HOY NO HAY RESPALDO».

**El encargo decía «nodemailer con `SMTP_URL`, ya montado». Ese camino es el que se colgó.** SCRUM-1114
midió el 25-sep que SMTP agota 20 s desde dentro de Railway, y por eso el aviso de SCRUM-1109 sale por
Resend (HTTPS) si hay `RESEND_API_KEY`. El guion hace lo mismo: Resend primero, SMTP sólo si no hay clave.
La tarea necesita `RESEND_API_KEY`; con sólo `SMTP_URL` lo esperable es que el envío se corte por tiempo.

## Qué hace, por casos

| qué pasa | correo que sale | código |
| --- | --- | --- |
| volcado bien, fichero de hasta 15 MiB | con el fichero adjunto, su tamaño, su sha256 y el % del tope | 0 |
| igual, y el fichero pasa de la mitad del tope | el mismo, con «⚠️ … pronto no cabrá en un correo» en el asunto | 0 |
| el fichero pasa de 15 MiB | SIN adjunto: «HECHO PERO NO ENVIADO … ya no cabe en un correo». El adjunto ni se intenta | 2 |
| el correo con adjunto falla (rechazo, tiempo) | un segundo correo SIN adjunto con el motivo | 2 |
| el volcado termina mal (código ≠ 0 o señal) | «HOY NO HAY RESPALDO», con cómo terminó y lo último que escribió | 1 |
| el volcado dice 0 y no deja fichero nuevo | «HOY NO HAY RESPALDO». No se manda uno viejo | 1 |
| el correo no está configurado, o está caído entero | ninguno. El rastro dice «esto no le ha llegado a nadie» | 1 o 2 |

El correo se prepara después de que el volcado termine: sin variables de correo, el volcado corre igual.

## El tope del adjunto

- **Resend:** 40 MB por correo, contados después de pasar los adjuntos a base64. Leído en su documentación
  el 13-oct-2026. **Qué contesta al pasarse no lo dice y no se ha probado** (haría falta la clave).
- **El tope propio:** 15 MiB de fichero (20 MiB en base64). Es una elección, no una medición: la mitad de lo
  de Resend, y por debajo de los 25 MB habituales de un buzón. **El tope del buzón del fundador no está
  medido.** Hoy el volcado pesa 388.319 B (c.19226): el 2,5 %.
- **Al pasarse del tope propio** no se intenta el adjunto: sale el aviso sin él y la pasada queda en rojo.
- **Si quien rechaza es el servidor**, el rechazo llega como error y se convierte en el aviso sin adjunto.
  Medido con el `nodemailer` de la casa contra un servidor SMTP fabricado en `127.0.0.1` que anuncia
  `SIZE 1048576`:

| caso | resultado | servidor |
| --- | --- | --- |
| 100.000 B (control positivo) | ENTREGABLE, código 0 | 1 mensaje, 0 rechazados |
| 2 MiB | NO_LLEGO, código 2, «Message failed: 552 5.3.4 mensaje demasiado grande», aviso sin adjunto ENTREGADO | 3 mensajes, 1 rechazado |

- **Memoria del proceso que envía** (camino de Resend, petición inyectada, un proceso por caso):

| fichero | caracteres del cuerpo | pico de memoria |
| --- | --- | --- |
| 0,37 MiB (como hoy) | 517.868 | 101 MB |
| 5 MiB | 6.991.079 | 138 MB |
| 15 MiB (el tope) | 20.972.128 | 214 MB |
| 16 MiB (no cabe) | 515 (sólo el aviso) | 116 MB |

  Los ~100 MB de base son de cargar el módulo del aviso de SCRUM-1109, que trae `typescript`. Ese proceso
  vive a la vez que el volcado: su memoria se suma a la del hijo dentro del mismo contenedor.

## Visto en rojo

Base 16 de 16. Catorce mutaciones del código, una a una, con el `git diff --numstat` de cada una impreso y el
árbol limpio al acabar: **14 de 14 hacen caer algún caso** (16 casos corridos en todas).

| mutación | casos que caen |
| --- | --- |
| no sale el segundo correo cuando falla el adjunto | 4 |
| el tope no corta | 1 |
| el borde del tope se corre un byte | 1 |
| se elige el fichero más reciente en vez del cambiado | 1 |
| con el volcado caído no sale correo | 5 |
| con el correo caído sale 0 | 4 |
| sin correo configurado sale 0 | 2 |
| una señal cuenta como éxito | 1 |
| el envío no tiene límite de tiempo | 1 |
| se pierde la línea «FATAL ERROR» | 1 |
| Resend no manda el adjunto | 2 |
| el adjunto no se pasa al transportador | 6 |
| el aviso de cercanía no salta | 1 |
| con el volcado caído se busca fichero igual | 1 |

Dos de los casos lanzan procesos de verdad: un hijo que muere por memoria con el montón a 24 MB (termina con
código 134 en Windows; en Linux llega como señal `SIGABRT` y código `null`, y el guion trata las dos formas),
y el guion entero con el `backup-dump.mjs` real cayendo en su primera puerta (sin `DATABASE_URL`: sale con 1
antes de conectar a nada).

## Mis errores

1. **Di por hecho que lo último que escribe un proceso al morir dice por qué ha muerto.** El caso del hijo
   que muere por memoria salió rojo: los últimos 2.000 caracteres eran pila nativa, y «FATAL ERROR: Reached
   heap limit» quedaba fuera. El correo habría llegado con cuarenta líneas de direcciones. Ahora esa línea
   se guarda aparte, y la mutación que la quita cae.
2. La primera versión resolvía el transportador antes de lanzar el volcado (una propiedad calculada que se
   leía al desestructurar): habría salido «sin configurar» siempre. Lo cacé releyendo, antes de correrlo.
3. Pasé un parche con barras invertidas por un heredoc de bash, que se las comió. Lo cazó el control del
   propio parche («no casa una vez») y el caso de SMTP en rojo. Es una trampa ya escrita en la ficha.

## Lo que NO cubre, y lo que NO se ha medido

- **Si Railway mata el contenedor entero, o no lanza la tarea, no sale ningún correo.** El padre muere con
  el hijo. Lo único que lo delata es que ese día no llega el correo diario: nadie vigila esa ausencia.
- **Si el correo está caído entero**, lo único que queda es la pasada en rojo en el panel de Railway.
- No se ha enviado ningún correo de verdad: ni por Resend ni por SMTP. Los dos canales se han probado
  hasta la puerta (el cuerpo que recibiría Resend; el mensaje que escribe `nodemailer`).
- Que Resend acepte un adjunto `.gz.enc`, y qué contesta al pasarse de 40 MB.
- La memoria del contenedor de la tarea, y si la imagen trae `typescript` (el aviso de SCRUM-1109 ya lo
  importa en producción; no lo he comprobado).
- Que el rol de la base que se le dé a la tarea pueda leer las 33 tablas.
- Sigue como estaba: dos pasadas el mismo día se pisan (el nombre sólo lleva la fecha), y la retención
  (decisión 4) es la del buzón: no hay código que borre ni que cuente copias.

## Para montar la tarea (lo hace el fundador en su panel)

Comando: `node scripts/respaldo-programado.mjs`. Variables: las dos de `backup-dump.mjs`
(`DATABASE_URL`, `BACKUP_ENCRYPTION_KEY`), `RESEND_API_KEY`, `EMAIL_FROM` y la nueva
`BACKUP_EMAIL_DESTINO`. Una pasada al día. La primera pasada dice si funciona: llega un correo con el
adjunto, o llega uno en rojo, o no llega nada y el panel está en rojo.
