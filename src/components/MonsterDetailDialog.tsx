import { useEffect, useState } from 'react';
import { Sword, Shield, Star, Hourglass, ArrowRight } from 'lucide-react';
import { Monster } from '../types';
import { Modale } from './Dialogs';
import ElementIcon from './ElementIcon';
import Segmented from './Segmented';
import LeadPill from './siege/LeadPill';
import CollabPortrait from './CollabPortrait';
import { libelleCollab } from '../lib/collabPairs';
import {
  Competence,
  DetailMonstre,
  chargerDetail,
  formuleLisible,
  paliersRechargement,
} from '../lib/monsterSkills';

// Portées de lead, en français comme le reste de l'interface. « General » n'y
// figure pas : c'est le cas courant, et il n'est pas affiché.
const AREA_LABEL: Record<string, string> = {
  Arena: 'Arène',
  Guild: 'Guilde',
  Dungeon: 'Donjon',
  Element: 'Alliés du même élément',
};

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
  autre,
  jumeau,
  onClose,
}: {
  monster: Monster;
  // Seconde forme d'un monstre TRANSFORMABLE (Bellenus, les Sœurs…), si elle
  // existe. La grille n'en montre qu'une carte — mais les deux formes n'ont pas
  // les mêmes compétences, donc la fiche doit donner accès aux deux.
  autre?: Monster | null;
  // Équivalent SW d'un monstre de COLLABORATION (Satoru Gojo ↔ Werner).
  //
  // ⚠️ À ne pas confondre avec `autre` juste au-dessus : les deux formes d'un
  // transformable ont des compétences DIFFÉRENTES, d'où un sélecteur pour
  // passer de l'une à l'autre. Une paire de collab, elle, est le MÊME monstre —
  // mêmes stats, mêmes compétences — donc rien à sélectionner : les deux
  // identités cohabitent dans l'en-tête, et le reste de la fiche vaut pour les
  // deux.
  jumeau?: Monster | null;
  onClose: () => void;
}) {
  // Forme affichée. ⚠️ On mémorise le MONSTRE et non un index : les deux formes
  // sont deux objets distincts, et un index se lirait mal ici.
  const [forme, setForme] = useState<Monster>(monster);
  const [detail, setDetail] = useState<DetailMonstre | null>(null);
  const [chargement, setChargement] = useState(true);

  // Rouvrir la fiche sur un autre monstre remet la forme de départ : sans ça,
  // on garderait la forme transformée du monstre précédent.
  useEffect(() => setForme(monster), [monster]);

  useEffect(() => {
    let vivant = true;
    setChargement(true);
    chargerDetail(forme.com2usId).then((d) => {
      // ⚠️ Garde de démontage : on peut fermer la fiche avant la fin du
      // chargement, et écrire dans un composant démonté lève un avertissement.
      if (!vivant) return;
      setDetail(d);
      setChargement(false);
    });
    return () => {
      vivant = false;
    };
  }, [forme.com2usId]);

  // Les deux formes, dans l'ordre où on les lit : celle d'origine puis la
  // transformée.
  const formes = autre ? [monster, autre] : [];
  const s = forme.stats;

  // ⚠️ Le jumeau ne vaut que pour le monstre REÇU, pas pour sa forme
  // transformée : basculer de forme changerait de monstre sans changer de
  // jumeau, et l'en-tête annoncerait une paire qui n'existe pas.
  const jumeauAffiche = forme === monster ? jumeau : null;

  // 820 px : la colonne de gauche en prend 200, il en reste ~600 aux
  // compétences — la largeur qu'elles avaient seules avant la mise en colonnes.
  // Sans cet élargissement, les passer à droite les aurait rétrécies d'un tiers.
  //
  // ⚠️ `croix` : cette fiche se CONSULTE, elle ne demande rien. Aucun bouton
  // n'y dit par où sortir, et Échap comme le clic à côté sont invisibles.
  return (
    // ⚠️ `ctx` : l'ÉLÉMENT du monstre teinte toute la fiche (voir `--ctx` dans
    // index.css). C'est le principe de la refonte — on sait de quel monstre on
    // parle avant d'avoir lu son nom. Aucun composant à l'intérieur n'a besoin
    // de connaître l'élément : ils écrivent `text-ctx`, la valeur descend.
    <Modale
      onClose={onClose}
      labelledBy="fiche-monstre"
      largeur="max-w-[820px]"
      ctx={forme.element}
      croix
    >
      {/* En-tête : portrait, nom, élément, rareté naturelle. */}
      <div className="mb-3 flex items-start gap-3">
        {forme.image && (
          <div className="hex-frame relative h-[64px] w-[64px] flex-none overflow-hidden bg-ctx-soft">
            {/* ⚠️ Le MÊME portrait partagé que sur la carte (`CollabPortrait`),
                pas une seconde découpe : on vient de cliquer cette carte, et la
                fiche qui s'ouvre doit montrer la même chose. */}
            <CollabPortrait monster={forme} jumeau={jumeauAffiche} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* Les DEUX noms pour une paire de collaboration, comme sur la carte.
              ⚠️ Seulement sur la forme de BASE : sur une forme transformée, le
              jumeau ne correspondrait plus à ce qui est affiché. */}
          <h2 id="fiche-monstre" className="font-display text-[19px] tracking-wide text-ink">
            {jumeauAffiche ? libelleCollab(forme.name, jumeauAffiche.name) : forme.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-dim">
            <span className="inline-flex items-center gap-1">
              <ElementIcon element={forme.element} size={14} />
            </span>
            {forme.naturalStars != null && (
              <span className="inline-flex items-center gap-0.5 font-mono text-star">
                {forme.naturalStars}
                <Star size={11} className="fill-current" />
              </span>
            )}
            {forme.secondAwaken && (
              <span className="rounded bg-ctx-soft px-1.5 py-px font-mono text-[11px] text-ink">
                2A
              </span>
            )}
            {detail?.archetype && <span>{detail.archetype}</span>}
          </div>
        </div>
      </div>

      {/* ⚠️ Sélecteur de FORME, pour les monstres transformables. La grille n'en
          montre qu'une carte — les deux entrées sont indistinguables — mais
          leurs compétences DIFFÈRENT : Bellenus voit son S2 passer de 3.0 à
          2.0 × ATQ et son passif changer entièrement. Sans ce sélecteur, la
          déduplication ferait perdre la moitié de l'information.
          Un contrôle à cran (`Segmented`) : les deux formes s'excluent. */}
      {formes.length > 1 && (
        <div className="mb-3">
          <Segmented
            value={String(forme.com2usId)}
            onChange={(v) => {
              const cible = formes.find((f) => String(f.com2usId) === v);
              if (cible) setForme(cible);
            }}
            options={formes.map((f, i) => ({
              key: String(f.com2usId),
              // Le nom est le MÊME des deux côtés : c'est le rang qui les
              // distingue, comme dans le jeu où l'une se transforme en l'autre.
              label: i === 0 ? 'Forme de base' : 'Forme transformée',
              hint: `Compétences de la ${i === 0 ? 'forme de base' : 'forme transformée'}`,
            }))}
            size="lg"
          />
        </div>
      )}

      {/* ⚠️ DEUX COLONNES : ce que le monstre EST à gauche (stats, lead), ce
          qu'il FAIT à droite (compétences). Les deux se lisent ensemble — on
          juge un coefficient à l'aune de l'ATQ du monstre — et empilés, il
          fallait faire défiler pour passer de l'un à l'autre.
          La colonne de gauche est FIXE (200 px) : elle ne porte que des nombres
          courts, la place gagnée revient aux descriptions de compétences.
          Sous `sm`, on repasse en pile — deux colonnes de 100 px ne sont
          lisibles ni l'une ni l'autre. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-3 sm:w-[200px] sm:flex-none">
          {/* ⚠️ La MÊME pastille que dans les decks (`LeadPill`) : l'icône du
              jeu, le montant, et rien d'autre. Elle encode déjà la stat ET la
              portée — les réécrire en toutes lettres (« Attack Speed · Arène »)
              n'apprenait rien à qui reconnaît l'icône, et faisait deux lignes
              là où une suffit. Le détail reste dans l'infobulle.
              Agrandie et alignée sur la LARGEUR des stats qu'elle surmonte : à
              taille de siège elle flottait, minuscule, au-dessus d'un bloc. */}
          {forme.leaderSkill && (
            <LeadPill ls={forme.leaderSkill} size="lg" pleineLargeur />
          )}
          {/* Stats du monstre 6★ nu — les mêmes que celles qui servent aux calculs
              de l'app (voir spec/shared/donnees-monstres.md).
              ⚠️ **UNE colonne, une stat par ligne**, et non une grille 2×4 : les
              valeurs s'alignent alors les unes SOUS les autres, ce qui permet de les
              comparer d'un monstre à l'autre et de repérer un ordre de grandeur d'un
              coup d'œil. En grille, « 10 050 » et « 107 » se retrouvaient dans des
              colonnes différentes et l'œil devait sauter.
              Même grammaire que la table de stats du panneau d'équipement : lignes
              séparées, libellé terne à gauche, valeur mono alignée à droite. */}
          <div className="rounded-lg border border-border bg-panel2 px-2.5 py-1.5">
            <Stat label="PV" valeur={s.hp} />
            <Stat label="ATQ" valeur={s.attack} />
            <Stat label="DEF" valeur={s.defense} />
            <Stat label="VIT" valeur={s.speed} />
            <Stat label="Taux crit." valeur={s.critRate} suffixe="%" />
            <Stat label="Dmg crit." valeur={s.critDamage} suffixe="%" />
            <Stat label="RES" valeur={s.resistance} suffixe="%" />
            <Stat label="Précision" valeur={s.accuracy} suffixe="%" dernier />
          </div>

        </div>

        {/* Colonne des compétences — `min-w-0` obligatoire : sans lui, une
            cellule flex refuse de descendre sous la largeur de son contenu, et
            une description longue déborderait sur la colonne de gauche. */}
        <div className="min-w-0 flex-1">
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
          {forme.com2usId == null
            ? "Ce monstre a été créé à la main : il n'a pas de fiche de compétences."
            : 'Le détail des compétences de ce monstre n’est pas disponible.'}
        </p>
      )}
        </div>
      </div>
    </Modale>
  );
}

function Stat({
  label,
  valeur,
  suffixe = '',
  dernier = false,
}: {
  label: string;
  valeur: number | null | undefined;
  suffixe?: string;
  // Pas de filet sous la dernière ligne : il soulignerait le bord du cadre.
  dernier?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 text-[12px] ${
        dernier ? '' : 'border-b border-border/40'
      }`}
    >
      <span className="text-ink-dim">{label}</span>
      {/* ⚠️ Espace fine insécable entre les milliers (« 10 050 ») : à quatre
          chiffres et plus, un nombre nu se lit mal. `tabular-nums` garde les
          colonnes alignées d'une ligne à l'autre. */}
      <span className="font-mono tabular-nums text-ink">
        {valeur != null ? valeur.toLocaleString('fr-FR') : '—'}
        {valeur != null && suffixe}
      </span>
    </div>
  );
}

// Une compétence : son nom, son coefficient, sa description, ses effets et ses
// montées de niveau.
function CompetenceBloc({ c }: { c: Competence }) {
  const formule = formuleLisible(c.formule);
  const paliers = paliersRechargement(c);
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
            {/* Rechargement. ⚠️ Le SABLIER et non l'éclair : l'éclair dit la
                puissance, pas l'attente — on lisait « 3 tours » comme une durée
                d'effet. Un sablier ne parle que de temps.
                ⚠️ **Tous les paliers**, pas seulement le premier : le champ de
                SWARFARM est le rechargement au niveau 1, alors qu'on joue une
                compétence MAXÉE. « 6 tours » pour une compétence qui descend à
                4 était donc simplement faux. La flèche montre où l'on arrive
                en montant les skill-ups, et le dernier palier — celui qui
                compte — est mis en avant. */}
            {paliers.length > 0 && (
              <span
                className="inline-flex items-center gap-1 text-ink-dim"
                title={
                  paliers.length > 1
                    ? `Rechargement : ${paliers[0]} tours, réduit à ${paliers[paliers.length - 1]} en montant la compétence`
                    : `Rechargement : ${paliers[0]} tours`
                }
              >
                <Hourglass size={11} />
                {paliers.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    {i > 0 && <ArrowRight size={10} className="opacity-60" />}
                    <span className={i === paliers.length - 1 ? 'text-ink' : ''}>{p}</span>
                  </span>
                ))}
                tours
              </span>
            )}
          </div>

          {c.description && (
            <p className="mt-1 text-[12px] leading-snug text-ink-dim">{c.description}</p>
          )}
        </div>
      </div>

      {/* Effets appliqués : buffs en vert, debuffs en rouge — le vocabulaire du
          jeu, où la couleur dit déjà de quel côté ça penche.
          ⚠️ **Le NOM de l'effet, et rien de plus.** La pastille a un temps
          affiché « Increase ATB · 100 % » : ce pourcentage était le champ
          `chance` (la PROBABILITÉ d'application), qu'on lisait comme la
          quantité de barre remplie — deux nombres en pourcent, donc une
          confusion invisible. Pire, SWARFARM écrit `chance: 0` pour un effet
          GARANTI, qui s'affichait donc « 0 % », soit l'exact contraire.
          Le chiffre juste est dans la description ci-dessus, telle que le jeu
          l'écrit : c'est elle qui fait foi, et on n'en reconstitue rien. */}
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
