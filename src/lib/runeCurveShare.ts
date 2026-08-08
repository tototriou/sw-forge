// Encodage/décodage d'une courbe d'efficience de runes, pour la partager et se
// comparer entre amis. Format compact : base64 d'un JSON { n: nom, e: [eff×10] }.
// 100% local (aucun envoi réseau) — le code est juste copié/collé ou téléchargé.

export interface CurvePayload {
  name: string;
  effs: number[]; // efficiences (%), triées décroissant
}

const PREFIX = 'SWF-RUNES-1:';

function toB64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}
function fromB64(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

// Encode une courbe en code partageable (efficiences arrondies au dixième).
export function encodeCurve(name: string, effs: number[]): string {
  const body = JSON.stringify({ n: name.slice(0, 40), e: effs.map((x) => Math.round(x * 10)) });
  return PREFIX + toB64(body);
}

// Décode un code (avec ou sans préfixe / espaces). Renvoie null si invalide.
export function decodeCurve(text: string): CurvePayload | null {
  try {
    let t = text.trim();
    const i = t.indexOf(PREFIX);
    if (i >= 0) t = t.slice(i + PREFIX.length);
    t = t.replace(/\s+/g, '');
    if (!t) return null;
    const obj = JSON.parse(fromB64(t));
    const raw = Array.isArray(obj?.e)
      ? obj.e
      : Array.isArray(obj?.effs)
        ? obj.effs.map((x: number) => Math.round(Number(x) * 10))
        : null;
    if (!raw) return null;
    const effs = raw
      .map((x: number) => Number(x) / 10)
      .filter((x: number) => Number.isFinite(x))
      .sort((a: number, b: number) => b - a);
    if (effs.length === 0) return null;
    const name =
      typeof obj?.n === 'string' ? obj.n : typeof obj?.name === 'string' ? obj.name : 'Ami';
    return { name: name.slice(0, 40), effs };
  } catch {
    return null;
  }
}
