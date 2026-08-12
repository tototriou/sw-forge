import { memo, useMemo, useState } from 'react';
import { X, RotateCw } from 'lucide-react';
import { ARTIFACT_KINDS, ArtifactDetail, ElementKey, MAX_ARTIFACT_SUBS } from '../../types';
import {
  formatArtifactMain,
  splitArtifactSub,
  artifactSubName,
  artifactSubKinds,
  artifactSubOrder,
  RARITY_META,
} from '../../lib/effects';
import { artifactScore, artifactEfficiency } from '../../lib/artifacts';
import { ArtifactGlyph } from '../ArtifactIcon';
import ArtifactFrameIcon from '../ArtifactFrameIcon';
import ElementIcon from '../ElementIcon';
import Segmented from '../Segmented';
import { ELEMENT_FILTER_STYLES } from '../elementStyles';
import Pager from './Pager';
import { useStickyState } from '../../hooks/useStickyState';
import { RuneMetric, useRuneMetric } from '../../hooks/useRuneMetric';

interface Props {
  artifacts: ArtifactDetail[];
}

interface ArtRow {
  art: ArtifactDetail;
  id: number;
  score: number; // score du jeu
  eff: number; // efficience, en % (même somme que le score, autre échelle)
}

// Un critère de recherche : une propriété secondaire et le minimum exigé.
//
// ⚠️ Les critères sont ORDONNÉS, et cet ordre est celui du **tri** : le premier
// classe la liste, le deuxième départage les ex æquo, et ainsi de suite —
// exactement comme la recherche détaillée du jeu. Ce n'est donc pas une simple
// liste de cases à cocher : la position de chaque critère porte du sens.
interface Critere {
  code: number;
  min: number; // seuil en unité de la propriété (%, ou points pour le 221)
}

// Quatre critères au plus : un artéfact ne porte que 4 propriétés (voir
// MAX_ARTIFACT_SUBS), donc un cinquième ne pourrait jamais être satisfait.
// La grille se replie à 2 cases quand on n'en utilise pas davantage.
const GRILLE_REPLIEE = 2;

// Pas d'incrément du seuil. 1 convient aux propriétés en %, qui sont la
// quasi-totalité ; le 221 (« Dégâts add. par X% de la VIT ») monte à 200 mais
// se règle tout aussi bien au clavier.
const PAS_SEUIL = 1;

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

export default function ArtifactsList({ artifacts }: Props) {
  const [kind, setKind] = useStickyState<'all' | 'element' | 'archetype'>('artefacts.kind', 'all');
  const [element, setElement] = useStickyState<ElementKey | ''>('artefacts.element', '');
  const [archetype, setArchetype] = useStickyState<Archetype | ''>('artefacts.archetype', '');
  const [rarities, setRarities] = useStickyState<Set<number>>('artefacts.rarities', new Set());
  // Critères de recherche, dans l'ordre de priorité du tri (voir `Critere`).
  const [criteres, setCriteres] = useStickyState<Critere[]>('artefacts.criteres', []);
  // Grille dépliée à 4 cases, ou repliée à 2.
  const [depliee, setDepliee] = useStickyState<boolean>('artefacts.grilleDepliee', false);

  // Cases visibles, et donc critères ACTIFS.
  //
  // ⚠️ Replier la grille désactive les critères 3 et 4 au lieu de les masquer
  // en les laissant filtrer : une liste restreinte par un critère invisible se
  // lit comme un bug. Ils sont conservés en mémoire et redeviennent actifs au
  // dépliage — on ne perd pas sa saisie.
  const cases = depliee ? MAX_ARTIFACT_SUBS : GRILLE_REPLIEE;
  const actifs = useMemo(
    () => criteres.slice(0, cases).filter((c) => c.code > 0),
    [criteres, cases]
  );
  // Mesure affichée : le réglage GLOBAL de l'application (menu ⚙), partagé avec
  // les runes. Pas de sélecteur répété dans la page.
  const metric = useRuneMetric();
  const [page, setPage] = useState(0);

  function toggleRarity(v: number) {
    const next = new Set(rarities);
    next.has(v) ? next.delete(v) : next.add(v);
    setRarities(next);
    setPage(0);
  }

  // Le score et l'efficience sont calculés UNE fois par artéfact, ici : les
  // tuiles les affichent et le tri s'en sert, les recalculer à chaque rendu
  // referait 2 000 passages à chaque changement de page.
  const rows = useMemo(
    () =>
      artifacts.map(
        (art, id): ArtRow => ({
          art,
          id,
          score: artifactScore(art),
          eff: artifactEfficiency(art),
        })
      ),
    [artifacts]
  );

  // ⚠️ Une valeur **hors de la catégorie choisie ne filtre pas**. Sur
  // « Attribut », un archétype resté sélectionné viderait la liste sans qu'on
  // voie pourquoi ; sa pastille est grisée, et elle est ignorée pour de bon.
  const elementActif = kind === 'archetype' ? '' : element;
  const archetypeActif = kind === 'element' ? '' : archetype;

  const filtered = useMemo(() => {
    const gardees = rows.filter(({ art }) => {
      if (kind !== 'all' && art.kind !== kind) return false;
      if (elementActif && art.element !== elementActif) return false;
      if (archetypeActif && art.archetype !== archetypeActif) return false;
      if (rarities.size && !rarities.has(art.rarity)) return false;
      // ⚠️ ET, pas OU : on cherche l'artéfact qui porte **toutes** les
      // propriétés demandées, chacune au-dessus de son seuil. Un OU renverrait
      // des centaines de pièces dès le deuxième critère.
      for (const c of actifs) {
        const ligne = art.subs.find((s) => s.code === c.code);
        if (!ligne || ligne.value < c.min) return false;
      }
      return true;
    });

    // ⚠️ Le tri suit l'ORDRE DES CRITÈRES : le premier classe, le deuxième
    // départage, etc. C'est tout l'intérêt de la grille — « mes meilleurs vol
    // de vie, et à vol de vie égal les meilleurs dégâts additionnels ».
    // Sans critère, on retombe sur la valeur de l'artéfact (score/efficience).
    const valeurDe = (r: ArtRow, code: number) =>
      r.art.subs.find((s) => s.code === code)?.value ?? -Infinity;

    return [...gardees].sort((a, b) => {
      for (const c of actifs) {
        const d = valeurDe(b, c.code) - valeurDe(a, c.code);
        if (d) return d;
      }
      return b.score - a.score || b.art.rarity - a.art.rarity || b.art.level - a.art.level;
    });
  }, [rows, kind, elementActif, archetypeActif, rarities, actifs]);

  // Propriétés proposables : celles **réellement portées** par un artéfact de
  // l'inventaire, restreintes à la catégorie choisie et privées de celles déjà
  // posées ailleurs dans la grille.
  //
  // ⚠️ Ordonnées **comme dans le jeu** (`artifactSubOrder`), pas par ordre
  // alphabétique ni par code : c'est la séquence que le joueur connaît de sa
  // recherche détaillée.
  // ⚠️ `artifactSubName` et non `artifactSubLabel` : dans un filtre, le « +X% »
  // du libellé complet n'apporte rien et allonge chaque ligne — c'est le seuil
  // à côté qui porte la valeur.
  const dispoSubs = useMemo(() => {
    const presentes = new Set<number>();
    for (const { art } of rows) {
      if (kind !== 'all' && art.kind !== kind) continue;
      for (const s of art.subs) presentes.add(s.code);
    }
    const poses = new Set(criteres.filter((c) => c.code > 0).map((c) => c.code));
    return [...presentes]
      .filter((c) => !poses.has(c))
      .sort((a, b) => artifactSubOrder(a) - artifactSubOrder(b))
      .map((code) => ({ code, label: artifactSubName(code) }));
  }, [rows, kind, criteres]);

  // Composition de la liste affichée, pour le rappel d'en-tête sur « Tous ».
  const repartition = useMemo(
    () => ({
      element: filtered.filter((r) => r.art.kind === 'element').length,
      archetype: filtered.filter((r) => r.art.kind === 'archetype').length,
    }),
    [filtered]
  );

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
              // ⚠️ Les critères portant une propriété qui n'existe pas sur la
              // nouvelle catégorie sont vidés : gardés, ils videraient la liste
              // sans qu'on voie pourquoi (« Dégâts sur le Feu » sur des
              // artéfacts de type ne peut jamais être satisfait). La case reste
              // en place, seul son contenu part — l'ordre de tri des autres
              // critères est ainsi préservé.
              if (k !== 'all') {
                setCriteres((cur) =>
                  cur.map((c) =>
                    c.code > 0 && !artifactSubKinds(c.code).includes(k) ? { code: 0, min: 0 } : c
                  )
                );
              }
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
                // ⚠️ Deux couleurs de rareté, deux usages (voir RARITY_META) :
                //   - ACTIF : `meta.bg` + `meta.color` — la bannière du jeu,
                //     dont le fond sombre est fait pour cette couleur vive ;
                //   - INACTIF : un fond de PANNEAU et `meta.ink`, la variante
                //     qui suit le thème. Sans fond, `meta.color` était illisible
                //     en thème clair (#7cf0a6 sur blanc), et la bordure était
                //     codée en dur (#2b3055) donc invisible elle aussi.
                className={`flex items-center rounded-full border px-3 py-1 text-[12.5px] font-semibold
                            transition select-none ${active ? '' : 'bg-panel2 hoverable:brightness-110'}`}
                style={
                  active
                    ? { background: meta.bg, color: meta.color, borderColor: meta.color }
                    : { borderColor: 'rgb(var(--border))', color: meta.ink }
                }
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Propriété secondaire — grille de critères, façon recherche
            détaillée du jeu.
            ⚠️ Les cases sont ORDONNÉES : la 1ʳᵉ trie la liste, la 2ᵉ départage
            les ex æquo, etc. Ce n'est pas une simple liste de cases à cocher,
            la position porte du sens (voir `Critere`). */}
        <div className="flex flex-wrap items-start gap-2">
          {/* Même intitulé à largeur fixe que les autres rangées de filtres :
              les cases démarrent sur la même colonne que les chips au-dessus.
              ⚠️ Pas de second titre « Propriété secondaire » dans un cadre —
              il répétait celui-ci et ajoutait une boîte là où les autres
              rangées n'en ont pas. */}
          <span className="w-[86px] flex-none label mt-1.5">Propriété</span>
          <div className="min-w-0 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {Array.from({ length: cases }, (_, i) => (
                <CritereCase
                  key={i}
                  rang={i + 1}
                  critere={criteres[i] ?? null}
                  options={dispoSubs}
                  onChange={(c) => {
                    const next = [...criteres];
                    while (next.length < cases) next.push({ code: 0, min: 0 });
                    next[i] = c ?? { code: 0, min: 0 };
                    setCriteres(next);
                    setPage(0);
                  }}
                />
              ))}
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              {/* ⚠️ Le bouton dit CE QU'IL VA FAIRE, pas l'état courant :
                  « 2 ▾ » se lisait aussi bien « je suis à 2 » que « passe à
                  2 ». Un verbe lève l'ambiguïté. */}
              <button
                onClick={() => setDepliee(!depliee)}
                className="rounded border border-border px-2 py-0.5 text-[10.5px] font-semibold
                           text-ink-dim transition hoverable:text-ink hoverable:border-accent"
              >
                {depliee
                  ? `▴ Replier à ${GRILLE_REPLIEE} propriétés`
                  : `▾ Déplier à ${MAX_ARTIFACT_SUBS} propriétés`}
              </button>

              {actifs.length > 0 && (
                <button
                  onClick={() => {
                    setCriteres([]);
                    setPage(0);
                  }}
                  className="rounded border border-border px-2 py-0.5 text-[10.5px] font-semibold
                             text-ink-dim transition hoverable:text-fire hoverable:border-fire"
                >
                  ✕ Réinitialiser
                </button>
              )}

              {/* Ce que les numéros veulent dire. L'info n'était qu'en `title`,
                  donc invisible pour qui ne survole pas — et sans elle, « 1 »
                  et « 2 » passent pour des emplacements d'artéfact. */}
              {actifs.length > 1 && (
                <span className="text-[10.5px] text-ink-dim">
                  <b className="font-mono text-accent">1</b> trie la liste,{' '}
                  <b className="font-mono text-accent">2</b> départage les ex æquo
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-[12px] text-ink-dim">
          {filtered.length} artéfact{filtered.length > 1 ? 's' : ''}
          {filtered.length !== artifacts.length && ` sur ${artifacts.length}`}
          {/* ⚠️ Sur « Tous », la liste mêle DEUX inventaires distincts qu'on ne
              monte pas sur les mêmes monstres. Le rappel de composition évite
              de lire un classement commun comme un seul stock — et dit quoi
              filtrer pour ne voir que l'un des deux. */}
          {kind === 'all' && repartition.element > 0 && repartition.archetype > 0 && (
            <span className="ml-1 opacity-70">
              ({repartition.element} attribut · {repartition.archetype} type)
            </span>
          )}
          {/* Rappel du filtre actif : sans lui, une liste courte ou vide passe
              pour une absence d'artéfacts plutôt que pour une sélection
              exigeante. Même règle que le compteur de l'Optimisation. */}
          {actifs.length > 0 && (
            <span className="ml-1 opacity-70">
              · triés sur {actifs.length} propriété{actifs.length > 1 ? 's' : ''}
            </span>
          )}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {/* ⚠️ Tuiles plus larges que celles des runes (150px) : elles portent les
          4 substats en clair, et l'en-tête aligne cadre + stat principale +
          bannière de rareté sur une seule ligne. En dessous de 240px, la stat
          principale se fait tronquer par la bannière. */}
      {filtered.length === 0 && (
        <p className="rounded-xl border border-border bg-panel px-4 py-6 text-center text-[13px] text-ink-dim">
          {actifs.length > 0
            ? `Aucun artéfact n'atteint ${actifs.length > 1 ? 'tous ces minimums' : 'ce minimum'} avec les filtres actuels.`
            : 'Aucun artéfact ne correspond à ces filtres.'}
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 items-start">
        {shown.map((row) => (
          <ArtTile
            key={row.id}
            art={row.art}
            score={row.score}
            eff={row.eff}
            metric={metric}
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

// Une case de la grille : le rang (= priorité de tri), la propriété, le seuil.
function CritereCase({
  rang,
  critere,
  options,
  onChange,
}: {
  rang: number;
  critere: Critere | null;
  // Propriétés dans l'ordre du jeu (voir `artifactSubOrder`).
  options: { code: number; label: string }[];
  onChange: (c: Critere | null) => void;
}) {
  const pose = !!critere && critere.code > 0;
  // ⚠️ La propriété choisie est retirée des options (elle est « prise »), il
  // faut donc la réinjecter — sans quoi le `select` afficherait du vide sur un
  // critère pourtant posé.
  const manque = pose && !options.some((o) => o.code === critere!.code);

  return (
    /* ⚠️ AUCUN cadre ici : le `select` porte déjà sa propre bordure, et
       l'envelopper dans une boîte bordée faisait « carte dans carte ». La ligne
       n'est qu'une rangée de contrôles alignés. */
    <div className="flex min-h-[28px] items-center gap-1.5">
      {/* Le rang dit la PRIORITÉ DE TRI, pas un emplacement d'artéfact.
          ⚠️ Un CHIFFRE, pas un glyphe cerclé (➊➋) : à cette taille le cercle
          se refermait sur le chiffre et le rendait illisible. */}
      <span
        className={`w-3 flex-none text-center font-mono text-[12px] font-bold leading-none ${
          pose ? 'text-accent' : 'text-ink-dim opacity-60'
        }`}
        title={`${rang}${rang === 1 ? 'ᵉʳ' : 'ᵉ'} critère de tri`}
      >
        {rang}
      </span>

      {/* C'est LUI qui porte la bordure — le seul élément encadré de la ligne.
          Elle passe à l'accent quand un critère est posé. */}
      <select
        value={pose ? critere!.code : ''}
        onChange={(e) => {
          const code = Number(e.target.value);
          onChange(code ? { code, min: critere?.min ?? 0 } : null);
        }}
        className={`min-w-0 flex-1 cursor-pointer rounded border bg-panel px-1.5 py-1 text-[11px]
                    outline-none transition [&>option]:bg-panel [&>option]:text-ink ${
                      pose
                        ? 'border-accent text-ink'
                        : 'border-border text-ink-dim hoverable:border-accent hoverable:text-ink'
                    }`}
      >
        <option value="">Choisir une propriété…</option>
        {/* La propriété posée, réinjectée en tête quand elle a été retirée des
            options disponibles. */}
        {manque && <option value={critere!.code}>{artifactSubName(critere!.code)}</option>}
        {/* Dans l'ordre de la recherche détaillée du jeu (`artifactSubOrder`). */}
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Seuil « au moins » — n'a de sens qu'une fois la propriété choisie.
          ⚠️ Le « ≥ » est indispensable : « 25 » seul ne dit pas si c'est un
          minimum, un maximum ou la valeur exacte. */}
      {pose && (
        <div className="flex flex-none items-center gap-px">
          <span className="mr-0.5 font-mono text-[10px] text-ink-dim">≥</span>
          {/* Cibles de 18px : un glyphe nu était trop petit pour être visé
              franchement, surtout au doigt. */}
          <button
            onClick={() => onChange({ ...critere!, min: Math.max(0, critere!.min - PAS_SEUIL) })}
            className="h-[18px] w-[18px] rounded bg-panel2 text-[12px] leading-none text-ink-dim
                       transition hoverable:bg-accent-soft hoverable:text-ink"
            title="Diminuer le minimum"
          >
            −
          </button>
          <input
            type="number"
            value={critere!.min}
            min={0}
            onChange={(e) => onChange({ ...critere!, min: Math.max(0, Number(e.target.value) || 0) })}
            className="h-[18px] w-[36px] rounded bg-panel2 text-center font-mono text-[10.5px]
                       text-ink outline-none tabular-nums
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            title="Minimum exigé"
          />
          <button
            onClick={() => onChange({ ...critere!, min: critere!.min + PAS_SEUIL })}
            className="h-[18px] w-[18px] rounded bg-panel2 text-[12px] leading-none text-ink-dim
                       transition hoverable:bg-accent-soft hoverable:text-ink"
            title="Augmenter le minimum"
          >
            +
          </button>
          <button
            onClick={() => onChange(null)}
            className="ml-1 text-ink-dim transition hoverable:text-fire"
            title="Retirer ce critère"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// Tuile d'artéfact — **tout est visible d'emblée**, sans clic.
//
// ⚠️ Il y avait un popover de détail au clic (comme les runes). Il a été retiré :
// une fois les 4 substats et leurs procs posés sur la tuile, il ne montrait plus
// que la rareté et le type, que la bannière porte déjà. Un clic pour rien sur
// 2 000 tuiles, et un état « ouvert » à gérer en plus.
const ArtTile = memo(function ArtTile({
  art,
  score,
  eff,
  metric,
}: {
  art: ArtifactDetail;
  // Passés en props plutôt que recalculés : ils le sont déjà une fois pour
  // toutes dans `rows`, et la tuile est mémoïsée.
  score: number;
  eff: number;
  metric: RuneMetric;
}) {
  const meta = RARITY_META[art.rarity] ?? RARITY_META[1];

  return (
    <div className="rounded-lg border border-border bg-panel">
      <div className="flex flex-col gap-1.5 p-2">
        {/* En-tête façon fiche du JEU, sur UNE ligne : le cadre, la stat
            principale à côté, et à droite la colonne rareté + valeur. */}
        <div className="flex w-full items-start gap-2.5">
          <ArtifactFrameIcon artifact={art} size={46} />
          <div className="min-w-0 flex-1 self-center">
            <div className="text-[13px] font-bold text-ink leading-tight truncate">
              {formatArtifactMain(art.main)}
            </div>
          </div>
          <div className="flex flex-none flex-col items-end gap-1">
            {/* Ici `meta.color` (et non `meta.ink`) : c'est bien la BANNIÈRE du
                jeu, avec son fond sombre dédié — le cas pour lequel la couleur
                vive est faite. Voir RARITY_META. */}
            <span
              className="rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide leading-tight"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
            {/* La mesure affichée suit le menu ⚙, comme pour les runes. */}
            <span className="flex items-center gap-1 rounded bg-panel2 px-1.5 py-px font-mono text-[11.5px] leading-tight tabular-nums text-ink">
              <img
                src={`${import.meta.env.BASE_URL}icons/artifact.png`}
                alt=""
                width={11}
                height={11}
                draggable={false}
                className="opacity-90"
              />
              <b>{metric === 'eff' ? `${eff.toFixed(1)}%` : score}</b>
            </span>
          </div>
        </div>

        {/* ⚠️ Les substats sont sur la TUILE, pas seulement dans le détail :
            c'est ce qu'on cherche en parcourant l'inventaire (« qui porte du
            vol de vie ? »), et l'ouvrir un par un pour le savoir rendait la
            liste inutilisable. Le popover garde le rendu complet (rareté,
            type, substat modifié). */}
        <div className="w-full space-y-[3px] border-t border-border/40 pt-1.5">
          {art.subs.map((s, j) => {
            const procs = s.rolls ?? 0;
            const { avant, valeur, apres } = splitArtifactSub(s);
            return (
              <div key={j} className="flex items-start gap-1.5 text-[10.5px] leading-tight">
                {/* ⚠️ Largeur FIXE : sans elle, la pastille se dimensionnait sur
                    son contenu et les libellés démarraient à deux colonnes
                    différentes selon que la ligne portait 0 ou 4 procs. */}
                <span
                  className={`mt-px w-[14px] flex-none rounded text-center font-mono text-[9.5px] font-bold tabular-nums ${
                    procs > 0 ? 'bg-good/20 text-good' : 'bg-ink-dim/15 text-ink-dim'
                  }`}
                >
                  {procs}
                </span>
                {/* Deux lignes au plus : les libellés longs (« Dgts supp. en
                    prop. de ATQ ») ne doivent pas faire grandir la tuile au
                    point de casser l'alignement de la grille. */}
                <span className="flex-1 text-ink-dim line-clamp-2">
                  {avant}
                  <b className="text-ink">{valeur}</b>
                  {apres}
                </span>
                {/* Substat MODIFIÉ (converti dans le jeu). Récupéré du popover
                    supprimé : c'est la seule information qu'il portait et que
                    la tuile n'avait pas. */}
                {s.enchant && (
                  <span className="mt-0.5 flex-none" title="Propriété modifiée">
                    <RotateCw size={9} className="text-orange-400" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
