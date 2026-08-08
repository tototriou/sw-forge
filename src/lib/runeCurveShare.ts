// Partage d'une courbe d'efficience de runes, pour se comparer entre amis.
// 100 % local : aucun envoi réseau, le contenu est copié/collé ou téléchargé.
//
// **Export : JSON** (clés en clair, inspectable, éditable) — même convention que
// les recommandations de siège (voir recoShare.ts).
// **Import : JSON *et* ancien code compact `SWF-RUNES-1:`**, qui a été diffusé
// avant ce changement — des fichiers `.txt` circulent chez les joueurs, on ne
// peut pas les rendre illisibles.

export interface CurvePayload {
  name: string;
  effs: number[]; // efficiences (%), triées décroissant
}

export const CURVE_FORMAT = 'sw-forge/courbe-runes';
export const CURVE_VERSION = 1;

const LEGACY_PREFIX = 'SWF-RUNES-1:';

function fromB64(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

// Efficiences normalisées : nombres finis, au dixième, triés décroissant.
function cleanEffs(raw: unknown[]): number[] {
  return raw
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0)
    .map((x) => Math.round(x * 10) / 10)
    .sort((a, b) => b - a);
}

// Encode une courbe en JSON lisible (efficiences au dixième).
export function encodeCurveJson(name: string, effs: number[]): string {
  return JSON.stringify(
    {
      format: CURVE_FORMAT,
      version: CURVE_VERSION,
      exporte_le: new Date().toISOString(),
      nom: name.slice(0, 40),
      efficiences: effs.map((x) => Math.round(x * 10) / 10),
    },
    null,
    2
  );
}

// Décode un JSON de courbe. null si ce n'est pas un export reconnaissable.
function decodeCurveJson(text: string): CurvePayload | null {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    if (!obj || typeof obj !== 'object') return null;
    const raw = (
      Array.isArray(obj.efficiences) ? obj.efficiences : Array.isArray(obj.effs) ? obj.effs : null
    ) as unknown[] | null;
    if (!raw) return null;
    const effs = cleanEffs(raw);
    if (effs.length === 0) return null;
    const nom = obj.nom ?? obj.name;
    return { name: (typeof nom === 'string' ? nom : 'Ami').slice(0, 40), effs };
  } catch {
    return null;
  }
}

// Décode l'ANCIEN code compact (base64), toujours accepté à l'import.
function decodeCurveLegacy(text: string): CurvePayload | null {
  try {
    let t = text.trim();
    const i = t.indexOf(LEGACY_PREFIX);
    if (i >= 0) t = t.slice(i + LEGACY_PREFIX.length);
    t = t.replace(/\s+/g, '');
    if (!t) return null;
    const obj = JSON.parse(fromB64(t));
    // Ancien format : `e` = efficiences × 10 (entiers).
    const raw = Array.isArray(obj?.e)
      ? (obj.e as unknown[]).map((x) => Number(x) / 10)
      : Array.isArray(obj?.effs)
        ? (obj.effs as unknown[])
        : null;
    if (!raw) return null;
    const effs = cleanEffs(raw);
    if (effs.length === 0) return null;
    const name =
      typeof obj?.n === 'string' ? obj.n : typeof obj?.name === 'string' ? obj.name : 'Ami';
    return { name: name.slice(0, 40), effs };
  } catch {
    return null;
  }
}

// Point d'entrée unique : l'utilisateur n'a pas à savoir de quel format il part.
export function decodeCurve(text: string): CurvePayload | null {
  const t = text.trim();
  if (!t) return null;
  return t.startsWith('{') ? decodeCurveJson(t) : decodeCurveLegacy(t) ?? decodeCurveJson(t);
}
