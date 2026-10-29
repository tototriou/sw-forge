import { useMemo, useRef, useState } from 'react';
import { Heart, Shield, Swords, X } from 'lucide-react';
import { ArtifactDetail } from '../../types';
import { ARTIFACT_MAIN, splitArtifactSub } from '../../lib/effects';
import {
  ColonneTop,
  dansGroupe,
  dePrincipale,
  effectifsGroupes,
  estGroupeElement,
  FamilleTop,
  GroupeTop,
  GROUPES_TOP,
  PRINCIPALES,
  TAILLE_TOP,
  topParPropriete,
} from '../../lib/artifactsTop';
import { useStickyState } from '../../hooks/useStickyState';
import { SOUS_LG, useMediaQuery } from '../../hooks/useMediaQuery';
import { ArtifactGlyph } from '../ArtifactIcon';
import { ArtifactDetailBox } from '../PieceDetail';
import ElementIcon from '../ElementIcon';
import Pastille from '../../ui/Pastille';
import Onglets from '../../ui/Onglets';
import FlottantAuto from '../../ui/FlottantAuto';
import ZoneCliquable from '../../ui/ZoneCliquable';
import { Panel } from './SummaryBits';

// Le « Top 10 par propriété », dans le Résumé de Mon compte › Artéfacts :
// pour un attribut ou un type (intangibles compris), et les stats principales
// cochées, les meilleures valeurs de chaque propriété secondaire.
// Calcul : lib/artifactsTop.ts. Voir docs/02-app/compte/feat-artefacts.md.

// L'icône de la stat principale devant chaque valeur : ♥ PV, ⚔ ATQ, 🛡 DEF.
//
// ⚠️ **En COULEUR**, comme les outils de référence du jeu : sur dix rangs
// serrés, c'est la teinte qu'on repère d'un coup d'œil, pas la forme. Le cœur
// rouge et le bouclier bleu reprennent les tokens du Feu et de l'Eau (deux
// valeurs par thème, déjà mesurées), les épées restent à l'encre.
const ICONE_PRINCIPALE: Record<number, { Icone: typeof Heart; couleur: string }> = {
  100: { Icone: Heart, couleur: 'text-fire' },
  101: { Icone: Swords, couleur: 'text-ink' },
  102: { Icone: Shield, couleur: 'text-water' },
};

export default function ArtifactsTop({ artifacts }: { artifacts: ArtifactDetail[] }) {
  const [choisi, setChoisi] = useStickyState<GroupeTop>('artefacts.top.groupe', 'water');
  const effectifs = useMemo(() => effectifsGroupes(artifacts), [artifacts]);
  // Un groupe retenu qui n'a plus d'artéfact (autre compte importé) : le
  // premier groupe qui en a, plutôt qu'un écran vide.
  const groupe = effectifs[choisi] > 0 ? choisi : (GROUPES_TOP.find((g) => effectifs[g.key] > 0)?.key ?? choisi);
  // Stats principales COCHÉES — ⚠️ une liste BLANCHE, tout coché par défaut,
  // comme la rareté de la Liste : une stat cochée est affichée, n'en cocher
  // aucune revient à ne rien vouloir voir. Cumulable : PV et DEF ensemble.
  const [principales, setPrincipales] = useStickyState<number[]>('artefacts.top.principales', [...PRINCIPALES]);
  const basculerPrincipale = (code: number) => {
    setPrincipales((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
    setOuverte(null);
  };
  const familles = useMemo(() => topParPropriete(artifacts, groupe, principales), [artifacts, groupe, principales]);
  // L'effectif AFFICHÉ : le groupe, réduit aux stats principales cochées.
  const effectif = useMemo(
    () => artifacts.filter((a) => dansGroupe(a, groupe) && dePrincipale(a, principales)).length,
    [artifacts, groupe, principales]
  );
  // Une seule fiche ouverte à la fois, dans toute la vue.
  const [ouverte, setOuverte] = useState<string | null>(null);
  const basculer = (cle: string) => setOuverte((o) => (o === cle ? null : cle));
  // ⚠️ **Au doigt, la fiche s'ouvre SOUS le tableau**, pas en flottant : le
  // tableau défile de côté dans sa carte, et ce défilement couperait une
  // surface ancrée à une cellule.
  const ficheEnLigne = useMediaQuery(SOUS_LG);

  if (artifacts.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-panel px-4 py-6 text-center text-sm text-ink-dim">
        Aucun artéfact dans l'inventaire importé.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="top-artefacts-titre">
      {/* L'intitulé de la section, aux DEUX formats : dans le Résumé, la
          barre du haut dit « Résumé », pas ce qu'est ce bloc. Même gabarit
          (`label`) que les intitulés des cartes au-dessus. */}
      <div className="flex items-center gap-2.5">
        <h3 id="top-artefacts-titre" className="label">
          Top {TAILLE_TOP} par propriété
        </h3>
        <span className="rounded-full border border-border-soft bg-panel2 px-2 py-0.5 font-mono text-micro text-ink-dim">
          {effectif.toLocaleString('fr-FR')} artéfact{effectif > 1 ? 's' : ''}
        </span>
      </div>

      {/* ⚠️ Des ONGLETS (`Onglets`), pas des pastilles : un seul groupe
          ouvert, et il coiffe les tableaux du dessous. Un groupe vide reste
          affiché, désactivé, avec sa raison. */}
      <Onglets
        aria-label="Attribut ou type des artéfacts"
        valeur={groupe}
        onChange={(g) => {
          setChoisi(g);
          setOuverte(null);
        }}
        options={GROUPES_TOP.map((g) => {
          const vide = effectifs[g.key] === 0;
          return {
            cle: g.key,
            libelle: g.label,
            icone: estGroupeElement(g.key) ? (
              <ElementIcon element={g.key} size={15} />
            ) : (
              <ArtifactGlyph name={g.key} size={15} />
            ),
            desactive: vide,
            title: vide ? 'Aucun artéfact de ce groupe dans l’inventaire' : undefined,
          };
        })}
      />

      {/* Stat principale — PV · ATQ · DEF : « mes réductions de dégâts
          reçus, sur des artéfacts PV ou DEF ».
          ⚠️ Trois pastilles À BASCULE, cumulables — et non un contrôle à
          cran : on veut pouvoir garder PV et DEF ensemble. Chacune porte
          l'icône de la cellule, en couleur : le lien se fait sans lire. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Stats principales affichées">
        <span className="label leading-tight">Stat principale</span>
        {PRINCIPALES.map((code) => {
          const { Icone, couleur } = ICONE_PRINCIPALE[code];
          return (
            <Pastille
              key={code}
              actif={principales.includes(code)}
              icone={<Icone size={13} strokeWidth={2.5} aria-hidden className={couleur} />}
              libelle={ARTIFACT_MAIN[code].label}
              onClick={() => basculerPrincipale(code)}
            />
          );
        })}
      </div>

      <p className="text-xs text-ink-dim">
        Les {TAILLE_TOP} meilleures valeurs de chaque propriété secondaire, intangibles compris. L’icône donne la stat
        principale ; une valeur ouvre la fiche de l’artéfact.
      </p>

      {/* Les tableaux prennent leur largeur, pas celle de la page : ils se
          suivent sur la ligne tant qu'ils tiennent. */}
      <div className="flex flex-wrap items-start gap-3">
        {familles.map((f) => (
          <Famille
            key={f.titre}
            famille={f}
            ouverte={ouverte}
            onBasculer={basculer}
            ficheEnLigne={ficheEnLigne}
          />
        ))}
      </div>
    </section>
  );
}

function Famille({
  famille,
  ouverte,
  onBasculer,
  ficheEnLigne,
}: {
  famille: FamilleTop;
  ouverte: string | null;
  onBasculer: (cle: string) => void;
  ficheEnLigne: boolean;
}) {
  // Un nom complet dans la famille : tous ses en-têtes prennent la même
  // hauteur, pour que les rangs restent alignés d'une colonne à l'autre.
  const entetesLongs = famille.colonnes.some((c) => !c.court);
  const ficheDeLaFamille = ficheEnLigne
    ? famille.colonnes.flatMap((c) => c.cellules.map((cel, i) => ({ cle: cleCellule(c, i), art: cel.art }))).find((x) => x.cle === ouverte)
    : undefined;
  return (
    // ⚠️ **La carte prend la largeur de son tableau** (`w-fit`), pas celle de
    // la page : des colonnes étirées sur 1 000 px écartaient l'icône de sa
    // valeur et noyaient dix rangs dans le vide.
    <Panel title={famille.titre} className="w-fit min-w-0 max-w-full">
      {/* ⚠️ Au doigt, le tableau DÉFILE DE CÔTÉ dans sa carte (la page, elle,
          ne défile jamais horizontalement) ; à la souris, les colonnes passent
          à la ligne. */}
      <div className="-mx-1 flex gap-0.5 overflow-x-auto px-1 lg:flex-wrap lg:overflow-visible">
        {famille.colonnes.map((c) => (
          <Colonne
            key={c.code}
            colonne={c}
            entetesLongs={entetesLongs}
            ouverte={ouverte}
            onBasculer={onBasculer}
            ficheEnLigne={ficheEnLigne}
          />
        ))}
      </div>
      {ficheDeLaFamille && (
        <div className="mt-3">
          <ArtifactDetailBox artifact={ficheDeLaFamille.art} compact />
        </div>
      )}
    </Panel>
  );
}

const cleCellule = (c: ColonneTop, rang: number) => `${c.code}-${rang}`;

function Colonne({
  colonne,
  entetesLongs,
  ouverte,
  onBasculer,
  ficheEnLigne,
}: {
  colonne: ColonneTop;
  entetesLongs: boolean;
  ouverte: string | null;
  onBasculer: (cle: string) => void;
  ficheEnLigne: boolean;
}) {
  return (
    // Largeur FIXE et serrée : « +21% », son icône et la marque d'intangible
    // tiennent en 4,5 rem ; un nom complet de propriété demande 7 rem, sur
    // trois lignes au plus.
    <div
      className={`flex flex-none flex-col ${colonne.court ? 'w-[4.5rem]' : 'w-28'}`}
      data-colonne-top={colonne.code}
    >
      <div
        className={`break-words px-1 pb-1 text-micro font-semibold leading-tight text-ink-dim ${
          entetesLongs ? 'min-h-[3.75em]' : ''
        }`}
      >
        {colonne.entete}
      </div>
      <ol className="flex flex-col">
        {colonne.cellules.map((cel, i) => (
          <Cellule
            key={cel.art.id || i}
            code={colonne.code}
            art={cel.art}
            valeur={cel.valeur}
            rang={i + 1}
            ouverte={ouverte === cleCellule(colonne, i)}
            onBasculer={() => onBasculer(cleCellule(colonne, i))}
            ficheEnLigne={ficheEnLigne}
          />
        ))}
        {/* ⚠️ Toujours TAILLE_TOP rangs : une croix là où il n'y a pas
            d'artéfact. Le tableau garde sa forme d'un groupe à l'autre, et un
            rang manquant se lit au lieu de raccourcir la colonne. */}
        {Array.from({ length: Math.max(0, TAILLE_TOP - colonne.cellules.length) }, (_, i) => (
          <li
            key={`vide-${i}`}
            className="flex h-5 items-center px-1 text-ink-dimmer"
            title="Aucun artéfact"
            data-case-vide
          >
            <X size={11} strokeWidth={2.5} aria-label="Aucun artéfact" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Cellule({
  code,
  art,
  valeur,
  rang,
  ouverte,
  onBasculer,
  ficheEnLigne,
}: {
  code: number;
  art: ArtifactDetail;
  valeur: number;
  rang: number;
  ouverte: boolean;
  onBasculer: () => void;
  ficheEnLigne: boolean;
}) {
  const ancre = useRef<HTMLLIElement>(null);
  const principale = ARTIFACT_MAIN[art.main.code]?.label ?? '';
  const texte = splitArtifactSub({ code, value: valeur }).valeur;
  const icone = ICONE_PRINCIPALE[art.main.code];
  return (
    // ⚠️ `relative` : l'ancre de la fiche flottante. `z-10` quand elle est
    // ouverte, sinon une cellule plus loin dans le DOM passerait devant.
    <li ref={ancre} className={`relative ${ouverte ? 'z-10' : ''}`}>
      <ZoneCliquable
        onClick={onBasculer}
        aria-expanded={ouverte}
        title={`n° ${rang} · principale ${principale}${art.intangible ? ' · intangible' : ''}`}
        className={`flex h-5 w-full items-center gap-1 rounded px-1 font-mono text-xs tabular-nums transition-colors ${
          ouverte ? 'bg-accent-soft text-ink' : 'text-ink hoverable:bg-panel2'
        }`}
      >
        {icone && <icone.Icone size={11} strokeWidth={2.5} aria-label={principale} className={`flex-none ${icone.couleur}`} />}
        <span>{texte}</span>
        {/* Un intangible se mêle aux autres : sa marque du jeu le signale. */}
        {art.intangible && <ArtifactGlyph name="intangible" size={10} className="flex-none opacity-80" />}
      </ZoneCliquable>
      {!ficheEnLigne && (
        <FlottantAuto ouvert={ouverte} ancre={ancre} largeur={300} hauteur={260} rembourrage="md" onFermer={onBasculer}>
          <ArtifactDetailBox artifact={art} encadre={false} />
        </FlottantAuto>
      )}
    </li>
  );
}
