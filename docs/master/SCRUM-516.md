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

## 3 · 🔴 EL NÚMERO QUE PIDE EL STOP 4: caen 31 entradas

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

### Lo que NO he hecho, y por qué

- **No he tocado `RE_ANCLA`.** El listón es el mismo; lo que cambia es la unidad que se mira.
- **No he reescrito ninguna ancla.** Reconstruir una medición que nadie tomó es inventarla, y eso
  es peor que no tenerla.
- **No he elegido el umbral.** El censo lleva las **31 medidas**, con nombre y motivo, no un número
  redondo. Están declaradas **en dos categorías distintas y honestas**: 2 anteriores al propio
  SCRUM-267, y **29 escritas con el guard ya vigente pero en apéndices, donde no miraba**.

> ⚠️ **DECISIÓN PENDIENTE DEL FUNDADOR**, entregada con número y lista: o se eximen las 29 por
> fecha (y se anota aquí esa decisión), o se arreglan una a una vaciando el censo. El guard queda
> en verde mientras tanto para no bloquear a nadie, y el censo **no puede crecer**: cualquier
> entrada nueva que no esté en él es roja.

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
