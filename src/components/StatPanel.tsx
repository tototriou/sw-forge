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
}

export default function StatPanel({ stats, spdCible = null }: Props) {
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
                <td className="py-1 pr-2 text-ink-dim compact:py-0.5">{row.label}</td>
                {showTotal ? (
                  <td
                    colSpan={2}
                    className={`py-1 text-right font-mono font-semibold tabular-nums compact:py-0.5 ${greenOrRed}`}
                  >
                    {fmt(displayedTotal(row.key, row.total, showOvercap))}
                    {row.suffix}
                  </td>
                ) : (
                  <>
                    <td className="py-1 pr-3 text-right font-mono font-semibold text-ink tabular-nums compact:py-0.5">
                      {fmt(row.base)}
                      {row.suffix}
                    </td>
                    <td className="py-1 text-left font-mono font-semibold text-good tabular-nums compact:py-0.5">
                      {row.bonus > 0 ? `+${fmt(row.bonus)}${row.suffix}` : '—'}
                      {/* Objectif de vitesse : ce que les runes doivent donner
                          pour coller à la valeur saisie dans l'ordre de tour. */}
                      {row.key === 'spd' && spdCible != null && spdCible !== row.bonus && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5 text-fire"
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
