// scripts/_db-guard.mjs — SCRUM-118: identidad, no patrón de texto.
//
// ANTES (SCRUM-60/79/38, tres copias independientes): cada guard comprobaba
// `url.includes('autorack.proxy.rlwy.net')` por su cuenta — un DESCARTE de una cadena
// conocida-mala. Si Railway rota el host de prod, alguien usa un pooler, una IP o un
// alias, esa cadena deja de aparecer en la URL y el guard pasa CUALQUIER OTRA COSA
// "limpio" — incluida producción. El propio SCRUM-118 lo resume: "lo que hoy impide un
// desastre no es el guard: es que nadie ha tenido a mano una URL de prod con otro host."
//
// AHORA: PERTENENCIA. `assertSafeStagingUrl` compara el host, parseado de verdad
// (`new URL().hostname`, nunca `.includes()`), contra una ALLOWLIST del único host de
// staging conocido. Cualquier host que no sea EXACTAMENTE ese falla CERRADO — incluida
// una futura producción con host distinto, un pooler, o una URL mal formada. Ya no
// importa si el texto "contiene" o "no contiene" nada: importa a qué host pertenece.
//
// Multi-BD en el mismo host de staging (SCRUM-84: varias bases en un solo Postgres) sigue
// funcionando igual que antes — el criterio es el HOST, no el nombre de la base ni el path.
//
// Un solo lugar que sabe cuáles son los hosts reales — antes había tres copias del mismo
// string que podían divergir en silencio; ahora hay una.
export const PROD_HOST = 'autorack.proxy.rlwy.net';
export const STAGING_HOST = 'acela.proxy.rlwy.net';

function hostOf(urlStr) {
  if (!urlStr) return null;
  try {
    return new URL(urlStr).hostname;
  } catch {
    return null; // URL ilegible: nunca se trata como "probablemente segura"
  }
}

/**
 * ¿Es `candidateUrl` una URL segura para tratar como STAGING (nunca producción)?
 * `prodUrl` es opcional — si se pasa (p. ej. `DATABASE_URL` ya cargado), se usa como
 * defensa adicional en profundidad; si no, el allowlist por sí solo ya es suficiente.
 * @returns {{safe: true} | {safe: false, reason: string}}
 */
export function assertSafeStagingUrl(candidateUrl, prodUrl) {
  if (!candidateUrl) {
    return { safe: false, reason: 'no se proporcionó ninguna URL' };
  }

  const candidateHost = hostOf(candidateUrl);
  if (!candidateHost) {
    return { safe: false, reason: 'la URL no se pudo parsear (formato inválido)' };
  }

  // ALLOWLIST: el host debe SER el de staging — no basta con que "no sea" el de prod.
  // Un host desconocido (rotación, pooler, IP, alias) no pasa nunca, ni por descarte.
  if (candidateHost !== STAGING_HOST) {
    return {
      safe: false,
      reason: `host "${candidateHost}" no está en la allowlist de staging (se esperaba "${STAGING_HOST}")`,
    };
  }

  // Defensa en profundidad: comparación por IDENTIDAD contra la prod real configurada,
  // no por texto. Cubre el caso límite de que la allowlist quedase mal actualizada.
  if (prodUrl) {
    const prodHost = hostOf(prodUrl);
    if (prodHost && candidateHost === prodHost) {
      return { safe: false, reason: 'el host de staging coincide con el host de producción configurado' };
    }
    if (candidateUrl === prodUrl) {
      return { safe: false, reason: 'la URL de staging es IDÉNTICA a la URL de producción configurada' };
    }
  }

  return { safe: true };
}
