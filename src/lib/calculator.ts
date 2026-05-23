/**
 * Inline calculator for the amount field. Evaluates simple arithmetic
 * expressions like "25000+8500" or "12000*3 - 500" without using eval().
 * Supports + - * / and parentheses. Returns null on invalid input.
 */
export function parseAmountExpression(input: string): number | null {
  const expr = input.replace(/\s+/g, "");
  if (expr === "") return null;
  if (!/^[0-9+\-*/().]+$/.test(expr)) return null;

  let pos = 0;

  const peek = () => expr[pos];

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = expr[pos++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() === "*" || peek() === "/") {
      const op = expr[pos++];
      const right = parseFactor();
      if (right === null) return null;
      if (op === "/" && right === 0) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number | null {
    if (peek() === "(") {
      pos++;
      const value = parseExpr();
      if (value === null || peek() !== ")") return null;
      pos++;
      return value;
    }
    if (peek() === "-") {
      pos++;
      const value = parseFactor();
      return value === null ? null : -value;
    }
    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;
    if (pos === start) return null;
    const num = Number(expr.slice(start, pos));
    return Number.isFinite(num) ? num : null;
  }

  const result = parseExpr();
  if (result === null || pos !== expr.length) return null;
  if (!Number.isFinite(result)) return null;
  return Math.round(result);
}
