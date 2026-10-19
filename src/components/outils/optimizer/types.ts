/**
 * L'état de validation d'un build affiché, vis-à-vis de celui qui est réservé.
 *
 * ⚠️ **Trois états, pas deux.** Comparer les seules runes rendait invalidable
 * un build aux MÊMES runes mais aux artéfacts DIFFÉRENTS : l'utilisateur
 * voyait des stats qui ne sont pas celles réservées, et le bouton disait
 * « Validé » sans rien offrir. Le cas est courant, puisque la paire
 * suit le critère de tri (voir docs/03-developpeur/optimizer/,
 * « Régime de la paire ») :
 * changer de tri change la paire, donc les stats, à runes identiques.
 *
 * Un artéfact entre dans les statistiques du monstre — deux paires
 * différentes, ce sont deux builds différents.
 */
export type EtatValidation = 'non' | 'oui' | 'artefacts';
