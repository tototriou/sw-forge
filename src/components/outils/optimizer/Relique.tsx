import HelpPopover from '../../HelpPopover';
import { LARGEUR_LIBELLE_LISTE, LARGEUR_SELECTEUR_LISTE } from './constantes';
import { Selecteur, NumberField } from '../../../ui';
import { RelicMainChoice, DEFAULT_RELIC_MIN_UPGRADE, type ArtifactMainChoice, type RelicUniqueChoice } from '../../../hooks/useOptimizerState';
import { RELIC_MAIN_OPTIONS, RELIC_UNIQUE, relicUniqueEffectLabel } from '../../../lib/effects';
import { type Dispatch, type SetStateAction } from 'react';

export interface ReliqueProps {
  relicMainChoice: ArtifactMainChoice;
  setRelicMainChoice: Dispatch<SetStateAction<ArtifactMainChoice>>;
  relicUniqueChoice: RelicUniqueChoice;
  setRelicUniqueChoice: Dispatch<SetStateAction<RelicUniqueChoice>>;
  relicMinUpgrade: number;
  setRelicMinUpgrade: Dispatch<SetStateAction<number>>;
}

export default function Relique({ relicMainChoice, setRelicMainChoice, relicUniqueChoice, setRelicUniqueChoice, relicMinUpgrade, setRelicMinUpgrade }: ReliqueProps) {
  return (
    <div className="mt-3 border-t border-border-soft pt-3">
      <div className="flex items-center gap-1">
        <span className="label">Relique</span>
        <HelpPopover title="Relique">
          Les soins et boucliers (Régénération) ne sont mesurés par aucun objectif, donc jamais notés.
          <br />
          <br />
          <b className="text-ink">« Garder la relique équipée »</b> conserve la pièce entière portée sur
          le build affiché ci-dessus, sans rien chercher.
        </HelpPopover>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs text-ink ${LARGEUR_LIBELLE_LISTE}`}>Principale</span>
          <Selecteur
            value={String(relicMainChoice)}
            onChange={(e) => {
              const raw = e.target.value;
              const next: RelicMainChoice =
                raw === 'equipped' || raw === 'libre' ? raw : (Number(raw) as 100 | 101 | 102);
              setRelicMainChoice(next);
            }}
            taille="sm"
            surface="panel2"
            pleineLargeur={false}
            className={LARGEUR_SELECTEUR_LISTE}
          >
            <option value="equipped">Garder la relique équipée</option>
            <option value="libre">Libre</option>
            {RELIC_MAIN_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </Selecteur>
        </div>
        {/* Groupés : « Niveau minimum » reste à côté de « Propriété unique » quand la carte le permet. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs text-ink ${LARGEUR_LIBELLE_LISTE}`}>Propriété unique</span>
          {/* ⚠️ **Sans effet avec « Garder la relique équipée »** (la
              pièce est fixée) — désactivé plutôt que retiré ; la raison
              reste dans l'infobulle, sans texte à côté qui prendrait
              la place de « Niveau minimum ». */}
          <Selecteur
            value={String(relicUniqueChoice)}
            onChange={(e) => {
              const raw = e.target.value;
              setRelicUniqueChoice(raw === 'libre' ? 'libre' : Number(raw));
            }}
            taille="sm"
            surface="panel2"
            pleineLargeur={false}
            className={LARGEUR_SELECTEUR_LISTE}
            disabled={relicMainChoice === 'equipped'}
            title={relicMainChoice === 'equipped' ? 'Sans effet : la relique équipée est fixée' : undefined}
          >
            <option value="libre">Libre</option>
            {/* ⚠️ Libellé DÉRIVÉ de `RELIC_UNIQUE` (`relicUniqueEffectLabel`,
                effects.ts) — « <effet> en fonction <stat> » avec les mots du
                jeu des deux moitiés, jamais une table séparée
                (game-data-curation). Même libellé que sur la carte candidat
                (RelicSlot → `RelicDetailBox` → `formatRelicUnique`, qui
                reste la phrase COMPLÈTE, trop longue pour un sélecteur). */}
            {Object.keys(RELIC_UNIQUE)
              .map(Number)
              .map((type) => (
                <option key={type} value={type}>
                  {relicUniqueEffectLabel(type)}
                </option>
              ))}
          </Selecteur>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Au bureau, libellé court et champ à deux chiffres : la rangée
              tient à côté de « Propriété unique ». */}
          <span className={`text-xs text-ink ${LARGEUR_LIBELLE_LISTE} lg:w-auto`} title="Niveau minimum">
            <span className="lg:hidden">Niveau minimum</span><span className="hidden lg:inline">Niveau min.</span>
          </span>
          {/* ⚠️ Filtre d'ENTRÉE sur le pool de reliques cherché, jamais
              un critère de classement (la dominance départage les
              reliques qui passent le seuil). Sans effet tant que
              « Principale » ne vaut pas « Libre » ou une principale
              forcée — pas désactivé pour autant : la combinaison
              reste rare, et un champ qui apparaît/disparaît selon un
              AUTRE champ de la même carte serait plus déroutant que
              sans effet à l'occasion (contrairement à « Propriété
              unique », désactivée seulement par « Garder la relique
              équipée », qui la rend vraiment inerte). */}
          <NumberField
            value={relicMinUpgrade}
            onChange={(v) => setRelicMinUpgrade(v ?? DEFAULT_RELIC_MIN_UPGRADE)}
            min={0}
            max={15}
            width="w-8"
            title="Niveau minimum de la relique — filtre d'entrée sur le pool cherché, jamais un critère de classement"
          />
        </div>
        </div>
      </div>
    </div>
  );
}
