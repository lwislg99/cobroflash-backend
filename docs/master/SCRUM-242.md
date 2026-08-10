# SCRUM-242 · Recuperabilidad: la foto completa

# 🔴 HOY NO PODRÍAMOS RECUPERAR LA BASE DE DATOS.

**Fecha:** 10-ago-2026 · **Carril:** infraestructura · **Entregable: MEDICIÓN, no código**
**Medido contra:** `origin/main` = `74a7592e2b4287106718b42eef61fdba49cff745` · 2026-08-10T09:30:00+02:00

No existe ninguna copia. No la genera nadie. Y si existiera, en el formato que produciría en
Railway **no hay camino implementado para restaurarla**. Esto no es un hallazgo técnico: es el
riesgo mayor del negocio, y la decisión de qué se contrata es del fundador (regla 36).

---

## ① QUÉ EXISTE

**Un solo mecanismo:** `scripts/backup-dump.mjs`. Y está bien hecho:

- dos formatos — `pg_dump --format=custom` si hay binario, y si no un **dump lógico** de las 24
  tablas a JSON vía Prisma;
- **cifrado AES-256-GCM** con `BACKUP_ENCRYPTION_KEY`;
- **fail-closed** (SCRUM-241): si una sola tabla no se vuelca, **lanza y no escribe fichero** — un
  backup parcial que se anuncia completo es peor que uno que falla a gritos;
- `--restore-test` que descifra, valida el tag GCM y **compara los conteos contra la BD viva**;
- su lista de tablas está **atada a un guard** (`scrum241-backup-tablas`) que la deriva del schema.

**El fichero sale a `BACKUP_DIR`, por defecto `./backups`** — dentro de la máquina.

## ② QUÉ SE EJECUTA DE VERDAD: **NADA**. Y está probado, no supuesto

Censo derivado sobre invocaciones reales, **con suelo**:

| Script | Invocado desde |
|---|---|
| `turno-staging` | **11** sitios |
| `test-staging-gated` | **7** |
| `seed-demo` | **5** |
| **`backup-dump`** | **0** |

**El suelo es la fila de arriba:** el mismo censo encuentra 11, 7 y 5 invocaciones cuando existen,
así que **el cero es un cero real y no una ceguera**. «No encontré quién lo llama» y «nadie lo
llama» dejan de ser lo mismo.

Comprobado uno por uno: **ningún cron** de `src/core/cron/cron.ts` (hay 6 registrados, ninguno de
backup) · **ningún script** de `package.json` (25, cero) · **ningún workflow** de CI (`ci.yml`,
`zona-roja.yml`) · **ninguna importación** desde `src/`. Todas las menciones que existen son
**documentación**: el máster, `SPRINT_DEMO_READY_EXT3.md` y las evidencias.

Y el propio máster lo declara pendiente: *«dump cifrado semanal fuera de Railway ANTES de 25
pagantes»*.

## ③ QUÉ HARÍA FALTA PARA RECUPERAR

| Pregunta | Respuesta medida |
|---|---|
| ¿Desde qué copia? | **Ninguna.** No hay nada que la genere. |
| ¿Con qué antigüedad? | **No aplica.** |
| ¿En cuánto tiempo? | **No aplica.** |
| ¿Quién sabe hacerlo? | **Nadie, y no está escrito.** |

Y hay algo peor que la ausencia de copia, porque sobreviviría a arreglarla:

> **NO HAY CAMINO DE RESTAURACIÓN IMPLEMENTADO.** El script tiene dos modos —volcar y
> `--restore-test`— y **ninguno escribe de vuelta en la base**. `--restore-test` *verifica*: descifra
> y compara conteos. No restaura.

Para el formato `pg_dump custom` existe salida: `pg_restore`, una herramienta externa. **Pero en
Railway la imagen de Node no trae `pg_dump`** —lo dice el propio script— así que **el formato que
se produciría allí es el LÓGICO (JSON)**, y para ése:

- el script promete «restaurable con este mismo script en un entorno limpio — **ver RUNBOOK al
  final**»;
- **ese RUNBOOK no existe.** Una sola mención en el fichero: la promesa. El fichero termina en
  `main().catch(...)`;
- `docs/RUNBOOKS.md` **tampoco** menciona restauración.

O sea: el formato que de verdad saldría en producción **no tiene procedimiento de restauración
escrito ni código que lo haga**.

## ④ ¿LA COPIA ESTÁ FUERA DE LA INFRAESTRUCTURA? **NO**

`BACKUP_DIR` es `./backups`, **dentro del contenedor**. La subida a un destino externo existe solo
como **comentario que describe lo que habría que añadir** (`BACKUP_S3_ENDPOINT/BUCKET/KEY/SECRET`),
y el script lo dice él mismo: *«hasta entonces el fichero queda en BACKUP_DIR y hay que moverlo a
mano fuera de la máquina»*, y al terminar imprime *«→ MUÉVELO fuera de esta máquina»*.

**Un backup que vive donde la base no protege del escenario que más importa** — y aquí ni siquiera
llega a existir.

## Lo que NO he medido, declarado

- **La política de backups de Railway.** El máster la lleva marcada **`[VALIDAR]`** desde hace
  meses y **no se puede medir desde el repositorio**: hay que mirarla en el panel del proveedor. Es
  la única vía por la que hoy podría existir alguna recuperabilidad, y **nadie ha confirmado que
  exista**. Mientras no se compruebe, la respuesta honesta a «¿tenemos backup?» es **no lo sabemos**,
  que a efectos de riesgo se gestiona como un no.
- **No he ejecutado nada.** Ni un dump, ni un `--restore-test`: exigen una base real.
- Si Railway tuviera copias, quedarían igualmente **dentro del mismo proveedor**: no cubren el
  escenario de perder la cuenta.

## Lo que decide el fundador (regla 36 — aquí no se construye nada)

1. **Validar la política de Railway.** Es lo más barato y lo primero: puede cambiar el diagnóstico.
2. **Qué dispara el backup** — cron del propio servicio, tarea programada del proveedor o CI.
3. **Dónde vive la copia**, fuera de Railway, y con qué **retención**.
4. **Escribir el RUNBOOK de restauración y probarlo**, porque una copia que nadie ha restaurado
   nunca es una copia que no sabemos si sirve — y el propio script ya lo dice: *«un backup no
   probado no es un backup»*.

> Ese cuarto punto es el que cierra el círculo con lo que salió de SCRUM-408: **un backup que nadie
> ejecuta es un backup que no existe**, y uno que nadie ha restaurado es una copia de la que no
> sabemos nada.

Ficheros: ninguno. Este ticket **mide**; no construye.
