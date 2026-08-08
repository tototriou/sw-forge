// Partage d'une courbe de runes, pour se comparer entre amis.
// 100 % local : aucun envoi réseau, le contenu est copié/collé ou téléchargé.
//
// **Un seul format : le JSON** (clés en clair, inspectable, éditable) — même
// convention que les recommandations de siège (voir recoShare.ts). L'ancien code
// compact `SWF-RUNES-1:` n'est plus ni produit ni lu.

// Une courbe partagée porte LES DEUX mesures : celui qui l'importe la lit dans
// celle qu'il a choisie, sans dépendre du réglage de l'expéditeur.
export interface CurvePayload {
  name: string;
  effs: number[]; // efficiences (%), triées décroissant
  scores: number[]; // scores SW, triés décroissant
}

export const CURVE_FORMAT = 'sw-forge/courbe-runes';
export const CURVE_VERSION = 2; // v2 : porte les deux mesures

// Efficiences normalisées : nombres finis, au dixième, triés décroissant.
function cleanEffs(raw: unknown[]): number[] {
  return raw
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0)
    .map((x) => Math.round(x * 10) / 10)
    .sort((a, b) => b - a);
}

// Encode une courbe en JSON lisible (efficiences au dixième).
export function encodeCurveJson(name: string, effs: number[], scores: number[]): string {
  return JSON.stringify(
    {
      format: CURVE_FORMAT,
      version: CURVE_VERSION,
      exporte_le: new Date().toISOString(),
      nom: name.slice(0, 40),
      efficiences: effs.map((x) => Math.round(x * 10) / 10),
      scores: scores.map((x) => Math.round(x)),
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
    const rawScores = Array.isArray(obj.scores) ? obj.scores : [];
    const nom = obj.nom ?? obj.name;
    return {
      name: (typeof nom === 'string' ? nom : 'Ami').slice(0, 40),
      effs,
      scores: cleanEffs(rawScores),
    };
  } catch {
    return null;
  }
}

// Point d'entrée de l'import : JSON uniquement.
export function decodeCurve(text: string): CurvePayload | null {
  const t = text.trim();
  return t ? decodeCurveJson(t) : null;
}
