import { Tag, ExternalLink } from 'lucide-react';
import { RELEASES, CHANGE_META, ChangeKind, libelleVersion } from '../data/releases';

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
  // ⚠️ Colonne BORNÉE : c'est une liste de textes courts qu'on lit de haut en
  // bas, pas un tableau à parcourir. Étalée sur toute la largeur, chaque entrée
  // devenait une ligne isolée au milieu du vide.
  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] title-gradient mb-2">
        Nouveautés
      </h1>
      <p className="text-ink-dim text-sm leading-relaxed mb-6 max-w-2xl">
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

      {/* ⚠️ **À la SOURIS, une version = une rangée à deux colonnes**
          (refonte graphique, lot 10, la maquette) : à gauche le numéro, son
          statut, sa date et son lien GitHub ; à droite le titre et les
          changements. Plus de carte : un filet sépare les versions, et la
          pastille (« Version actuelle », « Pas encore publiée ») dit laquelle
          tourne. L'ordre du DOM ne change pas.
          ⚠️ **Au doigt aussi, plus de carte** (lot 11d, décision 27, la
          maquette) : le même filet entre les versions ; la ligne numéro ·
          statut · date reste AU-DESSUS du titre, faute de place pour deux
          colonnes. */}
      <div>
        {RELEASES.map((r, i) => (
          <section
            key={r.version ?? 'en-preparation'}
            className="border-t border-border-soft py-5
              lg:grid lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-x-8 lg:py-6"
          >
            <div className="flex items-baseline gap-2.5 flex-wrap mb-1 lg:row-span-3 lg:mb-0 lg:flex-col lg:items-start lg:gap-1.5">
              <h2 className="font-display text-lg tracking-wide flex items-center gap-1.5">
                <Tag size={15} className={i === 0 ? 'text-star' : 'text-ink-dim'} />
                {libelleVersion(r.version)}
              </h2>
              {/* ⚠️ « Version actuelle » désigne celle qui TOURNE. Une version
                  en préparation est en tête de liste sans être déployée : la
                  dire actuelle ferait croire au joueur qu'il l'utilise déjà. */}
              {i === 0 && r.version !== null && (
                <span className="rounded-full bg-star/15 px-2 py-0.5 label text-star">
                  Version actuelle
                </span>
              )}
              {r.version === null && (
                <span className="rounded-full bg-ink-dim/15 px-2 py-0.5 label text-ink-dim">
                  Pas encore publiée
                </span>
              )}
              <span className="font-mono text-micro text-ink-dim">{formatDate(r.date)}</span>
              {/* ⚠️ Le lien n'apparaît QUE si un tag Git correspond. Il était
                  écrit inconditionnellement : la 1.0.0, publiée avant que le
                  dépôt existe, menait à un 404. Un lien mort est pire que pas
                  de lien — voir `tag` dans data/releases.ts. Sans numéro, il
                  n'y a pas d'URL de tag à construire : même masquage. */}
              {r.tag !== false && r.version !== null && (
                <a
                  href={`${REPO}/releases/tag/v${r.version}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto font-mono text-micro text-ink-dim hoverable:text-ink transition lg:ml-0"
                  title={`Release v${r.version} sur GitHub`}
                >
                  GitHub ↗
                </a>
              )}
            </div>

            <p className="text-sm text-ink mb-2 lg:col-start-2 lg:text-base lg:font-semibold">{r.title}</p>

            {r.highlights && r.highlights.length > 0 && (
              <ul className="mb-3 space-y-1 lg:col-start-2">
                {r.highlights.map((h, k) => (
                  <li key={k} className="flex gap-2 text-sm text-ink-dim">
                    <span className="text-star">◆</span>
                    {h}
                  </li>
                ))}
              </ul>
            )}

            <ul className="space-y-1.5 lg:col-start-2">
              {[...r.changes]
                .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
                .map((c, k) => (
                  <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                    <span
                      className={`label ${CHANGE_META[c.kind].color}`}
                    >
                      {CHANGE_META[c.kind].label}
                    </span>
                    <span className="label">
                      {c.scope}
                    </span>
                    {/* ⚠️ `min-w-[min(220px,100%)]` : le minimum force la
                        ligne à passer seule sous les deux étiquettes, mais à
                        220 px fixes il DÉBORDAIT dans une carte paddée sur un
                        écran de 320 px — c'était l'origine d'un défilement
                        latéral de toute la page. */}
                    <span className="min-w-[min(220px,100%)] flex-1 text-ink-dim leading-relaxed">
                      {c.text}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
