import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Modale } from '../ui/Dialogs';
import MonsterAvatar from './MonsterAvatar';
import { GroupePalette, EntreePalette } from './palette/recherchePalette';

// PALETTE Ctrl K (refonte graphique, lot 13, décision 29, la maquette) — voir
// docs/02-app/transverse/ § Palette Ctrl K. Une seule recherche pour l'app :
// pages, monstres, actions, en groupes intitulés.
//
// ⚠️ Le CLAVIER est géré ici, pas par `useComboboxNav` : ce hook n'ouvre sa
// liste qu'une fois quelque chose tapé, alors que la palette montre déjà pages
// et actions quand le champ est vide — les flèches doivent y marcher aussi.
// ↑ ↓ parcourent TOUTE la liste, groupes compris ; Entrée ouvre ; Échap ferme.

export default function Palette({
  groupesPour,
  onFermer,
  saisieInitiale = '',
}: {
  // Les résultats d'une saisie — calculés par l'appelant (`resultatsPalette`),
  // qui seul connaît pages, monstres, équipes et actions.
  groupesPour: (saisie: string) => GroupePalette[];
  onFermer: () => void;
  // Pour les tests : ouvrir sur une saisie déjà tapée.
  saisieInitiale?: string;
}) {
  const [saisie, setSaisie] = useState(saisieInitiale);
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);

  const groupes = useMemo(() => groupesPour(saisie), [groupesPour, saisie]);
  const plat = useMemo(() => groupes.flatMap((g) => g.entrees), [groupes]);

  // Nouvelle saisie : la sélection repart du premier résultat.
  useEffect(() => setActif(0), [saisie]);
  useEffect(() => champ.current?.focus(), []);
  // La sélection reste visible quand on la descend au clavier.
  useEffect(() => {
    liste.current?.querySelector<HTMLElement>('[data-actif="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  function ouvrir(e: EntreePalette) {
    onFermer();
    e.faire();
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'ArrowDown' && plat.length) {
      ev.preventDefault();
      setActif((i) => (i + 1) % plat.length);
    } else if (ev.key === 'ArrowUp' && plat.length) {
      ev.preventDefault();
      setActif((i) => (i - 1 + plat.length) % plat.length);
    } else if (ev.key === 'Enter' && plat[actif]) {
      ev.preventDefault();
      ouvrir(plat[actif]);
    }
  }

  let rang = -1;
  return (
    <Modale
      onClose={onFermer}
      labelledBy="palette-titre"
      titre={<span id="palette-titre">Rechercher</span>}
      croix
      largeur="max-w-[640px]"
      padding="p-4"
      bandes="compactes"
    >
      <div className="flex items-center gap-2 rounded-lg border border-border bg-panel2 px-3 py-2 focus-within:border-accent">
        <Search size={16} className="flex-none text-ink-dimmer" aria-hidden />
        <input
          ref={champ}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Rechercher une page, un monstre, une action…"
          aria-label="Rechercher une page, un monstre, une action"
          role="combobox"
          aria-expanded
          aria-controls="palette-liste"
          aria-activedescendant={plat[actif] ? `palette-opt-${actif}` : undefined}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-dimmer"
        />
        <kbd aria-hidden className="flex-none rounded-md border border-border bg-panel px-1.5 font-mono text-micro text-ink-dim">
          Échap
        </kbd>
      </div>

      <div
        ref={liste}
        id="palette-liste"
        role="listbox"
        aria-label="Résultats"
        className="mt-3 flex max-h-[min(60vh,440px)] flex-col gap-3 overflow-y-auto"
      >
        {plat.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <span className="text-sm text-ink">Aucun résultat pour « {saisie.trim()} »</span>
            <span className="text-xs text-ink-dim">Essaie un nom de monstre, de page ou d'action.</span>
          </div>
        ) : (
          groupes.map((g) => (
            <div key={g.titre} className="flex flex-col gap-px">
              <span className="label px-2.5 pb-1">{g.titre}</span>
              {g.entrees.map((e) => {
                rang += 1;
                const i = rang;
                return (
                  <button
                    key={e.cle}
                    id={`palette-opt-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === actif}
                    data-actif={i === actif}
                    onMouseEnter={() => setActif(i)}
                    onClick={() => ouvrir(e)}
                    // Le gabarit d'une entrée du menu (voir SidebarSearch) :
                    // 32 px, icône 16, voile d'encre pour la sélection.
                    className={`flex h-9 w-full flex-none items-center gap-2.5 rounded-lg px-2.5 text-left text-sm
                                transition-colors ${i === actif ? 'bg-ink/10 text-ink' : 'text-ink-dim'}`}
                  >
                    <span className="flex w-5 flex-none items-center justify-center">
                      {e.monstre ? <MonsterAvatar monster={e.monstre} size={20} element={false} /> : e.icone}
                    </span>
                    <span className="min-w-0 truncate">{e.libelle}</span>
                    {e.contexte && <span className="ml-auto flex-none text-micro text-ink-dimmer">{e.contexte}</span>}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </Modale>
  );
}
