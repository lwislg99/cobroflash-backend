import crypto from 'crypto';

// A11.2 (S3): teléfonos SIEMPRE enmascarados en logs — prefijo + últimos 3.
// "34629965893" → "34•••••893". Nunca usar el número completo en console.*.
export function maskPhone(input?: string | null): string {
  const p = String(input ?? '').replace(/\D/g, '');
  if (!p) return '—';
  if (p.length <= 5) return `•••${p.slice(-2)}`;
  return `${p.slice(0, 2)}${'•'.repeat(Math.max(3, p.length - 5))}${p.slice(-3)}`;
}

// SCRUM-101: emails SIEMPRE enmascarados en logs — mismo espíritu que maskPhone, pero
// por HASH en vez de caracteres parciales: un email es más fácil de re-identificar a
// partir de solo 2-3 caracteres visibles que un teléfono (el local-part suele ser un
// nombre). Conserva el dominio (útil para depurar patrones de bounce/typo por proveedor)
// y un hash corto NO reversible (útil para correlacionar "es el mismo email" entre
// líneas de log sin guardar el dato — RGPD: minimización). Nunca interpolar el email
// crudo en console.*.
export function maskEmail(input?: string | null): string {
  const e = String(input ?? '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (!e || at <= 0) return '—';
  const domain = e.slice(at + 1);
  const hash = crypto.createHash('sha256').update(e).digest('hex').slice(0, 8);
  return `${hash}@${domain}`;
}

export function normalizePhone(input?: string | null): string {
    if (!input) return '';
    let p = String(input).trim();
    p = p.replace(/[\s\-()]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    if (p.startsWith('00')) p = p.slice(2);
    if (!/^\d{8,15}$/.test(p)) return '';
    return p;
  }
  
  // A6.6 (P1 visual): dinero CLIENT-FACING siempre en formato español —
  // "2.383,70 €" (o "1.500,00 MXN" fuera del euro), nunca "2383.70 EUR".
  export function formatMoneyEs(
    n: number | string | { toString(): string }, // acepta Prisma Decimal
    currency = 'EUR',
  ): string {
    const v = Number(String(n));
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        // A18.2 (AB6): punto de miles SIEMPRE ("2.383,70 €", no "2383,70 €")
        useGrouping: 'always' as unknown as boolean,
        currency: currency || 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v);
    } catch {
      return `${v.toFixed(2)} ${currency}`;
    }
  }

  export type QuoteLine = { concept: string; qty: number; price: number; tax?: number };
  
  export function calcTotal(lines: QuoteLine[]): number {
    const sum = lines.reduce((acc, l) => acc + l.qty * l.price * (1 + (l.tax ?? 0)), 0);
    return Math.round(sum * 100) / 100;
  }
  
  export function makeReference() {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CF-${ymd}-${rand}`;
  }
  
  // nextInvoiceNumber() (aleatorio) eliminado en Sprint SPAIN: los números de
  // factura los asigna SIEMPRE modules/invoicing/domain/invoiceNumber.service.ts
  // (serie anual correlativa por merchant: 2026-CF-001).

  // Extrae el id numérico real de un parámetro de ruta, tolerando URLs "sucias".
  // El botón URL dinámica de WhatsApp puede dejar el placeholder sin sustituir
  // (p. ej. "{{1}}23" en vez de "23"); aquí quitamos primero cualquier "{{...}}"
  // (que contiene su propio dígito) y luego nos quedamos solo con los dígitos.
  // Devuelve NaN si no queda ningún dígito.
  export function parseNumericId(raw: unknown): number {
    const digits = String(raw ?? '')
      .replace(/\{\{.*?\}\}/g, '')  // fuera placeholders tipo {{1}}
      .replace(/\D/g, '');          // solo dígitos
    return digits ? Number(digits) : NaN;
  }

  // HTML escape
  export function esc(v?: string | number | null) {
    return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[s]);
  }
  