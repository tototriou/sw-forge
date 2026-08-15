import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import FilterBar from '../components/FilterBar';
import MonsterGrid from '../components/MonsterGrid';
import MonsterDetailDialog from '../components/MonsterDetailDialog';
import Pager from '../components/account/Pager';
import { ELEMENTS, ElementKey, Monster } from '../types';
import { LoadState } from '../hooks/useMonsters';
import { autreForme, sansDoublonDeTransformation } from '../lib/monsterForms';

interface Props {
  monsters: Monster[];
  loadState: LoadState;
}

// Cartes par page. ⚠️ Le bestiaire porte ~3 000 monstres, et chaque carte est un
// `motion.div` animé : tout rendre d'un coup fait ramer le navigateur au moindre
// filtre, chaque frappe reconstruisant 3 000 nœuds animés.
//
// 60 comme les autres listes de l'app (runes, artéfacts, optimisation) — même
// composant `Pager`, même ordre de grandeur, donc même sensation d'un écran à
// l'autre.
const PAGE = 60;

export default function BestiaryPage({ monsters }: Props) {
  const [query, setQuery] = useState('');
  const [activeElements, setActiveElements] = useState<Set<ElementKey>>(new Set());
  const [activeStars, setActiveStars] = useState<Set<number>>(new Set());
  const [sortMode, setSortMode] = useState('stars_desc');
  // Fiche ouverte — état local, non persisté : rouvrir la page sur une fiche
  // consultée la veille serait déroutant.
  const [fiche, setFiche] = useState<Monster | null>(null);
  const [page, setPage] = useState(0);
  // Ancre pour revenir en tête de liste au changement de page depuis le bas.
  const listeRef = useRef<HTMLDivElement>(null);

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

  // Monstres retenus, triés, **avant découpage en pages**.
  //
  // ⚠️ L'ordre est celui de l'AFFICHAGE : élément par élément, chacun trié selon
  // le mode. La pagination découpe ensuite cette suite — c'est ce qui garantit
  // qu'une page contient bien les monstres qu'on verrait à cet endroit sans
  // pagination.
  const retenus = useMemo(() => {
    const q = query.trim().toLowerCase();
    // ⚠️ Les monstres TRANSFORMABLES sont dédupliqués d'abord : Bellenus et ses
    // semblables existent en deux entrées de même nom, même élément, même
    // icône. Deux fiches identiques côte à côte n'apprennent rien et font
    // ouvrir l'une pour l'autre.
    const filtered = sansDoublonDeTransformation(monsters).filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (activeElements.size && !activeElements.has(m.element)) return false;
      if (activeStars.size && !(m.stars !== null && activeStars.has(m.stars))) return false;
      return true;
    });

    const byElement = new Map<ElementKey, Monster[]>();
    for (const el of ELEMENTS) byElement.set(el.key, []);
    for (const m of filtered) byElement.get(m.element)?.push(m);

    for (const [, list] of byElement) {
      if (sortMode === 'stars_desc') {
        list.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || a.name.localeCompare(b.name));
      } else if (sortMode === 'stars_asc') {
        list.sort((a, b) => (a.stars ?? 99) - (b.stars ?? 99) || a.name.localeCompare(b.name));
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    // Aplati dans l'ordre des éléments : la suite qu'on paginera.
    return ELEMENTS.flatMap((el) => byElement.get(el.key) ?? []);
  }, [monsters, query, activeElements, activeStars, sortMode]);

  const totalShown = retenus.length;
  // Total de RÉFÉRENCE : après déduplication des formes transformables. Sans
  // ça, le compteur annoncerait « 60 sur 3000 » alors que la base n'en montre
  // que ~2 940 — un écart qu'on ne saurait pas expliquer.
  const totalBase = useMemo(() => sansDoublonDeTransformation(monsters).length, [monsters]);
  const pageCount = Math.max(1, Math.ceil(totalShown / PAGE));
  const safePage = Math.min(page, pageCount - 1);

  // ⚠️ On pagine AVANT de grouper, et non l'inverse : paginer chaque élément
  // séparément donnerait cinq paginations à l'écran, et « page 2 » ne voudrait
  // plus rien dire. Ici la page découpe la liste entière ; les blocs d'élément
  // se reconstituent à partir de ce qu'elle contient — un bloc peut donc être
  // partiel, ou absent d'une page.
  const grouped = useMemo(() => {
    const debut = safePage * PAGE;
    const tranche = retenus.slice(debut, debut + PAGE);
    const byElement = new Map<ElementKey, Monster[]>();
    for (const el of ELEMENTS) byElement.set(el.key, []);
    for (const m of tranche) byElement.get(m.element)?.push(m);
    return byElement;
  }, [retenus, safePage]);

  // ⚠️ Retour à la première page dès que le RÉSULTAT change : rester en page 12
  // après avoir tapé une recherche qui n'en rend que deux laisserait un écran
  // vide, qu'on lirait comme « aucun résultat ».
  useEffect(() => setPage(0), [query, activeElements, activeStars, sortMode]);

  return (
    <div>
      <div className="mt-6">
        <SearchBar value={query} onChange={setQuery} />
        <FilterBar
          activeElements={activeElements}
          toggleElement={toggleElement}
          activeStars={activeStars}
          toggleStar={toggleStar}
          sortMode={sortMode}
          setSortMode={setSortMode}
        />
      </div>

      {/* Compteur + pagination en TÊTE : sur une page de 60 cartes, renvoyer en
          bas de page pour changer de page ferait remonter à chaque fois.
          ⚠️ Le compteur dit « N sur M » quand un filtre coupe : afficher le
          total alors qu'on en voit 60 se lit comme un bug d'affichage. */}
      {totalShown > 0 && (
        <div
          ref={listeRef}
          className="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="font-mono text-[12px] text-ink-dim">
            {totalShown} monstre{totalShown > 1 ? 's' : ''}
            {totalShown !== totalBase && ` sur ${totalBase}`}
          </p>
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      {totalShown === 0 ? (
        <div className="text-center py-16 text-ink-dim">
          <Sparkles className="mx-auto mb-3 opacity-40" />
          Aucun monstre ne correspond à ces filtres.
        </div>
      ) : (
        ELEMENTS.map((el) => (
          <MonsterGrid
            key={el.key}
            elementDef={el}
            monsters={grouped.get(el.key) ?? []}
            onOpen={setFiche}
          />
        ))
      )}

      {/* Répété en bas : après 60 cartes on est loin du haut, et remonter pour
          cliquer « suivant » puis redescendre est le genre d'aller-retour qui
          décourage de parcourir. */}
      {totalShown > 0 && pageCount > 1 && (
        <div className="mt-6 flex justify-center">
          {/* ⚠️ Depuis le bas, changer de page REMONTE en tête de liste :
              sinon on arrive au pied de la page suivante, donc à sa fin, et on
              croit que rien n'a bougé. Le pager du haut, lui, ne bouge rien —
              on y est déjà. */}
          <Pager
            page={safePage}
            pageCount={pageCount}
            onChange={(p) => {
              setPage(p);
              listeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </div>
      )}

      {/* La MÊME fiche que dans « Mon compte » : mêmes données, même rendu. Le
          bestiaire couvre en plus les monstres qu'on ne possède pas — c'est
          justement là qu'on consulte des coefficients avant d'invoquer. */}
      {/* ⚠️ `autre` est cherché dans la liste COMPLÈTE (`monsters`) et non dans
          ce qui est affiché : la grille a justement écarté la seconde forme,
          c'est tout l'objet de la déduplication. */}
      {fiche && (
        <MonsterDetailDialog
          monster={fiche}
          autre={autreForme(fiche, monsters)}
          onClose={() => setFiche(null)}
        />
      )}
    </div>
  );
}
