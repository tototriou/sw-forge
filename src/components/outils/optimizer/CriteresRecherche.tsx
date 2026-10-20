import { SlidersHorizontal } from 'lucide-react';
import { type ReactNode } from 'react';

export interface CriteresRechercheProps {
  setDeRunes: ReactNode;
  statPrincipaleImposee: ReactNode;
  conditions: ReactNode;
}

// Le titre de la carte, exporté pour la forme de bureau des essentiels
// (`bureau/SetDeRunesCompact.tsx`) : un seul dessin.
export function TitreCriteresRecherche({ className }: { className: string }) {
  return (
    <div className={`${className} flex items-center gap-2`}>
      {/* Curseurs de réglage, colorés (accent) — plus parlant qu'une
          cible générique pour « plusieurs critères ajustables ». */}
      <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-accent/40 bg-accent-soft">
        <SlidersHorizontal size={13} className="text-accent" />
      </div>
      <p className="text-[13.5px] font-bold text-ink">Critères de recherche</p>
    </div>
  );
}

export default function CriteresRecherche({ setDeRunes, statPrincipaleImposee, conditions }: CriteresRechercheProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <TitreCriteresRecherche className="mb-3" />
      {/* Empilés, dans l'ordre du DOM : Set de runes recherché et
          Statistique principale imposée (les deux contraintes qui portent sur
          les runes elles-mêmes), puis Conditions. */}
      <div className="flex flex-col gap-4">
      <div>
    {setDeRunes}

    {/* ⚠️ Trait horizontal entre Set de runes recherché et Statistique
        principale imposée (demande explicite) — `mt-4 border-t pt-4`
        remplace le `space-y-4` qu'avait le conteneur parent (sinon la
        marge automatique ET la bordure s'additionneraient, doublant
        l'écart visuel). */}
    {statPrincipaleImposee}
      </div>

      <div>
    {conditions}

      </div>
      </div>
    </div>
  );
}
