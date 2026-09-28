import { ReactNode } from 'react';
import { Search } from 'lucide-react';

// Recherche dans la NAVIGATION, en tête de la barre latérale.
//
// ⚠️ **Depuis le lot 13 (décision 29), ce champ OUVRE LA PALETTE** Ctrl K
// (`Palette.tsx`), qui cherche pages, monstres et actions en groupes
// intitulés. Il n'existe qu'UNE recherche : le contrat du lot interdisait d'en
// poser une seconde à côté de celle-ci. Le champ garde son aspect (« Aller
// à… », le raccourci Ctrl K) et son nom accessible ; ses résultats et le
// raccourci vivent désormais dans la palette et dans `App.tsx`.
//
// ⚠️ Elle cherchait QUE des destinations — « pas les monstres : un champ
// répondant aux deux obligerait à trier du regard deux natures de résultats ».
// La palette y répond par ses groupes : les natures sont séparées, pas mêlées.
// Les pages y sont les mêmes, dérivées des mêmes constantes (`CibleNav`).

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

export default function SidebarSearch({
  retractee,
  onOuvrir,
}: {
  retractee: boolean;
  // Ouvre la palette. ⚠️ Repliée, la barre n'a pas la place d'un champ : la
  // loupe ouvre la palette directement, sans déplier la barre.
  onOuvrir: () => void;
}) {
  if (retractee) {
    return (
      <button
        type="button"
        onClick={onOuvrir}
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
    <div className="relative flex-none px-3">
      <button
        type="button"
        onClick={onOuvrir}
        aria-label="Rechercher une page"
        title="Rechercher une page (⌘K)"
        className="flex w-full items-center gap-2 rounded-lg border border-border-soft bg-panel py-1.5 pl-2.5
                   pr-1.5 text-left transition-colors hoverable:border-border"
      >
        <Search size={16} className="flex-none text-ink-dimmer" />
        <span className="min-w-0 flex-1 truncate text-sm text-ink-dimmer">Aller à…</span>
        {/* Le raccourci, affiché comme dans la maquette de la refonte
            graphique (lot 4). */}
        <kbd
          aria-hidden
          className="flex-none rounded-md border border-border bg-panel2 px-1.5 font-mono text-micro
                     text-ink-dim"
        >
          Ctrl K
        </kbd>
      </button>
    </div>
  );
}
