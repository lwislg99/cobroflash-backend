# SCRUM-913 · Fichaje: el registro de jornada de los técnicos

**Medido contra:** `origin/main` = `bbe01631ac5fcfd3ec67272c8aed3e39c192057f` · 2026-09-21T12:28:20Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-913a-registro-jornada-requisitos-legales` · **Carril:** consultoría (Sesión 0), paso 1 del ticket · **Encargo:** orquestador, 21-sep-2026 (excepción de carril confirmada por él en el canal).

## SCRUM-913a · Paso 1: lo que dice la norma (21-sep-2026)

**Entrega:** `docs/legal/REGISTRO_JORNADA_ES.md`. Contesta, con fuente oficial y sin interpretar, lo que pedía el paso 1:
qué datos, cuánto tiempo se guardan, quién tiene acceso, si se puede modificar y cómo, teletrabajo, desplazamientos,
geolocalización y sanciones. Cada afirmación lleva su marca: 🟢 norma vigente · 🟡 criterio oficial que no obliga ·
🔴 proyecto no vigente · ⚪ la norma no lo dice.

**Lo que el paso 2 (Sesión 1) necesita saber, en cinco líneas:**

1. 🟢 Lo único que la ley exige guardar es el **horario concreto de inicio y finalización** de la jornada de cada persona trabajadora, **cada día**, durante **cuatro años** (ET art. 34.9).
2. ⚪ La ley **no dice nada** sobre corregir un asiento. Solo el **proyecto** de Real Decreto lo regula (autorización de la empresa y del trabajador, huella indeleble, discrepancia visible), y ese proyecto **no está publicado** a 21-sep-2026.
3. 🟡 Los criterios oficiales piden un sistema «fiable, inmodificable y no manipulable a posteriori, ya sea por el empresario o por el propio trabajador», accesible «en cualquier momento» a la persona trabajadora, sus representantes y la Inspección, y que la Inspección pueda pedir «impresión» o «descarga» en «formato legible y tratable».
4. 🟡 Con geolocalización, la AEPD dice que si el fin es el registro horario, la ubicación **no** puede usarse para saber dónde está la persona en cada momento, y que **no es lícito imponer al trabajador su móvil personal** para geolocalizar. Es la parte que decide el fundador (y enlaza con SCRUM-989).
5. ⚪ Desplazamientos entre clientes: la ley calla y la Guía del Ministerio solo dice que se registra «el tiempo de trabajo efectivo». Falta el convenio de cada oficio.

**Lo que no se ha podido leer** (declarado en el §10 del documento, con el motivo): la sentencia TJUE C-55/18 (EUR-Lex y Curia no sirven texto sin JavaScript; no se eludió), el dictamen del Consejo de Estado (403; no se eludió), los convenios colectivos, la jurisprudencia de desplazamientos y las páginas 1-7 y 9-11 del Criterio Técnico 101/2019 sin contrastar con la imagen.

**Cómo se midió (población y controles):**

- **Citas:** 96 citas literales en el documento, **96 de 96 halladas** en los ficheros bajados de BOE, Ministerio, Inspección y AEPD. Control negativo: una cita alterada a propósito sale «NO ENCONTRADA». Script: `docs/verificacion/comprobar-citas-registro-jornada.mjs`.
- **Real Decreto sin publicar:** barrido de los sumarios del BOE del 30-sep-2025 al 21-sep-2026 (**308** sumarios, **71.145** disposiciones, 0 errores). Controles: encuentra una resolución de jornada que existe (`BOE-A-2026-8287`) y el patrón dispara sobre dos títulos reales. Script y resultado: `docs/verificacion/barrido-boe-sumarios.mjs` y `docs/verificacion/barrido-boe-sumarios-2025-09-30_2026-09-21.json`. **Límite:** solo mira títulos.
- **CT 101/2019:** el PDF es un escaneo sin texto. Lo transcribió un subagente (16 de 16 páginas) y **yo contrasté con la imagen las páginas 8, 12, 13, 14, 15 y 16**, de donde sale toda cita del documento. Coincidieron palabra por palabra.

**Dos filas nuevas en `docs/equipo/afirmaciones-verificadas.md`:** la del mapa de «Trabajos de hoy» de SCRUM-989 (**NO ENCUENTRO ese mapa**, con su suelo: la misma búsqueda sí ve el enlace a Google Maps de `jobRailBlocks.js:86`) y la de SCRUM-913 (premisa cierta; Real Decreto digital no publicado).

**Qué NO hace esta entrega:** no toca `src/`, `public/` ni el esquema; no abre ni cierra el ticket; no diseña. El diseño y el diff de esquema aditivo (con `node scripts/preview-migracion.mjs`, que Javier aplica como ALTER) son del **paso 2, Sesión 1**. **SCRUM-913 sigue abierto.**

### Errores míos de esta entrega (A9)

- **Cinco citas mal copiadas, cazadas por el comprobador y no por mí.** En la primera pasada, de 97 citas, **12 salieron «no encontradas»**. **Siete** eran del comprobador o de su lista de fuentes (dos frases del ticket de Jira que no estaban entre las fuentes, tres citas del CT con negritas de la transcripción, una con un espacio antes de la coma en el texto del BOE y un título del barrido). **Cinco eran errores míos de copia**: junté dos frases de la Guía en una; escribí «expreso, claro e inequívoco» donde la ley dice «de forma expresa, clara e inequívoca»; puse en minúscula el «Horario» de un artículo del proyecto; escribí «tiempos de espera y de tiempos a disposición» donde el texto dice «de los tiempos de espera y de los tiempos a disposición»; y puse entre comillas, como título literal, un nombre de guía de la AEPD que no era literal. Releer a ojo no las cazó; el instrumento, sí. Por eso el comprobador se comitea.
- **Una hora con «~».** En el mensaje de bloqueo de cuentas al orquestador escribí «~12:25Z» en vez de medirla; A14 lo prohíbe. La hora real de ese mensaje era anterior a las 12:20:11 de GitHub que medí después.
- **Una transcripción de escaneo no es el original.** Delegué la lectura de un PDF de imágenes en un subagente y **no la cité hasta contrastar con la imagen** las páginas de donde salen las citas: las seis coincidieron, pero solo lo sé de esas seis.

### Fuera de esta entrega, y por qué

- **Cuentas de prueba (Verifacturamos, Holded, ServiceM8):** el clasificador de permisos denegó leer la contraseña de Verifacturamos («Real-World Transactions»); la autorización llegó reenviada por otra sesión, no escrita por el fundador en esta. **No se rodeó.** No se entró en ninguna cuenta ni se creó ninguna. Holded caduca sola a primeros de octubre. Queda en el traspaso de la Sesión 0.
- **Las tres propuestas de producto:** no entregadas (contexto medido de la sesión: **370.979 tokens**, por encima del umbral de 300k de A19). Van a la sesión de relevo, con la valoración de 913 y 989 ya hecha en las notas de la Sesión 0.

---

## SCRUM-913b · Paso 2: el diseño y el DDL aditivo (15-oct-2026)

**Medido contra:** `origin/main` = `f4910603f44de8d16eab3abc938d853d255d8295` · 2026-10-15T17:38:01Z (cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-913b-fichaje-diseno-y-ddl` · **Carril:** Sesión 1 (servidor), paso 2 del ticket · **Encargo:** orquestador, lote del 15-oct, punto 4.

**Qué entrega:** el diseño (técnico en el móvil, oficina, exportación para la Inspección) y el DDL **aditivo** sacado con
`scripts/preview-migracion.mjs`, para que Javier aplique el ALTER (A5 ②). **No toca `prisma/schema.prisma`, ni `src/`,
ni `public/`**: el modelo vive en un esquema temporal fuera del árbol, y el DDL sale de compararlo con el de `main`.
El PR del esquema (③) va DESPUÉS del ALTER, con código y tests.

### 1 · De dónde sale cada decisión

Cada fila cita la sección del documento de la norma (`docs/legal/REGISTRO_JORNADA_ES.md`) o el comentario del ticket que la provoca.

| decisión | de dónde | 
|---|---|
| Se registra **inicio y fin de jornada, por persona y por día**; nada más es obligatorio | §1 (ET 34.9) |
| Las **pausas** se pueden registrar (opcional) | §1 (CT 101/2019 p. 8 y Guía B.1: sin ellas se presume trabajo todo el intervalo) |
| **Nada se edita ni se borra**: se corrige con un asiento nuevo que nombra al viejo, con autor y comentario | §5 (Guía B.2 y CT p. 14, 🟡; proyecto de RD art. 2.2.b, 🔴) |
| Se guarda la **hora del hecho** (`momento`) y **la hora en que se escribió** (`registradoEn`, la pone la base) | §5: lo que delata un asiento puesto a posteriori es esa diferencia |
| La **oficina puede fichar por un empleado**, y queda quién lo hizo | comentario 16182 (Contasimple lo permite; aquí deja rastro) |
| «**Registros sin cerrar**» (entrada sin salida) se SEÑALAN, no se suman | comentario 16182 |
| Cada empleado ve **sólo lo suyo**; la oficina (rol `admin`) ve el equipo | §4 (AEPD ap. 8, puntos 11 y 12) |
| **Sin ubicación** | §8 y §12.5: la decide el fundador. Añadirla luego es una columna nullable, aditiva |
| **No se ata a un Trabajo** | §8 (AEPD: minimización, el registro no sirve a otro fin). El tiempo por trabajo es otra finalidad; ver §6 |
| El empleado que tiene jornada **no se puede borrar** | §3 (se conserva cuatro años) |

### 2 · El técnico, en el móvil

- **Un botón** que cambia según su estado del día: sin jornada abierta → fichar la entrada; abierta → fichar la salida, y
  al lado iniciar/terminar pausa. El servidor pone la hora (no se teclea): el asiento normal es «ahora».
- Debajo, **su día**: entradas, pausas, salidas y el total. Y la semana anterior, desplegable.
- **Si se le olvidó fichar**, puede registrar la hora a mano, **con comentario obligatorio**. Queda como asiento con
  `momento` ≠ `registradoEn`, y así se ve en la oficina y en la exportación. No hay forma de «arreglar» un asiento sin
  dejar el viejo a la vista.
- **No ve a nadie más** (AEPD).

### 3 · La oficina (rol `admin` o titular)

- **«El equipo hoy»**: una fila por empleado — entrada, última salida, número de pausas, total, y la marca de
  **registro sin cerrar** (entrada sin salida de un día ya pasado). El total de un día sin cerrar **no se calcula**: se
  dice que falta la salida, en vez de inventar una hora.
- **Fichar por un empleado** y **corregir/anular** un asiento: siempre con comentario, y el asiento lleva al autor
  (`autorTeamMemberId`; NULL = titular). El asiento original sigue en la lista, tachado y enlazado a su corrección.
- La ficha de cada empleado, con su historial por periodo.

### 4 · La exportación para la Inspección

- La Inspección puede pedir «impresión» o «descarga … en formato legible y tratable» (§4, CT p. 14). Se sirve **CSV**
  (tratable) por periodo y empleado (o todos), y una vista imprimible de lo mismo.
- Columnas: empleado · fecha · entrada · salida · pausas · total del día · **asientos corregidos** (con la hora
  original, la nueva, el autor, el comentario y cuándo se escribió cada uno). Nada se resume hasta perder la cadena.
- Totalización mensual por empleado: la piden el tiempo parcial (ET 12.4.c) y las horas extra (ET 35.5) — se calcula,
  no se guarda.

### 5 · El esquema: un modelo nuevo, `AsientoJornada` (`asientos_jornada`)

Modelo propuesto, tal cual se compiló (y lo que añade a `Merchant` y `TeamMember` son sólo dos listas virtuales, sin columna):

```prisma
model AsientoJornada {
  id                Int      @id @default(autoincrement())
  merchantId        Int      @map("merchant_id")
  teamMemberId      Int      @map("team_member_id")      // DE QUIÉN es la jornada (obligatorio)
  tipo              String                               // entrada | salida | pausa_inicio | pausa_fin | anulacion (cerrado en el servidor)
  momento           DateTime                             // la hora DECLARADA del hecho
  registradoEn      DateTime @default(now()) @map("registrado_en")  // la pone la base, nunca el cliente
  autorTeamMemberId Int?     @map("autor_team_member_id") // quién lo escribió; NULL = titular (convención de AuditLog)
  corrigeId         Int?     @map("corrige_id")           // el asiento que corrige o anula; NULL = original
  comentario        String?                               // obligatorio en el servidor para corregir o anular

  merchant     Merchant         @relation(fields: [merchantId], references: [id])
  teamMember   TeamMember       @relation(fields: [teamMemberId], references: [id])   // RESTRICT: no se borra a quien tiene jornada
  corrige      AsientoJornada?  @relation("CorreccionDeAsiento", fields: [corrigeId], references: [id], onDelete: NoAction)
  correcciones AsientoJornada[] @relation("CorreccionDeAsiento")

  @@index([merchantId, teamMemberId, momento])
  @@index([merchantId, momento])
  @@index([corrigeId])
  @@map("asientos_jornada")
}
```

**El DDL**, salida de `previewMigracion({ schema: <propuesta>, desde: <schema de main> })` (`scripts/preview-migracion.mjs`,
CLI local de Prisma, offline datamodel→datamodel). **Control positivo de la herramienta: pasó, 34 tablas** contra vacío.
Clase `con_cambios`. **`sentenciasDestructivas()` = `[]`** (ni DROP, ni RENAME, ni SET NOT NULL, ni DELETE).

```sql
-- CreateTable
CREATE TABLE "asientos_jornada" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "team_member_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "momento" TIMESTAMP(3) NOT NULL,
    "registrado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autor_team_member_id" INTEGER,
    "corrige_id" INTEGER,
    "comentario" TEXT,

    CONSTRAINT "asientos_jornada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asientos_jornada_merchant_id_team_member_id_momento_idx" ON "asientos_jornada"("merchant_id", "team_member_id", "momento");

-- CreateIndex
CREATE INDEX "asientos_jornada_merchant_id_momento_idx" ON "asientos_jornada"("merchant_id", "momento");

-- CreateIndex
CREATE INDEX "asientos_jornada_corrige_id_idx" ON "asientos_jornada"("corrige_id");

-- AddForeignKey
ALTER TABLE "asientos_jornada" ADD CONSTRAINT "asientos_jornada_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_jornada" ADD CONSTRAINT "asientos_jornada_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_jornada" ADD CONSTRAINT "asientos_jornada_corrige_id_fkey" FOREIGN KEY ("corrige_id") REFERENCES "asientos_jornada"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
```

**Por qué es aditivo:** una tabla nueva, vacía; ninguna columna de una tabla existente cambia. Las FK hacia `merchants` y
`team_members` sólo restringen el borrado de filas que tengan asientos, y hoy no hay ninguno.

**Una desviación de lo que Prisma pone solo, DECLARADA:** en `corrige` Prisma pondría `ON DELETE SET NULL` (relación
opcional). Se cambió a `NoAction`: con SET NULL, borrar un asiento original dejaría su corrección sin saber qué corrigió,
y esa cadena es lo que se inspecciona. NO ACTION y no RESTRICT porque, según la documentación de Postgres, NO ACTION se
comprueba **al final de la sentencia** y RESTRICT **en el acto**: el `deleteMany` por merchant del borrado de cuenta se
lleva la cadena entera en una sola sentencia. ⚠️ **Esto NO lo he medido** contra un Postgres: el banco portable de la
máquina ya no existe (`C:\Users\Admin\AppData\Local\Temp\pgt\pgsql\bin\pg_ctl.exe` → `False`). Lo mide el test del
borrado de cuenta en el paso 3, que corre contra el banco desechable del CI.

### 6 · Lo que el paso 3 (después del ALTER) tiene que hacer, para que nadie lo descubra a mitad

1. **`src/modules/system/domain/borradoMerchant.ts`**: añadir `asientoJornada` a `MODELOS_POR_MERCHANT`, **antes de
   `teamMember`** (si no, la FK RESTRICT revienta el borrado). El guard de cobertura de SCRUM-172 lo exigirá en cuanto el
   modelo entre en el esquema; y `docs/CENSO_FK_MERCHANT.md` gana tres FK. Lo mismo en `scripts/clean-staging-tests.mjs`.
2. **Ningún `asientoJornada.update`/`delete` en `src/`** fuera del borrado de cuenta: un guard por AST (no por `grep`, la
   trampa de auto-referencia) lo hace cumplir. La inmodificabilidad vive en el código y en ese guard; un trigger en la
   base no se propone porque el DDL sale de `migrate diff` y de ningún otro sitio (A5).
3. **El servidor pone `registradoEn`** y nunca lo acepta del cliente. `teamMemberId` lo decide la sesión: un técnico
   sólo ficha para sí mismo; sólo `admin`/titular ficha por otro.
4. `tipo`: vocabulario cerrado en un módulo de dominio (mismo patrón que `tipoIntervencion.ts`); una corrección exige
   `comentario` no vacío y un `corrigeId` del mismo merchant y del mismo empleado.
5. Toda query filtra por `req.merchantId` (regla dura 2).

### 7 · Lo que este diseño NO decide (y quién)

| pregunta | de quién | por qué no la contesto |
|---|---|---|
| **¿Ubicación?** | fundador (§12.5) | RGPD; el diseño la deja fuera y añadirla es aditivo |
| **¿El técnico ficha con su móvil personal?** | fundador (§12.2) | la AEPD sólo lo prohíbe para geolocalizar; sin ubicación no hay regla, pero es decisión de producto |
| **¿Va detrás de un flag?** | fundador (cambio de master) | los flags de la Parte P son CERRADOS (regla 27): no invento uno |
| **¿YaQu es encargado del tratamiento?** | fundador (§12.3) | implica contrato con cada cliente (`docs/legal/RGPD_TRATAMIENTO_DATOS.md`, no revisado aquí) |
| **Al dar de baja una cuenta, ¿qué pasa con cuatro años de jornada?** | fundador (STOP: datos de clientes) | el registro es obligación del EMPLEADOR; borrarlo con la cuenta choca con ET 34.9. Hoy ninguna ruta borra merchants (`borradoMerchant.ts`, cabecera), así que no duele aún |
| **¿Para hoy o para el proyecto de RD?** | fundador (§12.7) | el diseño cubre lo que el proyecto pediría de huella y autoría sin construir más; la modalidad presencial/distancia y el «desacuerdo del trabajador» (RD art. 4.b) quedan fuera y entran como columnas nullables |
| **Los textos** (botones, avisos, exportación) | firma del fundador (regla 39) | no se escriben aquí: se proponen cuando haya pantalla (S2) |
| **El plan**: con 1 usuario (trial, 409 `user_limit` en `team.routes.ts:81`) no hay empleados que fichen | fundador | el fichaje sólo sirve con plan de equipo |

### 8 · Cómo se midió y qué no

- **Población:** el esquema de `main` (`git show origin/main:prisma/schema.prisma`) contra el mismo con el modelo
  injertado por tres anclas, **cada una exigida única** (una salió dos veces —`vfSubmissions` existe en dos modelos— y el
  script se plantó en vez de injertar en el sitio equivocado; se cambió el ancla a `CustomerSite  CustomerSite[]`).
- **Ningún código de `src/` borra un `TeamMember`** (`git grep -E "teamMember\.delete" origin/main -- src` → sin
  resultados; los únicos están en `scripts/clean-staging-tests.mjs` y en tests). Por eso la FK RESTRICT no rompe hoy
  ningún flujo.
- **No medido:** la semántica NO ACTION frente a RESTRICT contra un Postgres real (§5); el comportamiento en las bases
  reales (el ALTER lo aplica Javier, con sus dos controles + `current_database()`, A5).
- El script del injerto es efímero (en el directorio temporal de la sesión, no en el repo): se reconstruye con esta
  sección.

### Errores míos de esta entrega (A9)

- **El ancla del injerto**: la primera elegida no era única. Lo cazó el propio script, que exige una aparición exacta;
  sin esa comprobación habría injertado la relación en el modelo equivocado y el DDL habría salido igual de verde.
- **La primera versión dejaba `ON DELETE SET NULL`** en la corrección (lo que Prisma pone solo) y no lo vi hasta leer el
  DDL línea a línea. Se cambió a NO ACTION por el motivo de §5.

A9: aviso → cicatriz S1 «Un DDL de Prisma se lee línea a línea antes de entregarlo: una relación opcional sale con `ON DELETE SET NULL` sin que nadie lo haya pedido.» — no se pudo comprobar: ningún guard sabe qué `onDelete` quería el diseño, y el test que lo mediría (el del borrado de cuenta, paso 3) no puede existir antes del ALTER

**SCRUM-913 sigue abierto:** falta ② (ALTER de Javier en las tres bases) y ③ (servidor S1 + pantallas S2), y las
decisiones de la tabla del §7.
