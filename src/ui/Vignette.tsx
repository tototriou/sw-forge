import { forwardRef, ReactNode } from 'react';
import { PRESSION } from './Bouton';

// Case SÉLECTIONNABLE d'une grille : une image (ou un aplat), un libellé
// facultatif dessous, et un état choisi/non choisi. Le choix des monstres d'une
// catégorie, une palette de couleurs, une grille de sets à cocher.
//
// ⚠️ **La TEINTE vient de l'appelant, pas de la librairie.** C'est ce qui la
// distingue d'un bouton à état : la couleur de sélection est ici une DONNÉE (la
// couleur de la catégorie qu'on remplit, la couleur qu'on choisit), pas une
// décision d'apparence. Passer par `teinte` plutôt que par une classe évite que
// chaque grille recalcule à la main son liseré et son fond translucide — c'était
// le cas dans trois écrans, avec trois opacités différentes.
//
// ⚠️ **Le liseré ET le fond, pas l'un ou l'autre.** La règle du marqueur unique
// vaut pour un état d'INTERFACE (voir Pastille) ; ici la teinte est l'identité de
// ce qu'on coche, et le fond seul ne se voit pas sur une case qui porte déjà une
// image. Le liseré la cerne, le fond la teinte.
//
// ⚠️ **`bloque` n'est pas `disabled` au sens visuel.** Une case refusée reste
// AFFICHÉE et très estompée plutôt que cachée : disparue, on la cherche ; grisée,
// on comprend qu'un plafond est atteint — à condition que le `title` le dise.

export interface VignetteProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  choisi: boolean;
  // Couleur de la sélection, en `#rrggbb`. Sans elle, la sélection prend
  // l'accent de l'app.
  teinte?: string;
  contenu: ReactNode;
  libelle?: ReactNode;
  // Largeur de la case. Défaut : celle d'un portrait de monstre plus sa marge.
  largeur?: string;
  // Coin de la case : une coche, un compteur, un badge.
  //
  // ⚠️ À NE PAS afficher au doigt sur une case qui porte un portrait — 12 px
  // posés dans le coin d'une image de 36 en masquent un bout, là où le fond
  // teinté et le liseré disent déjà la sélection. L'appelant décide, parce que
  // lui seul sait ce que la case montre.
  coin?: ReactNode;
  // Renforce le fond de sélection. ⚠️ Sert au TACTILE, où le coin n'est
  // généralement pas rendu : le fond y porte seul l'état et doit se voir sans
  // lui.
  fondAppuye?: boolean;
}

// « #rrggbb » + opacité → rgba(), pour teinter un fond sans écraser le contenu.
function avecAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const Vignette = forwardRef<HTMLButtonElement, VignetteProps>(function Vignette(
  {
    choisi,
    teinte,
    contenu,
    libelle,
    largeur = 'w-[72px]',
    coin,
    fondAppuye = false,
    disabled,
    className = '',
    type = 'button',
    ...reste
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={choisi}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition
        ${largeur} ${PRESSION} ${
          disabled
            ? 'cursor-not-allowed opacity-25'
            : choisi
              ? ''
              : 'opacity-70 hoverable:bg-panel2 hoverable:opacity-100'
        } ${!teinte && choisi ? 'bg-accent-soft ring-[1.5px] ring-accent' : ''} ${className}`}
      style={
        teinte && choisi
          ? {
              boxShadow: `0 0 0 1.5px ${teinte}`,
              backgroundColor: avecAlpha(teinte, fondAppuye ? 0.28 : 0.2),
            }
          : undefined
      }
      {...reste}
    >
      {contenu}
      {libelle != null && (
        <span className="w-full truncate text-center text-micro leading-tight text-ink-dim">
          {libelle}
        </span>
      )}
      {coin}
    </button>
  );
});

export default Vignette;
