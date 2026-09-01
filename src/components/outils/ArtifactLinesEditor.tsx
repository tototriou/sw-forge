// Saisie des LIGNES VERROUILLÉES d'artéfact — « je veux au moins X % de cette
// sous-propriété », quel que soit ce que ça coûte en dégâts.
//
// ⚠️ **Une seule liste, pas une par sorte** — contrairement à l'éditeur de
// propriétés des Recommandations (RecoCard.tsx). Une ligne 200-299 n'appartient
// à AUCUNE des deux sortes d'avance : c'est l'optimiseur qui décide sur quelle
// pièce la placer. Demander à l'utilisateur de trancher lui ferait prendre une
// décision qui n'est pas la sienne, et lui ferait rater des paires.
//
// ⚠️ La sorte reste VISIBLE (pastille) parce qu'elle change le plafond : une
// ligne portable par les deux pièces se cumule jusqu'au double, une ligne
// exclusive plafonne au simple. Sans ça, saisir 60 % sur une ligne exclusive
// produirait une exigence que rien ne peut jamais satisfaire.

import { X } from 'lucide-react';
import { BoutonIcone, NumberField, Selecteur } from '../../ui';
import { ARTIFACT_KINDS, ArtifactKind, MAX_ARTIFACT_SUBS } from '../../types';
import { artifactSubName, artifactSubsFor } from '../../lib/effects';
import { LigneVerrouillee, budgetEmplacements, plafondLigne } from '../../lib/artifactOptim';
import { ARTIFACT_SUB_MAX } from '../../lib/artifacts';
import { codesEquivalentsAuVerrou } from '../../lib/damage';

// Un artéfact porte 4 sous-propriétés, la paire 8.
const MAX_LIGNES = MAX_ARTIFACT_SUBS * 2;

// Toutes les sous-propriétés proposables, dans l'ordre du JEU (celui de la
// « Recherche détaillée » en jeu, voir `artifactSubOrder`), sans doublon entre
// les deux sortes.
function toutesLesLignes(): { code: number; nom: string; sortes: ArtifactKind[] }[] {
  const vues = new Map<number, ArtifactKind[]>();
  for (const { key } of ARTIFACT_KINDS) {
    for (const o of artifactSubsFor(key)) {
      const deja = vues.get(o.code);
      if (deja) deja.push(key);
      else vues.set(o.code, [key]);
    }
  }
  return [...vues.entries()]
    // ⚠️ Une ligne sans plafond connu (203, 207, 211-213 : d'anciennes lignes
    // devenues inobtenables) n'est PAS proposable — on ne saurait pas borner sa
    // saisie, et exiger une valeur qu'aucun artéfact ne peut porter ne rendrait
    // que « 0 build » sans explication.
    .filter(([code]) => plafondLigne(code) > 0)
    .map(([code, sortes]) => ({ code, nom: artifactSubName(code), sortes }));
}

function Pastille({ sortes }: { sortes: ArtifactKind[] }) {
  const deux = sortes.length === 2;
  const attribut = sortes[0] === 'element';
  const libelle = deux ? 'les deux' : attribut ? 'attribut' : 'type';
  const teinte = deux
    ? 'bg-panel text-ink-dim border-border'
    : attribut
      ? 'bg-dark-soft text-dark border-dark/40'
      : 'bg-accent-soft text-accent border-accent/40';
  return (
    <span className={`shrink-0 rounded-full border px-1.5 py-px text-nano font-semibold ${teinte}`}>{libelle}</span>
  );
}

export default function ArtifactLinesEditor({
  lignes,
  onChange,
  diagnostic,
}: {
  lignes: LigneVerrouillee[];
  onChange: (l: LigneVerrouillee[]) => void;
  // Le meilleur cumul RÉELLEMENT atteignable par ligne, quand aucune paire ne
  // passe. `null` le reste du temps — ce bloc n'a rien à dire quand ça marche.
  diagnostic?: { code: number; min: number; auMieux: number; atteint: boolean }[] | null;
}) {
  const catalogue = toutesLesLignes();
  const parCode = new Map(catalogue.map((l) => [l.code, l]));
  // Nom lisible d'un code, pour nommer les formes voisines dans
  // l'avertissement — le catalogue ne couvre que les lignes CHOISISSABLES ici,
  // d'où le repli sur le numéro.
  const nomDe = (code: number) => parCode.get(code)?.nom ?? `#${code}`;
  const posees = new Set(lignes.map((l) => l.code));
  const dispo = catalogue.filter((l) => !posees.has(l.code));
  const plein = lignes.length >= MAX_LIGNES;
  const budget = budgetEmplacements(lignes);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">Sous-propriétés verrouillées</span>
        <span className="font-mono text-nano text-ink-dim tabular-nums">
          {lignes.length} / {MAX_LIGNES}
        </span>
      </div>

      {lignes.map((ligne) => {
        const def = parCode.get(ligne.code);
        const plafond = plafondLigne(ligne.code);
        const parPiece = ARTIFACT_SUB_MAX[ligne.code] ?? 0;
        // ⚠️ Au-delà du plafond d'UNE pièce, les DEUX doivent porter la ligne :
        // ça consomme un emplacement de chaque côté, pas un seul « libre ».
        const exigeLesDeux = def?.sortes.length === 2 && ligne.min > parPiece;
        // Les autres formes qui recouvrent celle-ci — équivalentes au CALCUL,
        // étrangères au VERROU. Deux familles : les Dgts CRIT par compétence
        // (3/4 recouvre Comp.3 et Comp.4) et les amplifications de buff
        // (ATQ/DEF recouvre ATQ et DEF).
        const voisins = codesEquivalentsAuVerrou(ligne.code);
        return (
          <div
            key={ligne.code}
            // ⚠️ UN seul contour. Le plafond vit DANS la boîte, en seconde
            // rangée de la grille — une boîte bordée sous chaque ligne aurait
            // empilé deux contours de 1 px.
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 gap-y-0.5 rounded border border-border-soft bg-panel2 py-1 pl-2 pr-1"
          >
            <span className="text-xs leading-tight text-ink">{def?.nom ?? `#${ligne.code}`}</span>
            {def && <Pastille sortes={def.sortes} />}
            <NumberField
              value={ligne.min}
              onChange={(v) =>
                onChange(lignes.map((l) => (l.code === ligne.code ? { ...l, min: v ?? 0 } : l)))
              }
              min={0}
              // ⚠️ **Borné au plafond de la PAIRE**, pas d'un avertissement :
              // une exigence au-delà ne peut être satisfaite par aucun
              // inventaire, aussi riche soit-il. Le plafond double pour une
              // ligne portable par les deux pièces, reste simple sinon.
              max={plafond}
              sansBoutons
              width="w-12"
              suffix="%"
              ariaLabel={`Minimum pour ${def?.nom ?? ligne.code}`}
            />
            <BoutonIcone
              onClick={() => onChange(lignes.filter((l) => l.code !== ligne.code))}
              ton="danger"
              taille="serre"
              icone={<X size={11} />}
              libelle={`Retirer ${def?.nom ?? ligne.code}`}
            />
            <span
              className={`col-span-full font-mono text-nano tabular-nums ${exigeLesDeux ? 'text-warn' : 'text-ink-dimmer'}`}
            >
              {def?.sortes.length === 2
                ? exigeLesDeux
                  ? `max ${plafond} % cumulé — au-delà de ${parPiece} %, les DEUX artéfacts devront la porter`
                  : `max ${plafond} % en cumulant les deux artéfacts`
                : `max ${plafond} % · un seul artéfact peut la porter`}
            </span>
            {/* ⚠️ **Le verrou somme STRICTEMENT par code.** Deux familles du
                jeu ont une forme GROUPÉE qui recouvre des formes simples :
                « Dgts CRIT [compétence 3/4] » face à « [Comp.3] » et
                « [Comp.4] », et « Effet renforcement ATQ/DEF » face aux deux
                renforcements séparés. Au calcul des dégâts elles font la même
                chose ; au verrouillage, non — exiger l'une ignore l'autre. Sur
                un inventaire mixte, le verrou écarte donc une partie des
                pièces sans rien dire.
                Signalé par l'utilisateur, qui a préféré l'AVERTISSEMENT à un
                cumul groupé : celui-ci introduirait la première ligne dont la
                valeur ne se lit plus sur un seul code, avec un plafond et une
                arithmétique d'emplacements à repenser. */}
            {voisins.length > 0 && (
              <span className="col-span-full text-nano leading-tight text-warn">
                Compte uniquement cette forme. {voisins.map((c) => `« ${nomDe(c)} »`).join(' et ')}{' '}
                {voisins.length > 1 ? 'valent' : 'vaut'} pareil au calcul des dégâts, mais
                {voisins.length > 1 ? ' ne seront pas comptées' : ' ne sera pas comptée'} par ce verrou.
              </span>
            )}
          </div>
        );
      })}

      {/* `value=""` en permanence : ce menu AJOUTE, il ne porte pas de
          sélection courante. Même patron que l'éditeur des Recommandations. */}
      <Selecteur
        value=""
        disabled={plein || dispo.length === 0}
        onChange={(e) => {
          const code = Number(e.target.value);
          if (code) onChange([...lignes, { code, min: 0 }]);
        }}
        taille="sm"
        surface="panel2"
      >
        <option value="">
          {plein ? `Les ${MAX_LIGNES} sous-propriétés sont prises` : '+ Sous-propriété…'}
        </option>
        {dispo.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nom}
          </option>
        ))}
      </Selecteur>

      {lignes.length > 0 && (
        // ⚠️ Le compteur de SOUS-PROPRIÉTÉS OCCUPÉES, pas le compte de lignes :
        // un artéfact en porte 4, la paire 8, en deux moitiés de 4 qui ne se
        // prêtent rien. Verrouiller 5 lignes réservées au type est impossible
        // d'avance, quelle que soit la richesse de l'inventaire — et seul ce
        // découpage le montre PENDANT la saisie.
        <div className="flex flex-wrap items-center gap-x-3 font-mono text-nano tabular-nums text-ink-dim">
          <span>
            sous-propriétés&nbsp;: attribut{' '}
            <b className={budget.attribut > MAX_ARTIFACT_SUBS ? 'text-bad' : 'text-ink'}>
              {budget.attribut}/{MAX_ARTIFACT_SUBS}
            </b>
          </span>
          <span>
            type{' '}
            <b className={budget.type > MAX_ARTIFACT_SUBS ? 'text-bad' : 'text-ink'}>
              {budget.type}/{MAX_ARTIFACT_SUBS}
            </b>
          </span>
          {budget.libres > 0 && <span>{budget.libres} à placer</span>}
        </div>
      )}

      {diagnostic && diagnostic.length > 0 && (
        // ⚠️ **Observé, jamais déduit.** On ne dit pas « c'est impossible » : on
        // rapporte ce que l'inventaire a réellement produit, ligne par ligne.
        // Un pré-contrôle théorique pourrait annoncer l'impossible sur une
        // combinaison réalisable — bien pire que de se taire. L'utilisateur
        // voit laquelle bloque, et de combien.
        <div className="flex flex-col gap-1 rounded border border-bad/50 bg-bad-soft/50 px-2 py-1.5">
          <span className="text-xs font-semibold text-bad">
            Aucune paire d’artéfacts ne satisfait ces sous-propriétés
          </span>
          {diagnostic.map((d) => (
            <div key={d.code} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-ink">{parCode.get(d.code)?.nom ?? `#${d.code}`}</span>
              <span className="flex items-baseline gap-1.5 shrink-0">
                <span className="font-mono text-nano tabular-nums text-ink-dim">
                  {d.min} % exigé · {d.auMieux} % au mieux
                </span>
                <span className={`font-semibold ${d.atteint ? 'text-good' : 'text-bad'}`}>
                  {d.atteint ? '✓' : '✗'}
                </span>
              </span>
            </div>
          ))}
          {/* ⚠️ Le maximum est pris ligne par ligne, INDÉPENDAMMENT : deux
              lignes peuvent chacune être atteignables sans qu'aucune paire ne
              les serve ensemble. Le dire, plutôt que laisser croire qu'un « ✓ »
              partout serait contradictoire avec l'échec. */}
          <span className="text-nano text-ink-dimmer">
            Chaque maximum est mesuré sous-propriété par sous-propriété : deux sous-propriétés
            atteignables séparément peuvent ne l’être par aucune paire à la fois.
          </span>
        </div>
      )}

      {budget.impossible && (
        // ⚠️ Ne prouve QUE le dépassement d'emplacements — jamais que
        // l'inventaire ne suit pas. Ce diagnostic-là se lit sur le balayage,
        // pas sur une déduction (voir `meilleurCumulParLigne`).
        <p className="rounded border border-bad/50 bg-bad-soft/50 px-2 py-1 text-xs text-bad">
          Ces sous-propriétés ne tiennent pas sur deux artéfacts : chacun n’en porte que{' '}
          {MAX_ARTIFACT_SUBS}.
        </p>
      )}
    </div>
  );
}
