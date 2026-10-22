import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { StatRow } from '../lib/stats';
import { CAPPED_STATS } from '../lib/effects';
import { displayedTotal, useOvercapDisplay } from '../hooks/useOvercapDisplay';
import { ZoneCliquable } from '../ui';

// Nombres compacts (39051 → « 39 051 »).
function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

// Panneau de stats cliquable — extrait de [MonsterGear.tsx](src/components/MonsterGear.tsx)
// à son deuxième usage (cartes de résultat de l'Optimizer, voir
// BuildCandidateCard.tsx) plutôt que recopié, même principe que
// [RuneWheel.tsx](src/components/RuneWheel.tsx)/[Switch.tsx](src/components/Switch.tsx).
//
// ⚠️ **Largeur FIXE, pas `w-fit`** : en mode Total, une seule colonne
// remplace les deux colonnes base+bonus — sans largeur fixe, l'encadré
// changeait de taille au clic et poussait les artéfacts/la roue/la relique
// voisins d'un côté à l'autre. Une largeur fixe garantit que basculer
// base+bonus ↔ total ne déplace RIEN autour de lui.
const PANEL_WIDTH = 'w-[200px]';

interface Props {
  stats: StatRow[];
  // Vitesse de runes VISÉE (RTA), affichée en rouge sur la ligne VIT quand
  // elle ne correspond plus à l'équipement. `null`/absent = pas de cible.
  spdCible?: number | null;
  // ⚠️ **Lignes resserrées** (cartes de résultat de l'Optimizer au bureau,
  // décision de l'utilisateur) : pas de 27 à 22 px, taille du texte
  // inchangée — interligne `snug` et 2 px de rembourrage au lieu de 4.
  serre?: boolean;
}

// Le rembourrage vertical d'une cellule : 4 px (2 px au doigt), ou 2 px et
// l'interligne `snug` en lignes resserrées.
const PAS_NORMAL = 'py-1 compact:py-0.5';
const PAS_SERRE = 'py-0.5 leading-snug';

export default function StatPanel({ stats, spdCible = null, serre = false }: Props) {
  const pasLigne = serre ? PAS_SERRE : PAS_NORMAL;
  // ⚠️ État LOCAL à l'instance : chaque panneau (fiche pleine page, ou
  // chacune des cartes de résultat de l'Optimizer) bascule indépendamment
  // des autres.
  const [showTotal, setShowTotal] = useState(false);
  const showOvercap = useOvercapDisplay();

  return (
    // ⚠️ `imbrique` : ce panneau est posé DANS la fiche d'un monstre, elle-même
    // cliquable par endroits — un `<button>` dans un `<button>` est du HTML
    // invalide. Le composant remet à la main le focus clavier et l'activation à
    // Entrée/Espace, que le navigateur donnait gratuitement. Voir ZoneCliquable.
    <ZoneCliquable
      imbrique
      onClick={() => setShowTotal((v) => !v)}
      title={showTotal ? 'Afficher base + bonus' : 'Afficher le total'}
      aria-pressed={showTotal}
      // ⚠️ Rembourrage réduit au doigt : le panneau porte HUIT lignes, et
      // chaque pixel de marge s'y multiplie par huit.
      className={`rounded-lg border border-border bg-panel/50 p-3 self-start ${PANEL_WIDTH} cursor-pointer
                 transition hoverable:border-accent compact:p-2`}
    >
      {/* ⚠️ **Resserré d'un cran au doigt.** Huit lignes à 12 px plus 8 px
          d'interligne faisaient un bloc de ~190 px de haut : il pesait plus lourd
          que les trois monstres au-dessus, alors qu'il ne fait que les détailler.
          Le texte descend à 11 px et l'interligne de moitié — le nom du monstre
          reste au-dessus, ce qui remet le panneau à sa place dans la hiérarchie.
          À la souris, rien ne change : la place ne manque pas. */}
      <table className="w-full text-xs compact:text-micro">
        <tbody>
          {stats.map((row) => {
            // ⚠️ Le plafond de 100 % (Taux Crit/RES/Précision) n'a de sens à
            // signaler QUE sur le total : un bonus de +30 % n'est pas « au
            // plafond » en soi, c'est la somme avec la base qui peut l'être.
            const atCap = CAPPED_STATS.has(row.key) && row.total >= 100;
            const greenOrRed = atCap ? 'text-red-500' : 'text-good';
            return (
              <tr key={row.key} className="border-b border-border/40 last:border-0">
                <td className={`${pasLigne} pr-2 text-ink-dim`}>{row.label}</td>
                {showTotal ? (
                  <td
                    colSpan={2}
                    className={`${pasLigne} text-right font-mono font-semibold tabular-nums ${greenOrRed}`}
                  >
                    {fmt(displayedTotal(row.key, row.total, showOvercap))}
                    {row.suffix}
                  </td>
                ) : (
                  <>
                    <td className={`${pasLigne} pr-3 text-right font-mono font-semibold text-ink tabular-nums`}>
                      {fmt(row.base)}
                      {row.suffix}
                    </td>
                    <td className={`${pasLigne} text-left font-mono font-semibold text-good tabular-nums`}>
                      {row.bonus > 0 ? `+${fmt(row.bonus)}${row.suffix}` : '—'}
                      {/* Objectif de vitesse : ce que les runes doivent donner
                          pour coller à la valeur saisie dans l'ordre de tour. */}
                      {row.key === 'spd' && spdCible != null && spdCible !== row.bonus && (
                        <span
                          // Rouge d'ÉTAT, celui qu'annonce `DesyncBadge` (RTA).
                          className="ml-1.5 inline-flex items-center gap-0.5 text-bad"
                          title={`Il faut ${fmt(spdCible)} de SPD sur les runes pour coller à l'ordre de tour`}
                        >
                          <ArrowRight size={11} className="flex-none" />
                          {fmt(spdCible)}
                        </span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ZoneCliquable>
  );
}
