import { useState } from 'react';
import { Save } from 'lucide-react';
import { Bouton, Case, Modale, Selecteur } from '../../ui';
import { ELEMENTS, type LeaderSkill } from '../../types';
import { LEADER_SKILL_STATS, LEADER_SKILL_VALEURS, type LeaderSkillStat } from '../../lib/damage';
import { exclusionSelectorKey, resolveExclusionEntry, exclusionCandidatesFor, SOURCE_OPTIONS, type ExclusionSelector, type ExclusionSourceData } from '../../lib/optimizerExclusion';
import { MEMBRES_MAX_EQUIPE_OPTIMIZER, MEMBRES_MIN_EQUIPE_OPTIMIZER, type EquipeOptimizer } from '../../lib/optimizerMemberStorage';
import { creerEquipeOptimizer, modifierEquipeOptimizer, dissoudreEquipeOptimizer, type ContexteEquipesOptimizer } from '../../lib/equipesOptimizer';
import { nomStatLead } from '../siege/LeadPill';
import ExclusionCandidateRow from './ExclusionCandidateRow';
import { SOUS_LG, useMediaQuery } from '../../hooks/useMediaQuery';
import { useTraduction } from '../../hooks/useLangue';
import { nomElement } from '../../i18n/jeu';

export default function OptimizerEquipeDialog({ contexte, listId, equipe, data, onValider, onClose, onEnregistrerMesEquipes }: {
  contexte: ContexteEquipesOptimizer;
  listId: string;
  equipe: EquipeOptimizer | null;
  data: ExclusionSourceData;
  onValider: (teams: EquipeOptimizer[]) => void;
  onClose: () => void;
  // « Enregistrer dans Mes équipes » : applique le brouillon, puis passe l'équipe à Mes équipes.
  onEnregistrerMesEquipes?: (equipe: EquipeOptimizer) => void;
}) {
  const textes = useTraduction();
  const jeu = textes.jeu;
  const o = textes.optimizer;
  const q = o.equipe;
  // L'éditeur garde un brouillon : la liste ne se regroupe qu'à sa fermeture.
  const [members, setMembers] = useState<ExclusionSelector[]>(() => equipe?.members ?? []);
  const espece = (s: ExclusionSelector) => resolveExclusionEntry(s, data)?.monster;
  // Le leader se choisit par espèce ; la clé est son com2usId.
  const [leader, setLeader] = useState(() => {
    const id = equipe?.leader && espece(equipe.leader)?.com2usId;
    return id ? String(id) : '';
  });
  const [lead, setLead] = useState<LeaderSkill | null>(() => equipe?.lead ?? null);
  const [rapport, setRapport] = useState<string[]>([]);
  const telephone = useMediaQuery(SOUS_LG);
  const [id] = useState(() => equipe?.id ?? globalThis.crypto?.randomUUID?.() ?? `equipe_${Date.now()}_${Math.floor(Math.random() * 1e6)}`);
  const selection = new Set(members.map(exclusionSelectorKey));
  const autreEquipe = (s: ExclusionSelector) => contexte.teams.some(e => e.id !== equipe?.id && e.listId === listId && e.members.some(m => exclusionSelectorKey(m) === exclusionSelectorKey(s)));
  const options = contexte.members.filter(m => m.listId === listId && !autreEquipe(m.selector));
  const creationImpossible = !equipe && options.length < 2;
  const nom = (s: ExclusionSelector) => resolveExclusionEntry(s, data)?.monster.name ?? q.introuvable;
  const source = (s: ExclusionSelector) => o.sources[s.source];
  const candidats = new Map(SOURCE_OPTIONS.flatMap(o => exclusionCandidatesFor(o.key, data, null, null, false)).map(c => [exclusionSelectorKey(c.selector), c]));
  const valeurs = lead && LEADER_SKILL_STATS.includes(lead.stat as LeaderSkillStat) ? LEADER_SKILL_VALEURS[lead.stat as LeaderSkillStat] : [];
  // Une option par espèce cochée, nommée par son premier exemplaire coché.
  const parEspece = new Map<string, NonNullable<ReturnType<typeof espece>>>();
  for (const s of members) {
    const m = espece(s);
    if (m?.com2usId && !parEspece.has(String(m.com2usId))) parEspece.set(String(m.com2usId), m);
  }
  const especes = [...parEspece.values()];
  // L'exemplaire leader déjà désigné reste retenu si son espèce l'est encore.
  const memeEspece = (s: ExclusionSelector) => String(espece(s)?.com2usId) === leader;
  const leaderRetenu = !leader ? undefined
    : equipe?.leader && members.some(s => exclusionSelectorKey(s) === exclusionSelectorKey(equipe.leader!)) && memeEspece(equipe.leader)
      ? members.find(s => exclusionSelectorKey(s) === exclusionSelectorKey(equipe.leader!))
      : members.find(memeEspece);
  function appliquer(versMesEquipes = false) {
    const proposition = { id, listId, members, lead, ...(leaderRetenu ? { leader: leaderRetenu } : {}) };
    const resultat = equipe && members.length < MEMBRES_MIN_EQUIPE_OPTIMIZER ? dissoudreEquipeOptimizer(contexte.teams, equipe.id, textes)
      : equipe ? modifierEquipeOptimizer(contexte, proposition, textes) : creerEquipeOptimizer(contexte, proposition, textes);
    if (resultat.teams === contexte.teams) { setRapport(resultat.rapport); return; }
    onValider(resultat.teams); onClose();
    const enregistree = versMesEquipes ? resultat.teams.find(t => t.id === id) : undefined;
    if (enregistree) onEnregistrerMesEquipes?.(enregistree);
  }
  const tailleValide = members.length >= MEMBRES_MIN_EQUIPE_OPTIMIZER && members.length <= MEMBRES_MAX_EQUIPE_OPTIMIZER;
  const champsLead = <>
      <label className="flex flex-col gap-1 text-xs text-ink-dim">{q.leader}
        <Selecteur aria-label={q.leaderAria} value={leaderRetenu ? leader : ''} onChange={e => {
          const cle = e.target.value;
          setLeader(cle);
          if (cle) {
            const skill = especes.find(m => String(m.com2usId) === cle)?.leaderSkill;
            setLead(skill ? { ...skill } : null);
          }
        }}>
          <option value="">{q.aucun}</option>{especes.map(m => <option key={m.com2usId} value={String(m.com2usId)}>{m.name}</option>)}
        </Selecteur>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-dim">{q.lead}
          <Selecteur aria-label={q.leadAria} value={lead?.stat ?? ''} onChange={e => {
            const stat = e.target.value as LeaderSkillStat;
            if (stat && !LEADER_SKILL_STATS.includes(stat)) return;
            setLead(stat ? { stat, amount: LEADER_SKILL_VALEURS[stat][0], area: lead?.area ?? 'General', element: lead?.element ?? null } : null);
          }}>
            <option value="">{q.aucun}</option>{LEADER_SKILL_STATS.map(stat => <option key={stat} value={stat}>{nomStatLead(jeu, stat)}</option>)}
            {lead?.stat && !LEADER_SKILL_STATS.includes(lead.stat as LeaderSkillStat) && <option value={lead.stat}>{nomStatLead(jeu, lead.stat)} {q.sansEffet}</option>}
          </Selecteur>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">{q.valeur}
          <Selecteur aria-label={q.valeurAria} disabled={!lead} value={lead?.amount ?? ''} onChange={e => lead && setLead({ ...lead, amount: Number(e.target.value) })}>
            {!lead && <option value="">—</option>}{valeurs.map(v => <option key={v} value={v}>{v} %</option>)}
            {lead && !valeurs.includes(lead.amount) && <option value={lead.amount}>{lead.amount} %</option>}
          </Selecteur>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">{q.portee}
          <Selecteur aria-label={q.porteeAria} disabled={!lead} value={lead?.area ?? 'General'} onChange={e => lead && setLead({ ...lead, area: e.target.value, element: e.target.value === 'Element' ? lead.element ?? 'fire' : null })}>
            {(['General', 'Element', 'Guild', 'Dungeon', 'Arena'] as const).map(zone => <option key={zone} value={zone}>{q.portees[zone]}</option>)}
          </Selecteur>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-dim">{q.element}
          <Selecteur aria-label={q.elementAria} disabled={!lead || lead.area !== 'Element'} value={lead?.area === 'Element' ? lead.element ?? 'fire' : ''} onChange={e => lead && setLead({ ...lead, element: e.target.value as LeaderSkill['element'] })}>
            <option value=""></option>
            {ELEMENTS.map(el => <option key={el.key} value={el.key}>{nomElement(jeu, el.key)}</option>)}
          </Selecteur>
        </label>
      </div>
      <div className="h-12 overflow-y-auto text-xs text-warn" role="status">
        {lead?.stat && !LEADER_SKILL_STATS.includes(lead.stat as LeaderSkillStat) && <p>{q.conserveSansEffet}</p>}
        {rapport.map((m, i) => <p key={i}>{m}</p>)}
      </div>
    </>;
  return <Modale titre={equipe ? q.modifier : q.lier} labelledBy="equipe-optimizer" croix onClose={onClose}
    sousTitre={q.sousTitre}
    corpsFixeBas={telephone ? undefined : <div className="space-y-3">{champsLead}</div>}
    actions={<>
      {equipe && <Bouton libelle={q.delier} onClick={() => { onValider(dissoudreEquipeOptimizer(contexte.teams, equipe.id, textes).teams); onClose(); }} />}
      <Bouton libelle={textes.commun.annuler} fond="plein" onClick={onClose} />
      <Bouton libelle={equipe ? o.listes.enregistrer : q.lierAction} ton="accent" fond="doux" disabled={creationImpossible || members.length > MEMBRES_MAX_EQUIPE_OPTIMIZER || (!equipe && members.length < MEMBRES_MIN_EQUIPE_OPTIMIZER)} onClick={() => appliquer()} />
    </>}>
    <div className="space-y-3">
      {/* Dans la fenêtre de l'équipe : l'en-tête de sa bande n'a plus de place au téléphone. */}
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-dim">{q.membres(members.length)}{equipe && members.length < MEMBRES_MIN_EQUIPE_OPTIMIZER ? q.dissoudra : ''}</p>
        {equipe && onEnregistrerMesEquipes && <Bouton taille="xs" fond="vide" icone={<Save size={12} />} libelle={q.enregistrerMesEquipes}
          disabled={!tailleValide} onClick={() => appliquer(true)} />}
      </div>
      <div className="space-y-2">
        {creationImpossible && <p role="status" className="text-sm text-ink-dim">{q.pasAssez}</p>}
        {options.map(m => { const cle = exclusionSelectorKey(m.selector), resolu = resolveExclusionEntry(m.selector, data);
          const candidat = candidats.get(cle) ?? (resolu ? { selector: m.selector, ...resolu } : null);
          return <Case key={cle} className="items-start"
          libelle={<span className="min-w-0 flex-1 space-y-1"><span className="block text-xs">{source(m.selector)}</span>
            <span className="flex min-w-0 items-center gap-2">{candidat ? <ExclusionCandidateRow candidate={candidat} /> : nom(m.selector)}</span></span>} checked={selection.has(cle)}
          disabled={!selection.has(cle) && members.length >= MEMBRES_MAX_EQUIPE_OPTIMIZER}
          onChange={e => setMembers(e.target.checked ? [...members, m.selector] : members.filter(s => exclusionSelectorKey(s) !== cle))} />; })}
      </div>
      {telephone && champsLead}
    </div>
  </Modale>;
}
