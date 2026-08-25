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
  // ⚠️ **Deux comptes, pas un.** Les SLOTS remplis (un monstre y est posé) et
  // les monstres RECONNUS (retrouvés dans le catalogue). Ils diffèrent tant que
  // les données ne sont pas chargées — au rechargement de la page, typiquement.
  // Sans cette distinction, la card disait « il faut au moins deux monstres » à
  // une équipe qui en a quatre : le message accusait l'utilisateur d'un défaut
  // qui n'était pas le sien, et lui demandait de corriger ce qui était déjà bon.
  slotsRemplis: number;
  monstresConnus: number;
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
  // ⚠️ **Les données ne sont pas encore là.** L'équipe a de quoi être jugée, ce
  // sont ses monstres qui ne sont pas encore reconnus (catalogue en cours de
  // chargement, juste après un rechargement de page). Dire « il faut au moins
  // deux monstres » à une équipe qui en a quatre envoyait corriger un défaut
  // inexistant. Rien à faire : ça se résout tout seul.
  if (e.slotsRemplis >= 2 && e.monstresConnus < 2) return 'Vitesses en cours de chargement…';
  // Swift sans verdict : l'analyse demande au moins deux monstres connus.
  return 'Équipe speed : il faut au moins deux monstres pour calculer le speed tune.';
}
