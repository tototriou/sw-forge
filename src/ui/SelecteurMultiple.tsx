import { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Case from './Case';
import Flottant from './Flottant';

// Liste À CHOIX MULTIPLES : fermée, elle dit ce qui est choisi ; ouverte, une
// case par option, dans un flottant.
//
// ⚠️ **L'axe que `Selecteur` ne couvre pas.** Un `<select multiple>` natif est
// une boîte à défilement toujours ouverte, qui ne se ferme pas sur un résumé et
// demande Ctrl pour cocher deux options ; une rangée de `Pastille` dit bien un
// choix multiple, mais prend une ligne par réglage. Fermée, cette liste tient
// la hauteur d'un `Selecteur` et montre ses choix : elle ne cache pas ce
// qu'elle filtre (voir `Menu`, « Pas de `Deroulant` »).
//
// ⚠️ **Les cases sont des `Case`**, la case à cocher de la librairie : le
// clavier natif (Tab, Espace) et le nom accessible viennent avec elle, et la
// coche ne se redessine pas ici.
//
// ⚠️ **La surface reste dans le DOM, fermée** (`hidden`), comme les entrées du
// `Menu` : un choix ne quitte jamais le DOM selon l'état de l'écran, et c'est ce
// qui laisse les tests de rendu lire chaque option et son état.
//
// ⚠️ **Elle sort du flux** : ouverte, elle flotte sous son déclencheur, rien ne
// bouge dessous (un clic ne déplace jamais ce qu'on vient de cliquer). Échap la
// referme et rend le focus au déclencheur ; un clic dehors ou un focus qui sort
// la referme aussi.
//
// Deux axes de structure, nés du second usage (le set de runes recherché, dont
// le choix est un MULTIENSEMBLE — deux fois le même set — qu'une case par option
// ne sait pas dire) :
//  - `resume` : ce que montre la liste fermée, à la place des libellés choisis
//    (les icônes des sets), avec son texte pour le nom accessible ;
//  - `surface` : ce que porte la surface ouverte, à la place des cases (la
//    grille d'ajout des sets, inchangée).
//
// Un axe de FORME, né des principales imposées du bureau : `forme`
// 'surbrillance' fait de la surface une liste classique — chaque valeur est un
// bouton (`aria-pressed`), la valeur choisie en surbrillance (contour et fond
// d'accent, le marqueur des filtres), sans case. Le geste est le même :
// cliquer une valeur la choisit ou la retire.
//
// Un axe d'OUVERTURE : `ouvert` et `onOuvertChange` la rendent contrôlée par
// l'appelant (le set compact se ferme quand les six emplacements sont pleins).
// Sans eux, la liste gère seule son ouverture.
//
// Un axe de RÉSUMÉ, né des principales du bureau : `resumeEntier` fait montrer
// au champ fermé TOUTES les valeurs choisies, à la ligne entre deux valeurs
// (jamais au milieu d'une), rien de tronqué. Le champ prend la hauteur de ce
// qu'il montre : une ligne pour « Libre », deux quand les choix l'exigent.
// ⚠️ **La surface ouverte ne descend jamais sous le doigt** : elle se pose à
// la hauteur qu'avait le champ À L'OUVERTURE, et y reste tant qu'elle est
// ouverte. Un choix qui fait passer le champ à deux lignes l'allonge SOUS la
// surface, qui ne bouge pas (un clic ne déplace jamais ce qu'on vient de
// cliquer) ; fermée, la liste montre tout. Ce qui suit le champ, lui, descend :
// la règle protège la cible du clic, pas ce qui est dessous (décision de
// l'utilisateur à l'arrêt 4 de la refonte, qui a retiré la hauteur réservée
// pour toutes les options).
//
// ⚠️ **Un focus perdu vers RIEN ne ferme pas la liste.** Un choix qui
// désactive ou retire le bouton qu'on vient de cliquer (un set de 4 rend les
// autres sets de 4 indisponibles) fait tomber le focus sur le document : ce
// n'est pas un départ, la liste reste ouverte et le focus revient au
// déclencheur (Échap et Tab gardent leur sens).

export interface OptionChoixMultiple<V extends string | number> {
  valeur: V;
  libelle: string;
  // Désactivée, jamais retirée : son `title` dit pourquoi.
  disabled?: boolean;
  title?: string;
}

export interface SelecteurMultipleProps<V extends string | number> {
  // Nom du réglage : nom accessible du déclencheur et de la surface.
  libelle: string;
  options?: OptionChoixMultiple<V>[];
  valeurs?: V[];
  // Reçoit les valeurs cochées, dans l'ordre des options.
  onChange?: (valeurs: V[]) => void;
  // Texte de la liste fermée quand rien n'est choisi (« Libre »).
  vide: string;
  resume?: { visuel: ReactNode; texte: string };
  surface?: ReactNode;
  // Forme de la surface ouverte quand l'appelant n'en fournit pas : une case
  // par option (défaut), ou une liste classique à surbrillance.
  forme?: 'cases' | 'surbrillance';
  // Ouverture contrôlée (voir l'en-tête).
  ouvert?: boolean;
  onOuvertChange?: (ouvert: boolean) => void;
  // Champ fermé qui montre tout le résumé, surface fixée à l'ouverture (voir l'en-tête).
  resumeEntier?: boolean;
  taille?: 'md' | 'sm';
  // Largeur de la surface ouverte ; défaut : celle du déclencheur.
  largeurSurface?: string;
  disabled?: boolean;
  title?: string;
}

// Les libellés séparés par « , » ; chacun insécable, la ligne ne se coupe
// qu'entre deux valeurs (« Taux Crit » ne se lit jamais « Taux » / « Crit »).
function ValeursALaLigne({ libelles }: { libelles: string[] }) {
  return libelles.map((l, i) => (
    <span key={l}>
      <span className="whitespace-nowrap">{i < libelles.length - 1 ? `${l},` : l}</span>
      {i < libelles.length - 1 ? ' ' : null}
    </span>
  ));
}

const TAILLES = {
  md: 'rounded-lg px-3 py-2 text-sm',
  sm: 'rounded-md px-2 py-1 text-xs',
} as const;

export default function SelecteurMultiple<V extends string | number>({
  libelle,
  options = [],
  valeurs = [],
  onChange,
  vide,
  resume,
  surface,
  forme = 'cases',
  ouvert: ouvertControle,
  onOuvertChange,
  resumeEntier = false,
  taille = 'md',
  largeurSurface,
  disabled = false,
  title,
}: SelecteurMultipleProps<V>) {
  const [ouvertInterne, setOuvertInterne] = useState(false);
  const ouvert = ouvertControle ?? ouvertInterne;
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  // Le focus est-il dans la liste (déclencheur ou surface) ?
  const focusDedans = useRef(false);
  const id = useId();
  const changer = useRef<(o: boolean) => void>(() => {});
  changer.current = (o: boolean) => {
    if (ouvertControle === undefined) setOuvertInterne(o);
    onOuvertChange?.(o);
  };
  const setOuvert = (o: boolean) => changer.current(o);

  // `resumeEntier` : la hauteur du champ à l'ouverture, où la surface se pose
  // tant qu'elle reste ouverte (voir l'en-tête). Lue au seul changement
  // d'ouverture, jamais quand le champ grandit.
  const [hautOuverture, setHautOuverture] = useState<number | null>(null);
  useLayoutEffect(() => {
    setHautOuverture(ouvert && resumeEntier ? declencheur.current?.offsetHeight ?? null : null);
  }, [ouvert, resumeEntier]);

  // Focus tombé sur le document alors qu'il était dans la liste ouverte :
  // rendu au déclencheur, la liste reste ouverte.
  const rendreLeFocus = () => {
    if (focusDedans.current && (document.activeElement === document.body || document.activeElement === null)) declencheur.current?.focus();
  };
  useEffect(() => {
    if (ouvert) rendreLeFocus();
  });

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) {
        focusDedans.current = false;
        changer.current(false);
      }
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert]);

  const choisies = options.filter((o) => valeurs.includes(o.valeur));
  const texte = resume ? resume.texte : choisies.length > 0 ? choisies.map((o) => o.libelle).join(', ') : vide;

  function basculer(valeur: V) {
    const suivantes = valeurs.includes(valeur) ? valeurs.filter((v) => v !== valeur) : [...valeurs, valeur];
    onChange?.(options.map((o) => o.valeur).filter((v) => suivantes.includes(v)));
  }

  return (
    <div
      ref={racine}
      className="relative min-w-0"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && ouvert) {
          e.preventDefault();
          setOuvert(false);
          declencheur.current?.focus();
        }
      }}
      onFocus={() => {
        focusDedans.current = true;
      }}
      onBlur={(e) => {
        const vers = e.relatedTarget as Node | null;
        if (vers === null) {
          // Vers rien : un bouton cliqué désactivé ou retiré. Pas un départ.
          if (ouvert) requestAnimationFrame(rendreLeFocus);
          return;
        }
        if (racine.current?.contains(vers)) return;
        focusDedans.current = false;
        if (ouvert) setOuvert(false);
      }}
    >
      <button
        ref={declencheur}
        type="button"
        disabled={disabled}
        title={title ?? texte}
        aria-label={`${libelle} : ${texte}`}
        aria-haspopup="true"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert(!ouvert)}
        // ⚠️ Le dessin du `Selecteur` fermé — cadre, fond, chevron peint en fond
        // (`--chevron-select`), rembourrage droit réservé — pour qu'une liste
        // simple et une liste multiple, côte à côte, se lisent comme une même
        // famille de contrôles.
        className={`flex w-full min-w-0 items-center border ${ouvert ? 'border-accent' : 'border-border'} bg-panel2
          bg-[image:var(--chevron-select)] bg-[length:12px] bg-[right_0.4rem_center] bg-no-repeat pr-6 text-left
          outline-none transition focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${TAILLES[taille]}`}
      >
        {resume ? (
          <span className="flex min-w-0 items-center gap-1 overflow-hidden">{resume.visuel}</span>
        ) : resumeEntier ? (
          <span data-resume-entier className={`min-w-0 flex-1 ${choisies.length > 0 ? 'text-ink' : 'text-ink-dim'}`}>
            {choisies.length > 0 ? <ValeursALaLigne libelles={choisies.map((o) => o.libelle)} /> : vide}
          </span>
        ) : (
          <span className={`min-w-0 truncate ${choisies.length > 0 ? 'text-ink' : 'text-ink-dim'}`}>{texte}</span>
        )}
      </button>
      <Flottant
        rembourrage={surface ? 'sm' : 'aucun'}
        largeur={largeurSurface}
        style={hautOuverture != null ? { top: hautOuverture } : undefined}
        role="group"
        aria-label={libelle}
        className={ouvert ? '' : 'hidden'}
      >
        <div id={id} className={surface ? '' : 'flex flex-col gap-px p-1'}>
          {surface ??
            options.map((o) =>
              forme === 'surbrillance' ? (
                // ⚠️ Le marqueur des filtres (contour et fond d'accent) sur la
                // valeur choisie, un contour transparent sur les autres : la
                // valeur garde sa place, choisie ou non.
                <button
                  key={String(o.valeur)}
                  type="button"
                  aria-pressed={valeurs.includes(o.valeur)}
                  disabled={o.disabled}
                  title={o.title}
                  onClick={() => basculer(o.valeur)}
                  className={`flex h-8 w-full items-center rounded-md border px-2 text-left text-sm text-ink transition
                    disabled:cursor-not-allowed disabled:opacity-40 ${
                      valeurs.includes(o.valeur) ? 'border-accent bg-accent-soft' : 'border-transparent hoverable:bg-panel2'
                    }`}
                >
                  {o.libelle}
                </button>
              ) : (
                <Case
                  key={String(o.valeur)}
                  libelle={o.libelle}
                  checked={valeurs.includes(o.valeur)}
                  disabled={o.disabled}
                  title={o.title}
                  onChange={() => basculer(o.valeur)}
                  className="h-8 rounded-md px-2 hoverable:bg-panel2"
                />
              ),
            )}
        </div>
      </Flottant>
    </div>
  );
}
