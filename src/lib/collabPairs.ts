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
// ⚠️ **SWARFARM ne dit rien de ce lien.** `transforms_to` ne relie que les
// formes transformables (Bellenus) ; aucun champ ne relie Gojo à Werner. La
// relation se DÉDUIT donc, et c'est la raison de ce module.

// Ce qu'il faut d'un monstre pour l'apparier. Volontairement réduit à des
// primitives : le script de génération (Node, JSON brut) et l'app (typé)
// appellent la même fonction, sans partager leurs types.
export interface CandidatCollab {
  com2usId: number;
  name: string;
  image: string | null;
  // Signature de ce que le monstre EST et FAIT. Construite par l'appelant, qui
  // seul a accès aux compétences — l'app ne les charge qu'à l'ouverture d'une
  // fiche, le script les a toutes sous la main.
  signature: string;
}

export interface PaireCollab {
  a: number; // com2usId
  b: number;
}

// Apparie les monstres dont la signature est identique.
//
// ⚠️ **La signature doit inclure les COMPÉTENCES**, pas seulement les stats.
// Sur les stats + le lead seuls, 120 paires ressortent — mais 14 d'entre elles
// ont des compétences différentes : ce sont alors deux monstres distincts qui
// partagent une grille de stats, et les fusionner effacerait de vraies
// différences. Avec les compétences, il reste 75 paires, toutes légitimes.
//
// ⚠️ **Deux entrées de MÊME image sont le même monstre, pas une paire.**
// SWARFARM liste parfois deux fois le même monstre (Nezuko Kamado apparaît en
// familles 319 ET 320, portrait identique). Sans cette déduplication, le groupe
// « Nezuko, Nezuko, Vermilion Bird Dancer » comptait trois entrées et devenait
// ambigu — c'était le seul cas irrésolu, et l'image le tranche exactement.
//
// ⚠️ **Seuls les groupes de DEUX sont retenus.** Trois monstres de même
// signature, c'est qu'elle ne suffit pas à les distinguer : on préfère ne rien
// affirmer plutôt que d'apparier au hasard. Sur les données réelles, il n'en
// reste aucun.
export function apparierCollabs(candidats: CandidatCollab[]): PaireCollab[] {
  const parSignature = new Map<string, CandidatCollab[]>();
  for (const c of candidats) {
    const groupe = parSignature.get(c.signature);
    if (groupe) groupe.push(c);
    else parSignature.set(c.signature, [c]);
  }

  const paires: PaireCollab[] = [];
  for (const groupe of parSignature.values()) {
    if (groupe.length < 2) continue;

    // Une seule entrée par portrait : les doublons d'un même monstre tombent.
    const parImage = new Map<string, CandidatCollab>();
    for (const c of groupe) {
      const cle = c.image ?? `__sans-image-${c.com2usId}`;
      if (!parImage.has(cle)) parImage.set(cle, c);
    }
    const distincts = [...parImage.values()];
    if (distincts.length !== 2) continue;

    // ⚠️ Ordre par `com2usId` : la paire doit être la MÊME à chaque génération,
    // sinon l'affichage (quelle moitié à gauche) changerait d'une version à
    // l'autre sans qu'on ait rien touché.
    const [a, b] = distincts.sort((x, y) => x.com2usId - y.com2usId);
    paires.push({ a: a.com2usId, b: b.com2usId });
  }

  // Ordre stable de la liste elle-même, pour un diff lisible sur le JSON généré.
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
