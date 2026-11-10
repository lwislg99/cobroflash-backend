// src/modules/auth/app/cli/altaDeMerchant.ts — SCRUM-1515, paso ①: NUESTRA puerta de alta.
//
// Da de alta un merchant LLAMANDO a `registerMerchant`, el mismo que usa `POST /auth/register`.
// Aquí no hay ni un `merchant.create`: una fila escrita a mano sería una segunda clase de
// merchant, y eso se paga en cada consulta que asuma que todos nacieron por el mismo sitio.
//
// Uso (desde la raíz, con `dist/` construido y la base en el entorno del proceso):
//   node dist/modules/auth/app/cli/altaDeMerchant.js --name "Fontanería X" --email x@y.es
//        --provincia "Las Palmas" [--country ES] [--ref CODIGO] [--source "origen/medio/campaña"]
//
// SCRUM-1522e: `--provincia` es OBLIGATORIA con país España (el que va por defecto). De ella sale la
// zona con la que nace el comercio (domain/zonaDeLaProvincia.ts); sin ella no se crea nada. Con
// otro país no se admite: no hay tabla de ningún otro, y ese comercio nace sin zona, como hasta hoy.
// SCRUM-1616b: vale el nombre, la forma doble del INE («Valencia/València») o el código INE («46»).
//
// SCRUM-1536d: con España, también `--domicilio-foral si|no` y `--domicilio-canarias si|no`, las dos
// OBLIGATORIAS: son las dos preguntas Q1 firmadas en SCRUM-1536 c.20225. Con un «si», o con una
// provincia de Canarias, no se crea nada y la consola devuelve en `texto` la frase firmada que hay
// que decirle a esa persona (`domain/territorioDeAlta.ts`): hoy se la dice quien lanza el alta.
//
// Sale: 0 creado · 2 argumentos que la ruta también rechazaba, mal escritos, sin provincia o sin domicilio, o territorio excluido · 3 ese correo ya es
// un merchant (no se llama a nada) · 4 ese correo es de un operario · 1 cualquier otro fallo.
// Lo que dice va a la consola de quien lo lanza, en una línea de JSON. No lo lee ningún usuario.
import '../../../../core/config/loadEnv'; // PRIMERO, como en src/index.ts
import { prisma } from '../../../../core/db/prisma';
import { registerMerchant } from '../../domain/auth.service';

const ARGUMENTOS = ['name', 'email', 'country', 'ref', 'source', 'provincia', 'domicilio-foral', 'domicilio-canarias'] as const;
type Argumento = (typeof ARGUMENTOS)[number];

/** `--clave valor` → { clave: valor }. `null` si hay algo que no es uno de los admitidos. */
function leerArgumentos(argv: string[]): Partial<Record<Argumento, string>> | null {
  const crudo: Partial<Record<Argumento, string>> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const clave = argv[i].replace(/^--/, '') as Argumento;
    if (!argv[i].startsWith('--') || !ARGUMENTOS.includes(clave) || argv[i + 1] === undefined) return null;
    crudo[clave] = argv[i + 1];
  }
  return crudo;
}

/**
 * Los cinco campos, LIMPIOS como los limpia la ruta antes de llamar a `registerMerchant`
 * (auth.routes.ts, el manejador de `/register`): `registerMerchant` no limpia nada, guarda lo que
 * recibe. Un correo con una mayúscula entraría tal cual, y `/auth/login` busca en minúsculas.
 *
 * ⚠️ Es la segunda copia de esas seis líneas, y no se han sacado a un sitio común porque el texto
 * de la ruta lo leen `scrum334` y `scrum264`. Que las dos copias sigan diciendo lo mismo lo
 * comprueba `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`, con datos SUCIOS por las dos puertas.
 */
function camposDeAlta(crudo: Partial<Record<Argumento, string>>) {
  const name = String(crudo.name || '').trim();
  const email = String(crudo.email || '').toLowerCase().trim();
  const country = String(crudo.country || 'ES').trim();
  const ref = String(crudo.ref || '').trim();
  const source = String(crudo.source || '').trim().slice(0, 200);
  // SCRUM-1522e: la provincia NO viene de la ruta (nunca la pidió). Sólo se le quitan los espacios:
  // quién es cada una lo decide `zonaDeAlta`, dentro de `registerMerchant`.
  const provincia = String(crudo.provincia || '').trim();
  // SCRUM-1536d: «si» o «no»; sin el argumento, sin contestar. Cualquier otra cosa no llega aquí
  // (`respuesta` la devuelve como `null` y `principal` la rechaza como argumento mal escrito).
  const domicilio = { foral: respuesta(crudo['domicilio-foral']), canarias: respuesta(crudo['domicilio-canarias']) };
  return { name, email, country, ref: ref || undefined, source: source || undefined, provincia: provincia || undefined, domicilio };
}

/** «si»/«sí» → true · «no» → false · sin el argumento → undefined · cualquier otra cosa → null. */
function respuesta(valor: string | undefined): boolean | undefined | null {
  if (valor === undefined) return undefined;
  const plano = valor.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  return plano === 'si' ? true : plano === 'no' ? false : null;
}

const decir = (algo: Record<string, unknown>) => console.log(JSON.stringify(algo));

async function principal(): Promise<void> {
  const crudo = leerArgumentos(process.argv.slice(2));
  if (!crudo) {
    decir({ resultado: 'rechazado', error: 'argumentos', admite: ARGUMENTOS.map((a) => `--${a}`) });
    process.exitCode = 2;
    return;
  }
  const { domicilio: respuestas, ...resto } = camposDeAlta(crudo);
  if (respuestas.foral === null || respuestas.canarias === null) {
    decir({ resultado: 'rechazado', error: 'argumentos', admite: ['--domicilio-foral si|no', '--domicilio-canarias si|no'] });
    process.exitCode = 2;
    return;
  }
  const campos = { ...resto, domicilio: { foral: respuestas.foral, canarias: respuestas.canarias } };
  // Los dos rechazos de la ruta, con sus mismos códigos y en su mismo orden.
  const error = !campos.name ? 'name_required' : !campos.email || !campos.email.includes('@') ? 'invalid_email' : null;
  if (error) {
    decir({ resultado: 'rechazado', error });
    process.exitCode = 2;
    return;
  }

  // Con un correo que YA es merchant, `registerMerchant` no crea nada y le manda un enlace de
  // acceso. Por la ruta eso tiene sentido (no revela si existe); aquí sería escribirle a alguien
  // sin haber creado nada, así que se mira antes y no se llama.
  const previo = await prisma.merchant.findUnique({ where: { email: campos.email }, select: { id: true } });
  if (previo) {
    decir({ resultado: 'ya_existe', id: previo.id });
    process.exitCode = 3;
    return;
  }

  try {
    await registerMerchant(campos);
  } catch (err) {
    const codigo = (err as { code?: string })?.code;
    // SCRUM-1522e: sin provincia (o con una que no está en la tabla) `registerMerchant` no crea nada.
    // Se dice cuáles admite (las trae el propio rechazo): lo lee quien da de alta, en su consola.
    if (codigo === 'provincia_required' || codigo === 'provincia_desconocida') {
      decir({ resultado: 'rechazado', error: codigo, provincias: (err as { provincias?: string[] }).provincias });
      process.exitCode = 2;
      return;
    }
    // SCRUM-1536d: sin las dos respuestas, o fuera por territorio. No se ha creado nada; con
    // `territorio_excluido` va el texto firmado que se le dice a esa persona, y por qué vía cayó.
    if (codigo === 'domicilio_fiscal_required' || codigo === 'domicilio_fiscal_desconocido' || codigo === 'territorio_excluido') {
      const { motivo, texto } = err as { motivo?: string; texto?: string };
      decir({ resultado: 'rechazado', error: codigo, ...(motivo ? { motivo, texto } : {}) });
      process.exitCode = 2;
      return;
    }
    if (codigo !== 'email_belongs_to_team') throw err;
    decir({ resultado: 'rechazado', error: 'email_belongs_to_team' });
    process.exitCode = 4;
    return;
  }

  // 🔴 AQUÍ NO SE SALE. `registerMerchant` deja la bienvenida lanzada SIN esperarla, y cuando sale
  // es ella la que escribe `lifecycleEmailsSent` en la fila. La ruta vive en un servidor que sigue
  // en pie; un guion que cortara aquí dejaría al merchant sin bienvenida y con ese campo a NULL:
  // distinto de los demás. Se deja que el proceso se quede sin trabajo él solo, y sólo entonces
  // se lee la fila y se dice qué se creó.
  process.once('beforeExit', () => {
    prisma.merchant
      .findUnique({
        where: { email: campos.email },
        select: {
          id: true, name: true, email: true, country: true, timezone: true, status: true, plan: true, planExpiresAt: true,
          referralCode: true, referredBy: true, acquisitionSource: true, lifecycleEmailsSent: true, createdAt: true,
        },
      })
      .then((fila) => {
        if (fila) return decir({ resultado: 'creado', merchant: fila });
        decir({ resultado: 'fallo', error: 'registerMerchant volvió sin lanzar y la fila no está' });
        process.exitCode = 1;
      })
      .catch(fallo);
  });
}

function fallo(err: unknown): void {
  decir({ resultado: 'fallo', error: (err as Error)?.message || String(err) });
  process.exitCode = 1;
}

if (require.main === module) principal().catch(fallo);
