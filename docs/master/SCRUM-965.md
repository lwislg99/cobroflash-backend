# SCRUM-965 · pulsar «Generar presupuesto» dos veces no puede crear dos presupuestos

**Fecha:** 20-sep-2026 · **Carril:** S2 (frontend) · **Pedido por:** el orquestador
**Medido contra:** `origin/main` = `102370c9aebac27cd770c1f109c509b4ff47b956` · 2026-09-20T14:32:12Z
**Rama:** `scrum-915-paso0-inventario` (entra junto al PASO 0 de 915, que es de donde salió)

## De dónde sale este ticket

Del **PASO 0 de SCRUM-915**. Al medir fila a fila qué queda de la v3 aprobada, la fila «Generar dos
veces = dos presupuestos» salió en rojo **contando los `POST /quote/create` de verdad**: dos clics,
dos documentos. El orquestador lo sacó del rediseño y le dio ticket propio, y tiene razón: **no es
una fila pendiente de un rediseño de siete cortes, es un defecto vivo en la pantalla de hoy** que le
deja al profesional dos presupuestos donde quería uno, cada uno con su número. Enterrarlo dentro de
915 lo ataba a que llegaran los siete.

## El defecto, medido antes de escribir (A2)

El botón **sí** se deshabilita mientras la petición está en vuelo —el doble clic rápido ya estaba
cubierto—, pero el `finally` lo devuelve a «Generar presupuesto» **habilitado**, y la pantalla no
navega ni se limpia. El camino es el del profesional, no un caso raro: generar → cerrar la hoja con
«Seguir editando» → volver a pulsar. Sale otro presupuesto.

```
A · presupuesto 1280px · 1.er clic: 1 documento, hoja abierta=true, nº=101
A · presupuesto 1280px · 2.º clic (pulsado): 2 documentos en total, hoja abierta=true, nº=102
🔴 pulsar «Generar presupuesto» dos veces sin tocar nada creó 2 documentos (nº 101 y 102)
```

## Lo que se hace

Se guarda la **huella del payload** que se acaba de mandar (`JSON.stringify(quotePayload)`) junto
con la hoja que se abrió. En el siguiente clic, si la huella es **idéntica**, no se crea nada: se
**reabre la misma hoja**, con el mismo número.

🔴 **Por qué la huella y no un «ya se generó una vez».** Un simple «ya generado» sería falso en
cuanto el profesional cambie una línea y vuelva a pulsar: ahí **sí** quiere otro documento, y
negárselo es un defecto nuevo a cambio del viejo. Lo que separa los dos casos no es cuántas veces ha
pulsado, es **si lo que va a mandar es lo mismo**.

Y **no duplicar no puede costar que pierda su presupuesto**: por eso el camino corto no es «no hacer
nada», es volver a abrir la hoja de aquel presupuesto, que es a donde iba. El guard lo exige.

No es estado nuevo del producto (Partes L y P): no se guarda en ningún sitio, no viaja al servidor y
muere con la pantalla. Es memoria de un formulario dentro de su propia vista. **Ni un texto nuevo.**

## El documento suelto NO entra, y está medido

El justificante navega a su ficha al emitir (`renderAppView('invoice-detail')`) y sólo rearma el
botón en el `catch`: **no tiene el agujero**. No se toca, y eso lo convierte en el **control
positivo** del guard — un caso que hoy ya tiene que salir verde. Importa más que el otro: un
justificante emitido no se edita ni se borra (regla 29), así que emitir dos sería peor que
presupuestar dos. Se mide aunque esté sano, y el test ancla el motivo: si alguien le quitara la
navegación, el caso B se pondría rojo.

## El guard: 3 casos, y los dos controles son la mitad del trabajo

`npm run guard:un-solo-presupuesto` · `scripts/guard-965-un-solo-presupuesto.mjs`

No mira si el botón «parece» deshabilitado ni qué clase lleva —una clase la pone el mismo código que
se juzga—: **cuenta los POST que llegan al servidor**, que es lo único que no miente.

| caso | qué hace | qué exige |
|---|---|---|
| 🔴 **A** · presupuesto | generar · «Seguir editando» · generar otra vez **sin tocar nada** | **1** `POST /quote/create`, y la hoja vuelve a salir **con el mismo nº** |
| ✅ **B** · justificante (POSITIVO) | la misma doble pulsación sobre «Emitir justificante» | **1** `POST /admin/invoices`. **Hoy ya sale verde**: si saliera rojo, el averiado sería el instrumento |
| ⛔ **C** · presupuesto CAMBIADO (NEGATIVO) | entre los dos clics se vuelve a Conceptos con «Cambiar», se cambia el precio y se vuelve | **2** documentos, y la hoja enseñando el nº **nuevo** |

**Sin el caso C, un arreglo que bloqueara SIEMPRE el segundo clic habría pasado por bueno.** Es la
otra mitad del trinquete: no sólo «no de más», también «no de menos».

**SUELO:** si el PRIMER documento no llega a crearse, sale con **2 (NO SUPE MEDIR)**. «0 duplicados»
de algo que no se pulsó se lee exactamente igual que un arreglo.

**POBLACIÓN derivada, no escrita:** la cabecera y el veredicto cuentan `CASOS.length`. La primera
versión anunciaba «2 casos» a mano; al añadir el C **siguió diciendo 2 y el guard estuvo mintiendo
sobre su propio alcance mientras salía verde**. Error propio, y de los baratos de cometer.

## Visto en ROJO, dos veces, cada una con su inyección aplicada

Con todo el árbol commiteado antes de cada inyección (`git add -A`) y revertido con
`git restore --source=HEAD`, dejando `git status --porcelain` vacío.

| inyección | `--numstat` | guard de navegador | red de Node |
|---|---|---|---|
| el arreglo **que se pasa de frenada**: `if (presupuestoYaCreado)` sin comparar la huella | `1 1` | 🔴 **caso C**: «dejó 1 documento y tenían que ser 2: el arreglo se ha pasado» | 🔴 «la condición mira la HUELLA, no sólo que ya se haya creado algo» |
| **no guardar** la huella tras crear | `1 1` | 🔴 **caso A**: 2 documentos, nº 101 y 102 | 🔴 «al crear se guarda la huella y la hoja» |

Y el rojo de partida, el del defecto real, es el bloque de arriba: el caso A contra `origin/main`
sin tocar nada. Tras revertir, los dos instrumentos en verde: guard **3/3 casos**, red de Node
**7/7 tests**.

No hizo falta `npm run build` entre inyecciones (A23 #10): tanto el guard como la red de Node leen
`public/dashboard/js/quotesView.js` del árbol, no de `dist/`. Se dice para que nadie deduzca que se
saltó la casilla.

## La red que corre siempre

`tests/scrum965-un-solo-documento.test.mjs` — 7 tests sobre el fuente **sin comentarios** (el
comentario que explica el arreglo contiene las mismas palabras que el arreglo: A23 #2), con el
recorte partido por líneas `/\r?\n/` y no con `.*$`, que en un fichero CRLF no quitaría nada
(A23 #3). Lleva su **control del propio recorte**: si no quita al menos 1.000 caracteres, falla
diciendo que todo lo demás estaría leyendo prosa.

Vigila las cuatro piezas cuya ausencia deja el arreglo mudo: la huella sale del mismo objeto que
viaja · la comparación va **antes** del POST · la condición mira la **huella** · al crear se
**guarda**. Más que el camino corto reabra la hoja guardada y que el suelto siga navegando.

## Errores propios

- **La población del guard escrita a mano.** Ver arriba: dijo «2 casos» con tres corriendo. Ahora
  sale de `CASOS.length` y además se declara cuántos **se corrieron**, no sólo cuántos hay.
- **Estuve a punto de entregar sin el caso C.** Con sólo A y B, el arreglo «no dejar generar nunca
  más» habría salido verde en los dos. El caso C no nació de una norma: nació de preguntarme qué
  pasa si el profesional cambia el precio.

    🔒 Un arreglo que sólo se prueba por el lado que fallaba no se ha probado: se ha confirmado.

## Los tres censos que cobra un guard de navegador nuevo (20-sep, al empujar)

Un guard nuevo **no entra solo**: hay tres trinquetes que lo cobran, y los tres salieron en ROJO
contra esta rama antes de tocarlos. Se corrieron **por su nombre**, como ficheros sueltos —norma
nueva del orquestador de esta tanda, que sustituye al turno de suite completa para este caso—:

| censo | qué cobra | estado |
|---|---|---|
| `tests/scrum258-nota-por-sesion.test.mjs` | que el `//guard:` del `package.json` esté escrito | ✅ verde ya |
| `tests/scrum522-guards-fuera-de-la-tanda.test.mjs` | el recuento de guards que nadie corre salvo esa puerta | 🔴 `30 → 31` |
| `tests/scrum548-peaje-package-json.test.mjs` | los guards cuyo **destino no se deriva** del fuente | 🔴 faltaba declararlo |

Los dos rojos se resolvieron **midiendo, no sumando**: el 31 salió de correr el test sobre el árbol
ya fusionado con `origin/main`, y la declaración del 548 se justificó leyendo el fuente del guard,
no suponiéndolo — levanta servidor en puerto EFÍMERO (`GUARD965_PUERTO || 0`) y navega con el
puerto **y** la ruta en variables (`#quotes-new` / `#invoices-new`), que es exactamente la familia
de `guard:arranque-sin-red` y `guard:rastro-del-menu`. Tras los dos ajustes: **44/44 en verde**.

🔒 Un guard nuevo que no cruza sus censos entrega el arreglo y rompe el trinquete del de al lado.

## Lo que NO cubre

- La v3 quiere además que **enviar, descargar o copiar el enlace reutilicen el mismo presupuesto**
  desde la hoja de envío. Eso es **915f** y necesita el GO del fundador: aquí sólo se cierra el
  agujero de la acción primaria.
- Dos pestañas del mismo editor abiertas a la vez: cada una tiene su memoria, así que seguirían
  creando uno cada una. No se toca — hacerlo exigiría estado compartido, que es otra cosa.
- Capturas AB6: esta entrega no cambia un píxel de la pantalla.
