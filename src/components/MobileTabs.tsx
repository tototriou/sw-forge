import { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Bouton } from '../ui';
import { useClavierOuvert } from '../hooks/useClavierOuvert';

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
  // Destination. ⚠️ **Absente quand l'onglet OUVRE une section** — voir `ouvre`.
  hash?: string;
  icon: ReactNode;
  // Le TITRE de la section dont il faut choisir la sous-section (voir
  // MobileNavSheet). ⚠️ Un onglet qui en a une ne mène nulle part par lui-même :
  // « Compte » menait droit à l'inventaire de monstres, et les dix autres vues
  // n'étaient atteignables que par des rangées d'onglets posées dans la page.
  // Même règle que la barre latérale : on choisit d'abord OÙ, la page ne change
  // qu'ensuite.
  ouvre?: string;
  actif: boolean;
}

export default function MobileTabs({
  onglets,
  onOuvrirSection,
  sectionOuverte = null,
  onOuvrirActions,
  actionsOuvertes = false,
}: {
  onglets: OngletMobile[];
  // Ouvre le panneau de choix de sous-section, pour un onglet qui porte `ouvre`.
  onOuvrirSection?: (titre: string) => void;
  // Titre de la section dont le panneau est OUVERT — pour `aria-expanded`. Un
  // `false` en dur mentirait au lecteur d'écran dès que le panneau est déplié.
  sectionOuverte?: string | null;
  // Ouvre le panneau d'actions de la page (`MobileSheet`). Absent = la page n'en
  // a pas, et le bouton ne s'affiche pas — voir `PAGES_AVEC_MENU` dans App.tsx.
  onOuvrirActions?: () => void;
  actionsOuvertes?: boolean;
}) {
  // ⚠️ **La barre s'efface pendant la SAISIE.** Fixée en bas, le navigateur la
  // recolle juste au-dessus du clavier quand celui-ci monte : elle remonte donc
  // au milieu de l'écran, par-dessus le formulaire qu'on remplit. Ce n'est pas
  // un défaut à corriger en CSS — c'est le comportement voulu pour une barre
  // d'outils. La seule sortie est de la retirer, ce qui rend au passage une
  // quarantaine de pixels à un écran qui en manque.
  const clavierOuvert = useClavierOuvert();

  // ⚠️ **Démontée, pas masquée.** Un `opacity-0` la laisserait cliquable et
  // dans le parcours de tabulation, derrière le clavier — on quitterait la page
  // en visant une touche.
  if (clavierOuvert) return null;

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
        <Bouton
          onClick={onOuvrirActions}
          aria-expanded={actionsOuvertes}
          aria-label="Filtres et actions de la page"
          fond="plein"
          forme="pilule"
          taille="sm"
          icone={<SlidersHorizontal size={15} />}
          libelle="Options"
          // ⚠️ L'OMBRE est ici justifiée, contrairement à la règle générale : ce
          // bouton FLOTTE réellement au-dessus de la page qui défile dessous.
          // C'est le seul cas où l'élévation dit quelque chose de vrai.
          className="fixed right-3 z-30 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.6)]
                     hoverable:border-ctx lg:hidden"
          // ⚠️ Décalé de la hauteur de la barre d'onglets PLUS l'encoche du bas :
          // sans `env()`, il se pose sur les onglets des iPhone récents.
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)' }}
        />
      )}

      <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-5">
        {onglets.map((o) => {
          // ⚠️ Un BOUTON quand l'onglet ouvre une section, un LIEN quand il mène
          // quelque part. Le premier ne va nulle part : il n'a rien à faire dans
          // l'historique du navigateur ni dans un « ouvrir dans un nouvel
          // onglet ». Même distinction que la barre latérale.
          const Balise = o.ouvre ? 'button' : 'a';
          return (
          <Balise
            key={o.key}
            {...(o.ouvre
              ? { type: 'button' as const, onClick: () => onOuvrirSection?.(o.ouvre!) }
              : { href: o.hash })}
            aria-expanded={o.ouvre ? o.ouvre === sectionOuverte : undefined}
            aria-current={o.actif && !o.ouvre ? 'page' : undefined}
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
          </Balise>
          );
        })}
      </div>
      </nav>
    </>
  );
}
