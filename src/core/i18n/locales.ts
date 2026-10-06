export interface LocaleConfig {
  // Terminología
  quote: string;          // "Presupuesto" | "Cotización"
  quotePlural: string;    // "Presupuestos" | "Cotizaciones"
  quoteArticle: string;   // "el presupuesto" | "la cotización"
  quoteNew: string;       // "Nuevo presupuesto" | "Nueva cotización"
  quoteVerb: string;      // "presupuesto" | "cotización" (minúscula)
  // SCRUM-1476 · FRASES ENTERAS, una por país. El participio concuerda con la palabra del documento,
  // que cambia de género por país: no se componen con `quote` + terminación, se escriben.
  quoteExpiredTitle: string;   // "Presupuesto caducado" | "Cotización caducada"
  quoteAcceptedTitle: string;  // "Presupuesto ya aceptado" | "Cotización ya aceptada"
  quoteRejectedTitle: string;  // "Presupuesto rechazado" | "Cotización rechazada"
  // Fiscal
  currency: string;       // "EUR" | "MXN" | "COP" ...
  defaultVat: number;     // 0.21 | 0.16 | 0.19 ...
  vatName: string;        // "IVA" | "IGV"
  // Formato
  dateLocale: string;     // para Intl.DateTimeFormat
}

const LOCALES: Record<string, LocaleConfig> = {
  ES: { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteArticle: 'el presupuesto', quoteNew: 'Nuevo presupuesto', quoteVerb: 'presupuesto', currency: 'EUR', defaultVat: 0.21, vatName: 'IVA', dateLocale: 'es-ES',
    quoteExpiredTitle: 'Presupuesto caducado', quoteAcceptedTitle: 'Presupuesto ya aceptado', quoteRejectedTitle: 'Presupuesto rechazado' },
  MX: { quote: 'Cotización',  quotePlural: 'Cotizaciones',  quoteArticle: 'la cotización',  quoteNew: 'Nueva cotización',  quoteVerb: 'cotización',  currency: 'MXN', defaultVat: 0.16, vatName: 'IVA', dateLocale: 'es-MX',
    quoteExpiredTitle: 'Cotización caducada', quoteAcceptedTitle: 'Cotización ya aceptada', quoteRejectedTitle: 'Cotización rechazada' },
  CO: { quote: 'Cotización',  quotePlural: 'Cotizaciones',  quoteArticle: 'la cotización',  quoteNew: 'Nueva cotización',  quoteVerb: 'cotización',  currency: 'COP', defaultVat: 0.19, vatName: 'IVA', dateLocale: 'es-CO',
    quoteExpiredTitle: 'Cotización caducada', quoteAcceptedTitle: 'Cotización ya aceptada', quoteRejectedTitle: 'Cotización rechazada' },
  AR: { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteArticle: 'el presupuesto', quoteNew: 'Nuevo presupuesto', quoteVerb: 'presupuesto', currency: 'ARS', defaultVat: 0.21, vatName: 'IVA', dateLocale: 'es-AR',
    quoteExpiredTitle: 'Presupuesto caducado', quoteAcceptedTitle: 'Presupuesto ya aceptado', quoteRejectedTitle: 'Presupuesto rechazado' },
  PE: { quote: 'Cotización',  quotePlural: 'Cotizaciones',  quoteArticle: 'la cotización',  quoteNew: 'Nueva cotización',  quoteVerb: 'cotización',  currency: 'PEN', defaultVat: 0.18, vatName: 'IGV', dateLocale: 'es-PE',
    quoteExpiredTitle: 'Cotización caducada', quoteAcceptedTitle: 'Cotización ya aceptada', quoteRejectedTitle: 'Cotización rechazada' },
  CL: { quote: 'Cotización',  quotePlural: 'Cotizaciones',  quoteArticle: 'la cotización',  quoteNew: 'Nueva cotización',  quoteVerb: 'cotización',  currency: 'CLP', defaultVat: 0.19, vatName: 'IVA', dateLocale: 'es-CL',
    quoteExpiredTitle: 'Cotización caducada', quoteAcceptedTitle: 'Cotización ya aceptada', quoteRejectedTitle: 'Cotización rechazada' },
};

const DEFAULT_LOCALE = LOCALES['ES'];

export function getLocale(country: string | null | undefined): LocaleConfig {
  return LOCALES[(country ?? '').toUpperCase()] ?? DEFAULT_LOCALE;
}

// Para el frontend — objeto seguro serializable a JSON
export function getLocaleJson(country: string | null | undefined) {
  const l = getLocale(country);
  return {
    quote:        l.quote,
    quotePlural:  l.quotePlural,
    quoteArticle: l.quoteArticle,
    quoteNew:     l.quoteNew,
    quoteVerb:    l.quoteVerb,
    currency:     l.currency,
    defaultVat:   l.defaultVat,
    vatName:      l.vatName,
    dateLocale:   l.dateLocale,
  };
}
