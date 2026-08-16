import { useMemo, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { Monster, RtaEntry } from '../../types';
import ElementIcon from '../ElementIcon';
import CategoryRing from './CategoryRing';
import NumberField from '../NumberField';
import { RtaCategory } from '../../hooks/useRtaCategories';
import RuneIcon from '../RuneIcon';
import { SPEED_LEADS, speedLeadOf } from '../../lib/speed';
import { useStickyState } from '../../hooks/useStickyState';

const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`;

const RING: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};
const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};

// ⚠️ **Les boutons de lead viennent de la PRÉPA, pas d'une liste figée.**
// Simuler un +33 % quand aucun monstre de sa box ne le porte n'apprend rien ; à
// l'inverse, une liste en dur oublie les leads des sorties récentes. On propose
// donc les leads réellement disponibles, complétés à la main au besoin.
//
// ⚠️ Seuls comptent les leads qui s'appliquent **en RTA sans condition** : un
// lead d'élément ne profite qu'aux alliés du bon élément, or la simulation
// applique la valeur à TOUT le monde — le proposer induirait en erreur. Même
// règle que pour la catégorie « Lead SPD » (voir ../../spec/rta/categories.md).
const AIRES_RTA = new Set(['General', 'Arena']);

function leadsDeLaPrepa(items: TurnItem[]): number[] {
  const trouves = new Set<number>();
  for (const { monster } of items) {
    const lead = speedLeadOf(monster);
    if (lead && AIRES_RTA.has(lead.area)) trouves.add(lead.amount);
  }
  return [...trouves];
}

// Totem de vitesse de guilde : +15% de vitesse de base pour tous, toujours actif.
const TOTEM = 15;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export interface TurnItem {
  monster: Monster;
  entry: RtaEntry;
}

interface Props {
  items: TurnItem[];
  // Absent = **lecture seule** : les champs de saisie disparaissent. C'est le
  // cas de la prépa d'un ami, qu'on ne modifie pas. ⚠️ L'ordre de tour lui-même
  // est calculé ICI et nulle part ailleurs : une seconde implémentation pour la
  // consultation aurait divergé au premier changement de règle.
  onRuneSpeed?: (id: string, value: number | null) => void;
  // Catégories de la prépa : l'ordre de tour doit porter les MÊMES couleurs que
  // les cartes, sinon on perd le repère au moment où il sert le plus (voir
  // ../../spec/rta/categories.md).
  categories?: RtaCategory[];
  // Interrupteur des couleurs, RÉPÉTÉ ici : l'ordre de tour est en bas de page,
  // et remonter tout en haut juste pour couper les anneaux est absurde.
  categoriesVisible?: boolean;
  onToggleCategories?: (v: boolean) => void;
  // Visibilité CATÉGORIE PAR CATÉGORIE. Absent = tout visible (prépa d'un ami,
  // où l'on ne règle rien).
  //
  // ⚠️ Distinct de `categoriesVisible`, qui coupe tout d'un coup : on veut
  // pouvoir n'afficher que ses strippers sans perdre les autres étiquettes.
  estVisible?: (id: string) => boolean;
  onToggleCategorie?: (id: string) => void;
  // Masquer le chiffre de vitesse SANS toucher au classement : le tri continue
  // d'utiliser les vitesses, sinon l'ordre affiché serait faux.
  showSpeed?: boolean;
  // Présent = un interrupteur « Vitesses » rejoint la barre, à côté de celui des
  // catégories. Absent = pas d'interrupteur (sa propre prépa, où l'on saisit les
  // vitesses juste en dessous : les masquer n'aurait pas de sens).
  onToggleSpeed?: (v: boolean) => void;
}

// Vitesse totale hors lead (base + runes).
function rawTotal(it: TurnItem): number | null {
  const b = it.monster.stats.speed;
  const r = it.entry.runeSpeed;
  return b !== null || r !== null ? (b ?? 0) + (r ?? 0) : null;
}

// Bonus en % appliqué à la vitesse de BASE (totem + lead), arrondi au supérieur.
function pctBonus(it: TurnItem, lead: number): number {
  const base = it.monster.stats.speed;
  if (base === null) return 0;
  return Math.ceil((base * (TOTEM + lead)) / 100);
}

// Vitesse effective = total (base + runes) + bonus % sur la base (totem + lead).
function effective(it: TurnItem, lead: number): number | null {
  const raw = rawTotal(it);
  if (raw === null) return null;
  return raw + pctBonus(it, lead);
}

// Tri par vitesse effective décroissante (le plus rapide en premier).
function sortByLead(items: TurnItem[], lead: number): TurnItem[] {
  return [...items].sort((a, b) => {
    const ta = effective(a, lead);
    const tb = effective(b, lead);
    if (ta === null && tb === null) return a.monster.name.localeCompare(b.monster.name);
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta || a.monster.name.localeCompare(b.monster.name);
  });
}

export default function TurnOrder({
  items,
  onRuneSpeed,
  categories = [],
  categoriesVisible = true,
  estVisible,
  onToggleCategorie,
  onToggleCategories,
  showSpeed = true,
  onToggleSpeed,
}: Props) {
  const [lead, setLead] = useState(0);

  // Leads ajoutés à la main, et leads proposés que l'utilisateur a retirés.
  // ⚠️ Deux listes plutôt qu'une liste modifiable : la prépa change (import,
  // ajout d'un monstre) et les boutons doivent suivre — sans effacer les choix
  // déjà faits, ni faire réapparaître ce qu'on avait retiré.
  const [leadsAjoutes, setLeadsAjoutes] = useStickyState<number[]>('turnOrder.leadsAjoutes', []);
  const [leadsRetires, setLeadsRetires] = useStickyState<number[]>('turnOrder.leadsRetires', []);
  const [saisie, setSaisie] = useState<number | null>(null);
  // ⚠️ **C'est ICI que `categoriesVisible` agit**, et non chez l'appelant.
  // Il ne pilotait que l'apparence du bouton : le masquage se faisait en amont
  // (`categories={visible ? cats : []}`), si bien qu'une fois masquées, les
  // catégories n'arrivaient plus au composant et son propre interrupteur ne
  // pouvait plus rien réafficher.
  // ⚠️ DEUX niveaux de masquage, et ils ne disent pas la même chose :
  //   - `categoriesVisible` coupe TOUT (l'interrupteur de la barre) ;
  //   - `estVisible(id)` éteint UNE catégorie, réglée depuis la légende.
  const affichee = (id: string) => categoriesVisible && (estVisible?.(id) ?? true);
  const catsOf = (monsterId: string) =>
    categories.filter((c) => c.members.includes(monsterId) && affichee(c.id));
  // Légende : uniquement les catégories réellement représentées ici, sinon on
  // rappellerait des couleurs qu'on ne voit nulle part à l'écran.
  //
  // ⚠️ Une catégorie ÉTEINTE reste dans la légende — c'est là qu'on la
  // rallume. La retirer supprimerait le seul moyen de revenir en arrière.
  const legende = categoriesVisible
    ? categories.filter((c) => items.some((it) => c.members.includes(String(it.monster.id))))
    : [];
  const [highlightMovers, setHighlightMovers] = useState(false);

  const leads = useMemo(() => {
    const proposes = leadsDeLaPrepa(items);
    // Prépa vide ou sans lead VIT : on retombe sur les valeurs classiques, sinon
    // la rangée serait vide et l'outil inutilisable avant tout import.
    const base = proposes.length > 0 ? proposes : [...SPEED_LEADS];
    return [...new Set([...base, ...leadsAjoutes])]
      .filter((v) => !leadsRetires.includes(v))
      .sort((a, b) => b - a);
  }, [items, leadsAjoutes, leadsRetires]);

  function retirerLead(pct: number) {
    if (lead === pct) setLead(0); // ne pas laisser actif un lead sans bouton
    setLeadsAjoutes((l) => l.filter((v) => v !== pct));
    setLeadsRetires((l) => (l.includes(pct) ? l : [...l, pct]));
  }

  function ajouterLead() {
    if (saisie === null || saisie <= 0) return;
    setLeadsRetires((l) => l.filter((v) => v !== saisie)); // réafficher un retiré
    setLeadsAjoutes((l) => (l.includes(saisie) ? l : [...l, saisie]));
    setLead(saisie); // ce qu'on vient d'ajouter, on veut le voir appliqué
    setSaisie(null);
  }

  const ordered = useMemo(() => sortByLead(items, lead), [items, lead]);

  // Rang de référence sans lead → sert à repérer les monstres qui changent de place.
  const baselineRank = useMemo(() => {
    const map = new Map<string, number>();
    sortByLead(items, 0).forEach((it, idx) => map.set(String(it.monster.id), idx));
    return map;
  }, [items]);

  return (
    <div>
      {/* Boutons de lead SPD : du plus gros au plus petit */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="label mr-1">
          Lead SPD
        </span>
        {leads.map((pct) => {
          const active = lead === pct;
          return (
            <span
              key={pct}
              className={`group inline-flex items-center rounded-full border transition select-none
                ${
                  active
                    ? // Le dégradé `star` EST le marqueur (c'est le code couleur
                      // du lead, pas l'accent) : pas d'ombre en plus.
                      'bg-gradient-to-br from-star to-yellow-200 text-bg border-star'
                    : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
                }`}
            >
              <button
                onClick={() => setLead(active ? 0 : pct)}
                className="pl-3 pr-1 py-1 text-[12.5px] font-mono font-semibold"
              >
                +{pct}%
              </button>
              {/* ⚠️ Le × reste VISIBLE. Ne l'afficher qu'au survol laissait un
                  vide à droite du pourcentage, qu'on lit comme un défaut
                  d'alignement — et un bouton qui apparaît sous le curseur se
                  clique par accident. */}
              <button
                onClick={() => retirerLead(pct)}
                aria-label={`Retirer le lead +${pct}%`}
                title={`Retirer le lead +${pct}%`}
                className="pr-2 pl-0.5 py-1 opacity-50 transition hoverable:opacity-100 hoverable:text-fire"
              >
                <X size={11} strokeWidth={3} />
              </button>
            </span>
          );
        })}
        <button
          onClick={() => setLead(0)}
          className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
            ${
              // Fond seul — voir spec/shared/design.md.
              lead === 0
                ? 'bg-accent-soft border-border text-ink'
                : 'bg-panel border-border text-ink-dim hoverable:text-ink'
            }`}
        >
          Sans lead
        </button>

        {/* Ajout d'un lead absent de la prépa : il REJOINT la rangée au lieu de
            vivre dans un champ à part — une fois ajouté, il se clique comme les
            autres et se retire pareil. */}
        <span className="flex items-center gap-1">
          <NumberField
            value={saisie}
            onChange={setSaisie}
            min={1}
            max={99}
            width="w-11"
            placeholder="%"
            allowEmpty
            ariaLabel="Lead de vitesse à ajouter, en pourcentage"
          />
          <button
            onClick={ajouterLead}
            disabled={saisie === null || saisie <= 0}
            className="px-1 py-0.5 text-[11.5px] font-semibold text-ink-dim underline-offset-2 transition
                       hoverable:text-ink hoverable:underline disabled:opacity-40 disabled:hover:text-ink-dim
                       disabled:hover:no-underline"
          >
            Ajouter
          </button>
        </span>

        {/* Interrupteurs d'AFFICHAGE, au contact des vignettes qu'ils modifient
            — et non en tête de panneau, où l'on ne fait pas le lien. */}
        {onToggleSpeed && (
          <button
            onClick={() => onToggleSpeed(!showSpeed)}
            aria-pressed={showSpeed}
            title={
              showSpeed
                ? "Masquer les vitesses (l'ordre reste le même)"
                : 'Réafficher les vitesses'
            }
            className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition ${
              showSpeed
                ? 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
                : // Fond seul — voir spec/shared/design.md.
                  'border-border bg-accent-soft text-ink'
            }`}
          >
            {showSpeed ? <Eye size={12} /> : <EyeOff size={12} />}
            Vitesses
          </button>
        )}

        {onToggleCategories && (
          <button
            onClick={() => onToggleCategories(!categoriesVisible)}
            aria-pressed={categoriesVisible}
            title={
              categoriesVisible
                ? 'Masquer les couleurs de catégories'
                : 'Réafficher les couleurs de catégories'
            }
            className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition ${
              categoriesVisible
                ? 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
                : // Fond seul — voir spec/shared/design.md.
                  'border-border bg-accent-soft text-ink'
            }`}
          >
            {categoriesVisible ? <Eye size={12} /> : <EyeOff size={12} />}
            Catégories
          </button>
        )}

        <button
          onClick={() => setHighlightMovers((v) => !v)}
          role="switch"
          aria-checked={highlightMovers}
          title="Surligner les monstres dont la place change avec le lead actif"
          className="ml-1 flex items-center gap-2 select-none"
        >
          <span
            className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors
              ${highlightMovers ? 'bg-star' : 'bg-panel2 border border-border'}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                ${highlightMovers ? 'translate-x-[19px]' : 'translate-x-[3px]'}`}
            />
          </span>
          <span className={`text-[12px] font-semibold ${highlightMovers ? 'text-ink' : 'text-ink-dim'}`}>
            Surligner les changements
          </span>
        </button>
      </div>

      {/* Rappel des couleurs : sans légende, un anneau coloré ne veut rien dire
          pour qui n'a pas la barre de catégories sous les yeux.
          ⚠️ **Cliquer une entrée masque sa catégorie**, exactement comme la
          légende des courbes de runes : on éteint ce qu'on ne veut pas voir, là
          où on le voit. Sur six catégories, les anneaux se marchent dessus et
          l'ordre de tour devient illisible — c'est justement là qu'on a besoin
          de n'en garder qu'une ou deux.
          Une entrée éteinte reste en place, barrée et estompée : c'est le seul
          endroit où la rallumer. */}
      {legende.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {legende.map((c) => {
            const off = !affichee(c.id);
            const cliquable = !!onToggleCategorie;
            const contenu = (
              <>
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none border-2 transition"
                  style={{
                    borderColor: c.color,
                    // Éteinte, la pastille devient un cercle CREUX : la couleur
                    // reste reconnaissable, le plein dit « affichée ».
                    backgroundColor: off ? 'transparent' : c.color,
                  }}
                />
                <span className={off ? 'line-through' : ''}>{c.label}</span>
              </>
            );
            return cliquable ? (
              <button
                key={c.id}
                onClick={() => onToggleCategorie(c.id)}
                aria-pressed={!off}
                title={off ? `Réafficher « ${c.label} »` : `Masquer « ${c.label} »`}
                className={`inline-flex items-center gap-1.5 text-[11px] transition ${
                  off ? 'text-ink-dim opacity-60' : 'text-ink-dim hoverable:text-ink'
                }`}
              >
                {contenu}
              </button>
            ) : (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-[11px] text-ink-dim">
                {contenu}
              </span>
            );
          })}
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-ink-dim text-[13px]">
          Ajoute des monstres pour visualiser l'ordre de tour.
        </div>
      ) : (
        // ⚠️ **Une seule ligne qui DÉFILE sous `sm`**, pas un retour à la
        // ligne. L'ordre de tour est une SÉQUENCE : replié sur deux ou trois
        // rangées, on ne lit plus qui joue avant qui — c'est précisément
        // l'information de cet écran. On le fait donc glisser du doigt.
        // Au-dessus de `sm`, la largeur suffit et le retour à la ligne évite
        // un défilement inutile.
        <div className="flex gap-2.5 overflow-x-auto pb-3 sm:flex-wrap sm:overflow-visible">
          {ordered.map((it, i) => {
            const eff = effective(it, lead);
            const m = it.monster;
            // Change de place par rapport à l'ordre sans lead (quand un lead est actif).
            const moved =
              highlightMovers && lead !== 0 && baselineRank.get(String(m.id)) !== i;
            return (
              <div
                key={m.id}
                title={
                  catsOf(String(m.id)).length > 0
                    ? catsOf(String(m.id))
                        .map((c) => c.label)
                        .join(' · ')
                    : undefined
                }
                // ⚠️ Un monstre qui change de place se signale par son FOND
                // orange, et rien d'autre. Repeindre la bordure entrait en
                // concurrence avec l'anneau de catégories : deux informations
                // au même endroit, on ne lisait plus ni l'une ni l'autre.
                className={`relative flex-none w-[168px] rounded-xl border border-border p-2 flex flex-col gap-1.5 transition-colors
                  ${moved ? 'bg-warn/20' : 'bg-panel2'}`}
              >
                <CategoryRing colors={catsOf(String(m.id)).map((c) => c.color)} radius="rounded-xl" />
                {/* numéro d'ordre superposé en haut à gauche */}
                <span
                  className="absolute -top-2 -left-2 z-10 flex items-center justify-center min-w-[20px] h-5 px-1
                             rounded-full bg-accent-soft border border-border
                             font-mono text-[10px] font-bold text-ink shadow"
                >
                  {i + 1}
                </span>

                <div className="flex items-center gap-2">
                  {/* portrait */}
                  <div className="relative flex-none">
                    <div
                      className={`hex-frame w-[42px] h-[42px] p-[2px] bg-gradient-to-br ${RING[m.element]}`}
                    >
                      <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
                        {m.image ? (
                          <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className={`font-display font-bold text-sm ${TEXT[m.element]}`}>
                            {initials(m.name)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ElementIcon
                      element={m.element}
                      size={15}
                      className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold leading-tight truncate" title={m.name}>
                      {m.name}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {showSpeed && (
                        <>
                          <img src={SPD_ICON} alt="SPD" width={15} height={15} className="flex-none" />
                          <span className="font-mono text-[16px] font-black text-ink leading-none">
                            {eff ?? '—'}
                          </span>
                        </>
                      )}
                      {(it.entry.sets ?? []).slice(0, 3).map((s, si) => (
                        <RuneIcon key={si} setKey={s} size={16} className="flex-none" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Saisie de la vitesse des runes — seulement sur SA prépa. */}
                {onRuneSpeed && (
                  <div className="flex justify-center">
                    <NumberField
                      value={it.entry.runeSpeed}
                      allowEmpty
                      min={0}
                      placeholder="+ runes"
                      width="w-14"
                      ariaLabel={`SPD des runes de ${m.name}`}
                      onChange={(v) => onRuneSpeed(String(m.id), v)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
