import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import Bouton from './Bouton';

// Hauteur des boutons posés dans un EN-TÊTE d'écran, « ⋯ » compris : 36 px.
// Exportée pour que les boutons voisins (« Exporter » de la RTA) s'y alignent
// sans recopier la valeur.
export const HAUTEUR_EN_TETE = 'h-9';
import Flottant from './Flottant';

// MENU D'ACTIONS : un bouton « ⋯ » qui ouvre, sous lui, une liste d'actions.
// Refonte graphique, lot 6 (RTA, décision 13) : les actions secondaires d'un
// écran y rejoignent leurs pareilles au lieu de s'aligner en rangées de
// boutons qui repoussaient le contenu.
//
// ⚠️ **Monté dans la librairie à son PREMIER usage**, contre la règle du
// deuxième (spec/shared/librairie-ui.md) : l'écrire dans l'écran aurait été un
// contrôle MAISON, ce que « rien de custom » interdit, et les maquettes en
// posent un dans plusieurs écrans. Justifié dans la spec.
//
// ⚠️ **Les entrées restent dans le DOM, menu fermé** (`hidden`). Un bouton ne
// quitte jamais le DOM selon l'état de l'écran (spec/shared/design.md) : fermé,
// le menu est masqué, pas vidé. C'est aussi ce qui laisse les tests de rendu
// retrouver chaque action, son état désactivé et sa raison.
//
// ⚠️ **Une entrée destructrice se sépare** (`danger`) : filet au-dessus, texte
// `bad`. Un geste qui perd quelque chose ne se range pas au contact de celui
// qu'on presse en boucle.
//
// Clavier : flèches haut / bas entre les entrées actives, Échap referme et
// rend le focus au bouton, Tab referme. C'est ce que promet `role="menu"`.

export interface ElementMenu {
  cle: string;
  libelle: ReactNode;
  icone?: ReactNode;
  onClick: () => void;
  // ⚠️ Désactivé, jamais retiré : l'entrée reste lisible, et son `title` dit
  // pourquoi.
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
  // Action qui perd quelque chose : séparée des autres, en `bad`.
  danger?: boolean;
  // Bouton À DEUX ÉTATS (« Vérifier mes speed ») : enclenché ou non. En bouton,
  // il porte `aria-pressed` et le fond d'accent ; dans le menu, il devient une
  // entrée à cocher (`menuitemcheckbox`).
  actif?: boolean;
  // L'action PRINCIPALE de l'écran (décision 4 : un seul bouton plein par
  // écran). Ne vaut qu'en bouton : une action principale ne se range pas dans
  // un menu — la mettre dans les `toujours` d'une BarreActions.
  principal?: boolean;
}

export interface MenuProps {
  // Nom du bouton qui ouvre le menu (aria-label et infobulle).
  libelle: string;
  elements: ElementMenu[];
  // Largeur de la liste. Défaut : 15 rem, la maquette.
  largeur?: string;
}

export default function Menu({ libelle, elements, largeur = 'w-60' }: MenuProps) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const id = useId();

  const entrees = () =>
    [
      ...(liste.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)'
      ) ?? []),
    ];

  // Ouvert : le focus va à la première entrée active ; un clic ailleurs referme.
  useEffect(() => {
    if (!ouvert) return;
    entrees()[0]?.focus();
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert]);

  function fermer(rendreFocus: boolean) {
    setOuvert(false);
    if (rendreFocus) declencheur.current?.focus();
  }

  function clavier(e: React.KeyboardEvent) {
    const liste = entrees();
    const i = liste.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const pas = e.key === 'ArrowDown' ? 1 : -1;
      liste[(i + pas + liste.length) % liste.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      liste[e.key === 'Home' ? 0 : liste.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      fermer(true);
    } else if (e.key === 'Tab') {
      fermer(false);
    }
  }

  const normaux = elements.filter((el) => !el.danger);
  const destructeurs = elements.filter((el) => el.danger);

  return (
    <div ref={racine} className="relative flex-none">
      {/* ⚠️ **La HAUTEUR des boutons d'en-tête (36 px, `HAUTEUR_EN_TETE`)**, pas
          celle d'un `BoutonIcone` (28 px) : le « ⋯ » se pose à côté des
          boutons d'action d'un en-tête (« Exporter » dans la RTA), et deux
          hauteurs côte à côte se lisaient comme deux familles de boutons —
          relevé par Thomas. Un `Bouton` carré dimensionné ici, et non un
          `BoutonIcone` dont on écraserait le `h-7` : deux hauteurs dans la
          même classe, c'est l'ordre de la feuille de style qui trancherait. */}
      <Bouton
        ref={declencheur}
        taille="carre"
        aria-label={libelle}
        title={libelle}
        icone={<MoreHorizontal size={16} />}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert((o) => !o)}
        className={`${HAUTEUR_EN_TETE} w-9`}
      />
      {/* ⚠️ Toujours rendu, masqué fermé : voir l'en-tête. */}
      <Flottant
        ref={liste}
        rembourrage="aucun"
        largeur={largeur}
        cote="droite"
        role="menu"
        aria-label={libelle}
        className={`p-1 ${ouvert ? '' : 'hidden'}`}
      >
        <div id={id} onKeyDown={clavier} className="flex flex-col gap-px">
          {normaux.map((el) => (
            <Entree key={el.cle} el={el} fermer={() => fermer(false)} />
          ))}
          {destructeurs.length > 0 && normaux.length > 0 && (
            <div aria-hidden className="-mx-1 my-1 h-px bg-border-soft" />
          )}
          {destructeurs.map((el) => (
            <Entree key={el.cle} el={el} fermer={() => fermer(false)} />
          ))}
        </div>
      </Flottant>
    </div>
  );
}

function Entree({ el, fermer }: { el: ElementMenu; fermer: () => void }) {
  return (
    <button
      type="button"
      role={el.actif === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={el.actif === undefined ? undefined : el.actif}
      disabled={el.disabled}
      title={el.title}
      aria-label={el['aria-label']}
      onClick={() => {
        fermer();
        el.onClick();
      }}
      // ⚠️ `data-cible-fine` : dans une liste, 32 px suffisent — la règle
      // tactile de 40 px (index.css) étirerait chaque entrée et la liste
      // doublerait de hauteur. Le menu est un contrôle de bureau.
      data-cible-fine
      className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm transition-colors
        disabled:cursor-not-allowed disabled:opacity-50 ${
          el.danger
            ? 'text-bad hoverable:enabled:bg-bad/10 focus-visible:bg-bad/10'
            : 'text-ink hoverable:enabled:bg-panel2 focus-visible:bg-panel2'
        } focus-visible:outline-none`}
    >
      {el.icone && (
        <span className={`flex flex-none items-center ${el.danger ? '' : 'text-ink-dim'}`}>{el.icone}</span>
      )}
      <span className="min-w-0 truncate">{el.libelle}</span>
    </button>
  );
}
