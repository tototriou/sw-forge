import {
  forwardRef,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Flottant from './Flottant';

// Liste déroulante.
//
// ⚠️ **`appearance-none` + notre propre chevron.** Le contrôle natif dessine sa
// flèche avec les couleurs du SYSTÈME, qui ne suivent ni le thème Forge ni le
// thème Atelier : sur fond sombre, une flèche noire disparaissait. Le chevron
// vient de `--chevron-select` (index.css), donc il suit les tokens comme le
// reste.
//
// ⚠️ **Fermé, c'est le `<select>` natif ; ouverte, la liste est la nôtre.** La
// liste du système (fond blanc, survol bleu) ignorait la charte. On garde le
// `<select>` comme champ fermé — sa boîte, sa valeur, son `onChange`, son
// étiquette et ce qu'en lisent les tests ne changent pas, ni la taille d'aucun
// appelant (31 usages, dont les classes visent le `<select>` lui-même) — et on
// remplace seulement ce qu'il ouvre : à la souris et au clavier, une liste
// dessinée comme celle des principales imposées (`SelecteurMultiple`,
// `forme="surbrillance"`) : survol gris, valeur retenue en braise légère, entrée
// atteinte au clavier cerclée de braise. Les options se lisent dans le DOM du
// `<select>` à l'ouverture (`<option>`, `<optgroup>`, `disabled`, `hidden`,
// `title`) : les appelants ne changent pas. Choisir pose la valeur sur le
// `<select>` et émet son événement `change` : l'`onChange` de l'appelant le
// reçoit comme d'un choix natif.
//
// ⚠️ **Au doigt, la liste reste celle du système.** Un appui tactile ouvre le
// sélecteur natif du téléphone (roue ou feuille), fait pour le pouce ; c'est
// le geste qui décide (`pointerType`), pas la largeur de l'écran. Un navigateur
// sans l'API `popover` garde aussi la liste native.
//
// ⚠️ **La liste passe par la couche supérieure (`popover`)**, posée en
// `position: fixed` sur la boîte du `<select>` : ni un `overflow` d'ancêtre (les
// colonnes qui défilent de l'Optimizer) ni un `z-index` (un dialogue en 70) ne
// la coupent. Elle reste pourtant DANS le DOM à côté du `<select>` : un clic
// dedans reste un clic dans le dialogue ou le panneau qui la porte, et le Tab
// repart du `<select>`. Le dessin de la surface est celui de `Flottant`, tel
// quel.
//
// ⚠️ **`dense` n'est pas « plus petit », c'est une EXEMPTION tactile.** Il
// descend à 32 px là où la règle générale impose 40 px, et ne s'emploie que dans
// une carte déjà serrée — une tuile de 150 px qui porte un portrait, un nom, une
// vitesse et trois icônes de set. Voir `data-carte-dense` dans index.css.

export interface SelecteurProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  taille?: 'md' | 'sm' | 'dense';
  pleineLargeur?: boolean;
  // Surface sur laquelle le sélecteur est posé.
  //
  // ⚠️ Le contrôle doit CONTRASTER avec ce qui le porte, pas avoir une couleur
  // en soi. `panel2` (défaut) le pose dans un panneau, à côté d'un
  // [Champ](Champ.tsx) dont il partage alors le fond — deux fonds différents
  // dans un même formulaire se lisent comme deux natures de contrôle. `panel`
  // le pose sur une carte, déjà en `panel2`, où il s'y confondrait.
  surface?: 'panel' | 'panel2';
  ton?: 'neutre' | 'accent';
  children: ReactNode;
}

const TAILLES = {
  md: 'rounded-lg px-3 py-2 text-sm',
  sm: 'rounded-md px-2 py-1 text-xs',
  dense: 'rounded px-1.5 py-0.5 text-micro',
} as const;

interface OptionLue {
  valeur: string;
  libelle: string;
  disabled: boolean;
  title?: string;
}

interface GroupeLu {
  libelle?: string;
  options: OptionLue[];
}

// La liste telle que le `<select>` la porte : ses options hors groupe, puis
// chaque `<optgroup>` dans l'ordre. Une option `hidden` ne s'affiche pas, comme
// dans la liste native.
function lireOptions(select: HTMLSelectElement): GroupeLu[] {
  const groupes: GroupeLu[] = [];
  const lire = (o: HTMLOptionElement, groupeDesactive: boolean): OptionLue => ({
    valeur: o.value,
    libelle: o.label || o.text,
    disabled: o.disabled || groupeDesactive,
    title: o.title || undefined,
  });
  let libres: GroupeLu | null = null;
  for (const enfant of Array.from(select.children)) {
    if (enfant instanceof HTMLOptGroupElement) {
      libres = null;
      groupes.push({
        libelle: enfant.label,
        options: Array.from(enfant.children)
          .filter((o): o is HTMLOptionElement => o instanceof HTMLOptionElement && !o.hidden)
          .map((o) => lire(o, enfant.disabled)),
      });
    } else if (enfant instanceof HTMLOptionElement && !enfant.hidden) {
      if (!libres) {
        libres = { options: [] };
        groupes.push(libres);
      }
      libres.options.push(lire(enfant, false));
    }
  }
  return groupes;
}

const sansAccents = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const POPOVER_DISPONIBLE = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

// Hauteur d'une entrée (`h-8`) et plafond de la liste avant défilement.
const HAUTEUR_ENTREE = 32;
const HAUTEUR_MAX = 320;

interface Ouverture {
  parClavier: boolean;
  // Première frappe d'une recherche par lettre, quand c'est elle qui ouvre.
  lettre?: string;
}

interface ListeProps {
  select: HTMLSelectElement;
  id: string;
  ouverture: Ouverture;
  onChoisir: (valeur: string) => void;
  // `rendreFocus` : Échap, Tab et le choix rendent le focus au `<select>` ; un
  // clic ailleurs le laisse où il va.
  onFermer: (rendreFocus: boolean) => void;
}

function ListeSelecteur({ select, id, ouverture, onChoisir, onFermer }: ListeProps) {
  // Lu une fois, à l'ouverture : la liste ne change pas sous le pointeur.
  const [groupes] = useState(() => lireOptions(select));
  const [courante] = useState(() => select.value);
  const options = groupes.flatMap((g) => g.options);
  const [actif, setActif] = useState(() => {
    const i = options.findIndex((o) => o.valeur === courante && !o.disabled);
    return i >= 0 ? i : options.findIndex((o) => !o.disabled);
  });
  // L'entrée active ne se cercle qu'au clavier : à la souris, le survol suffit.
  const [parClavier, setParClavier] = useState(ouverture.parClavier);
  const couche = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const recherche = useRef({ texte: '', minuterie: 0 });
  const [boite, setBoite] = useState(() => select.getBoundingClientRect());
  const [cote, setCote] = useState<'gauche' | 'droite'>('gauche');

  const nbGroupesNommes = groupes.filter((g) => g.libelle).length;
  const hauteurVoulue = Math.min(HAUTEUR_MAX, options.length * HAUTEUR_ENTREE + nbGroupesNommes * 24 + 8);
  const espaceDessous = window.innerHeight - boite.bottom - 12;
  const espaceDessus = boite.top - 12;
  const dessus = espaceDessous < hauteurVoulue && espaceDessus > espaceDessous;
  const hauteurMax = Math.max(HAUTEUR_ENTREE + 8, Math.min(HAUTEUR_MAX, dessus ? espaceDessus : espaceDessous));

  // Couche supérieure : montrée au montage, avant la première peinture.
  useLayoutEffect(() => {
    const el = couche.current as (HTMLDivElement & { showPopover?: () => void }) | null;
    el?.showPopover?.();
    liste.current?.focus({ preventScroll: true });
  }, []);

  // Côté horizontal : vers la gauche si la surface sortirait de l'écran à droite.
  useLayoutEffect(() => {
    const r = surface.current?.getBoundingClientRect();
    if (r && cote === 'gauche' && r.right > window.innerWidth - 8) setCote('droite');
  }, [cote, boite]);

  // La surface suit son `<select>` quand la page défile ou change de taille ;
  // un défilement DANS la liste ne la déplace pas.
  useEffect(() => {
    let cadre = 0;
    const suivre = (e: Event) => {
      if (e.target instanceof Node && couche.current?.contains(e.target)) return;
      cancelAnimationFrame(cadre);
      cadre = requestAnimationFrame(() => setBoite(select.getBoundingClientRect()));
    };
    window.addEventListener('scroll', suivre, { capture: true, passive: true });
    window.addEventListener('resize', suivre);
    return () => {
      cancelAnimationFrame(cadre);
      window.removeEventListener('scroll', suivre, { capture: true });
      window.removeEventListener('resize', suivre);
    };
  }, [select]);

  // Un appui hors de la liste et du `<select>` la ferme (le `<select>` gère le
  // sien : il bascule).
  useEffect(() => {
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (couche.current?.contains(cible) || select.contains(cible)) return;
      onFermer(false);
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [select, onFermer]);

  useEffect(() => {
    liste.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  useEffect(() => () => window.clearTimeout(recherche.current.minuterie), []);

  // L'entrée activable suivante dans le sens `pas`, ou l'entrée active au bout.
  const deplacer = (depart: number, pas: number) => {
    let i = depart;
    for (let n = 0; n < options.length; n += 1) {
      i += pas;
      if (i < 0 || i >= options.length) break;
      if (!options[i].disabled) return i;
    }
    return actif;
  };

  const chercher = (lettre: string, depuis: number) => {
    const r = recherche.current;
    window.clearTimeout(r.minuterie);
    r.texte += sansAccents(lettre);
    r.minuterie = window.setTimeout(() => {
      r.texte = '';
    }, 600);
    // Une seule lettre passe à l'entrée suivante qui commence par elle ; un mot
    // tapé d'affilée reste sur l'entrée qui le commence.
    const debut = r.texte.length === 1 ? depuis + 1 : depuis;
    for (let n = 0; n < options.length; n += 1) {
      const i = (((debut + n) % options.length) + options.length) % options.length;
      if (!options[i].disabled && sansAccents(options[i].libelle).startsWith(r.texte)) return i;
    }
    return depuis;
  };

  // La première lettre, quand c'est elle qui a ouvert la liste.
  useEffect(() => {
    if (ouverture.lettre) setActif(chercher(ouverture.lettre, actif));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const auClavier = (e: ReactKeyboardEvent) => {
    const page = Math.max(1, Math.floor(hauteurMax / HAUTEUR_ENTREE) - 1);
    let suivant: number | null = null;
    switch (e.key) {
      case 'ArrowDown':
        if (e.altKey) break;
        suivant = deplacer(actif, 1);
        break;
      case 'ArrowUp':
        if (e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          if (options[actif]) onChoisir(options[actif].valeur);
          return;
        }
        suivant = deplacer(actif, -1);
        break;
      case 'Home':
        suivant = deplacer(-1, 1);
        break;
      case 'End':
        suivant = deplacer(options.length, -1);
        break;
      case 'PageDown':
        suivant = Math.min(options.length - 1, actif + page);
        suivant = options[suivant]?.disabled ? deplacer(suivant, -1) : suivant;
        break;
      case 'PageUp':
        suivant = Math.max(0, actif - page);
        suivant = options[suivant]?.disabled ? deplacer(suivant, 1) : suivant;
        break;
      case 'Enter':
      case ' ':
        // L'espace au milieu d'un mot tapé appartient à la recherche.
        if (e.key === ' ' && recherche.current.texte) {
          suivant = chercher(' ', actif);
          break;
        }
        e.preventDefault();
        e.stopPropagation();
        if (options[actif] && !options[actif].disabled) onChoisir(options[actif].valeur);
        return;
      case 'Escape':
        e.preventDefault();
        // Un dialogue ou un panneau écoute aussi Échap : celui-ci ne ferme que la liste.
        e.stopPropagation();
        onFermer(true);
        return;
      case 'Tab':
        // Ferme sans choisir ; le focus revient au `<select>` AVANT l'action par
        // défaut, qui repart donc de lui (et la boucle de Tab d'un dialogue aussi).
        onFermer(true);
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) suivant = chercher(e.key, actif);
    }
    if (suivant === null) return;
    e.preventDefault();
    e.stopPropagation();
    setParClavier(true);
    if (suivant >= 0) setActif(suivant);
  };

  let index = -1;
  // Le `popover` n'est pas encore dans les types de React 18.
  const attributsCouche = { popover: 'manual' } as Record<string, string>;
  return (
    <div
      ref={couche}
      {...attributsCouche}
      // ⚠️ Posée EXACTEMENT sur la boîte du `<select>` : le `Flottant` s'y ancre
      // comme à un parent `relative`. Transparente aux clics, sauf la surface.
      style={{
        position: 'fixed',
        inset: 'auto',
        left: boite.left,
        top: boite.top,
        width: boite.width,
        height: boite.height,
        margin: 0,
        padding: 0,
        border: 0,
        background: 'transparent',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
      // Un clic, un appui ou un glisser dans la liste ne remonte pas à ce qui
      // porte le `<select>` (une carte cliquable ou déplaçable) : la liste du
      // système ne le faisait pas non plus.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Flottant
        ref={surface}
        rembourrage="aucun"
        largeur="w-max min-w-full max-w-[90vw]"
        ancrage={dessus ? 'dessus' : 'dessous'}
        cote={cote}
        className="pointer-events-auto"
      >
        <div
          ref={liste}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={select.getAttribute('aria-label') ?? (select.title || undefined)}
          aria-activedescendant={actif >= 0 ? `${id}-${actif}` : undefined}
          onKeyDown={auClavier}
          onBlur={(e) => {
            const vers = e.relatedTarget as Node | null;
            if (vers && (couche.current?.contains(vers) || vers === select)) return;
            if (vers) onFermer(false);
          }}
          // ⚠️ Le focus est porté par l'ENTRÉE active (cerclée), pas par le
          // cadre de la liste : un anneau autour de toute la surface doublerait
          // celui de l'entrée.
          className="overflow-y-auto overscroll-contain p-1 focus:outline-none"
          style={{ maxHeight: hauteurMax }}
        >
          {groupes.map((g, gi) => (
            <div key={gi} role={g.libelle ? 'group' : 'presentation'} aria-label={g.libelle || undefined}>
              {g.libelle && (
                <div aria-hidden className="px-2 pb-0.5 pt-1.5 text-micro font-medium text-ink-dim">
                  {g.libelle}
                </div>
              )}
              {g.options.map((o) => {
                index += 1;
                const i = index;
                const choisie = o.valeur === courante;
                return (
                  // ⚠️ Le marqueur des filtres (contour et fond d'accent) sur la
                  // valeur retenue, un contour transparent sur les autres : la
                  // valeur garde sa place, retenue ou non — le dessin des
                  // principales imposées.
                  <div
                    key={`${o.valeur}-${i}`}
                    id={`${id}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={choisie}
                    aria-disabled={o.disabled || undefined}
                    title={o.title}
                    onPointerMove={() => setParClavier(false)}
                    onClick={() => {
                      if (!o.disabled) onChoisir(o.valeur);
                    }}
                    className={`flex h-8 w-full cursor-pointer items-center whitespace-nowrap rounded-md border px-2
                      text-left text-sm text-ink transition ${
                        o.disabled ? 'cursor-not-allowed opacity-40' : ''
                      } ${choisie ? 'border-accent bg-accent-soft' : 'border-transparent hoverable:bg-panel2'} ${
                        parClavier && i === actif ? 'outline outline-1 outline-offset-0 outline-accent' : ''
                      }`}
                  >
                    {o.libelle || ' '}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Flottant>
    </div>
  );
}

const Selecteur = forwardRef<HTMLSelectElement, SelecteurProps>(function Selecteur(
  {
    taille = 'md',
    pleineLargeur = true,
    surface = 'panel2',
    ton = 'neutre',
    className = '',
    children,
    onPointerDown,
    onMouseDown,
    onKeyDown,
    ...reste
  },
  ref,
) {
  const element = useRef<HTMLSelectElement | null>(null);
  const poserRef = useCallback(
    (el: HTMLSelectElement | null) => {
      element.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const [ouverture, setOuverture] = useState<Ouverture | null>(null);
  const dernierPointeur = useRef<string>('mouse');
  const id = useId();

  const fermer = useCallback((rendreFocus: boolean) => {
    setOuverture(null);
    if (rendreFocus) element.current?.focus({ preventScroll: true });
  }, []);

  const choisir = useCallback(
    (valeur: string) => {
      const el = element.current;
      fermer(true);
      if (!el || el.value === valeur) return;
      // Comme un choix natif : la valeur posée, puis l'événement `change`, que
      // l'`onChange` de React reçoit pour un `<select>`. Un `<select>` contrôlé
      // reprend ensuite la valeur de ses props si l'appelant ne la change pas
      // (les listes « Ajouter… » qui reviennent à leur invite).
      el.value = valeur;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [fermer],
  );

  const prendLaMain = () => POPOVER_DISPONIBLE && !reste.disabled && dernierPointeur.current !== 'touch';

  return (
    <>
      <select
        ref={poserRef}
        // ⚠️ Le chevron est peint en fond, d'où le rembourrage droit réservé
        // (`pr-6`) : sans lui, le texte de l'option passait dessous.
        // ⚠️ L'ENCRE suit la surface, et ce n'est pas un raccourci : un sélecteur
        // posé dans un formulaire (`panel2`) montre une VALEUR qu'on vient de
        // choisir — encre pleine. Posé sur une carte (`panel`), il montre un
        // classement au milieu d'autres informations — encre atténuée, sans quoi
        // il pèse plus lourd que le monstre qu'il classe.
        // ⚠️ Ouverte, la liste a le focus : la bordure d'accent du `<select>`
        // dit alors de qui elle sort, comme celle du `SelecteurMultiple`.
        className={`appearance-none border ${ton === 'accent' || ouverture ? 'border-accent' : 'border-border'} ${
          surface === 'panel' ? 'bg-panel text-ink-dim' : 'bg-panel2 text-ink'
        } bg-[image:var(--chevron-select)]
        bg-[length:12px] bg-[right_0.4rem_center] bg-no-repeat pr-6 outline-none
        transition focus:border-accent ${TAILLES[taille]} ${
          pleineLargeur ? 'w-full' : ''
        } ${className}`}
        {...(taille === 'dense' ? { 'data-cible-fine': true } : {})}
        {...(ouverture ? { 'aria-expanded': true, 'aria-controls': id } : {})}
        onPointerDown={(e) => {
          dernierPointeur.current = e.pointerType;
          onPointerDown?.(e);
        }}
        onMouseDown={(e) => {
          onMouseDown?.(e);
          if (e.defaultPrevented || e.button !== 0 || !prendLaMain()) return;
          // Empêche la liste du système (et la mise au point par défaut).
          e.preventDefault();
          if (ouverture) {
            fermer(true);
            return;
          }
          e.currentTarget.focus({ preventScroll: true });
          setOuverture({ parClavier: false });
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || ouverture || !POPOVER_DISPONIBLE || reste.disabled) return;
          const lettre = e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
          // Les touches qui ouvrent (ou, sous Windows, changeaient la valeur sans
          // rien montrer) ouvrent la liste : une flèche ne choisit jamais à
          // l'aveugle — certaines listes AGISSENT à chaque `change` (« Ajouter… »).
          if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'F4'].includes(e.key) || lettre) {
            e.preventDefault();
            setOuverture({ parClavier: true, lettre: lettre ? e.key : undefined });
          }
        }}
        {...reste}
      >
        {children}
      </select>
      {ouverture && element.current && (
        <ListeSelecteur select={element.current} id={id} ouverture={ouverture} onChoisir={choisir} onFermer={fermer} />
      )}
    </>
  );
});

export default Selecteur;
