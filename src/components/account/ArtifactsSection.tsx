import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ARTIFACT_KINDS, ArtifactDetail, ElementKey } from '../../types';
import { formatArtifactMain, RARITY_META } from '../../lib/effects';
import ArtifactIcon, { ArtifactGlyph } from '../ArtifactIcon';
import ElementIcon from '../ElementIcon';
import Segmented from '../Segmented';
import { ELEMENT_FILTER_STYLES } from '../elementStyles';
import { ArtifactDetailBox } from '../MonsterGear';
import Pager from './Pager';
import DetailPopover from './DetailPopover';
import { useStickyState } from '../../hooks/useStickyState';

interface Props {
  artifacts: ArtifactDetail[];
}

interface ArtRow {
  art: ArtifactDetail;
  id: number;
}

type Archetype = 'attack' | 'defense' | 'hp' | 'support';

const RARITY_ORDER = [5, 4, 3, 2, 1];
const PAGE = 60;

const ELEMENTS: { key: ElementKey; label: string }[] = [
  { key: 'water', label: 'Eau' },
  { key: 'fire', label: 'Feu' },
  { key: 'wind', label: 'Vent' },
  { key: 'light', label: 'Lumière' },
  { key: 'dark', label: 'Ténèbres' },
];
const ARCHETYPES: { key: Archetype; label: string }[] = [
  { key: 'attack', label: 'Attaque' },
  { key: 'defense', label: 'Défense' },
  { key: 'hp', label: 'PV' },
  { key: 'support', label: 'Support' },
];

export default function ArtifactsSection({ artifacts }: Props) {
  const [kind, setKind] = useStickyState<'all' | 'element' | 'archetype'>('artefacts.kind', 'all');
  const [element, setElement] = useStickyState<ElementKey | ''>('artefacts.element', '');
  const [archetype, setArchetype] = useStickyState<Archetype | ''>('artefacts.archetype', '');
  const [rarities, setRarities] = useStickyState<Set<number>>('artefacts.rarities', new Set());
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const toggleOpen = useCallback((id: number) => setOpenId((c) => (c === id ? null : id)), []);

  function toggleRarity(v: number) {
    const next = new Set(rarities);
    next.has(v) ? next.delete(v) : next.add(v);
    setRarities(next);
    setPage(0);
  }

  // Tri par rareté décroissante puis niveau décroissant.
  const rows = useMemo(
    () =>
      artifacts
        .map((art, id): ArtRow => ({ art, id }))
        .sort((a, b) => b.art.rarity - a.art.rarity || b.art.level - a.art.level),
    [artifacts]
  );

  // ⚠️ Une valeur **hors de la catégorie choisie ne filtre pas**. Sur
  // « Attribut », un archétype resté sélectionné viderait la liste sans qu'on
  // voie pourquoi ; sa pastille est grisée, et elle est ignorée pour de bon.
  const elementActif = kind === 'archetype' ? '' : element;
  const archetypeActif = kind === 'element' ? '' : archetype;

  const filtered = useMemo(() => {
    return rows.filter(({ art }) => {
      if (kind !== 'all' && art.kind !== kind) return false;
      if (elementActif && art.element !== elementActif) return false;
      if (archetypeActif && art.archetype !== archetypeActif) return false;
      if (rarities.size && !rarities.has(art.rarity)) return false;
      return true;
    });
  }, [rows, kind, elementActif, archetypeActif, rarities]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        {/* Catégorie + sous-filtre.
            ⚠️ L'intitulé de la rangée est « Catégorie » et non « Type » : les
            deux sortes d'artéfacts s'appellent **Attribut** et **Type** dans le
            jeu, un en-tête « Type » au-dessus d'un bouton « Type » se lirait
            comme un doublon. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-[86px] flex-none label">
            Catégorie
          </span>
          {/* ⚠️ Un contrôle **à cran** (`Segmented`) et non trois pastilles :
              les trois choix s'excluent, alors que des pastilles séparées se
              lisent comme des filtres cumulables — comme les chips de valeur
              juste à côté, qui elles le sont.
              Les libellés viennent d'`ARTIFACT_KINDS` : les noms du JEU,
              « Attribut » et « Type ». */}
          <Segmented
            value={kind}
            onChange={(k) => {
              setKind(k);
              setElement('');
              setArchetype('');
              setPage(0);
            }}
            options={[
              { key: 'all' as const, label: 'Tous' },
              ...ARTIFACT_KINDS.map((x) => ({ key: x.key, label: x.label })),
            ]}
          />
        </div>

        {/* ⚠️ **Une rangée par axe**, chacune avec son intitulé, comme la
            rareté juste en dessous. Tout sur une seule ligne, les neuf pastilles
            et le contrôle de catégorie passaient à la ligne au hasard de la
            largeur : on ne voyait plus où finissait un filtre et où commençait
            le suivant. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-[86px] flex-none label">
            Attribut
          </span>

          {/* Chips de valeur : **icône du jeu + libellé**. On reconnaît un
              attribut ou un archétype à son symbole ; le texte seul obligeait à
              lire.
              ⚠️ Les attributs reprennent **exactement** les chips d'élément de
              la box (mêmes classes, même `ELEMENT_FILTER_STYLES`, même taille
              d'icône) : filtrer par élément doit se présenter pareil d'un écran
              à l'autre.

              ⚠️ **Les neuf pastilles sont TOUJOURS là.** Celles qui ne
              s'appliquent pas à la catégorie choisie sont **grisées**, jamais
              retirées : des boutons qui disparaissent réorganisent la barre sous
              le curseur, on perd des yeux ce qu'on visait, et rien ne dit
              pourquoi ils sont partis. Grisées, elles montrent ce qui existe et
              ce qu'il faudrait changer pour y accéder.

              Choisir une valeur ne **bascule pas** la catégorie : on se
              retrouvait sur « Attribut » sans l'avoir demandé, et retirer la
              valeur laissait ce cran posé — un filtre restait actif après qu'on
              ait tout désélectionné. */}
          {ELEMENTS.map((e) => {
            const active = elementActif === e.key;
            const hs = kind === 'archetype'; // hors sujet dans cette catégorie
            return (
              <button
                key={e.key}
                data-active={active}
                disabled={hs}
                title={hs ? "Change la catégorie pour filtrer par attribut" : undefined}
                onClick={() => {
                  setElement((cur) => (cur === e.key ? '' : e.key));
                  setArchetype(''); // les deux axes s'excluent
                  setPage(0);
                }}
                className={`flex items-center gap-1.5 rounded-full border bg-panel px-3 py-1 text-[12.5px] font-semibold
                  transition select-none ${ELEMENT_FILTER_STYLES[e.key]}
                  ${hs ? 'opacity-25 cursor-not-allowed' : active ? 'shadow' : 'opacity-70 hoverable:opacity-100'}`}
              >
                <ElementIcon element={e.key} size={15} />
                {e.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-[86px] flex-none label">
            Type
          </span>
          {/* ⚠️ Les types restent **neutres**, sans couleur propre. Les quatre
              archétypes n'ont pas de code couleur dans le jeu : en inventer un
              donnerait à croire qu'il veut dire quelque chose. L'icône suffit à
              les distinguer, et la surbrillance dit lequel est posé. */}
          {ARCHETYPES.map((a) => {
            const active = archetypeActif === a.key;
            const hs = kind === 'element';
            return (
              <button
                key={a.key}
                disabled={hs}
                title={hs ? 'Change la catégorie pour filtrer par type' : undefined}
                onClick={() => {
                  setArchetype((cur) => (cur === a.key ? '' : a.key));
                  setElement(''); // les deux axes s'excluent
                  setPage(0);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold
                  transition select-none ${
                    active
                      ? 'bg-panel2 border-accent text-ink shadow'
                      : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
                  } ${hs ? 'opacity-25 cursor-not-allowed' : ''}`}
              >
                <ArtifactGlyph name={a.key} size={15} />
                {a.label}
              </button>
            );
          })}
        </div>

        {/* Rareté */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-[86px] flex-none label">Rareté</span>
          {RARITY_ORDER.map((r) => {
            const meta = RARITY_META[r];
            const active = rarities.has(r);
            return (
              <button
                key={r}
                onClick={() => toggleRarity(r)}
                // ⚠️ Même typographie que les autres chips de la page
                // (`font-semibold`, casse normale). Le gras majuscule espacé
                // qu'elles portaient venait de la bannière du jeu : isolé dans
                // une rangée de filtres, il se lisait comme un autre composant
                // collé là. La rareté garde en revanche ses couleurs, qui elles
                // portent une information.
                className="flex items-center rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none"
                style={
                  active
                    ? { background: meta.bg, color: meta.color, borderColor: meta.color }
                    : { borderColor: '#2b3055', color: meta.color, opacity: 0.6 }
                }
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-[12px] text-ink-dim">
          {filtered.length} artéfact{filtered.length > 1 ? 's' : ''}
          {filtered.length !== artifacts.length && ` sur ${artifacts.length}`}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2 items-start">
        {shown.map((row) => (
          <ArtTile
            key={row.id}
            id={row.id}
            art={row.art}
            open={openId === row.id}
            onToggle={toggleOpen}
          />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-center">
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

const ArtTile = memo(function ArtTile({
  id,
  art,
  open,
  onToggle,
}: {
  id: number;
  art: ArtifactDetail;
  open: boolean;
  onToggle: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = RARITY_META[art.rarity] ?? RARITY_META[1];

  return (
    <div
      ref={ref}
      className={`relative rounded-lg border bg-panel ${open ? 'z-20 border-accent' : 'border-border'}`}
    >
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-2 p-2 text-left"
        style={{ borderLeft: `3px solid ${meta.color}` }}
      >
        <ArtifactIcon artifact={art} size={26} className="flex-none" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-ink-dim">+{art.level}</div>
          <div className="text-[12.5px] font-bold text-ink leading-tight truncate">
            {formatArtifactMain(art.main)}
          </div>
        </div>
      </button>

      {/* Détail flottant : carte récap, placement auto (gauche/haut si bord). */}
      <DetailPopover open={open} anchorRef={ref} height={260}>
        <ArtifactDetailBox artifact={art} />
      </DetailPopover>
    </div>
  );
});
