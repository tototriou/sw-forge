import { memo, useMemo } from 'react';
import { Search, Copy, Star } from 'lucide-react';
import GameIcon from '../components/GameIcon';
import { BoxItem } from '../lib/applyAccount';
import { ELEMENTS, ElementKey, Monster, RuneDetail, ArtifactDetail, CraftLine } from '../types';
import { LoadState } from '../hooks/useMonsters';
import ElementIcon from '../components/ElementIcon';
import { ELEMENT_FILTER_STYLES } from '../components/elementStyles';
import RunesSection from '../components/account/RunesSection';
import ArtifactsSection from '../components/account/ArtifactsSection';
import { useStickyState } from '../hooks/useStickyState';
import Segmented from '../components/Segmented';
import { MonsterSortMode, comparateurMonstres } from '../lib/monsterSort';

type Sub = 'monstres' | 'runes' | 'artefacts';

interface Props {
  sub: Sub; // sous-section pilotée par le dropdown de nav (« Mon compte »)
  box: BoxItem[];
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  crafts: CraftLine[];
  loadState: LoadState;
  // Relecture du compte conservé en cours : on n'annonce pas « aucune donnée »
  // tant qu'on n'a pas fini de regarder.
  hydrating?: boolean;
}

// Styles de chips d'élément (repris de FilterBar pour rester cohérent).

const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};
const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Un monstre unique de la box + son nombre d'exemplaires possédés.
interface BoxEntry {
  monster: Monster;
  count: number;
}

// Une carte de la box : portrait + nom, avec une bulle ×N si doublons.
const BoxCard = memo(function BoxCard({ entry }: { entry: BoxEntry }) {
  const m = entry.monster;
  return (
    <div className="relative rounded-xl border border-border bg-panel px-2 pt-3 pb-2.5 text-center">
      <div className="relative w-[64px] mx-auto mb-1.5">
        <div className={`hex-frame w-[64px] h-[64px] p-[2px] bg-gradient-to-br ${GRADIENT[m.element]}`}>
          <div className="hex-frame w-full h-full bg-panel2 flex items-center justify-center overflow-hidden">
            {m.image ? (
              <img src={m.image} alt={m.name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <span className={`font-display font-bold text-lg ${TEXT[m.element]}`}>
                {initials(m.name)}
              </span>
            )}
          </div>
        </div>
        <ElementIcon
          element={m.element}
          size={18}
          className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        />
        {entry.count > 1 && (
          <span
            className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center
                       rounded-full bg-accent-soft border border-accent text-ink font-mono text-[11px] font-bold
                       shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            title={`${entry.count} exemplaires`}
          >
            ×{entry.count}
          </span>
        )}
      </div>
      <div className="text-[12px] font-semibold leading-tight line-clamp-2">{m.name}</div>
    </div>
  );
});

// Sous-section « Box de monstres » (tous les 6★, dédupliqués, filtrables).
function MonsterBoxSection({ box }: { box: BoxItem[] }) {
  const [query, setQuery] = useStickyState('box.query', '');
  const [activeElements, setActiveElements] = useStickyState<Set<ElementKey>>('box.elements', new Set());
  const [activeStars, setActiveStars] = useStickyState<Set<number>>('box.stars', new Set());
  const [dupesOnly, setDupesOnly] = useStickyState('box.dupes', false);
  // ⚠️ Défaut : l'ordre du JEU. C'est celui qu'on a en tête en parcourant sa
  // collection ; l'alphabétique sert à retrouver UN monstre dont on connaît le
  // nom, ce qui est déjà le rôle du champ de recherche juste à côté.
  const [sortMode, setSortMode] = useStickyState<MonsterSortMode>('box.sort', 'jeu');
  const [secondOnly, setSecondOnly] = useStickyState('box.second', false);

  function toggleElement(k: ElementKey) {
    setActiveElements((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }
  function toggleStar(n: number) {
    setActiveStars((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  // Dédup par monstre (com2usId identique = même monstre) + comptage des
  // exemplaires, puis tri selon le mode choisi (voir lib/monsterSort.ts).
  const entries = useMemo(() => {
    const byMonster = new Map<string, BoxEntry>();
    for (const it of box) {
      const id = String(it.monster.id);
      const e = byMonster.get(id);
      if (e) e.count += 1;
      else byMonster.set(id, { monster: it.monster, count: 1 });
    }
    const cmp = comparateurMonstres(sortMode);
    return Array.from(byMonster.values()).sort((a, b) => cmp(a.monster, b.monster));
  }, [box, sortMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q && !e.monster.name.toLowerCase().includes(q)) return false;
      if (activeElements.size && !activeElements.has(e.monster.element)) return false;
      if (activeStars.size && !(e.monster.naturalStars != null && activeStars.has(e.monster.naturalStars)))
        return false;
      if (dupesOnly && e.count < 2) return false;
      if (secondOnly && !e.monster.secondAwaken) return false;
      return true;
    });
  }, [entries, query, activeElements, activeStars, dupesOnly, secondOnly]);

  return (
    <div>
      <p className="font-mono text-ink-dim text-xs mb-4">
        {entries.length} monstre{entries.length > 1 ? 's' : ''} différent{entries.length > 1 ? 's' : ''}
        {box.length !== entries.length && ` · ${box.length} au total`} · 6★
      </p>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un monstre…"
              className="w-full bg-panel border border-border rounded-lg pl-8 pr-3 py-1.5 text-[13px]
                         text-ink outline-none focus:border-accent"
            />
          </div>

          {/* ⚠️ Un contrôle à CRAN (`Segmented`) et non une pastille : les deux
              ordres s'excluent. Et il est posé à côté de la RECHERCHE, pas dans
              la rangée de filtres en dessous — trier n'est pas filtrer, le
              mêler aux pastilles le ferait lire comme un critère de plus.
              ⚠️ Les libellés disent ce qui varie — la date ou le nom — et NON
              « ordre du jeu » : les monstres sont groupés par élément dans les
              deux cas, donc les deux sont « l'ordre du jeu ». */}
          <Segmented
            value={sortMode}
            onChange={setSortMode}
            options={[
              {
                key: 'jeu' as const,
                label: 'Sortie',
                hint: 'Par élément, puis les 2A d’abord et les familles par date de sortie',
              },
              {
                key: 'alpha' as const,
                label: 'A → Z',
                hint: 'Par élément, puis par nom',
              },
            ]}
          />
        </div>

        {/* Filtre élément */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mr-1">Élément</span>
          {ELEMENTS.filter((el) => el.key !== 'unknown').map((el) => {
            const active = activeElements.has(el.key);
            return (
              <button
                key={el.key}
                data-active={active}
                onClick={() => toggleElement(el.key)}
                // L'opacité est le marqueur, sans ombre — voir design.md.
                className={`flex items-center gap-1.5 rounded-full border bg-panel px-3 py-1 text-[12.5px] font-semibold
                  transition select-none ${ELEMENT_FILTER_STYLES[el.key]}
                  ${active ? '' : 'opacity-70 hoverable:opacity-100'}`}
              >
                <ElementIcon element={el.key} size={15} />
                {el.label}
              </button>
            );
          })}
        </div>

        {/* Filtre rareté naturelle + doublons + 2A.
            ⚠️ **Un seul style actif pour toute la rangée** — le jaune des
            étoiles. Chaque bouton avait le sien (bleu-violet pour Doublons,
            doré sombre pour 2A) : trois surbrillances différentes dans une même
            rangée se lisent comme trois natures de filtre différentes, alors
            qu'ils font tous la même chose. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mr-1">Nat</span>
          {[5, 4, 3, 2].map((s) => {
            const active = activeStars.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStar(s)}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-mono font-semibold transition select-none
                  ${
                    active
                      ? 'bg-gradient-to-br from-star to-yellow-200 text-bg border-star'
                      : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
                  }`}
              >
                {s}★
              </button>
            );
          })}
          <button
            onClick={() => setDupesOnly((v) => !v)}
            className={`ml-1 flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                dupesOnly
                  ? 'bg-gradient-to-br from-star to-yellow-200 text-bg border-star'
                  : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
              }`}
          >
            <Copy size={13} /> Doublons
          </button>
          <button
            onClick={() => setSecondOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                secondOnly
                  ? 'bg-gradient-to-br from-star to-yellow-200 text-bg border-star'
                  : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
              }`}
            title="Monstres à second éveil (double éveil)"
          >
            <Star size={13} /> 2A
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-ink-dim text-[13px]">Aucun monstre ne correspond aux filtres.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 items-start">
          {filtered.map((e) => (
            <BoxCard key={e.monster.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountPage({ sub, box, runes, artifacts, crafts, loadState, hydrating }: Props) {
  const empty = box.length === 0 && runes.length === 0 && artifacts.length === 0;

  if (empty && hydrating) {
    return (
      <div className="mt-10 flex flex-col items-center text-center text-ink-dim">
        <div className="mb-3 flex items-center gap-3 opacity-40">
          <GameIcon name="monster" size={34} />
          <GameIcon name="rune" size={34} />
          <GameIcon name="artifact" size={34} />
        </div>
        <p className="text-[13px]">Chargement de ton compte…</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="mt-10 flex flex-col items-center text-center text-ink-dim">
        {/* Les trois icônes du jeu : l'écran vide annonce ce qu'on va y trouver. */}
        <div className="mb-3 flex items-center gap-3 opacity-70">
          <GameIcon name="monster" size={34} />
          <GameIcon name="rune" size={34} />
          <GameIcon name="artifact" size={34} />
        </div>
        <p className="text-[15px] font-semibold text-ink">Aucune donnée de compte chargée</p>
        <p className="mt-1 text-[13px] max-w-sm">
          Importe ton compte (bouton en haut à droite) pour afficher tes monstres 6★, tes runes et
          tes artéfacts. Active « Garder mon compte » dans le menu ⚙ pour ne pas avoir à le
          redéposer à chaque visite.
        </p>
        {loadState === 'loading' && <p className="mt-3 text-[12px]">Chargement des monstres…</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {sub === 'monstres' && <MonsterBoxSection box={box} />}
      {sub === 'runes' && <RunesSection runes={runes} crafts={crafts} />}
      {sub === 'artefacts' && <ArtifactsSection artifacts={artifacts} />}
    </div>
  );
}
