-- docs/sql/scrum-815-el-evento-que-no-se-pierde.sql — SCRUM-815
--
-- LA TABLA QUE HACE QUE UN WEBHOOK NO SE PIERDA AL MORIR A MEDIAS. Una tabla nueva. **Nada más.**
--
-- ESTADO (8-sep-2026):
--    · desarrollo, staging y producción → ⛔ TODAS pendientes. Las aplica el fundador.
--    · esta sesión NO ha ejecutado nada contra ninguna base. Ni con `--dry-run`.
--
-- POR QUÉ HACE FALTA: `docs/master/SCRUM-815.md` («El webhook de Stripe marca el evento como visto
-- ANTES de terminar de procesarlo»). Ese documento MIDE el defecto y propone el modelo; esto es su
-- §4 TRADUCIDA a DDL, no una versión nueva. Si los dos difieren, gana el documento.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 DOS MARCAS DE TIEMPO, NO UN BOOLEANO — y es el ticket entero
--
-- **Confundir «visto» con «procesado» ES el defecto de hoy**, y guardarlo mal en la base sería ese
-- mismo defecto hecho permanente. Un `Boolean processed` no distingue «en curso» de «murió a
-- medias»: sería el `Set` en memoria de hoy, con más pasos y sobreviviendo a los despliegues.
--
-- Las dos columnas dicen cosas distintas, y las tres combinaciones tienen significado:
--
--   received_at   processed_at   qué significa                              qué hay que hacer
--   ───────────── ────────────── ─────────────────────────────────────────── ──────────────────────
--   puesto        **NULL**       llegó y NO terminó — o está en curso, o el  dejar pasar el
--                                proceso murió                               reintento: el trabajo
--                                                                            no está hecho
--   puesto        puesto         terminó bien                                ACK 200, sin repetir
--   —             —              no ha llegado nunca                         procesarlo
--
-- Por eso `processed_at` es NULLABLE y no lleva default: **NULL es un estado con significado**, no
-- un hueco. Y `received_at` sí lleva `DEFAULT CURRENT_TIMESTAMP`, porque el instante de llegada lo
-- pone la base al insertar y no hay ninguna fila que pueda no tenerlo.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 EL `UNIQUE (provider, event_id)` ES EL MECANISMO, NO UN ADORNO
--
-- Es lo que hace IMPOSIBLE que dos réplicas se crean las dos las primeras en atender el mismo
-- evento: la segunda choca contra el índice en vez de duplicar el trabajo. Es lo mismo que sostiene
-- `@@unique([merchantId, claveIdempotencia])` en el albarán.
--
-- El protocolo que habilita (③, NO ahora — aquí no se escribe ni una línea de código):
--   1. al llegar: `INSERT`. Si choca y la fila tiene `processed_at` NO nulo → duplicado real → 200
--      sin trabajo. Si choca y es NULL → el intento anterior no terminó → `attempts++` y se hace.
--   2. al terminar bien: `UPDATE … SET processed_at = now()`.
--   3. si falla: se guarda `last_error` y se responde 400 — que es lo que hace que Stripe reintente.
--
-- `attempts` y `last_error` existen para que un evento que no termina nunca sea VISIBLE: sin ellos,
-- uno atascado en `processed_at = NULL` es indistinguible de uno recién llegado.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- NOMBRES FÍSICOS Y TIPOS — traducidos del modelo, no elegidos aquí
--
-- Medido el 8-sep-2026 sobre `origin/main` = 61d14a15: **`gateway_events` no existe** (0
-- coincidencias en `docs/sql/deriva-prod.sql`, que se escribió contra la base real), así que esto
-- no pisa nada y no hay que mirar qué había antes.
--
--   Prisma (§4 del documento)                  →  físico (aquí)
--   ────────────────────────────────────────────  ────────────────────────────────
--   model GatewayEvent  @@map("gateway_events")    tabla "gateway_events"
--   id       Int @id @default(autoincrement())     "id" SERIAL + PK  (patrón de "email_messages")
--   provider String @db.VarChar(24)                "provider" VARCHAR(24) NOT NULL
--   eventId  String @map("event_id") @db.VarChar(255)  "event_id" VARCHAR(255) NOT NULL
--   type     String @db.VarChar(120)               "type" VARCHAR(120) NOT NULL
--   receivedAt  DateTime @default(now()) @map(…)   "received_at" TIMESTAMP(3) NOT NULL DEFAULT …
--   processedAt DateTime? @map("processed_at")     "processed_at" TIMESTAMP(3)      ← sin NOT NULL
--   attempts Int @default(1)                       "attempts" INTEGER NOT NULL DEFAULT 1
--   lastError String? @map("last_error") @db.VarChar(500)  "last_error" VARCHAR(500)
--
-- Los nombres de índice siguen la convención que Prisma genera y que ya usa `email_messages`:
-- `<tabla>_<columnas>_key` para el único y `<tabla>_<columnas>_idx` para el normal. Se escriben
-- con los nombres FÍSICOS de las columnas, no con los del modelo.
--
-- ⚠️ `provider`, `type`, `id` y `attempts` van SIN `@map` en el modelo porque son de una palabra:
-- ahí camello y guiones bajos no se distinguen. Los cuatro multipalabra sí lo llevan.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 Y ESTO OBLIGA A PEGAR EL MODELO EN `schema.prisma`, QUE EL FUNDADOR HACE A MANO
--
-- El bloque exacto está en `docs/master/SCRUM-815.md` §4 y se copia de allí TAL CUAL — no se
-- transcribe aquí para que no puedan divergir dos copias del mismo modelo. Sin él, Prisma no sabe
-- que esta tabla existe; sin la tabla, Prisma falla en la primera consulta que la pida.
--
-- ⚠️ El orden de aplicación es el de la regla 3: ① decisión → ② DDL en las TRES bases
-- (dev → staging → prod) → ③ UN solo PR con esquema + código + tests. **Nunca ③ sin ②.**
--
-- ADITIVO: crea una tabla nueva y **no toca ninguna existente**. Nada de lo que hay hoy deja de
-- funcionar al aplicarlo — hoy no hay ni una línea de código que la lea o la escriba, así que el
-- producto se comporta exactamente igual antes y después. Se deshace con un `DROP TABLE` limpio.
--
-- ⛔ AQUÍ NO SE ESCRIBE EL PROTOCOLO. El código que inserte, actualice y decida sobre reintentos
--    toca el flujo de cobro en producción → STOP del fundador (AA1.4). Esto sólo abre el sitio.
--
-- 🔴 ESTE FICHERO ES SÓLO DDL. La comprobación vive aparte, en
-- `docs/sql/scrum-815-verificar.sql`: el clasificador del aplicador rechaza un `SELECT` dentro de
-- un fichero de DDL (lección de SCRUM-650), y mezclarlos deja el DDL sin poder ejecutarse.
-- ═════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "gateway_events" (
    "id"           SERIAL       NOT NULL,
    "provider"     VARCHAR(24)  NOT NULL,
    "event_id"     VARCHAR(255) NOT NULL,
    "type"         VARCHAR(120) NOT NULL,
    "received_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "attempts"     INTEGER      NOT NULL DEFAULT 1,
    "last_error"   VARCHAR(500),
    CONSTRAINT "gateway_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gateway_events_provider_event_id_key"
    ON "gateway_events"("provider", "event_id");

CREATE INDEX IF NOT EXISTS "gateway_events_provider_processed_at_idx"
    ON "gateway_events"("provider", "processed_at");
