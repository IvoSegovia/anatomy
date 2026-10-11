// Vocabulario de JUGUETE de 16 símbolos para un fragmento de código.
// No es la tokenización de ningún modelo comercial: es una segmentación codiciosa
// (coincidencia más larga primero) sobre esta lista, ignorando espacios.

export const VOCAB = ["def", "f", "(", "x", ")", ":", "return", "+", "1", "*", "2", "if", "<", "0", "y", "-"];

export function tokenize(text) {
  const order = VOCAB.map((symbol, id) => ({ symbol, id })).sort((a, b) => b.symbol.length - a.symbol.length);
  const pieces = [];
  let at = 0;
  while (at < text.length) {
    if (/\s/.test(text[at])) {
      at += 1;
      continue;
    }
    const match = order.find(({ symbol }) => text.startsWith(symbol, at));
    if (!match) {
      pieces.push({ symbol: text[at], id: -1, from: at, to: at + 1 });
      at += 1;
      continue;
    }
    pieces.push({ symbol: match.symbol, id: match.id, from: at, to: at + match.symbol.length });
    at += match.symbol.length;
  }
  return pieces;
}

export const detokenize = (ids) => ids.map((id) => VOCAB[id]).join(" ");
