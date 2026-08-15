import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Pagination compacte, partagée par TOUTES les listes paginées (runes,
// artéfacts, optimisation) pour borner le DOM — une seule page rendue à la fois.
//
// Trois éléments : page précédente, **champ de saisie de la page**, page
// suivante. Les flèches sont de simples icônes ; c'est le champ qui compte.
//
// ⚠️ Avec 30 pages, avancer d'une flèche à la fois est intenable. Le champ
// permet d'aller **directement** où l'on veut, ce qu'aucune liste de numéros ne
// ferait tenir sur une ligne à ce volume.
export default function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}) {
  // Saisie en cours, séparée de la page réelle : on doit pouvoir vider le champ
  // ou taper « 12 » sans sauter à la page 1 au premier chiffre.
  const [draft, setDraft] = useState(String(page + 1));

  // Resynchronisation quand la page change ailleurs (filtre, tri, flèches).
  useEffect(() => setDraft(String(page + 1)), [page]);

  if (pageCount <= 1) return null;

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || draft.trim() === '') return setDraft(String(page + 1));
    const cible = Math.min(pageCount - 1, Math.max(0, Math.round(n) - 1));
    // ⚠️ Le brouillon est REMIS EN FORME ici, et pas seulement par l'effet de
    // resynchronisation : celui-ci ne se déclenche que si la page CHANGE. Taper
    // « 007 » en étant déjà page 7 laissait donc « 007 » affiché. Idem pour une
    // valeur hors bornes, qu'on veut voir ramenée à ce qu'elle vaut vraiment.
    setDraft(String(cible + 1));
    onChange(cible);
  };

  const arrow =
    'flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-panel ' +
    'hoverable:text-ink hoverable:border-accent transition disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-1.5 font-mono text-[12px] text-ink-dim">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className={arrow}
        aria-label="Page précédente"
        title="Page précédente"
      >
        <ChevronLeft size={15} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (v === '' || /^\d+$/.test(v)) setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(String(page + 1));
        }}
        onBlur={commit}
        aria-label="Aller à la page"
        title="Aller à la page"
        className="w-9 h-7 rounded-lg border border-border bg-panel text-center tabular-nums text-ink
                   outline-none transition focus:border-accent"
      />
      <span className="tabular-nums">/ {pageCount}</span>

      <button
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        className={arrow}
        aria-label="Page suivante"
        title="Page suivante"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
