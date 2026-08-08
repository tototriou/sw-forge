import { ChevronLeft, ChevronRight } from 'lucide-react';

// Pagination compacte (Préc. · x/N · Suiv.), partagée par les sous-sections
// Runes & Artéfacts pour borner le DOM (une seule page rendue à la fois).
export default function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center gap-2 font-mono text-[12px] text-ink-dim">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-panel
                   hover:text-ink hover:border-[#4a52a0] transition disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Page précédente"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="tabular-nums">
        {page + 1} / {pageCount}
      </span>
      <button
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        className="flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-panel
                   hover:text-ink hover:border-[#4a52a0] transition disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Page suivante"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
