// src/modules/auth/app/cli/altaDeMerchant.ts — SCRUM-1515, paso ①: NUESTRA puerta de alta.
//
// Da de alta un merchant LLAMANDO a `registerMerchant`, el mismo que usa `POST /auth/register`.
// Aquí no hay ni un `merchant.create`: una fila escrita a mano sería una segunda clase de
// merchant, y eso se paga en cada consulta que asuma que todos nacieron por el mismo sitio.
//
// Uso (desde la raíz, con `dist/` construido y la base en el entorno del proceso):
//   node dist/modules/auth/app/cli/altaDeMerchant.js --name "Fontanería X" --email x@y.es
//        [--country ES] [--ref CODIGO] [--source "origen/medio/campaña"]
//
// Sale: 0 creado · 2 argumentos que la ruta también rechaza (o mal escritos) · 3 ese correo ya es
// un merchant (no se llama a nada) · 4 ese correo es de un operario · 1 cualquier otro fallo.
// Lo que dice va a la consola de quien lo lanza, en una línea de JSON. No lo lee ningún usuario.
import '../../../../core/config/loadEnv'; // PRIMERO, como en src/index.ts
import { prisma } from '../../../../core/db/prisma';
import { registerMerchant } from '../../domain/auth.service';

const ARGUMENTOS = ['name', 'email', 'country', 'ref', 'source'] as const;
type Argumento = (typeof ARGUMENTOS)[number];

/** `--clave valor` → { clave: valor }. `null` si hay algo que no es uno de los cinco. */
export function leerArgumentos(argv: string[]): Partial<Record<Argumento, string>> | null {
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
export function camposDeAlta(crudo: Partial<Record<Argumento, string>>) {
  const name = String(crudo.name || '').trim();
  const email = String(crudo.email || '').toLowerCase().trim();
  const country = String(crudo.country || 'ES').trim();
  const ref = String(crudo.ref || '').trim();
  const source = String(crudo.source || '').trim().slice(0, 200);
  return { name, email, country, ref: ref || undefined, source: source || undefined };
}

const decir = (algo: Record<string, unknown>) => console.log(JSON.stringify(algo));

async function principal(): Promise<void> {
  const crudo = leerArgumentos(process.argv.slice(2));
  if (!crudo) {
    decir({ resultado: 'rechazado', error: 'argumentos', admite: ARGUMENTOS.map((a) => `--${a}`) });
    process.exitCode = 2;
    return;
  }
  const campos = camposDeAlta(crudo);
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
    if ((err as { code?: string })?.code !== 'email_belongs_to_team') throw err;
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
          id: true, name: true, email: true, country: true, status: true, plan: true, planExpiresAt: true,
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
