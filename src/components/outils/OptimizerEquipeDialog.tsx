import { useState } from 'react';
import { Bouton, Case, Modale, Selecteur } from '../../ui';
import { ELEMENTS, type LeaderSkill } from '../../types';
import { LEADER_SKILL_STATS, LEADER_SKILL_VALEURS, type LeaderSkillStat } from '../../lib/damage';
import { exclusionSelectorKey, resolveExclusionEntry, exclusionCandidatesFor, SOURCE_OPTIONS, type ExclusionSelector, type ExclusionSourceData } from '../../lib/optimizerExclusion';
import type { EquipeOptimizer } from '../../lib/optimizerMemberStorage';
import { creerEquipeOptimizer, modifierEquipeOptimizer, dissoudreEquipeOptimizer, type ContexteEquipesOptimizer } from '../../lib/equipesOptimizer';
import { STAT_LABEL } from '../siege/LeadPill';
import ExclusionCandidateRow from './ExclusionCandidateRow';

export default function OptimizerEquipeDialog({ contexte, listId, equipe, data, onValider, onClose }: {
  contexte: ContexteEquipesOptimizer;
  listId: string;
  equipe: EquipeOptimizer | null;
  data: ExclusionSourceData;
  onValider: (teams: EquipeOptimizer[]) => void;
  onClose: () => void;
}) {
  // L'éditeur garde un brouillon : la liste ne se regroupe qu'à sa fermeture.
  const [members, setMembers] = useState<ExclusionSelector[]>(() => equipe?.members ?? []);
  const [leader, setLeader] = useState(() => equipe?.leader ? exclusionSelectorKey(equipe.leader) : '');
  const [lead, setLead] = useState<LeaderSkill | null>(() => equipe?.lead ?? null);
  const [rapport, setRapport] = useState<string[]>([]);
  const [id] = useState(() => equipe?.id ?? globalThis.crypto?.randomUUID?.() ?? `equipe_${Date.now()}_${Math.floor(Math.random() * 1e6)}`);
  const selection = new Set(members.map(exclusionSelectorKey));
  const options = contexte.members.filter(m => m.listId === listId);
  const autreEquipe = (s: ExclusionSelector) => contexte.teams.some(e => e.id !== equipe?.id && e.listId === listId && e.members.some(m => exclusionSelectorKey(m) === exclusionSelectorKey(s)));
  const nom = (s: ExclusionSelector) => resolveExclusionEntry(s, data)?.monster.name ?? 'Introuvable';
  const source = (s: ExclusionSelector) => SOURCE_OPTIONS.find(o => o.key === s.source)?.label ?? 'Non possédé';
  const candidats = new Map(SOURCE_OPTIONS.flatMap(o => exclusionCandidatesFor(o.key, data, null, null, false)).map(c => [exclusionSelectorKey(c.selector), c]));
  const valeurs = lead && LEADER_SKILL_STATS.includes(lead.stat as LeaderSkillStat) ? LEADER_SKILL_VALEURS[lead.stat as LeaderSkillStat] : [];
  function appliquer() {
    const proposition = { id, listId, members, lead, ...(leader && members.find(s => exclusionSelectorKey(s) === leader) ? { leader: members.find(s => exclusionSelectorKey(s) === leader)! } : {}) };
    const resultat = equipe && members.length < 2 ? dissoudreEquipeOptimizer(contexte.teams, equipe.id)
      : equipe ? modifierEquipeOptimizer(contexte, proposition) : creerEquipeOptimizer(contexte, proposition);
    if (resultat.teams === contexte.teams) { setRapport(resultat.rapport); return; }
    onValider(resultat.teams); onClose();
  }
  return <Modale titre={equipe ? 'Modifier l’équipe' : 'Lier une team'} labelledBy="equipe-optimizer" croix onClose={onClose}
    sousTitre="Deux à cinq membres de cette liste. Le lead se partage dans l’équipe ; les critères personnels restent mémorisés."
    actions={<>
      {equipe && <Bouton libelle="Délier" onClick={() => { onValider(dissoudreEquipeOptimizer(contexte.teams, equipe.id).teams); onClose(); }} />}
      <Bouton libelle="Annuler" fond="plein" onClick={onClose} />
      <Bouton libelle={equipe ? 'Enregistrer' : 'Lier'} ton="accent" fond="doux" disabled={members.length > 5 || (!equipe && members.length < 2)} onClick={appliquer} />
    </>}>
    <div className="space-y-3">
      <p className="text-xs text-ink-dim">{members.length} / 5 membres{equipe && members.length < 2 ? ' — enregistrer dissoudra l’équipe.' : ''}</p>
      <div className="space-y-2">
        {options.map(m => { const cle = exclusionSelectorKey(m.selector), prise = autreEquipe(m.selector), resolu = resolveExclusionEntry(m.selector, data);
          const candidat = candidats.get(cle) ?? (resolu ? { selector: m.selector, ...resolu } : null);
          return <Case key={cle} className="items-start"
          libelle={<span className="min-w-0 flex-1 space-y-1"><span className="block text-xs">{source(m.selector)}{prise ? ' — déjà dans une équipe' : ''}</span>
            <span className="flex min-w-0 items-center gap-2">{candidat ? <ExclusionCandidateRow candidate={candidat} /> : nom(m.selector)}</span></span>} checked={selection.has(cle)}
          disabled={prise || (!selection.has(cle) && members.length >= 5)}
          onChange={e => setMembers(e.target.checked ? [...members, m.selector] : members.filter(s => exclusionSelectorKey(s) !== cle))} />; })}
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink-dim">Leader (facultatif)
        <Selecteur aria-label="Leader de l’équipe" value={selection.has(leader) ? leader : ''} onChange={e => setLeader(e.target.value)}>
          <option value="">Aucun</option>{members.map(s => <option key={exclusionSelectorKey(s)} value={exclusionSelectorKey(s)}>{nom(s)} · {source(s)}</option>)}
        </Selecteur>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-dim">Lead
          <Selecteur aria-label="Type de lead de l’équipe" value={lead?.stat ?? ''} onChange={e => {
            const stat = e.target.value as LeaderSkillStat;
            if (stat && !LEADER_SKILL_STATS.includes(stat)) return;
            setLead(stat ? { stat, amount: LEADER_SKILL_VALEURS[stat][0], area: lead?.area ?? 'General', element: lead?.element ?? null } : null);
          }}>
            <option value="">Aucun</option>{LEADER_SKILL_STATS.map(stat => <option key={stat} value={stat}>{STAT_LABEL[stat]}</option>)}
            {lead?.stat && !LEADER_SKILL_STATS.includes(lead.stat as LeaderSkillStat) && <option value={lead.stat}>{STAT_LABEL[lead.stat] ?? lead.stat} (sans effet calculé)</option>}
          </Selecteur>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">Valeur
          <Selecteur aria-label="Valeur du lead de l’équipe" disabled={!lead} value={lead?.amount ?? ''} onChange={e => lead && setLead({ ...lead, amount: Number(e.target.value) })}>
            {!lead && <option value="">—</option>}{valeurs.map(v => <option key={v} value={v}>{v} %</option>)}
            {lead && !valeurs.includes(lead.amount) && <option value={lead.amount}>{lead.amount} %</option>}
          </Selecteur>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">Portée
          <Selecteur aria-label="Portée du lead de l’équipe" disabled={!lead} value={lead?.area ?? 'General'} onChange={e => lead && setLead({ ...lead, area: e.target.value, element: e.target.value === 'Element' ? lead.element ?? 'fire' : null })}>
            <option value="General">Générale</option><option value="Element">Élément</option><option value="Guild">Guilde</option><option value="Dungeon">Donjon</option><option value="Arena">Arène</option>
          </Selecteur>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">Élément
          <Selecteur aria-label="Élément du lead de l’équipe" disabled={!lead || lead.area !== 'Element'} value={lead?.element ?? 'fire'} onChange={e => lead && setLead({ ...lead, element: e.target.value as LeaderSkill['element'] })}>
            {ELEMENTS.map(el => <option key={el.key} value={el.key}>{el.label}</option>)}
          </Selecteur>
        </label>
      </div>
      <div className="h-12 overflow-y-auto text-xs text-warn" role="status">{rapport.map((m, i) => <p key={i}>{m}</p>)}</div>
    </div>
  </Modale>;
}
