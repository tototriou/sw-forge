import { BoutonIcone, Champ } from '../../../ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Dispatch, type SetStateAction } from 'react';

export interface PaginationResultatsProps {
  setResultsPage: Dispatch<SetStateAction<number>>;
  resultsPage: number;
  pageDraft: string | null;
  setPageDraft: Dispatch<SetStateAction<string | null>>;
  totalResultsPages: number;
}

export default function PaginationResultats({ setResultsPage, resultsPage, pageDraft, setPageDraft, totalResultsPages }: PaginationResultatsProps) {
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <BoutonIcone
        cadre
        libelle="Page précédente"
        icone={<ChevronLeft size={16} />}
        onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
        disabled={resultsPage <= 1}
        className="h-8 w-8"
      />

      <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-ink-dim">
        <span>Page</span>
        <Champ
          inputMode="numeric"
          value={pageDraft ?? String(resultsPage)}
          aria-label="Aller à la page"
          pleineLargeur={false}
          onChange={(e) => {
            const brut = e.target.value.trim();
            // ⚠️ La chaîne VIDE est un état de brouillon valide (tout
            // sélectionner puis taper) — contrairement à l'ancienne
            // version, ne JAMAIS `return` sans mettre à jour l'état
            // ici, sinon le champ contrôlé revient aussitôt à
            // l'ancienne valeur et le chiffre ne peut plus disparaître.
            if (brut !== '' && !/^\d+$/.test(brut)) return; // frappe invalide ignorée
            setPageDraft(brut);
          }}
          onBlur={() => {
            if (pageDraft !== null && pageDraft !== '') {
              setResultsPage(Math.min(Math.max(Number(pageDraft), 1), totalResultsPages));
            }
            setPageDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-11 px-1 py-1 text-center"
        />
        <span>/ {totalResultsPages}</span>
      </div>

      <BoutonIcone
        cadre
        libelle="Page suivante"
        icone={<ChevronRight size={16} />}
        onClick={() => setResultsPage((p) => Math.min(totalResultsPages, p + 1))}
        disabled={resultsPage >= totalResultsPages}
        className="h-8 w-8"
      />
    </div>
  );
}
