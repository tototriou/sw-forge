import MobileSheet from '../ui/MobileSheet';
import { SidebarSection } from './Sidebar';

// Choix de la SOUS-SECTION sur téléphone — le second niveau de navigation.
//
// ⚠️ **Toucher une section n'ouvre pas une page, il ouvre ce panneau.** C'est la
// même règle que la barre latérale (« la barre navigue SEULE ») portée au
// format tactile : on choisit d'abord OÙ, la page ne change qu'ensuite. Sans
// lui, « Compte » menait droit à l'inventaire de monstres et les dix autres vues
// n'étaient atteignables que par des rangées d'onglets posées dans la page —
// une par écran, chacune avec son rendu, invisibles tant qu'on n'y était pas.
//
// ⚠️ **Il monte du BAS, sous le doigt qui l'a demandé.** Son déclencheur est un
// onglet de la barre du bas ; un menu qui surgirait en haut de l'écran
// obligerait à refaire le lien entre les deux à chaque fois — et le haut d'un
// téléphone tenu à une main est hors d'atteinte du pouce.
//
// ⚠️ **Les mêmes `SidebarSection` que la barre latérale**, pas une seconde
// liste. Une liste parallèle aurait divergé au premier écran ajouté, et le
// manque serait passé inaperçu : on ne cherche pas ce dont on ignore
// l'existence. C'est déjà la règle de `SidebarSearch`.
export default function MobileNavSheet({
  section,
  onFermer,
}: {
  // `null` = aucun panneau ouvert. La section vient du rendu courant, jamais
  // d'un objet mémorisé — voir `Sidebar`, où un objet figé au clic laissait le
  // surlignage en arrière d'une navigation.
  section: SidebarSection | null;
  onFermer: () => void;
}) {
  return (
    <MobileSheet
      ouvert={section !== null}
      onFermer={onFermer}
      titre={section?.titre ?? ''}
    >
      {section && (
        <nav className="flex flex-col gap-0.5" aria-label={`Vues de ${section.titre}`}>
          {section.groupes.map((g, i) => (
            <div key={g.titre ?? i}>
              {/* ⚠️ Un FILET entre les groupes, comme dans la barre latérale :
                  « Mon compte » en aligne dix, que seule une marge séparait —
                  à cette densité l'œil ne voit qu'une longue liste. Il
                  n'apparaît qu'à partir du DEUXIÈME : en tête, il séparerait le
                  premier groupe de rien du tout. */}
              {i > 0 && <span aria-hidden className="my-2 block h-px bg-border-soft" />}
              {/* Un intitulé de groupe n'est PAS un lien : « Runes » annonce ce
                  qui suit, il ne mène nulle part. C'est la vue qu'on choisit. */}
              {g.titre && <span className="label block px-1 pb-1">{g.titre}</span>}
              {g.liens.map((l) => (
                <a
                  key={l.key}
                  href={l.hash}
                  // ⚠️ Le panneau se ferme au CHOIX, pas au relâchement du
                  // doigt : c'est le choix d'une destination qui fait changer la
                  // page, donc c'est lui qui a fini le geste.
                  onClick={onFermer}
                  aria-current={l.actif ? 'page' : undefined}
                  // ⚠️ Cible PLEINE HAUTEUR (44 px) : c'est une liste qu'on vise
                  // du pouce, pas une rangée de pastilles serrées. La règle
                  // tactile générale s'applique ici sans exception.
                  className={`relative flex min-h-[44px] items-center gap-2.5 rounded-lg px-3
                              text-sm transition-colors ${
                                l.actif ? 'text-ink' : 'text-ink-dim hoverable:bg-panel2'
                              }`}
                >
                  {/* Marqueur d'état UNIQUE de l'app : contour d'accent + fond
                      très léger (spec/shared/design.md). Posé sur un calque en
                      `absolute` comme dans la barre latérale — sur l'entrée
                      elle-même, il décalerait le libellé de 1 px à chaque
                      changement de vue. */}
                  <span
                    aria-hidden
                    className={`absolute inset-0 rounded-lg border border-ctx bg-ctx-soft
                                transition-opacity ${l.actif ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <span className="relative flex-none">{l.icon}</span>
                  <span className="relative">{l.label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
      )}
    </MobileSheet>
  );
}
