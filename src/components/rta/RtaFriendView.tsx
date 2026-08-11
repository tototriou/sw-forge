import { useMemo, useState } from 'react';
import { X, ChevronDown, EyeOff, Users } from 'lucide-react';
import { RtaEntry, Monster, sectionLabel, sectionAccent, RTA_UNASSIGNED, RTA_OTHER } from '../../types';
import { RtaVueAmi } from '../../lib/rtaShare';
import ElementIcon from '../ElementIcon';
import RuneIcon from '../RuneIcon';
import MonsterGear from '../MonsterGear';
import AccordionGrid from '../AccordionGrid';
import CategoryRing from './CategoryRing';

/* --------------------------------------------------------------------------
 * Consultation de la prépa d'un ami
 * -----------------------------------------------------------------------
 *
 * ⚠️ **Lecture seule, et rien n'est comparé à ce que je possède.** Les monstres,
 * les vitesses et les runes affichés sont ceux de L'AUTEUR. Confronter à ma box
 * répondrait à une autre question (« puis-je jouer ça ? ») — c'est le rôle des
 * recommandations de siège, qui existent pour ça. Ici on regarde la prépa d'un
 * ami comme on regarderait son écran par-dessus son épaule.
 *
 * ⚠️ **Ma prépa n'est pas touchée.** Ce panneau s'ouvre à côté ; rien n'entre
 * dans mon état. C'est ce qui permet de consulter sans rien risquer, et donc
 * sans confirmation.
 */

const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`;

const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};
const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Carte en LECTURE : ni poignée de drag, ni croix, ni sélecteur de section —
// aucun de ces gestes n'a de sens sur la prépa de quelqu'un d'autre.
function CarteAmi({
  monster,
  entry,
  couleurs,
  libelles,
  open,
  onToggle,
}: {
  monster: Monster;
  entry: RtaEntry;
  couleurs: string[];
  libelles: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const base = monster.stats.speed;
  const total = base !== null || entry.runeSpeed !== null ? (base ?? 0) + (entry.runeSpeed ?? 0) : null;
  const hasGear = !!entry.gear && entry.gear.runes.length > 0;

  return (
    <div
      title={libelles.length > 0 ? libelles.join(' · ') : undefined}
      className={`relative rounded-lg border bg-panel2 transition-colors ${
        open ? 'border-accent ring-1 ring-accent/50' : 'border-border'
      }`}
    >
      <CategoryRing colors={couleurs} />
      <div className="flex items-center gap-2 p-1.5">
        <div className={`relative flex-none ${hasGear ? 'cursor-pointer' : ''}`} onClick={onToggle}>
          <div
            className={`hex-frame w-[50px] h-[50px] p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
          >
            <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
              {monster.image ? (
                <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" />
              ) : (
                <span className={`font-display font-bold text-sm ${TEXT[monster.element]}`}>
                  {initials(monster.name)}
                </span>
              )}
            </div>
          </div>
          <ElementIcon
            element={monster.element}
            size={16}
            className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={hasGear ? onToggle : undefined}
            disabled={!hasGear}
            className="flex w-full items-center gap-1 text-left disabled:cursor-default"
            title={hasGear ? 'Voir son équipement' : undefined}
          >
            <span className="text-[12px] font-semibold leading-tight truncate flex-1">
              {monster.name}
            </span>
            <img src={SPD_ICON} alt="SPD" width={15} height={15} className="flex-none" />
            <span className="font-mono text-[14px] font-black leading-none text-ink">
              {total !== null ? total : '—'}
            </span>
            {hasGear && (
              <ChevronDown
                size={14}
                className={`flex-none text-ink-dim transition-transform ${open ? 'rotate-180' : ''}`}
              />
            )}
          </button>
          <div className="mt-1 flex items-center gap-1">
            {(entry.sets ?? []).slice(0, 3).map((s, i) => (
              <RuneIcon key={i} setKey={s} size={16} className="flex-none" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RtaFriendView({ vue, onClose }: { vue: RtaVueAmi; onClose: () => void }) {
  // Un seul détail ouvert à la fois, comme dans la prépa (mais indépendant : ce
  // sont deux listes distinctes à l'écran).
  const [openId, setOpenId] = useState<string | null>(null);

  // Regroupement par section, et tri par vitesse totale — mêmes règles que la
  // prépa, pour qu'on lise les deux écrans de la même façon.
  const groupes = useMemo(() => {
    const g: Record<string, { monster: Monster; entry: RtaEntry }[]> = { [RTA_UNASSIGNED]: [] };
    for (const k of vue.sections) g[k] = [];
    for (const it of vue.entries) (g[it.entry.section] ??= []).push(it);
    const total = (it: { monster: Monster; entry: RtaEntry }) => {
      const b = it.monster.stats.speed;
      const r = it.entry.runeSpeed;
      return b !== null || r !== null ? (b ?? 0) + (r ?? 0) : null;
    };
    for (const liste of Object.values(g)) {
      liste.sort((a, b) => {
        const ta = total(a);
        const tb = total(b);
        if (ta === null && tb === null) return a.monster.name.localeCompare(b.monster.name);
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta || a.monster.name.localeCompare(b.monster.name);
      });
    }
    return g;
  }, [vue]);

  const categoriesDe = (id: string) => vue.categories.filter((c) => c.members.has(id));

  // Sections affichées : « Non classé » d'abord (si peuplée), puis celles de
  // l'auteur. Une section vide chez lui n'apporte rien à lire.
  const aAfficher = [RTA_UNASSIGNED, ...vue.sections].filter((k) => (groupes[k]?.length ?? 0) > 0);

  const titre = vue.nom || (vue.auteur ? `Prépa de ${vue.auteur}` : "Prépa d'un ami");

  function rendreSection(key: string) {
    const items = groupes[key] ?? [];
    const openIndex = openId ? items.findIndex((it) => String(it.monster.id) === openId) : -1;
    const gear = openIndex >= 0 ? items[openIndex].entry.gear : undefined;

    return (
      <section key={key} className="rounded-2xl border border-border bg-panel/40 p-3">
        <div className="flex items-center gap-2.5 mb-3">
          {key === RTA_OTHER || key === RTA_UNASSIGNED ? (
            <span
              className="w-3 h-3 rounded-[3px] rotate-45 flex-none"
              style={{ background: sectionAccent(key) }}
            />
          ) : (
            <RuneIcon setKey={key} size={22} className="flex-none" />
          )}
          <h3 className="font-display text-[16px] tracking-wide">{sectionLabel(key)}</h3>
          <span className="font-mono text-ink-dim text-[11px]">{items.length}</span>
        </div>

        <AccordionGrid
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-2.5"
          openIndex={gear ? openIndex : -1}
          detail={
            gear ? (
              <div className="rounded-xl border border-accent bg-panel/60 p-3">
                <MonsterGear gear={gear} spdCible={null} />
              </div>
            ) : undefined
          }
        >
          {items.map((it) => {
            const id = String(it.monster.id);
            const cats = categoriesDe(id);
            return (
              <CarteAmi
                key={id}
                monster={it.monster}
                entry={it.entry}
                couleurs={cats.map((c) => c.color)}
                libelles={cats.map((c) => c.label)}
                open={openId === id}
                onToggle={() => setOpenId((cur) => (cur === id ? null : id))}
              />
            );
          })}
        </AccordionGrid>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-accent bg-panel2/40 p-4">
      <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap pb-2.5 mb-4 border-b border-border">
        <span className="flex items-center gap-1.5 text-accent">
          <Users size={16} />
        </span>
        <h2 className="font-display text-[19px] tracking-wide">{titre}</h2>
        {vue.auteur && vue.nom && (
          <span className="font-mono text-[11px] text-ink-dim">par {vue.auteur}</span>
        )}
        <span className="font-mono text-[11px] text-ink-dim">
          {vue.entries.length} monstre{vue.entries.length > 1 ? 's' : ''}
        </span>
        <button
          onClick={onClose}
          className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-dim hoverable:text-ink transition"
          title="Fermer la consultation"
        >
          <X size={14} /> Fermer
        </button>
      </div>

      {/* ⚠️ Dit à voix haute que rien n'est comparé ni modifié : sans ça, on
          cherche un verdict (« est-ce que je peux jouer ça ? ») qui n'existe pas
          sur cet écran, et on se demande si sa propre prépa a bougé. */}
      <p className="mb-4 text-[12.5px] leading-relaxed text-ink-dim">
        Tu regardes la prépa de quelqu'un d'autre. <b className="text-ink">Ta prépa n'a pas bougé</b>{' '}
        et rien n'est comparé à tes monstres.
        {vue.avecEquipement ? (
          <> Clique un monstre pour voir ses runes et ses artéfacts.</>
        ) : (
          <> Son équipement n'est pas joint.</>
        )}
      </p>

      {!vue.avecEquipement && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] leading-relaxed text-ink-dim">
          <EyeOff size={14} className="mt-[1px] flex-none text-ink-dim" />
          <span>
            L'auteur a partagé son classement <b className="text-ink">sans ses runes</b>. Tu vois ses
            sections et les vitesses qu'il vise, pas comment il les atteint.
          </span>
        </p>
      )}

      {vue.inconnus.length > 0 && (
        <p className="mb-4 text-[11.5px] text-warn">
          {vue.inconnus.length} monstre(s) de cette prépa sont absents des données chargées et ne
          sont pas affichés.
        </p>
      )}

      <div className="flex flex-col gap-4">{aAfficher.map(rendreSection)}</div>
    </section>
  );
}
