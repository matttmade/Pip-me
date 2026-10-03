/**
 * A tiny, safe arithmetic evaluator (no eval): + - * / % ^, parentheses, unary minus,
 * decimals, and the constant PI. Also accepts × ÷ and a comma as decimal point.
 * Returns null for anything it can't read.
 */
export function evaluate(input: string): number | null {
  const src = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, '').toLowerCase()
  if (!src || src.length > 200) return null
  let i = 0

  const peek = () => src[i]
  const eat = (c: string) => (src[i] === c ? (i++, true) : false)

  function primary(): number {
    if (eat('(')) {
      const v = expr()
      if (!eat(')')) throw new Error('paren')
      return v
    }
    if (src.startsWith('pi', i)) return (i += 2), Math.PI
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(src.slice(i))
    if (!m) throw new Error('num')
    i += m[0].length
    return Number(m[0])
  }
  function unary(): number {
    if (eat('-')) return -unary()
    if (eat('+')) return unary()
    return power()
  }
  function power(): number {
    const base = primary()
    // right-associative; the exponent may itself be signed
    return eat('^') ? base ** unary() : base
  }
  function term(): number {
    let v = unary()
    for (;;) {
      if (eat('*')) v *= unary()
      else if (eat('/')) v /= unary()
      else if (eat('%')) v %= unary()
      else return v
    }
  }
  function expr(): number {
    let v = term()
    for (;;) {
      if (eat('+')) v += term()
      else if (eat('-')) v -= term()
      else return v
    }
  }

  try {
    const v = expr()
    if (peek() !== undefined || !Number.isFinite(v)) return null
    return v
  } catch {
    return null
  }
}
