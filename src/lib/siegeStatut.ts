import { ResultatAuto } from './speedTuneAuto';

// Le STATUT d'une équipe de siège en mode « Vérifier mes speed », et ce que
// la card en dit.
//
// ⚠️ **Métier, pas affichage.** Cette décision vivait dans `SiegeTeam.tsx`, en
// ternaires imbriqués : impossible à vérifier autrement qu'à l'œil, sur ses
// propres équipes, en cliquant. Le jour où le mode a semblé « ne plus rien
// faire », il n'y avait aucun moyen de dire quel cas répondait quoi. Ici, chaque
// cas est un test.
export type StatutEquipe = 'neutre' | 'vert' | 'orange' | 'rouge';

export interface EntreeStatut {
  // Le mode est-il allumé (bouton « Vérifier mes speed ») ?
  verifier: boolean;
  // Au moins un monstre posé dans l'équipe.
  desMonstres: boolean;
  // Leo est dans l'équipe : ses ticks ne se comparent à rien de connu.
  leo: boolean;
  // L'utilisateur a écarté la recommandation sur CETTE composition.
  ignoree: boolean;
  // Au moins un set Rapidité : l'équipe se juge au speed tune, jamais au tick.
  swift: boolean;
  // Le verdict de speed tune, quand il est calculable.
  speedTune: ResultatAuto | null;
  // Au moins un monstre mal calé sur un tick (équipes non-Swift).
  horsTick: boolean;
}

export function statutEquipe(e: EntreeStatut): StatutEquipe {
  if (!e.verifier || !e.desMonstres || e.leo) return 'neutre';
  if (e.ignoree) return 'vert';
  // ⚠️ **Une équipe Swift ne se juge JAMAIS au tick** : ce qui compte, c'est que
  // toute l'équipe joue avant que l'adverse ne s'intercale.
  if (e.swift) {
    if (!e.speedTune) return 'neutre';
    return e.speedTune.verdict.ok ? 'vert' : 'orange';
  }
  return e.horsTick ? 'rouge' : 'vert';
}

// ⚠️ **Le mode allumé doit TOUJOURS répondre quelque chose.** Un statut neutre
// sans un mot, c'est exactement « le bouton ne fait rien » : on a demandé une
// vérification, la card n'a pas bougé, et rien ne dit pourquoi. Cette fonction
// donne la raison quand il n'y a pas de verdict — et `null` quand il y en a un,
// c'est alors le message de statut qui parle.
export function raisonSansVerdict(e: EntreeStatut): string | null {
  if (!e.verifier || statutEquipe(e) !== 'neutre') return null;
  if (!e.desMonstres) return 'Équipe vide.';
  if (e.leo) return 'Leo est dans l\u2019équipe : elle ne se juge pas au tick.';
  // Swift sans verdict : l'analyse demande au moins deux monstres connus.
  return 'Équipe speed : il faut au moins deux monstres pour calculer le speed tune.';
}
