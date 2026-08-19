# SCRUM-516 · El guard del ancla vigila CADA ENTRADA, no el fichero

**Fecha:** 19-ago-2026 · **Carril:** guards del registro · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d59d5cd97546e394bdb027dea59c9cb6ba1f587b` · 2026-08-19T09:24:30+01:00

**Paso 0.** `docs/master/SCRUM-516.md` no existía. Búsqueda **por contenido** (no por número) sobre
`tests/`: nadie había troceado por entradas bajo otro ticket — `scrum273` trocea `YAQU_MASTER.md`
con otro patrón y para otra pregunta. La rama viva más cercana (`scrum-517`) toca `scrum480`, no
éste. **La premisa sigue en pie**, y está en el código: `motivoSinAncla(e.texto)` recibía el
fichero ENTERO y `RE_ANCLA` lleva `/m`, así que bastaba **una** línea válida en cualquier sitio.

> Y el propio guard ya declaraba lo contrario de lo que hacía: su cabecera dice que vigila «**qué
> lleva dentro** cada entrada». La intención estaba escrita; el mecanismo no la cumplía.

## 1 · La línea base de `npm test`

| | tests | pass | fail | skip |
| --- | --- | --- | --- | --- |
| **Base** (worktree recién creado sobre el ancla) | 3674 | 3597 | **0** | 77 |
| **Al cerrar** | 3677 | 3600 | **0** | 77 |

Verde, como decía el protocolo. **Aviso de SCRUM-518 confirmado en vivo:** `npm ci` terminó con
`npm warn allow-scripts` y **sin ejecutar el postinstall** — no imprimió «Generated Prisma
Client», al contrario que en otro worktree la misma mañana. Se regeneró explícitamente con
`npm run prisma:generate` desde ESTE worktree antes de medir nada.

## 2 · El delimitador, MEDIDO antes de apoyarse en él

El candidato del encargo era `---` + `# SCRUM-<n> · …`. **Medido sobre los 226 ficheros reales: no
es estable**, así que **no se usa tal cual**.

| Señal candidata | Resultado | Decisión |
| --- | --- | --- |
| `---` antes del apéndice | **7 apéndices no lo llevan** (244, 328 ×3, 406, 420, 447) | **no se exige** |
| `·` en el título | **8 encabezados usan otra cosa** (`# SCRUM-374` a secas, `# SCRUM-415 — …`, `# SCRUM-16 / 142 · …`) | **no se exige** |
| nº del encabezado = nº del fichero | **1 discrepa**: `SCRUM-441.md:420` encabeza `# SCRUM-496` | **no se exige** (es asunto del 273) |
| `^# SCRUM-<n>` | presente en los 226 ficheros y las 317 entradas | **es el delimitador** |

**Con una trampa real:** `SCRUM-480.md` tiene dos `# SCRUM-` **dentro de un bloque cercado**
```` ``` ````. Trocear por texto plano inventaría dos entradas fantasma —sin ancla, porque no son
entradas— y el guard acusaría a quien pegó un ejemplo en su registro. El troceador lleva la cuenta
de los cercados y los salta; hay un control que lo fija.

El delimitador es, por tanto, **`^# SCRUM-\d+` fuera de bloque cercado**, y nada más.

## 3 · 🔴 EL NÚMERO QUE PIDIÓ EL STOP 4: caían 31 entradas

Medido **antes** de tocar el guard, contra el ancla de arriba:

```
ficheros ............. 226
ENTRADAS troceadas ... 317
con ancla ............ 286
SIN ancla ............  31     <── de éstas, 2 ya estaban eximidas → 29 NUEVAS
¿suman? .............. SÍ (286 + 31 = 317)
```

Por motivo:

| motivo | nº | cuáles |
| --- | --- | --- |
| no declara «Medido contra» | 23 | 231#1, 242#2·3·4, 244#1·2·3·4·5·7, 264#1, 313#2, 328#2·3·4·5, 397#2·3, 445#2, 446#2·3, 467#2, 485#2 |
| lo declara **sin hora** | 4 | 268#2, 273#2, 406#2, 409#2 |
| **sha ABREVIADO** | 2 | 290#2, **447#2** |
| fecha entre backticks | 2 | 397#4, 397#5 |

**`SCRUM-447.md#2` es el caso del 17-ago-2026**: el sha de 7 caracteres que motivó este ticket
sigue ahí, y hasta hoy ningún guard lo veía. Ahora está nombrado.

### 🔴 LA DECISIÓN DEL FUNDADOR, aplicada el 19-ago-2026

**El principio, y va en las dos direcciones:**

> Un ancla que nadie midió **NO SE ESCRIBE NUNCA**. Reconstruir contra qué `main` se midió algo hace
> meses es fabricar una medición — justo lo que el guard existe para impedir. Vaciar el censo
> inventando anclas sería usar la barrera para producir el daño que previene.
>
> Y su reverso, para que no sea la salida fácil: **lo que SÍ se puede recuperar sin inventar, SE
> RECUPERA.** Eximir un dato que existe y sólo está mal escrito no es prudencia, es pereza con
> coartada.

**Se arreglaron 4** (el dato existía, sólo estaba mal escrito):

| entrada | qué tenía | qué se hizo |
| --- | --- | --- |
| `397#4`, `397#5` | fecha entre backticks | se quitaron los dos caracteres. Ni sha ni hora tocados. |
| `290#2` | `22d8e84` | → `22d8e84d33ff6ea5684163cacc33dfc3d966285d` |
| `447#2` | `8a57b9cd` | → `8a57b9cd3689abb666d11f3faa96575af2e2da41` |

Expandir un prefijo completa, no inventa — **pero sólo si resuelve a un commit real y único**, así
que se comprobó antes de tocar nada:

```
22d8e84   --disambiguate → 1 objeto · cat-file -t → commit · ancestro de origin/main → SÍ
8a57b9cd  --disambiguate → 1 objeto · cat-file -t → commit · ancestro de origin/main → SÍ
```

Si alguno hubiera salido ambiguo o inexistente, se habría quedado exento.

**Se eximen 27, por LISTA NOMINAL** — no por umbral ni por fecha de corte:

- **23 no declaran «Medido contra»**: el dato NO EXISTE, no está mal escrito.
- **4 lo declaran sin hora** (`268#2`, `273#2`, `406#2`, `409#2`): la fecha está, la hora no se
  tomó. **La hora del commit que las escribió no es la hora de la medición** — usarla sería
  inventar con apariencia de precisión, que es la peor de las dos formas de inventar.

**Y la propiedad que hace que esto dure:** `🔴 LAS EXENTAS SON EXACTAMENTE ÉSTAS` falla si aparece
una entrada sin ancla que no esté en la lista. **La lista no puede crecer**: meter la número 28
obliga a editar `HEREDADAS_SIN_ANCLA`, y eso se ve en un diff. También falla al revés — si una
exenta deja de necesitarlo, hay que quitarla, o el censo mentiría sobre su propio número.

### Los números, REMEDIDOS tras la decisión

```
ficheros ............. 227     (226 + esta entrada)
ENTRADAS troceadas ... 318
con ancla ............ 291     (286 + las 4 arregladas + esta entrada)
EXENTAS ..............  27
¿suman? .............. SÍ      291 + 27 = 318
```

> ⚠️ **Incoherencia encontrada al expandir, y se reporta sin tocarla:** el ancla de `447#2` dice
> medido el `2026-08-11T02:20:00+02:00`, pero el commit `8a57b9cd` se creó a las `17:34:33` de ese
> día — **quince horas después**. El sha resuelve a un commit real y único, así que se expandió
> conforme al criterio; pero una de las dos cifras es errónea y no hay forma de saber cuál sin
> inventar. Queda escrito aquí en vez de corregido.

### Lo que NO se ha hecho, y por qué

- **No se ha tocado `RE_ANCLA`.** El listón para una entrada NUEVA sigue siendo
  `Medido contra: origin/main = <sha40> · <ISO-8601>`, completo. Lo único que cambió es la UNIDAD
  que se mira.
- **No se ha inventado ni una sola ancla.** De las 31, sólo se tocaron las 4 cuyo dato ya existía:
  dos a las que sobraban dos caracteres y dos a las que les faltaban los del sha. Las 27 restantes
  siguen sin ancla porque **no la tuvieron nunca**.
- **No se ha eximido por umbral ni por fecha de corte.** La lista es nominal, entrada a entrada,
  con motivo — y cerrada.

## 4 · El rojo, probado por el mecanismo

**SHA del commit en verde previo a la mutación: `8737ed1c2698e016b152c26bff661940ba8a6574`.**
Las tres mutaciones se revirtieron con `git stash` y el árbol volvió a ese commit.

### Mutación 1 — el defecto real: un apéndice con el sha abreviado

Se añadió a `docs/master/SCRUM-475.md` (que tiene su ancla buena) un tercer registro con
`= \`d59d5cd\``, siete caracteres. **Es el caso del 17-ago-2026, reproducido.**

| instrumento | veredicto |
| --- | --- |
| el guard **VIEJO** (fichero entero, `/m`) | **✅ VERDE — no ve el apéndice roto** |
| el guard **NUEVO** (por entrada) | **🔴 ROJO**, y lo nombra |

```
SCRUM-475.md#3 (línea 1184) — el sha está ABREVIADO (hacen falta las 40 posiciones)
    # SCRUM-475 (parte 3) · MUTACION SCRUM-516 · apendice con el sha ABREVIADO
```

Mismo fichero, mismo apéndice, dos respuestas opuestas. Eso es el ticket.

### Mutación 2 — romper el troceador: que deje de saltar los bloques cercados

Cae el SUELO, nombrando el mecanismo: «*el troceador cuenta como entrada un `# SCRUM-` que vive
DENTRO de un bloque cercado. Inventaría entradas fantasma —sin ancla, porque no son entradas— y el
guard acusaría a quien pegó un ejemplo en su registro*». Y arrastra al guard principal, porque las
dos fantasmas de `SCRUM-480.md` aparecen como entradas sin ancla: la trampa no era teórica.

### Mutación 3 — volver al comportamiento viejo (una entrada por fichero)

Cae el CONTROL POSITIVO: «*el troceador no ve las dos entradas del fichero sintético*».

🔴 **Y aquí está lo que justifica que ese control exista:** con esta mutación **el guard principal
sigue VERDE**. Sin el control positivo, alguien podría revertir el arreglo entero —devolver el
guard a mirar por fichero— y la tanda no se enteraría. Una lista vacía hace verdad cualquier «ya
no está»; este control es lo que la obliga a significar algo.

## 5 · La evidencia que exige el encargo

| Requisito | Dónde |
| --- | --- |
| Control **positivo** dentro del mismo test | `🔴 un APÉNDICE con el ancla rota cae…` — fichero sintético con primera entrada impecable y apéndice con sha de 7. Comprueba **(a)** que el fichero entero SÍ pasa (la premisa) y **(b)** que troceado el apéndice cae. Una lista vacía ya no hace verdad cualquier «ya no está». |
| **SUELO**: cero = ceguera | `🔴 SUELO: el troceador VE entradas…` — falla si el troceo da 0, si pierde ficheros, si inventa una entrada dentro de un bloque cercado, o si devuelve algo donde no hay encabezado. |
| El censo se **autoprueba** sobre fuente sintética | mismo test: `conCercado` y el caso sin encabezado son fuente sintética con respuesta conocida. |
| Los **números cuadran** | `🔴 los números CUADRAN…` — `con ancla + sin ancla = total` y `eximidas + acusadas = sin ancla`. Un censo cuyas partes no suman no es un censo. |

## 6 · Hallazgos fuera de carril

1. `SCRUM-441.md:420` encabeza `# SCRUM-496` — un registro de 496 vive dentro del fichero de 441; lo ve el guard de nombres (273), no éste.
2. `npm ci` **se saltó el postinstall** en este worktree (`npm warn allow-scripts`) y dejó el cliente de Prisma sin regenerar: es exactamente lo que avisa SCRUM-518, confirmado en vivo.
3. `SCRUM-397.md#4` y `#5` llevan la fecha **entre backticks** — el ancla es correcta salvo por dos caracteres, y el mensaje del guard la clasifica como «forma inesperada» en vez de decir eso.
