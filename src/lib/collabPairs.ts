// Monstres de COLLABORATION et leur équivalent Summoners War.
//
// Une collab (Jujutsu Kaisen, Street Fighter, Tekken, Le Seigneur des Anneaux…)
// ajoute des monstres sous licence — Satoru Gojo — qui sont, mécaniquement, des
// monstres SW existants réhabillés : **Satoru Gojo, c'est Werner**. Mêmes stats,
// même lead, mêmes compétences, même rôle dans une équipe. Seuls le nom et le
// portrait changent.
//
// Les afficher comme deux monstres sans rapport oblige à savoir de tête que l'un
// vaut l'autre — or c'est précisément ce qu'on vient chercher, et c'est ce qui
// décide si on possède déjà le monstre.
//
// ⚠️ **Le lien vient de l'API : `family_id` ≠ `skill_group_id`.**
// SWARFARM donne à chaque monstre sa famille ET son groupe de compétences.
// Normalement identiques — quand ils divergent, c'est que le monstre EMPRUNTE
// les compétences d'un autre, et c'est exactement ce qu'est une collab : Werner
// (famille 30900) porte le groupe 30300, celui de Gojo.
//
// ⚠️ **Ne pas déduire le lien des stats et des compétences.** Une première
// version l'a fait, faute d'avoir vu ce champ — et une signature comparée n'a
// jamais fini de se tromper : elle échoue en silence, laissant un monstre
// dépareillé au milieu de ses quatre frères, visible seulement en ouvrant la
// bonne carte. Quatre champs de SWARFARM ont dû être écartés un par un (`aoe`
// faux dans 14 % du corpus, ordre des effets instable, effets surnuméraires,
// `coups` sur des compétences sans dégâts) avant que l'appariement soit complet.
// Le champ, lui, est exact du premier coup.

// Ce qu'il faut d'un monstre pour l'apparier. Réduit à des primitives : le
// script de génération (Node, JSON brut) et l'app (typé) appellent la même
// fonction sans partager leurs types.
export interface CandidatCollab {
  com2usId: number;
  familyId: number | null;
  skillGroupId: number | null;
  // Suffixe d'élément et d'éveil du `com2usId` — deux monstres ne s'apparient
  // qu'à suffixe ÉGAL (le Gojo eau avec le Werner eau).
  suffixe: number;
  // Signature de ce que le monstre EST : rareté naturelle et stats de base.
  // ⚠️ Le groupe de compétences ne suffit PAS — voir `apparierCollabs`.
  profil: string;
}

export interface PaireCollab {
  a: number; // com2usId
  b: number;
}

// Apparie chaque monstre de collaboration à son équivalent SW.
//
// ⚠️ **Un écart de +10 entre famille et groupe n'est PAS une collab** : c'est un
// SECOND ÉVEIL, qui emprunte les compétences de sa propre famille (Elucia 2A,
// famille 10110, groupe 10100). Ces deux-là sont le même monstre à deux stades,
// déjà traités par `formesJouables` — les fusionner ici masquerait la 2A.
//
// ⚠️ **Partager un groupe de compétences ne suffit pas.** D'autres monstres les
// RÉUTILISENT sans être le même monstre : Fairy Queen emprunte les compétences
// de Fairy, Vampire Lord celles de Vampire, sans partager leurs stats. Une
// collab, elle, est un RESKIN — mêmes stats, même rareté. D'où le `profil`, qui
// écarte 27 faux appariements de ce genre.
//
// ⚠️ L'appariement se fait **à suffixe égal** : une famille porte cinq éléments,
// et le Gojo eau doit trouver le Werner eau, pas le Werner feu.
export function apparierCollabs(candidats: CandidatCollab[]): PaireCollab[] {
  // Index des monstres par (groupe de compétences, suffixe) : c'est la clé
  // qu'un monstre de collab partage avec son équivalent.
  const parGroupe = new Map<string, CandidatCollab[]>();
  for (const c of candidats) {
    if (c.skillGroupId == null) continue;
    const cle = `${c.skillGroupId}|${c.suffixe}`;
    const groupe = parGroupe.get(cle);
    if (groupe) groupe.push(c);
    else parGroupe.set(cle, [c]);
  }

  const paires: PaireCollab[] = [];
  for (const groupe of parGroupe.values()) {
    // Un monstre seul dans son groupe n'a pas d'équivalent : c'est le cas
    // courant, l'immense majorité du bestiaire.
    if (groupe.length !== 2) continue;

    const [a, b] = [...groupe].sort((x, y) => x.com2usId - y.com2usId);
    // Les deux doivent appartenir à des FAMILLES différentes : deux entrées
    // d'une même famille sont deux formes d'un même monstre, pas une paire.
    if (a.familyId != null && a.familyId === b.familyId) continue;
    // Second éveil (+10) : même monstre, deux stades. Voir plus haut.
    if (a.familyId != null && b.familyId != null && Math.abs(a.familyId - b.familyId) === 10) {
      continue;
    }
    // Stats ou rareté différentes : l'un emprunte les compétences de l'autre
    // sans être le même monstre.
    if (a.profil !== b.profil) continue;

    paires.push({ a: a.com2usId, b: b.com2usId });
  }

  // Ordre stable, pour un diff lisible sur le JSON généré.
  return paires.sort((p, q) => p.a - q.a);
}

// Le libellé d'une paire : « Satoru Gojo, Werner ».
//
// ⚠️ Deux monstres appariés portent parfois le MÊME nom (Vendhan, Dyeus) — la
// collab reprend alors le nom SW tel quel. « Vendhan, Vendhan » n'apprendrait
// rien et se lirait comme un bug : on n'écrit alors qu'une fois.
export function libelleCollab(nomA: string, nomB: string): string {
  return nomA === nomB ? nomA : `${nomA}, ${nomB}`;
}
