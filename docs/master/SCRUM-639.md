# SCRUM-639 · El vocabulario de códigos no salía de la puerta

**Fecha:** 1-sep-2026 · **Carril:** infraestructura de guards · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `9ae6ec070d76da8fbad21d8d6209f2ffd609eab6` · 2026-09-01T19:04:37+01:00

**Tanda:** 4200 tests, 4120 pass, 0 fail, 79 skipped

---

## ⚠️ LO PRIMERO: ¿era una política de salida deliberada?

**Ni sí ni no. Hay política escrita, pero es de OTRA COSA — y la puerta ya se contradecía a sí misma.**

Esto hay que decirlo antes de proponer nada, porque cambia qué se toca y qué no.

### Lo que SÍ está decidido y documentado (y no se toca)

Que **un guard no verde hace fallar el job**. Está escrito dos veces, y con motivo:

* `guards-visuales.mjs:149-151` — «🔴 CIEGO cuenta como fallo. Un guard que no supo mirar no ha
  vigilado nada, y dejarlo pasar sería exactamente el hueco que este ticket viene a cerrar.»
* `package.json`, clave `//guards:visuales` — «Un guard CIEGO cuenta como fallo: "no supo mirar" no
  es "ha vigilado".»

**Esa decisión es correcta y sigue intacta:** una tanda ciega sigue haciendo fallar el job. No se ha
relajado nada.

### Lo que NO está escrito en ninguna parte

Que **todos los fallos compartieran el código 1**. Buscado en el fichero, en `package.json`, en
`docs/` y en el workflow: no hay una sola frase que lo decida ni que lo justifique.

### 🔴 Y la puerta ya se contradecía

`guards-visuales.mjs` **ya distingue** «no pude medir» de «medí y hay fallos» — para su propia
ceguera:

| situación | código |
|---|---|
| lista de guards vacía (`:96-101`) | **2** |
| no hay navegador (`:106-109`) | **2** |
| cualquier guard no verde (`:159-169`) | 1 |

O sea: el vocabulario de SCRUM-620 **ya vivía en este fichero** y se aplicaba a la ceguera del
PADRE. Lo que no hacía era **propagarla desde los hijos**.

> **Conclusión: esto no es una decisión que revisar, y tampoco es una función que falte. Es una
> inconsistencia dentro de la política que el propio fichero ya tenía.** Por eso el arreglo entra
> sin cambiar ninguna decisión de producto.

Y de paso, un hueco medido: **el código 4 de SCRUM-620 (`SALIDA_SIN_SERVIDOR`) ni siquiera estaba
importado aquí**, así que un guard que no pudo levantar su servidor se pintaba `rojo(4)` — con la
palabra «rojo» delante, que es exactamente la que significa «he encontrado defectos».

---

## El defecto, REPRODUCIDO — no deducido del log

Las dos direcciones, sobre el código de `main`, con navegador real:

| dirección | cómo se forzó | lo que dijo la puerta | **salida** |
|---|---|---|---|
| **A · hay un defecto** | una página con gris `#c9c9c9` sobre blanco, muy por debajo de AA | `✖ guard:contraste  rojo(1)` · «PARES NUEVOS por debajo de WCAG AA» | **1** |
| **B · el navegador está y no levanta** | `EDGE_PATH` a un binario que EXISTE y no es navegador — que es lo que `resolverNavegador` comprueba: sólo existencia | `✖ … NO ARRANCA` **en los 9** · «verdes: 0 · no verdes: 9» | **1** |

**Las dos, 1.** Y en la dirección B la puerta imprimió nueve veces `NO ARRANCA`: **sabía la
respuesta y la estaba diciendo**, sólo que por una puerta que significaba otra cosa.

El hijo, por su parte, ya hacía lo correcto: `guard-contraste.mjs` con el impostor sale con **3** en
3 s. El vocabulario existía y se perdía UNA CAPA MÁS ARRIBA — la familia de SCRUM-620, con el padre
colapsando lo que el hijo ya distinguía.

---

## La decisión, y sus motivos

`veredicto(filas)` — **pura, exportada y sin `process`**:

| caso | salida |
|---|---|
| nadie no-verde | **0** |
| alguien **MIDIÓ** y encontró algo | **1** — aunque otros se quedaran ciegos |
| **nadie** midió | **2, 3 o 4**: el código de la ceguera |
| ciegos que no coinciden entre sí, o sin código (tope) | **2** |

Tres decisiones que no son obvias, cada una con su porqué:

1. **Un defecto MANDA sobre una ceguera.** Las dos equivocaciones no cuestan lo mismo: leer una
   ceguera como defecto hace perder tiempo —lo que pasó, dos días—, pero leer un defecto como
   ceguera lo convierte en «cosa de infraestructura», alguien relanza el job, y el defecto acaba
   mergeando. Cuando pasan las dos cosas, **se dice**: el detalle lleva «⚠️ Y ADEMÁS N guard(s) NO
   llegaron a medir … esta tanda NO es la lista completa de defectos».
2. **Un código DESCONOCIDO cuenta como defecto, no como ceguera.** Mismo razonamiento, fail-closed
   en la dirección que importa.
3. **La ceguera mixta sale 2, que NO es un número nuevo.** Es el «no supe mirar» que esta puerta ya
   usaba para su propia ceguera. Inventar un 5 habría sido añadir vocabulario donde ya lo había.

---

## Que se vea SIN abrir el log

Desde el script, **no desde el workflow** (que está fuera de carril, y además sólo ve un número:
no sabe distinguir los desenlaces). Dos canales, los dos gratis:

* **Anotación** de GitHub Actions (`::error title=…`), que sale en la pestaña de checks del PR.
* **Resumen** del run (`$GITHUB_STEP_SUMMARY`), que se renderiza en la página.

**No es un mecanismo nuevo: es el que ya usa `.github/workflows/zona-roja.yml` y vigila
`tests/scrum168-zona-roja.test.mjs`.** Se reusa en vez de escribir un segundo.

Con `GITHUB_ACTIONS` simulado, lo que ahora se lee sin entrar en el log:

```
::error title=NO MEDIDO (salida 3) · NO ARRANCA en 9 guard(s)::NINGUN guard llegó a medir:
guard:contraste: NO ARRANCA, … Esto NO es un hallazgo de contraste ni de accesibilidad: no se
ha comprobado nada.
```

```
::error title=DEFECTOS (salida 1) · 1 guard(s) midieron y encontraron algo::Han medido y hay
hallazgos: guard:contraste.
```

En local no se emite nada, para no ensuciar una salida que alguien pueda estar leyendo.

---

## Verificado en rojo — DOS rojos, y hacen falta los dos

### ① De punta a punta, con el arreglo puesto

| dirección | antes | **después** |
|---|---|---|
| A · defecto de contraste real | 1 | **1** |
| B · el navegador está y no levanta | 1 | **3** |

Mismo montaje que la reproducción de arriba, mismo navegador real. La sonda de contraste era una
página desechable en `public/`, retirada después (`git status public/` limpio).

### ② El test, contra el colapso reinyectado

Devolviendo `conDefecto = noVerdes` —o sea, la puerta de antes—:

```
ok 1     DIRECCIÓN A · midió y encontró defectos → sale por la puerta 1
not ok 2 DIRECCIÓN B · el navegador está y no levanta → NO sale por la puerta 1
not ok 3 🔴 EL CONTROL: las dos direcciones NO comparten código
not ok 4 cada ceguera conserva SU código: 2 no es 3 y 3 no es 4
ok 5     un DEFECTO manda sobre una ceguera
not ok 6 cegueras que no coinciden → el 2 genérico
not ok 7 el TOPE tampoco midió
ok 8     un código DESCONOCIDO cuenta como defecto
ok 9     CONTROL NEGATIVO: todo verde sigue saliendo 0
ok 10    SUELO: el vocabulario no puede tener dos códigos iguales
```

con el mensaje:

```
🔴 un defecto real y un navegador que no levanta vuelven a salir por la misma puerta:
   el arreglo no ha hecho nada. Es el defecto entero de este ticket.
   expected: 1 · actual: 1
```

**🔴 Y LO QUE MÁS DICE DE ESTE REPARTO ES QUE ① PASA CON EL COLAPSO PUESTO.** La dirección A sola
da verde tanto con el arreglo como sin él: **una sola dirección no demuestra absolutamente nada.**
Lo que prueba el arreglo no es ninguno de los dos códigos por separado, sino que **sean distintos**
— y eso es lo único que mide el test 3. Que ⑨ y ⑩ también pasen en los dos lados enseña que el
fichero no está midiendo sólo el código nuevo.

**Reversión:** `Buffer.compare(disco, testigo) === 0` y **0 CR en disco** (guard de SCRUM-533).

---

## Lo que NO cubre — declarado

1. **No arregla por qué el navegador no levanta en CI.** Eso es SCRUM-626 y lo lleva otra sesión.
   Esto sólo hace que, cuando pase, se sepa **desde fuera y en el primer minuto** que no se ha
   medido nada. El tope de arranque y `_navegador.mjs` **no se han tocado**.
2. **El código de salida no dice CUÁNTOS guards se quedaron ciegos**, sólo por qué. Eso va en la
   anotación y en el resumen, que es donde cabe.
3. **`TOPE` sigue sin código propio.** Un guard cortado por el tope de la puerta no llegó a medir y
   entra en la ceguera genérica (2). Darle número propio sería vocabulario nuevo, y este ticket
   trata de sacar el que ya había, no de inventar más.
4. **Nadie vigila que un guard nuevo use el vocabulario.** Si mañana alguien escribe un guard que
   sale con 7, esta puerta lo tratará como defecto —fail-closed, a propósito— pero nada le avisa de
   que existía un código para lo suyo.

---

## Ficheros

* `scripts/guards-visuales.mjs` — importa `SALIDA_SIN_SERVIDOR`; añade `VOCABULARIO`,
  `llegoAMedir()`, `veredicto()` y `anuncio()` (todo exportado y puro); guarda el código de cada
  hijo; y sale por `veredicto` en vez de por un `1` fijo.
* `tests/scrum639-vocabulario-sale-de-la-puerta.test.mjs` — **nuevo**, 10 tests, las dos direcciones.
* `package.json` — la clave `//guards:visuales` documenta ahora **por qué puerta sale cada
  desenlace**. Estaba documentado que un guard ciego hace fallar; no por dónde salía.

**Lo que NO se ha tocado:** ningún guard se ha relajado, ni hay skips ni excepciones nuevas;
`scripts/_navegador.mjs` y el tope de arranque intactos (SCRUM-626, otra sesión);
`.github/workflows/` intacto; `prisma/schema.prisma` intacto.

## HALLAZGOS FUERA DE ALCANCE

* **El punto 4 de arriba merece ticket propio**: un guard nuevo puede nacer sin usar el vocabulario
  y nadie se entera. Es el mismo patrón que SCRUM-234 resolvió para las series con un censo por
  AST, y aquí no existe.
