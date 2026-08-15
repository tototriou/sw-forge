import { useEffect, useState } from 'react';
import { Sword, Shield, Zap, Star } from 'lucide-react';
import { Monster } from '../../types';
import { Modale } from '../Dialogs';
import ElementIcon from '../ElementIcon';
import {
  Competence,
  DetailMonstre,
  chargerDetail,
  formuleLisible,
} from '../../lib/monsterSkills';

// Fiche complète d'un monstre : ses stats de base, son lead, et le DÉTAIL de
// ses compétences — coefficients, effets, taux, montées de niveau.
//
// ⚠️ **En modale plein écran, pas en panneau sous la grille.** Une fiche porte
// trois ou quatre compétences avec chacune sa formule, ses effets et ses sept
// niveaux d'amélioration : posée dans le flux, elle repousserait la grille de
// plusieurs écrans et on perdrait le monstre qu'on venait de cliquer.
//
// ⚠️ Le détail est **chargé à l'ouverture**, pas au montage de la page : il vit
// dans un fichier par monstre (~3 Ko), et on ne télécharge que ce qu'on ouvre.
export default function MonsterDetailDialog({
  monster,
  onClose,
}: {
  monster: Monster;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<DetailMonstre | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let vivant = true;
    setChargement(true);
    chargerDetail(monster.com2usId).then((d) => {
      // ⚠️ Garde de démontage : on peut fermer la fiche avant la fin du
      // chargement, et écrire dans un composant démonté lève un avertissement.
      if (!vivant) return;
      setDetail(d);
      setChargement(false);
    });
    return () => {
      vivant = false;
    };
  }, [monster.com2usId]);

  const s = monster.stats;

  return (
    <Modale onClose={onClose} labelledBy="fiche-monstre" largeur="max-w-[720px]">
      {/* En-tête : portrait, nom, élément, rareté naturelle. */}
      <div className="mb-3 flex items-start gap-3">
        {monster.image && (
          <div className="hex-frame h-[64px] w-[64px] flex-none overflow-hidden bg-panel2">
            <img
              src={monster.image}
              alt={monster.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="fiche-monstre" className="font-display text-[19px] tracking-wide text-ink">
            {monster.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-dim">
            <span className="inline-flex items-center gap-1">
              <ElementIcon element={monster.element} size={14} />
            </span>
            {monster.naturalStars != null && (
              <span className="inline-flex items-center gap-0.5 font-mono text-star">
                {monster.naturalStars}
                <Star size={11} className="fill-current" />
              </span>
            )}
            {monster.secondAwaken && (
              <span className="rounded bg-accent-soft px-1.5 py-px font-mono text-[11px] text-ink">
                2A
              </span>
            )}
            {detail?.archetype && <span>{detail.archetype}</span>}
          </div>
        </div>
      </div>

      {/* Stats du monstre 6★ nu — les mêmes que celles qui servent aux calculs
          de l'app (voir spec/shared/donnees-monstres.md). */}
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-panel2 p-2.5 sm:grid-cols-4">
        <Stat label="PV" valeur={s.hp} />
        <Stat label="ATQ" valeur={s.attack} />
        <Stat label="DEF" valeur={s.defense} />
        <Stat label="VIT" valeur={s.speed} />
        <Stat label="Taux crit." valeur={s.critRate} suffixe="%" />
        <Stat label="Dmg crit." valeur={s.critDamage} suffixe="%" />
        <Stat label="RES" valeur={s.resistance} suffixe="%" />
        <Stat label="Précision" valeur={s.accuracy} suffixe="%" />
      </div>

      {/* Compétence de leader — ce que le monstre apporte à l'équipe. */}
      {monster.leaderSkill && (
        <div className="mb-3 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-2 text-[12px]">
          <span className="label">Leader</span>
          <p className="mt-0.5 text-ink">
            {monster.leaderSkill.stat} +{monster.leaderSkill.amount} %
            {monster.leaderSkill.area && monster.leaderSkill.area !== 'General' && (
              <span className="text-ink-dim"> · {monster.leaderSkill.area}</span>
            )}
            {monster.leaderSkill.element && (
              <span className="text-ink-dim"> · {monster.leaderSkill.element}</span>
            )}
          </p>
        </div>
      )}

      {chargement ? (
        <p className="py-6 text-center text-[12px] text-ink-dim">Chargement des compétences…</p>
      ) : detail && detail.competences.length > 0 ? (
        <div className="flex flex-col gap-2">
          {detail.competences.map((c) => (
            <CompetenceBloc key={c.id} c={c} />
          ))}
          {detail.skillUpsToMax != null && (
            <p className="mt-1 font-mono text-[11px] text-ink-dim">
              {detail.skillUpsToMax} amélioration(s) pour maxer ses compétences.
            </p>
          )}
        </div>
      ) : (
        // ⚠️ Le message dit POURQUOI c'est vide. « Aucune compétence » se lirait
        // comme une affirmation sur le monstre, alors que c'est notre donnée qui
        // manque — un monstre perso n'a pas de fiche SWARFARM.
        <p className="py-6 text-center text-[12px] text-ink-dim">
          {monster.com2usId == null
            ? "Ce monstre a été créé à la main : il n'a pas de fiche de compétences."
            : 'Le détail des compétences de ce monstre n’est pas disponible.'}
        </p>
      )}
    </Modale>
  );
}

function Stat({
  label,
  valeur,
  suffixe = '',
}: {
  label: string;
  valeur: number | null | undefined;
  suffixe?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="text-ink-dim">{label}</span>
      <span className="font-mono tabular-nums text-ink">
        {valeur ?? '—'}
        {valeur != null && suffixe}
      </span>
    </div>
  );
}

// Une compétence : son nom, son coefficient, sa description, ses effets et ses
// montées de niveau.
function CompetenceBloc({ c }: { c: Competence }) {
  const formule = formuleLisible(c.formule);
  return (
    <div className="rounded-lg border border-border bg-panel2 p-2.5">
      <div className="flex items-start gap-2.5">
        {c.icone && (
          <img
            src={c.icone}
            alt=""
            className="h-9 w-9 flex-none rounded"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {c.slot != null && (
              <span className="font-mono text-[11px] text-ink-dim">S{c.slot}</span>
            )}
            <span className="text-[13px] font-bold text-ink">{c.nom}</span>
            {c.passif && (
              <span className="rounded bg-panel px-1.5 py-px font-mono text-[10px] text-ink-dim">
                Passif
              </span>
            )}
            {c.aoe && (
              <span className="rounded bg-panel px-1.5 py-px font-mono text-[10px] text-ink-dim">
                Zone
              </span>
            )}
          </div>

          {/* ⚠️ Le COEFFICIENT en évidence : c'est la donnée qu'on vient
              chercher, celle qui décide d'un build. Elle passe avant la
              description, qui la raconte en mots. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
            {formule && (
              <span className="inline-flex items-center gap-1 text-star">
                <Sword size={11} /> {formule}
              </span>
            )}
            {c.coups != null && c.coups > 1 && (
              <span className="text-ink-dim">×{c.coups} coups</span>
            )}
            {c.cooldown != null && (
              <span className="inline-flex items-center gap-1 text-ink-dim">
                <Zap size={11} /> {c.cooldown} tours
              </span>
            )}
          </div>

          {c.description && (
            <p className="mt-1 text-[12px] leading-snug text-ink-dim">{c.description}</p>
          )}
        </div>
      </div>

      {/* Effets appliqués : buffs en vert, debuffs en rouge — le vocabulaire du
          jeu, où la couleur dit déjà de quel côté ça penche. */}
      {c.effets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.effets.map((e, i) => (
            <span
              key={i}
              title={[e.description, e.note].filter(Boolean).join(' · ') || undefined}
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] ${
                e.bonus
                  ? 'border-good/40 bg-good/10 text-good'
                  : 'border-fire/40 bg-fire/10 text-fire'
              }`}
            >
              {e.icone && <img src={e.icone} alt="" className="h-3.5 w-3.5" loading="lazy" />}
              {e.nom}
              {e.chance != null && (
                <span className="font-mono opacity-80">{e.chance} %</span>
              )}
              {e.surSoi && <Shield size={10} className="opacity-70" />}
            </span>
          ))}
        </div>
      )}

      {/* Montées de niveau : ce que chaque amélioration apporte. Repliées par
          défaut — c'est une liste de sept lignes par compétence, soit un mur si
          les quatre s'ouvrent d'un coup. */}
      {c.ameliorations.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-ink-dim transition hoverable:text-ink">
            {c.ameliorations.length} amélioration(s)
          </summary>
          <ol className="mt-1 space-y-px pl-4">
            {c.ameliorations.map((a, i) => (
              <li key={i} className="list-decimal text-[11px] leading-snug text-ink-dim">
                {a}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
