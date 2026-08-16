import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { useComboboxNav } from '../hooks/useComboboxNav';

// Recherche dans la NAVIGATION, en tête de la barre latérale.
//
// ⚠️ **Elle ne cherche QUE des destinations** — pages et sous-sections. Pas les
// monstres, pas les runes : chercher un monstre est le rôle du Bestiaire et de
// la box, qui ont leurs filtres et leur grille. Un champ qui répondrait aux deux
// obligerait à trier du regard deux natures de résultats, et « Runes » se
// noierait sous les noms de monstres contenant ces lettres.
//
// ⚠️ Elle existe parce que la navigation compte **quinze destinations** une fois
// les sous-sections dépliées, réparties sur deux niveaux. Atteindre
// « Recommandations » demande d'ouvrir le Siège d'abord ; ici, trois lettres
// suffisent.
//
// ⚠️ La navigation au clavier vient de `useComboboxNav`, comme toutes les barres
// de l'app — voir spec/shared/recherche-clavier.md. Chaque barre avait la
// sienne, et toutes la même faute : Entrée agissait sur « le premier résultat »
// sans que rien à l'écran ne dise lequel.

export interface CibleNav {
  key: string;
  label: string;
  hash: string;
  icon: ReactNode;
  // Section d'appartenance, affichée à droite : « Siège » pour « Défense ».
  // ⚠️ Sans elle, « Offense » et « Défense » n'ont pas de contexte — et deux
  // sous-sections d'écrans différents peuvent porter des noms proches.
  contexte?: string;
}

// Comparaison INSENSIBLE aux accents et à la casse : on tape « arene » pour
// « Arène », « recos » pour « Recommandations ». Sans ça, la moitié des pages
// françaises de l'app étaient introuvables au clavier.
function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export default function SidebarSearch({
  cibles,
  retractee,
  onDeplier,
}: {
  // TOUTES les destinations, sous-sections comprises — c'est ce qui fait
  // l'intérêt du champ : atteindre « Recommandations » sans ouvrir le Siège.
  cibles: CibleNav[];
  retractee: boolean;
  // ⚠️ Repliée, il n'y a AUCUN champ à focaliser : le bouton doit d'abord
  // déplier la barre. Sans ça, cliquer la loupe ne faisait rien du tout.
  onDeplier: () => void;
}) {
  const [query, setQuery] = useState('');
  // Vrai le temps d'un dépliage demandé par ⌘K ou par la loupe : le champ
  // n'existe pas encore au moment du geste, il prendra le focus au rendu où il
  // apparaît.
  const [focusAuMontage, setFocusAuMontage] = useState(false);

  const resultats = useMemo(() => {
    const q = normaliser(query.trim());
    if (!q) return [];
    return cibles.filter(
      (c) => normaliser(c.label).includes(q) || normaliser(c.contexte ?? '').includes(q)
    );
  }, [query, cibles]);

  const nav = useComboboxNav<CibleNav>({
    results: resultats,
    query,
    setQuery,
    idBase: 'nav-search',
    onValider: (c) => {
      window.location.hash = c.hash;
    },
  });

  // ⚠️ Ctrl/⌘ + K depuis n'importe quel écran. C'est le raccourci qu'attendent
  // les gens qui viennent d'un éditeur ou d'un outil de développement, et il
  // évite d'aller chercher le champ à la souris.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Repliée, le champ n'est pas monté : on déplie, et l'effet ci-dessous
        // lui donnera le focus au rendu suivant.
        if (retractee) {
          setFocusAuMontage(true);
          onDeplier();
        } else {
          nav.inputProps.ref.current?.focus();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav.inputProps.ref, retractee, onDeplier]);

  // Le champ vient d'apparaître à la suite d'un ⌘K ou d'un clic sur la loupe :
  // il prend le focus, sinon le geste n'aurait servi qu'à déplier.
  useEffect(() => {
    if (!retractee && focusAuMontage) {
      nav.inputProps.ref.current?.focus();
      setFocusAuMontage(false);
    }
  }, [retractee, focusAuMontage, nav.inputProps.ref]);

  // Repliée, un champ de saisie n'a pas la place d'exister : la loupe DÉPLIE la
  // barre, et le champ prend le focus une fois monté.
  if (retractee) {
    return (
      <button
        type="button"
        onClick={() => {
          setFocusAuMontage(true);
          onDeplier();
        }}
        title="Rechercher une page (⌘K)"
        aria-label="Rechercher une page"
        className="mx-auto mb-1 flex aspect-square h-8 w-8 items-center justify-center rounded-md
                   text-ink-dim transition-colors hoverable:bg-panel2 hoverable:text-ink"
      >
        <Search size={17} />
      </button>
    );
  }

  return (
    <div className="relative px-2.5 pb-2">
      <div
        className="flex items-center gap-2 rounded-md border border-border bg-panel2 px-2.5
                   py-1.5 transition-colors focus-within:border-ctx"
      >
        <Search size={15} className="flex-none text-ink-dimmer" />
        <input
          {...nav.inputProps}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Aller à…"
          aria-label="Rechercher une page"
          title="Rechercher une page (⌘K)"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none
                     placeholder:text-ink-dimmer"
        />
        {/* ⚠️ Un CHEVRON VERS LA DROITE, pas le badge « ⌘K ». Le badge
            annonçait un raccourci — une information qu'on lit une fois puis
            qu'on n'utilise plus, alors qu'elle occupait le champ en permanence.
            ⚠️ Vers la DROITE et non vers le bas : ce champ mène à une PAGE,
            il n'ouvre pas un panneau. C'est le même chevron que les entrées de
            navigation à sous-niveau, et il veut dire la même chose — « ça
            emmène ailleurs ».
            Le raccourci existe toujours : il est dans le `title` du champ. */}
        <ChevronRight
          size={14}
          aria-hidden
          className={`flex-none transition-all ${
            nav.open ? 'translate-x-0.5 text-ctx' : 'text-ink-dimmer'
          }`}
        />
      </div>

      {nav.open && (
        <div
          {...nav.listProps}
          // ⚠️ `absolute` : la liste se pose PAR-DESSUS la navigation, elle ne
          // la pousse pas vers le bas. Une liste qui décale les neuf sections à
          // chaque frappe rend la barre illisible.
          className="absolute inset-x-2.5 top-full z-40 mt-1 overflow-hidden rounded-lg border
                     border-border bg-panel shadow-glow shadow-black/40"
        >
          {resultats.length === 0 ? (
            <p className="px-3 py-2.5 text-[12.5px] text-ink-dim">Aucune page</p>
          ) : (
            resultats.map((c, i) => (
              <a
                key={c.key}
                href={c.hash}
                {...nav.optionProps(i)}
                // Garde le focus au champ : sans ça, le `blur` ferme la liste
                // avant que le clic ne l'atteigne.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => nav.reinitialiser()}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px]
                            transition-colors ${
                              i === nav.actif ? 'bg-ctx-soft text-ink' : 'text-ink-dim'
                            }`}
              >
                <span className="flex-none">{c.icon}</span>
                <span className="truncate">{c.label}</span>
                {c.contexte && (
                  <span className="ml-auto flex-none text-micro text-ink-dimmer">
                    {c.contexte}
                  </span>
                )}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
