// Amounts with simple sums, written the German way: "12,50+3×2".

export const OPERATORS = ['+', '−', '×', '÷'] as const;
const OP = /[+−×÷]/;

/** Tidies typed or pasted text: dot or comma decimals, * / x - become × ÷ ×  −, two decimals at most. */
export function cleanExpression(raw: string): string {
  const s = raw
    .replace(/[*xX]/g, '×').replace(/\//g, '÷').replace(/-/g, '−')
    .replace(/[^\d.,+−×÷]/g, '')
    .replace(/^[+−×÷]+/, '')            // can't start with an operator
    .replace(/([+−×÷])[+−×÷]+/g, '$1'); // one operator between numbers
  return s.split(/([+−×÷])/).map(part => {
    if (OP.test(part) || !part) return part;
    // "12.50" -> "12,50"; with a comma present, dots are thousands separators ("1.234,56")
    const n = part.includes(',') ? part.replace(/\./g, '') : part.replace('.', ',');
    const i = n.indexOf(',');
    return i === -1 ? n : n.slice(0, i + 1) + n.slice(i + 1).replace(/,/g, '').slice(0, 2);
  }).join('');
}

export const hasOperator = (expr: string) => OP.test(expr.replace(/[+−×÷]$/, ''));

/** The value of the sum, rounded to cents; null if it can't be worked out (e.g. ÷ 0). */
export function evaluate(expr: string): number | null {
  const tokens = expr.replace(/[+−×÷]$/, '').split(/([+−×÷])/).filter(Boolean);
  if (!tokens.length) return null;
  // × and ÷ first, then + and −, left to right
  const terms: number[] = [];
  const signs: string[] = [];
  let current: number | null = null;
  let pending: string | null = null;
  for (const t of tokens) {
    if (OP.test(t)) {
      if (t === '×' || t === '÷') pending = t;
      else { if (current === null) return null; terms.push(current); signs.push(t); current = null; }
      continue;
    }
    const n = parseFloat(t.replace(',', '.'));
    if (Number.isNaN(n)) return null;
    if (pending && current !== null) {
      if (pending === '÷' && n === 0) return null;
      current = pending === '×' ? current * n : current / n;
      pending = null;
    } else {
      current = n;
    }
  }
  if (current === null) return null;
  terms.push(current);
  let total = terms[0];
  signs.forEach((s, i) => { total = s === '+' ? total + terms[i + 1] : total - terms[i + 1]; });
  return Math.round(total * 100) / 100;
}
