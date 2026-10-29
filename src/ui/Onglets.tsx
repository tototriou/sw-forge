import { KeyboardEvent, ReactNode, useRef } from 'react';

// ONGLETS : de vrais onglets posés côte à côte au-dessus d'un contenu, dont un
// seul est ouvert. Celui qui l'est se FOND dans la ligne de base — son bord
// bas s'efface —, les autres restent derrière elle.
//
// ⚠️ **Pas un `Segmented`.** Les deux font un choix unique, mais `Segmented`
// règle un MODE dans une rangée de réglages ; les onglets disent QUEL CONTENU
// on regarde, et ils en coiffent la page : on lit le titre de l'onglet comme
// celui de ce qui est dessous. Ni des pastilles : elles se lisent cumulables.
//
// ⚠️ **Contour unique, 1 px** (docs/03-developpeur/interface/librairie-ui/contours.md) :
// les onglets ne se touchent pas. Un fin intervalle les sépare, et la ligne de
// base passe SOUS cet intervalle (un segment par intervalle, plus un pour finir
// la ligne) — deux bords accolés feraient un trait de 2 px. Une ligne de base
// tracée par le conteneur, avec l'onglet ouvert qui la recouvre d'une marge
// négative, serait coupée par le défilement horizontal : il rogne tout ce qui
// déborde du cadre, de 1 px compris.
//
// ⚠️ **Au doigt, la rangée défile de côté** plutôt que de passer à la ligne :
// une rangée d'onglets sur deux lignes n'a plus de ligne de base unique, et
// l'on ne sait plus quel onglet coiffe le contenu.
//
// Clavier, comme un `tablist` : ← et → passent à l'onglet disponible voisin,
// Début et Fin au premier et au dernier ; seul l'onglet ouvert est dans
// l'ordre de tabulation.
// La copie invisible réserve la largeur du libellé en gras dans les deux
// états : fermer un onglet ne déplace jamais ceux qui le suivent.

export interface OngletOption<K extends string> {
  cle: K;
  libelle: ReactNode;
  icone?: ReactNode;
  // Toujours affiché, désactivé — jamais retiré : la rangée ne se réorganise
  // pas sous le curseur. `title` dit pourquoi.
  desactive?: boolean;
  title?: string;
}

export interface OngletsProps<K extends string> {
  options: OngletOption<K>[];
  valeur: K;
  onChange: (cle: K) => void;
  // Nom de la rangée pour un lecteur d'écran (« Attribut ou type des
  // artéfacts ») : un `tablist` sans nom n'annonce pas ce qu'il choisit.
  'aria-label': string;
  className?: string;
}

export default function Onglets<K extends string>({
  options,
  valeur,
  onChange,
  'aria-label': ariaLabel,
  className = '',
}: OngletsProps<K>) {
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);

  // L'onglet disponible voisin dans le sens donné, en bouclant.
  function voisin(depuis: number, pas: number): number {
    for (let k = 1; k <= options.length; k++) {
      const i = (depuis + pas * k + options.length) % options.length;
      if (!options[i].desactive) return i;
    }
    return depuis;
  }

  function clavier(e: KeyboardEvent<HTMLDivElement>) {
    const courant = options.findIndex((o) => o.cle === valeur);
    let cible: number | null = null;
    if (e.key === 'ArrowRight') cible = voisin(courant, 1);
    else if (e.key === 'ArrowLeft') cible = voisin(courant, -1);
    else if (e.key === 'Home') cible = voisin(-1, 1);
    else if (e.key === 'End') cible = voisin(options.length, -1);
    if (cible === null) return;
    e.preventDefault();
    onChange(options[cible].cle);
    boutons.current[cible]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={clavier}
      className={`flex items-end overflow-x-auto ${className}`}
    >
      {options.map((o, i) => {
        const ouvert = o.cle === valeur;
        return (
          <span key={o.cle} className="flex flex-none items-end">
            {/* L'intervalle et sa part de ligne de base. Pas avant le premier :
                la ligne commence avec lui. */}
            {i > 0 && <span aria-hidden className="h-px w-1 flex-none self-end bg-border" />}
            <button
              ref={(b) => {
                boutons.current[i] = b;
              }}
              type="button"
              role="tab"
              aria-selected={ouvert}
              tabIndex={ouvert ? 0 : -1}
              disabled={o.desactive}
              title={o.title}
              onClick={() => onChange(o.cle)}
              className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-t-lg border px-3 py-1.5 text-sm transition-colors
                disabled:cursor-not-allowed disabled:opacity-40 ${
                  ouvert
                    ? 'border-border border-b-transparent bg-panel font-semibold text-ink'
                    : 'border-border bg-panel2 text-ink-dim hoverable:text-ink'
                }`}
            >
              {o.icone}
              <span className="inline-grid">
                <span data-libelle-onglet className="col-start-1 row-start-1">{o.libelle}</span>
                <span data-reserve-onglet aria-hidden className="invisible col-start-1 row-start-1 font-semibold">{o.libelle}</span>
              </span>
            </button>
          </span>
        );
      })}
      {/* La fin de la ligne de base, jusqu'au bord. */}
      <span aria-hidden className="h-px min-w-1 flex-1 self-end bg-border" />
    </div>
  );
}
