# CENSO · «Tipo de cliente» — PASO 0 de SCRUM-574 (CONT-01), pregunta `P-CONT-4`

> Medido el **24-ago-2026** en la rama `scrum-574-switch-empresa-persona`.
> Comando: `node scripts/censo-tipo-cliente.mjs` — **solo lectura**, re-ejecutable.
> Esto es un **REGISTRO MEDIDO**, no una afirmación de estado: quien lo vuelva a medir, que lo re-feche.

## 0. Resumen para el fundador

| Pregunta | Respuesta medida |
|---|---|
| ¿Existe el campo «Tipo de cliente»? | **Sí.** Es `Customer.tipoDestinatario` (columna `tipo_destinatario`). |
| ¿Qué valores tienen los clientes de hoy? | **NULL en el 100 %.** 15 filas medidas, 15 sin clasificar. |
| ¿Hay que mapear algún valor existente? | **No.** No hay ni un solo `PARTICULAR` ni un solo `EMPRESARIO` en las bases medibles. |
| ¿Es la migración trivial, entonces? | **Como movimiento de datos, sí. Como decisión, NO** — ver §3. |

## 1. Las dos preguntas, que son distintas

El encargo exige las dos y tiene razón: «qué permite el esquema» y «qué hay en las filas» se
responden en sitios distintos y pueden no coincidir.

### (a) Qué PERMITE el esquema

| Capa | Qué admite |
|---|---|
| Columna Postgres `customers.tipo_destinatario` | `text` · `nullable=YES` · **sin `DEFAULT`** · **sin `CHECK`** → acepta **cualquier cadena** |
| `prisma/schema.prisma` | `tipoDestinatario String? @map("tipo_destinatario")` — sin enum |
| Zod (`src/core/validation/schemas.ts:248`) | `z.enum([...]).nullable().optional()` con `PARTICULAR` y `EMPRESARIO` |

🔴 **La lista cerrada existe SOLO en el borde de la API.** La base de datos no la sostiene: un
`UPDATE` directo mete cualquier texto. Relevante para el punto 4 del encargo — una migración por
SQL no tiene red debajo.

### (b) Qué tienen LAS FILAS de hoy

| Base | Filas en `customers` | `tipo_destinatario` | Con razón social | Con NIF |
|---|---|---|---|---|
| `acela.proxy.rlwy.net/railway` (STAGING) | 4 | **NULL × 4** | 0 | 0 |
| `acela.proxy.rlwy.net/yaqu_dev_javier` (DEV) | 11 | **NULL × 11** | — (ver §4) | — |
| **TOTAL medido** | **15** | **NULL × 15 (100 %)** | | |

**Producción NO se ha medido y no puede medirse desde aquí:** no existe `DATABASE_URL` en este
árbol de trabajo (verificado con `node scripts/comprobar-claves-bd.mjs`, regla 3). El número de
producción sigue **sin medir** y este censo no lo afirma.

### Cobertura del censo (lo que este censo NO sabe)

- **Producción: no medida.** Ninguna sesión tiene la credencial, y así debe seguir.
- **No hay medición de S1.** Se buscó `P-CONT-4` en `docs/` y `.claude/`: **cero coincidencias**.
  Este censo es, hoy, la **única** medición de la pregunta. No hay segunda opinión que contrastar.

## 2. Dónde vive hoy el campo (censo de código)

| Sitio | Fichero |
|---|---|
| Alta **y** edición desde la lista | `public/dashboard/js/customersView.js:167-176, 268, 297` |
| Edición desde la ficha 360 | `public/dashboard/js/customerDetailView.js:312-317, 343, 365` |
| Validación de entrada | `src/core/validation/schemas.ts:247-248` |
| Selección de salida | `src/modules/system/customerAdmin.ts:19` |
| **Consumo** | `src/modules/jobs/domain/pendientesFacturar.service.ts:18-19, 179, 188` |

## 3. 🔴 EL HALLAZGO: «Tipo de cliente» NO es una clasificación suelta

El encargo describe «Tipo de cliente: Sin clasificar» como un desplegable de clasificación cuya
función puede absorber el switch. **Medido en el repositorio, no es eso.**

`tipoDestinatario` es el campo de **SCRUM-69 (FACT-1)** y determina el **plazo legal de la factura
recapitulativa** (art. 13.2 RD 1619/2012):

```
fechaLimiteRecapitulativa(mesKey, tipo)      // pendientesFacturar.service.ts:28-32
  EMPRESARIO -> new Date(y, m, 16)   // día 16 del mes SIGUIENTE
  PARTICULAR -> new Date(y, m, 0)    // último día del mes actual
```

De ahí sale el semáforo verde/ámbar/rojo de la bandeja «Pendientes de facturar». Es decir:
**mover un cliente de un lado al otro del switch cambia la fecha límite legal que YaQu le enseña
al profesional**, hasta ~16 días.

Y los tres estados son deliberados. El propio `schema.prisma` lo deja escrito:

> `SIN @default en la BD a propósito: null = "nunca clasificado", distinto de "clasificado como
> particular" — el criterio seguro (tratar null como PARTICULAR, el plazo MÁS CORTO) se aplica en
> código (resolveTipoDestinatario), **nunca se escribe de vuelta a la BD**.`

### 3.1 Por qué un switch de dos lados no puede absorberlo

**① Tres estados no caben en dos posiciones.** Hoy: `NULL` · `PARTICULAR` · `EMPRESARIO`. Un
toggle Empresa|Persona tiene dos. Los 15 clientes medidos están **todos** en el estado que el
switch no puede representar.

**② No son la misma distinción.** Y esto es lo decisivo:

| | Empresa / Persona (el switch) | PARTICULAR / EMPRESARIO (`tipoDestinatario`) |
|---|---|---|
| Qué pregunta | **forma jurídica** del contacto | si el destinatario **actúa como empresario** a efectos de IVA |
| Para qué sirve | qué campos enseña la ficha | **plazo legal de la recapitulativa** |
| Un autónomo es… | **PERSONA** (nombre, no razón social) | **EMPRESARIO** |

🔴 **El caso roto es la víctima del propio ticket.** Un *administrador de fincas* autónomo es una
**PERSONA** física y a la vez un **EMPRESARIO** fiscal. Si el switch escribe en `tipoDestinatario`,
ponerlo en «Persona» —que es lo correcto en su ficha— le asigna en silencio el plazo de
particular, **~16 días más corto**, y la bandeja avisará tarde de una factura que ya venció.

**③ El alta cambiaría de comportamiento.** Hoy un cliente nuevo nace `NULL` = «no consta», y el
código elige el plazo **más corto** por seguridad. Un switch obligatorio hace que cada alta
**declare** un valor. Si el lado por defecto fuese «Empresa», cada cliente nuevo nacería
`EMPRESARIO` → plazo más largo → **YaQu afirmando un régimen fiscal que el profesional no ha
declarado**. Es exactamente lo que `SCRUM-294-a` prohíbe para el recargo de equivalencia
(«degradar en silencio … el peor sitio»), aplicado al campo de al lado.

### 3.2 Qué decisión hace falta (es del fundador — AA1.4: zona fiscal)

| | Opción | Coste | Riesgo |
|---|---|---|---|
| **A** | El switch **escribe** en `tipoDestinatario` (lo que dice el ticket) | 0 columnas | 🔴 Conflación fiscal: el autónomo queda mal clasificado. Un dato de UI pasa a mandar sobre un plazo legal. |
| **B** | Campo **nuevo** para la forma jurídica; `tipoDestinatario` sobrevive aparte | 1 columna aditiva | 🟢 Ninguno fiscal. **Choca con «NO SE AÑADE CAMPO»** del ticket → por eso se para y se pregunta. |
| **C** | El switch es **presentación**: decide qué campos se ven, y no persiste nada | 0 columnas | 🟡 CONT-08 (filtro Empresas/Personas) necesita persistencia → habría que resolverlo ahí. |

**Recomendación medida: B.** Es la única que deja el plazo legal donde está y le da al switch un
dato propio.

> ✅ **DECIDIDO POR EL FUNDADOR el 24-ago-2026: OPCIÓN B.** `contact_kind` para la forma jurídica;
> `tipoDestinatario` intacto, con su plazo legal y su `z.enum`. La frase del ticket («no se añade
> campo: se promueve el que ya existía») se aprobó creyendo que «Tipo de cliente» era una
> clasificación genérica; medida la premisa, cae la decisión que se apoyaba en ella.
> Descartadas: **A** por riesgo fiscal, **C** porque deja a CONT-08 sin dato que filtrar.
> Lo que este episodio destapó tiene ticket propio: **SCRUM-615**.
>
> ⛔ **PROHIBICIÓN NUEVA, del fundador:** `contact_kind` y `tipoDestinatario` NO se mezclan en
> ningún sitio — ni en la migración, ni en el formulario, ni en un valor por defecto que deduzca
> uno del otro. Es la lección entera: **forma jurídica ≠ capacidad fiscal.**

## 4. Hallazgo lateral (otro carril — se reporta, no se arregla; regla 37)

**Deriva de esquema entre DEV y STAGING.** `customers.recargo_equivalencia` (SCRUM-294-a) **existe
en STAGING y NO existe en `yaqu_dev_javier`**. Medido con `information_schema.columns`:

```
STAGING : …, portal_token, recargo_equivalencia, tax_id, …
DEV     : …, portal_token,                       tax_id, …
```

El comentario de `schema.prisma` solo afirmaba producción y staging, así que **no se contradice**;
lo que no estaba escrito es que DEV se quedó atrás. Efecto práctico mientras duró: cualquier
consulta que leyera esa columna **fallaba con `P2010` en DEV**.

> ⚠️ **CERRADA DE PASO, y hay que decirlo: NO fue una decisión, fue un efecto de `db push`.** Al
> aplicar la migración de este ticket (§5), `db push` sincroniza el esquema **entero**, no solo la
> columna nueva — así que `recargo_equivalencia` entró en `yaqu_dev_javier` en la misma pasada.
> Aditivo y nullable; ninguna fila tocada; las 11 quedan en `NULL` = «no consta», que es el valor
> correcto. Se reporta en vez de dejarlo implícito: **estaba fuera del alcance de SCRUM-574** y
> quien lea este censo mañana tiene que saber por qué la deriva ya no está.

## 5. Estado del punto 4 del encargo (la migración) — ✅ APLICADA

**Autorización puntual del fundador (24-ago-2026)** para aplicarla esta sesión. No es regla nueva:
`prisma/schema.prisma` sigue siendo de los fundadores y cualquier otro cambio de esquema se prepara
y se para, como se hizo aquí antes del GO.

```sql
ALTER TABLE "customers" ADD COLUMN "contact_kind" TEXT;
```

| | |
|---|---|
| Preview previo | `node scripts/preview-migracion.mjs --desde <schema de main>` |
| Control positivo | **25 `CREATE TABLE`** (esquema entero contra vacío) → la herramienta contestaba |
| Veredicto | **aditiva**: ni `DROP`, ni `RENAME`, ni `TRUNCATE`, ni `DELETE`, ni `SET NOT NULL` |
| Aplicada en | `acela/railway` (STAGING) y `acela/yaqu_dev_javier` (DEV), CLI local por ruta |
| Producción | **NO**, y no puede: no hay `DATABASE_URL` en el árbol |
| `--accept-data-loss` | **no se usó** (ni hacía falta: aditiva) |
| Turno de staging | tomado antes, soltado después |

**Migración de datos: NINGUNA.** Con los 15 clientes en `NULL` y `contact_kind` naciendo `NULL`, no
se escribió un solo byte sobre ninguna fila existente. Verificado después con el control gateado
`tests/scrum574-mismo-cliente-tras-migracion.test.mjs`: 15/15 con `contact_kind` `NULL`, ninguna
fila perdida contra el número del PASO 0, y `tipo_destinatario` sin tocar.
