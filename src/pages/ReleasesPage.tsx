import { Tag, ExternalLink } from 'lucide-react';
import { RELEASES, CHANGE_META, ChangeKind } from '../data/releases';

const REPO = 'https://github.com/tototriou/sw-forge';

// Date ISO → « 9 août 2026 ».
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Ordre d'affichage des changements : nouveautés, puis corrections, puis doc.
const ORDER: ChangeKind[] = ['feat', 'fix', 'docs'];

export default function ReleasesPage() {
  return (
    <div className="pt-6">
      <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] title-gradient mb-2">
        Nouveautés
      </h1>
      <p className="text-ink-dim text-[14px] leading-relaxed mb-6 max-w-2xl">
        Ce qui a changé à chaque version de SW Forge. La version en cours est rappelée en bas de
        chaque page.{' '}
        <a
          href={`${REPO}/releases`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hoverable:text-ink transition"
        >
          Voir les releases sur GitHub <ExternalLink size={12} />
        </a>
      </p>

      <div className="space-y-4">
        {RELEASES.map((r, i) => (
          <section
            key={r.version}
            className={`rounded-2xl border p-4 ${
              // La dernière version est mise en avant : c'est celle qui tourne.
              i === 0 ? 'border-accent bg-panel2/50' : 'border-border bg-panel/50'
            }`}
          >
            <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
              <h2 className="font-display text-[20px] tracking-wide flex items-center gap-1.5">
                <Tag size={15} className={i === 0 ? 'text-star' : 'text-ink-dim'} />v{r.version}
              </h2>
              {i === 0 && (
                <span className="rounded-full bg-star/15 px-2 py-0.5 label text-star">
                  Version actuelle
                </span>
              )}
              <span className="font-mono text-[11px] text-ink-dim">{formatDate(r.date)}</span>
              <a
                href={`${REPO}/releases/tag/v${r.version}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto font-mono text-[11px] text-ink-dim hoverable:text-ink transition"
                title={`Release v${r.version} sur GitHub`}
              >
                GitHub ↗
              </a>
            </div>

            <p className="text-[14px] text-ink mb-2">{r.title}</p>

            {r.highlights && r.highlights.length > 0 && (
              <ul className="mb-3 space-y-1">
                {r.highlights.map((h, k) => (
                  <li key={k} className="flex gap-2 text-[13px] text-ink-dim">
                    <span className="text-star">◆</span>
                    {h}
                  </li>
                ))}
              </ul>
            )}

            <ul className="space-y-1.5">
              {[...r.changes]
                .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
                .map((c, k) => (
                  <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                    <span
                      className={`label ${CHANGE_META[c.kind].color}`}
                    >
                      {CHANGE_META[c.kind].label}
                    </span>
                    <span className="label">
                      {c.scope}
                    </span>
                    <span className="flex-1 min-w-[220px] text-ink-dim leading-relaxed">{c.text}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
