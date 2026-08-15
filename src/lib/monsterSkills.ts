// Détail d'un monstre : ses compétences, leurs coefficients, leurs effets.
//
// ⚠️ **UN SEUL point d'entrée** (`chargerDetail`) pour toute l'app. Les données
// sont aujourd'hui des fichiers pré-générés par `scripts/fetch-skills.mjs` ;
// elles vivront en base plus tard. Tout appelant qui irait chercher le JSON
// lui-même rendrait cette bascule invasive — ici, elle tient dans cette
// fonction.

export interface EffetCompetence {
  nom: string | null;
  type: string | null; // « Buff », « Debuff », « Other »…
  bonus: boolean; // effet favorable
  description: string | null;
  icone: string | null;
  // `null` = pas de taux, l'effet est garanti. À ne pas confondre avec 0.
  chance: number | null;
  quantite: number | null;
  surSoi: boolean;
  aoe: boolean;
  surCritique: boolean;
  surMort: boolean;
  note: string | null;
}

export interface Competence {
  id: number;
  com2usId: number | null;
  nom: string;
  description: string | null;
  slot: number | null;
  passif: boolean;
  aoe: boolean;
  cooldown: number | null; // tours de rechargement, `null` = aucun
  coups: number | null;
  niveauMax: number | null;
  // Le coefficient tel que SWARFARM l'écrit : « 3.6*{ATK} ».
  formule: string | null;
  scale: string[]; // stats dont la compétence dépend
  ameliorations: string[]; // ce qu'apporte chaque niveau, dans l'ordre
  icone: string | null;
  effets: EffetCompetence[];
}

export interface DetailMonstre {
  com2usId: number;
  archetype: string | null;
  skillUpsToMax: number | null;
  awakensFrom: string | null;
  awakensTo: string | null;
  source: string[];
  competences: Competence[];
}

// Mémoire de session : rouvrir la même fiche ne redemande rien. Le navigateur
// met déjà le fichier en cache, mais on évite aussi le parse et le va-et-vient.
//
// ⚠️ On mémorise AUSSI les absences (`null`) : sans ça, un monstre sans fiche
// relancerait une requête vouée au 404 à chaque ouverture.
const cache = new Map<number, DetailMonstre | null>();

/**
 * Charge le détail d'un monstre. `null` = aucune donnée pour lui (monstre perso,
 * fiche absente de SWARFARM, ou données pas encore générées).
 *
 * ⚠️ Ne lève jamais : une fiche indisponible n'est pas une erreur d'application.
 * L'appelant affiche ce qu'il a — les stats du monstre restent, seul le détail
 * des compétences manque.
 */
export async function chargerDetail(com2usId: number | null): Promise<DetailMonstre | null> {
  if (com2usId == null) return null;
  if (cache.has(com2usId)) return cache.get(com2usId) ?? null;

  try {
    const url = `${import.meta.env.BASE_URL}data/skills/${com2usId}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      cache.set(com2usId, null);
      return null;
    }
    const data = (await res.json()) as DetailMonstre;
    cache.set(com2usId, data);
    return data;
  } catch {
    // Réseau coupé, JSON illisible : on retient l'absence pour la session.
    cache.set(com2usId, null);
    return null;
  }
}

// Rend une formule lisible : « 3.6*{ATK} » → « 3.6 × ATQ ».
//
// ⚠️ On TRADUIT les noms de stats mais on garde la formule telle quelle pour le
// reste : la réécrire (« 360 % de l'ATQ ») ferait perdre la forme que le joueur
// retrouve sur les sites de référence, et introduirait une source d'erreur sur
// les formules composées (« 3.6*{ATK} + 0.5*{DEF} »).
const STAT_FR: Record<string, string> = {
  ATK: 'ATQ',
  DEF: 'DEF',
  HP: 'PV',
  SPD: 'VIT',
};

export function formuleLisible(formule: string | null): string | null {
  if (!formule) return null;
  return formule
    .replace(/\{(\w+)\}/g, (_, s) => STAT_FR[s] ?? s)
    .replace(/\*/g, ' × ')
    .replace(/\s+/g, ' ')
    .trim();
}
