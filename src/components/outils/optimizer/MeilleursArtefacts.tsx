import { ZoneCliquable, Bouton } from '../../../ui';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import Segmented from '../../../ui/Segmented';
import { CRITERE_ARTEFACTS_LABELS } from './constantes';
import ArtifactFrameIcon from '../../ArtifactFrameIcon';
import { formatArtifactMain } from '../../../lib/effects';
import ArtifactSubLigne from '../../ArtifactSubLigne';
import { type ArtifactDetail, type ArtifactKind } from '../../../types';
import { type Dispatch, type SetStateAction } from 'react';
import { type SkillDamageProfile } from '../../../lib/damage';
import { type ExclusionSelector, type ValidatedBuild } from '../../../lib/optimizerExclusion';
import { type UseOptimizerLists } from '../../../hooks/useOptimizerLists';

export interface MeilleursArtefactsProps {
  modeArtefactsSeuls: { explication: string | null; paire: ArtifactDetail[]; gainBrutParCoup: number; degatsParCoup: number; surLeReel: boolean; reelIndisponible: boolean; dejaPorte: boolean; coutVerrousPct: number | null; };
  etroit: boolean;
  setArtefactsOuverts: Dispatch<SetStateAction<boolean>>;
  artefactsOuverts: boolean;
  critereArtefacts: 'brut' | 'reel';
  setCritereArtefacts: Dispatch<SetStateAction<'brut' | 'reel'>>;
  setSetupOuvert: Dispatch<SetStateAction<boolean>>;
  sortesFigees: ArtifactKind[];
  resolvedSkill: SkillDamageProfile | null;
  sourceSelector: ExclusionSelector | null;
  lists: UseOptimizerLists;
  ownValidatedBuild: ValidatedBuild | undefined;
  canValidateDisplayed: boolean;
  handleValidateArtefacts: () => void;
  artefactsProposesDejaReserves: boolean;
  // Bureau seulement (optimizer/bureau/MeilleursArtefactsBureau.tsx) : le bloc
  // devient une SECTION à part du panneau de la colonne, sans cadre, sous la
  // relique, au lieu d'un encart de la carte « Artéfacts et reliques ». Le
  // téléphone ne le passe pas.
  carte?: boolean;
}

export default function MeilleursArtefacts({ modeArtefactsSeuls, etroit, setArtefactsOuverts, artefactsOuverts, critereArtefacts, setCritereArtefacts, setSetupOuvert, sortesFigees, resolvedSkill, sourceSelector, lists, ownValidatedBuild, canValidateDisplayed, handleValidateArtefacts, artefactsProposesDejaReserves, carte = false }: MeilleursArtefactsProps) {
  return (
    <div className={carte ? '' : 'mt-2.5 rounded-lg border border-border-soft bg-panel2/60 px-2 py-1.5'}>
      {(() => {
        const enTete = (<>
        {/* ⚠️ **« offensifs » reste dans le titre** : le segmenté
            ci-dessous dit précisément ce que le bloc maximise, mais le mot
            dit autre chose : ce bloc ne
            cherche pas la meilleure paire dans l'absolu, il cherche la plus
            offensive — et ses deux crans (dégâts bruts, dégâts du sort) sont
            offensifs l'un comme l'autre. Sans lui, « meilleurs » se lirait
            comme un verdict général, alors qu'un tank peut parfaitement
            vouloir tout autre chose. */}
        <span className="label">Meilleurs artéfacts offensifs pour ce build</span>
        {/* ⚠️ **L'ABSOLU d'abord, l'écart ensuite** (demande explicite). Le
            delta seul laissait sans réponse « combien cette paire me
            rapporte-t-elle ? » : un gros gain sur une base nulle et un petit
            gain sur une grosse base affichaient le même nombre.
            ⚠️ L'absolu s'affiche TOUJOURS, même quand on porte déjà la
            meilleure paire — c'est justement là qu'il est seul à dire quelque
            chose, l'écart valant zéro. L'écart, lui, ne s'affiche que si la meilleure
            paire n'est pas déjà portée et que l'écart n'est pas nul à
            l'arrondi, en plus comme en moins (voir plus bas). */}
        {/* ⚠️ Aucun chiffre quand il n'y a rien à proposer : un « 0 / coup »
            se lirait comme un résultat, alors que rien n'a été cherché. */}
        {modeArtefactsSeuls.explication == null && (
          // La mono sur les chiffres seuls (l'absolu, l'écart) ; « dégâts » et
          // « / coup » en police du texte.
          <span className="flex items-baseline gap-1.5 text-micro">
            <span className="text-ink">
              <span className="font-mono">{Math.round(modeArtefactsSeuls.degatsParCoup).toLocaleString('fr-FR')}</span>
              {modeArtefactsSeuls.surLeReel ? ' dégâts' : ' / coup'}
            </span>
            {/* ⚠️ **L’écart s’affiche AUSSI quand il est négatif.** Il ne
                l’était que s’il était positif : on cachait donc exactement
                l’information défavorable, en laissant un absolu qui avait
                l’air d’un gain.

                ⚠️ Un écart négatif n’est PAS une anomalie : la paire
                portée sort des candidates dès qu’une contrainte l’exclut —
                une principale imposée, une ligne verrouillée, ou une pièce
                déjà réservée par un autre monstre de la liste. Le nombre dit
                alors ce que cette contrainte coûte, ce qui est précisément
                ce qu’on veut savoir.

                ⚠️ Test sur l’ARRONDI, pas sur la valeur brute : un écart
                de 0,4 aurait affiché « +0 ». */}
            {!modeArtefactsSeuls.dejaPorte && Math.round(modeArtefactsSeuls.gainBrutParCoup) !== 0 && (
              <span className={`font-mono ${modeArtefactsSeuls.gainBrutParCoup > 0 ? 'text-good' : 'text-bad'}`}>
                {modeArtefactsSeuls.gainBrutParCoup > 0 ? '+' : '−'}
                {Math.abs(Math.round(modeArtefactsSeuls.gainBrutParCoup)).toLocaleString('fr-FR')}
              </span>
            )}
          </span>
        )}
        </>);
        // Au téléphone, le bloc se replie derrière son titre (replié par
        // défaut), comme « Gérer mes listes » ; le chiffre reste lisible.
        return etroit ? (
          <ZoneCliquable
            onClick={() => setArtefactsOuverts((v) => !v)}
            aria-expanded={artefactsOuverts}
            className="flex w-full items-center gap-2 text-left"
          >
            <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">{enTete}</span>
            <ChevronDown size={13} className={`flex-none text-ink-dim transition-transform ${artefactsOuverts ? 'rotate-180' : ''}`} />
          </ZoneCliquable>
        ) : (
          <div className="flex items-baseline justify-between gap-2">{enTete}</div>
        );
      })()}
      {(!etroit || artefactsOuverts) && <>
      {/* ⚠️ Choisir « Dégâts réels » OUVRE la fenêtre du combat, comme le cran
          homonyme de l'objectif de recherche : sans ce geste, le classement
          reposerait sur un sort, une cible et un critique jamais choisis —
          exactement ce qui avait fait RETIRER cette optimisation. */}
      <Segmented<'brut' | 'reel'>
        options={CRITERE_ARTEFACTS_LABELS}
        value={critereArtefacts}
        onChange={(v) => {
          setCritereArtefacts(v);
          if (v === 'reel') setSetupOuvert(true);
        }}
        size="sm"
        // ⚠️ `w-fit` : le `flex-none` que `Segmented` pose en taille `sm` ne
        // vaut que s'il est ENFANT d'un conteneur flex. Ici le parent est en
        // flux de bloc, donc sa propre boîte flex prenait toute la largeur —
        // deux crans étirés sur 700 px. Même piège que la grille Conditions,
        // qui porte déjà ce `w-fit` pour la même raison.
        // Au bureau (`carte`), centrés dans la colonne.
        className={carte ? 'mx-auto mt-1 w-fit' : 'mt-1 w-fit'}
      />
      {modeArtefactsSeuls.reelIndisponible && (
        <p className="mt-1 text-micro text-warn">
          Aucun sort de ce monstre n’est calculable : classement sur les dégâts supplémentaires.
        </p>
      )}
      {/* ⚠️ **Un seul emplacement figé : la proposition reste valable, mais
          CONTRAINTE.** Sans cette ligne, « le meilleur » se lirait comme « le
          meilleur de ton inventaire », alors qu'une moitié était imposée. La
          question reste bonne — « à artéfact d'attribut donné, quel type ? » —
          il faut juste dire qu'on y répond. */}
      {modeArtefactsSeuls.explication == null && sortesFigees.length === 1 && (
        // ⚠️ **Un BANDEAU, pas une phrase de bas de bloc.** La mention
        // vivait en `text-ink-dimmer` sous le titre, loin du regard : on
        // lisait la paire en croyant à deux propositions. Elle passe donc
        // AU-DESSUS des pièces, dans une boîte qui se détache du bloc.
        //
        // ⚠️ **Neutre appuyé, pas `alerte`** : un
        // réglage que l’utilisateur a lui-même posé n’est pas un
        // avertissement. L’ambre reste réservé à ce qui réclame une action
        // (« Valider les artéfacts ») — deux ambres de sens différents dans
        // la même carte auraient dévalué les deux. Le contraste vient donc
        // du contour (`border` plein là où le bloc porte `border-soft`) et
        // de l’encre pleine, pas de la couleur.
        //
        // ⚠️ UN seul contour : ce bandeau est un FRÈRE des pièces, jamais
        // une boîte posée sur une autre boîte déjà bordée.
        <p className="mt-1.5 rounded border border-border bg-panel px-2 py-1 text-micro leading-tight text-ink">
          <b className="font-semibold">
            Emplacement {sortesFigees[0] === 'element' ? 'attribut' : 'type'} figé
          </b>{' — '}
          il est gardé tel que porté, pas optimisé. Seul l’emplacement{' '}
          {sortesFigees[0] === 'element' ? 'type' : 'attribut'} est cherché ici.
        </p>
      )}
      {/* ⚠️ **La raison passe DEVANT tout le reste.** Elle dit ce que
          l'utilisateur a lui-même posé (un emplacement figé) ou ce que
          l'inventaire ne peut pas donner — dans les deux cas, afficher une
          proposition ou un « déjà porté » serait trompeur. */}
      {modeArtefactsSeuls.explication != null ? (
        <p className="mt-0.5 text-micro leading-tight text-ink-dim">{modeArtefactsSeuls.explication}</p>
      ) : modeArtefactsSeuls.dejaPorte ? (
        // ⚠️ Le dire plutôt que d'afficher « +0 » : « tu portes déjà les
        // meilleurs » est une réponse, un zéro ressemble à une panne.
        <p className="mt-0.5 text-micro text-ink-dim">
          Tu portes déjà la meilleure paire disponible pour ce critère.
        </p>
      ) : modeArtefactsSeuls.paire.length === 0 ? (
        <p className="mt-0.5 text-micro text-ink-dim">Aucun artéfact équipable ne correspond aux critères.</p>
      ) : (
        // ⚠️ **Le rendu du JEU, pas une ligne aplatie.** Les quatre
        // sous-propriétés étaient jointes par des « · » sur une seule ligne qui
        // repassait à la ligne n'importe où, avec un formatage maison
        // (`artifactSubLabel(...).replace('X', …)`) — un second rendu de la
        // même donnée, que rien ne rapprochait de l'inventaire ni du jeu.
        // `ArtifactSubLigne` est PARTAGÉ avec la tuile d'inventaire :
        // une ligne par propriété, la pastille de procs, la valeur en gras, le
        // marqueur des propriétés modifiées.
        // ⚠️ **Côte à côte, pas empilés** : une PAIRE se lit d'un coup d'œil,
        // et l'empilement doublait la hauteur du bloc dans une carte déjà
        // longue. `sm:` et non une largeur de conteneur : sous ce seuil la
        // carte est pleine largeur mais étroite (téléphone), où deux colonnes
        // couperaient les libellés longs — ils repassent alors l'un sous
        // l'autre. `items-start` : l'artéfact qui a la principale la plus
        // courte ne s'étire pas à la hauteur de l'autre.
        <div className="mt-1.5 grid grid-cols-1 items-start gap-x-4 gap-y-2 sm:grid-cols-2">
          {modeArtefactsSeuls.paire.map((a) => (
            /* ⚠️ **Atténuation LÉGÈRE sur la pièce figée** — elle
                n’est pas une proposition, elle est un fait. Le bandeau et le
                marqueur le disent déjà ; ceci ne fait qu’établir la
                hiérarchie, pour que l’œil tombe d’abord sur la moitié
                réellement cherchée.

                ⚠️ **80 %, et surtout PAS moins.** Le vocabulaire
                « désactivé » de ce dépôt vit à 30-40 % (`Bouton`,
                `NumberField`) : descendre là ferait lire « indisponible »
                une pièce qui est justement celle qu’on portera. Rester
                nettement au-dessus garde le sens « secondaire ». */
            <div key={`${a.kind}-${a.id}`} className={`flex items-start gap-2 ${sortesFigees.includes(a.kind) ? 'opacity-80' : ''}`}>
              <ArtifactFrameIcon artifact={a} size={24} />
              <div className="min-w-0 flex-1">
                {/* La principale en tête, comme sur une pièce en jeu : sans
                    elle, on lisait quatre sous-propriétés sans savoir ce que
                    l'artéfact apporte d'abord. */}
                {/* ⚠️ **Le marqueur désigne LAQUELLE.** Le bandeau dit ce
                    qui se passe, ce jeton dit sur quelle pièce — sans lui,
                    il fallait retraduire « attribut » en « celle de
                    gauche ». Même gabarit que la pastille de sorte de
                    ArtifactLinesEditor : rien de nouveau dans la librairie. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-micro font-semibold leading-tight text-ink">{formatArtifactMain(a.main)}</p>
                  {sortesFigees.includes(a.kind) && (
                    <span className="shrink-0 rounded-full border border-border bg-panel px-1.5 py-px text-nano font-semibold text-ink-dim">
                      figé
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-[3px]">
                  {a.subs.map((s, i) => (
                    <ArtifactSubLigne key={i} sub={s} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ⚠️ **Dire ce que le chiffre EST.** Le « +X % grâce aux artéfacts » des
          cartes de résultat a été retiré précisément parce que personne ne
          pouvait le nommer. Celui-ci se nomme : des dégâts BRUTS, par coup,
          qui ne critent pas et ignorent la défense — donc calculables sans
          choisir de sort ni décrire d'adversaire. */}
      {/* ⚠️ Affichée dès qu'un chiffre l'est — donc AUSSI quand on porte déjà
          la meilleure paire, puisque l'absolu s'affiche dans ce cas-là. Un
          nombre sans sa légende serait exactement le défaut du « +X % grâce
          aux artéfacts » qu'on a retiré. */}
      {modeArtefactsSeuls.paire.length > 0 && (
        <p className="mt-1 text-nano text-ink-dimmer">
          {modeArtefactsSeuls.surLeReel
            ? `Dégâts totaux de ${resolvedSkill ? `« ${resolvedSkill.nom} »` : 'ce sort'} contre l’adversaire décrit — ouvre « Dégâts réels » pour changer le sort, la cible ou le traitement du critique.`
            : 'Dégâts supplémentaires bruts, à chaque coup — ils ne peuvent pas être critiques et ignorent la défense adverse, donc ce gain ne dépend ni du sort utilisé ni de la cible.'}
        </p>
      )}
      {modeArtefactsSeuls.coutVerrousPct != null && (
        // ⚠️ « sur ce build » n'est PAS une précaution de langage : la recherche
        // de runes a elle aussi tourné sous le modèle contraint, donc sans les
        // verrous d'AUTRES builds auraient pu émerger. Un libellé sans cette
        // précision laisserait croire à un contrefactuel global qu'on ne
        // calcule pas.
        <p className="mt-1 text-micro text-warn">
          Vos lignes verrouillées coûtent −{modeArtefactsSeuls.coutVerrousPct.toFixed(1)} % sur ce build.
        </p>
      )}
      {/* ⚠️ **La proposition devient actionnable.** Le bloc calculait la
          meilleure paire sans qu’on puisse la prendre : il fallait la
          retrouver à la main dans l’inventaire. Le bouton n’apparaît qu’avec
          une liste active — une réservation appartient toujours à une liste
          — et jamais sur une pièce figée ou une absence de proposition. */}
      {modeArtefactsSeuls.explication == null &&
        modeArtefactsSeuls.paire.length > 0 &&
        sourceSelector &&
        lists.activeListId &&
        (ownValidatedBuild || canValidateDisplayed) && (
          <Bouton
            onClick={handleValidateArtefacts}
            disabled={artefactsProposesDejaReserves}
            // ⚠️ Même code couleur que « Valider les artéfacts » des cartes
            // de résultat : `alerte` signale un état des DONNÉES — ce qui est
            // montré n’est pas ce qui est réservé. Une fois réservée, la
            // paire repasse en `accent`, comme tout ce qui est validé.
            ton={artefactsProposesDejaReserves ? 'accent' : 'alerte'}
            fond="doux"
            taille="sm"
            pleineLargeur
            icone={artefactsProposesDejaReserves ? <CheckCircle2 size={14} /> : undefined}
            libelle={
              artefactsProposesDejaReserves
                ? 'Artéfacts validés'
                : ownValidatedBuild
                  ? 'Valider ces artéfacts'
                  : 'Valider ce build avec ces artéfacts'
            }
            className="mt-2"
          />
        )}
      </>}
    </div>
  );
}
