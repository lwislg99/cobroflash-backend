# SCRUM-1112 · El guard de acreditación se colgaba, y encima en silencio

**Medido contra:** `origin/main` = `c534eb0560e9df399730b67147a6d97414ddf5e3` · 2026-09-25T13:24:01Z

25-sep-2026 · Lo construye **el orquestador** (A13), con las seis sesiones cerradas y el
lanzador incapaz de arrancar ninguna.

## Lo medido, en Railway

| ejecución | duración | correo |
|---|---|---|
| 24-sep 16:05 | **27 m 41 s** | no llegó |
| 24-sep 16:37 | **15 m 13 s** | no llegó |
| 25-sep 08:02 | **1 h 46 m** | no llegó |

**Ese script hace UNA consulta de solo lectura.** Debería tardar segundos.

## 🔴 Dos defectos que se tapaban el uno al otro

1. **Ningún timeout.** `medirAcreditacion` y `sendMail` podían esperar indefinidamente. Cero
   apariciones de `timeout`, `AbortSignal` o `setTimeout` en el fichero.
2. **Todo se imprimía al FINAL.** La cabecera con el destino y el rastro salían en las dos
   últimas líneas de `principal()`. Si colgaba antes —y colgaba— **no salía ni una línea**.

**Por eso los logs estaban vacíos.** No era que no se escribiera nada: era que lo que se
escribía estaba detrás del cuelgue.

🔴 **Y eso derrota el propósito del guard.** SCRUM-1109 exige que *«un cero medido y un cero
por ceguera no salgan iguales»*. Cubría **«no pude medir»** y no cubría **«me quedé
colgado»** — que produce el **mismo silencio**, sólo que cuesta horas de máquina. **Un guard
colgado no avisa de nada, y encima figura como instalado.**

## Lo que se ha hecho

- **`conLimite(promesa, ms, etapa)`** — el error **nombra la etapa**, porque «timeout» a secas
  no distingue la base del correo, que es exactamente lo que hay que saber.
- **Límites:** medición 20 s · envío 20 s · **vigía general 90 s** que mata el proceso con
  código ≠ 0 (por si queda un socket abierto que impida salir aunque la etapa haya vencido).
- **Traza por etapas con `process.stdout.write`**, escrita **YA**, no al final.
- **La cabecera va ANTES de tocar nada**: si el proceso muere, el log al menos dice **contra
  qué destino lo intentaba** — lo que faltó los días 24 y 25.
- **Un fallo de medición sale por el camino de CIEGO**, nunca como «limpio». No se ha medido
  nada, así que no se afirma nada.

## Verificado EN ROJO, que es lo único que prueba un timeout

**① El mecanismo, con una promesa que nunca resuelve:**

```
✅ salto en 1511 ms   (límite 1500)
   mensaje: ⏱ se agotaron 1.5s en la etapa «medicion»
   etapa nombrada: medicion
✅ control positivo: una promesa rapida pasa -> valor
```

El control positivo importa tanto como el rojo: sin él, un `conLimite` que rechazara
**siempre** también habría dado ese verde.

**② El camino real, con el host bueno y un puerto muerto:**

```
[13:57:51.934Z] === SCRUM-1109 · aviso programado de acreditación INVOICING_ES ===
[13:57:51.935Z] destino · [DATABASE_URL_PROD_RO] → autorack.proxy.rlwy.net/railway
[13:57:51.955Z] ① midiendo · conectando y consultando
[13:57:57.004Z] ① medido · filas: ?
[13:57:57.004Z] ② enviando aviso · a destinatario configurado
🔴 CIEGO — no se pudo medir · aviso NO ENTREGADO (connect ECONNREFUSED 127.0.0.1:1)
```

**7 segundos.** Antes eran 27 minutos sin una sola línea.

⚠️ **Suelo declarado:** en esa segunda prueba **el timeout no llegó a vencer** — el puerto 1
rechaza de inmediato, así que la etapa terminó sola. Lo que la prueba demuestra es **la traza
y que un fallo sale rápido**; el vencimiento del límite lo demuestra la prueba ①. Son dos
cosas distintas y se dicen por separado.

## 🔴 Y un error del orquestador que sale a la luz aquí

El 24-sep le dije al fundador que cambiara `DATABASE_URL_PROD_RO` del proxy público
(`autorack.proxy.rlwy.net`) al host interno (`postgres.railway.internal`), razonando que
desde dentro de Railway se llega por la red interna.

**Ese consejo era incorrecto y no lo comprobé contra el código.** `_db-guard.mjs:23` fija
`PROD_HOST = 'autorack.proxy.rlwy.net'`, y `validarHost()` **aborta** si el host no es
exactamente ése. El script **exige el proxy público**.

**No es una preferencia: es un guard.** Está ahí para que nadie apunte «a lo que parezca la
buena». Y yo le di instrucciones para saltárselo sin haber leído la constante.

**Hay que devolver la variable al host público.**

## ⛔ Lo que este ticket NO cierra

⛔ **No se sabe todavía dónde se colgaba.** Los dos candidatos —la base y el correo— siguen
sin discriminar. **Lo que se ha construido es el instrumento que lo dirá** en la próxima
ejecución, en vez de otro misterio de hora y media.

⛔ No toca `src/` ni el camino de emisión. Es `scripts/`.
