import { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';

// Barre d'onglets du BAS — la navigation sous `lg`.
//
// ⚠️ **En bas, pas en haut.** Sur un téléphone tenu à une main, le haut de
// l'écran est hors d'atteinte du pouce ; le bas est la seule zone confortable.
// C'est aussi ce que font les applications du téléphone lui-même, donc le geste
// est déjà acquis.
//
// ⚠️ **Cinq entrées au maximum.** Au-delà, les cibles passent sous 44 px de
// large et on tape à côté. L'app en compte neuf : les cinq principales sont
// ici, les autres restent atteignables par leur page. Ce qui reste visible
// n'est donc pas un choix esthétique — c'est ce que la largeur d'un pouce
// autorise.
//
// ⚠️ **`env(safe-area-inset-bottom)`** : sans lui, la barre passe sous la barre
// de geste des iPhone récents et le dernier onglet devient intouchable.

export interface OngletMobile {
  key: string;
  label: string;
  hash: string;
  icon: ReactNode;
  actif: boolean;
}

export default function MobileTabs({
  onglets,
  onOuvrirActions,
  actionsOuvertes = false,
}: {
  onglets: OngletMobile[];
  // Ouvre le panneau d'actions de la page (`MobileSheet`). Absent = la page n'en
  // a pas, et le bouton ne s'affiche pas — voir `PAGES_AVEC_MENU` dans App.tsx.
  onOuvrirActions?: () => void;
  actionsOuvertes?: boolean;
}) {
  return (
    <>
      {/* ⚠️ Bouton d'actions posé JUSTE AU-DESSUS des onglets, pas dedans. La
          barre est à cinq colonnes ; une sixième ferait passer chaque cible
          sous les 44 px que réclame un pouce. Et il ne mène pas à une page :
          l'isoler dit qu'il fait autre chose que ses voisins.
          ⚠️ À DROITE : c'est le côté du pouce pour la plupart des gens, et il
          ne recouvre alors aucun contenu que l'on vient de lire (le regard part
          de la gauche). */}
      {onOuvrirActions && (
        <button
          type="button"
          onClick={onOuvrirActions}
          aria-expanded={actionsOuvertes}
          aria-label="Filtres et actions de la page"
          className="lg:hidden fixed right-3 z-30 flex items-center gap-1.5 rounded-full border
                     border-border bg-panel2 px-3 py-2 text-xs font-semibold text-ink
                     shadow-[0_4px_16px_-4px_rgba(0,0,0,0.6)] transition-colors
                     hoverable:border-ctx"
          // ⚠️ Décalé de la hauteur de la barre d'onglets PLUS l'encoche du bas :
          // sans `env()`, il se pose sur les onglets des iPhone récents.
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)' }}
        >
          <SlidersHorizontal size={15} />
          Options
        </button>
      )}

      <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-5">
        {onglets.map((o) => (
          <a
            key={o.key}
            href={o.hash}
            aria-current={o.actif ? 'page' : undefined}
            // ⚠️ `px-0.5` et non `px-1` : à 11 px (le plancher de l'échelle,
            // voir design.md), « Accueil » remplit une colonne de 64 px sur un
            // écran de 320. Le libellé était à 9,5 px — sous le plancher, donc
            // flou au doigt. On resserre la marge plutôt que le texte.
            className={`relative flex flex-col items-center gap-1 px-0.5 pt-2.5 pb-2.5 text-micro
                        leading-none transition-colors ${
                          o.actif ? 'text-ctx' : 'text-ink-dimmer'
                        }`}
          >
            {/* ⚠️ **UN SEUL** trait, qui GLISSE d'un onglet à l'autre
                (`layoutId`) au lieu de disparaître ici pour réapparaître là.
                Le déplacement montre d'où l'on vient — c'est la seule chose
                qu'une barre d'onglets peut dire de plus qu'un simple surlignage.
                Posé en HAUT : en bas, il tomberait dans la zone de geste du
                téléphone. */}
            {o.actif && (
              <motion.span
                layoutId="onglet-actif"
                className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-ctx"
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
            )}
            {o.icon}
            {o.label}
          </a>
        ))}
      </div>
      </nav>
    </>
  );
}
