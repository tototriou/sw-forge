import OptimizerBackupBar from '../OptimizerBackupBar';
import { Bouton, ZoneCliquable, BoutonIcone } from '../../../ui';
import { Plus, CheckCircle2, Trash2, Unlock } from 'lucide-react';
import OptimizerLeadInactif, { MotifHorsFlux } from '../OptimizerLeadInactif';
import { resolveExclusionEntry, exclusionSelectorKey, findValidatedBuild, runesManquantesDuBuild, artefactsManquantsDuBuild, type OptimizerList, type OptimizerListMember, type EtatAjoutListe, type ExclusionSourceData, type ExclusionSelector } from '../../../lib/optimizerExclusion';
import { leadEffectifMembreOptimizer } from '../../../lib/equipesOptimizer';
import LeadPill, { STAT_LABEL } from '../../siege/LeadPill';
import MonsterAvatar from '../../MonsterAvatar';
import IconeInterdite from '../../IconeInterdite';
import { WHEEL_IMG } from '../../RuneWheel';
import GameIcon from '../../GameIcon';
import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { type EquipeOptimizer } from '../../../lib/optimizerMemberStorage';
import { type UseOptimizerLists } from '../../../hooks/useOptimizerLists';
import { type OptimizerState } from '../../../hooks/useOptimizerState';
import { type ArtifactDetail, type RuneDetail, type Monster, type GearSet } from '../../../types';

export interface MonstresDeLaListeProps {
  activeList: OptimizerList | null;
  activeMembers: OptimizerListMember[];
  ajoutListe: EtatAjoutListe;
  handleAddToList: () => void;
  setEquipeOuverte: Dispatch<SetStateAction<{ listId: string; equipe: EquipeOptimizer | null; } | null>>;
  lists: UseOptimizerLists;
  optimizer: OptimizerState;
  exclusionData: ExclusionSourceData;
  artifacts: ArtifactDetail[];
  rapportZoneC: string[];
  groupesMembres: ({ equipe: EquipeOptimizer; members: OptimizerListMember[]; } | { equipe: null; members: OptimizerListMember[]; })[];
  runeById: Map<number, RuneDetail>;
  artifactById: Map<number, ArtifactDetail>;
  choisirMembreDeLaListe: (m: OptimizerListMember, resolved: { monster: Monster; gear: GearSet; } | null) => void;
  setReleaseConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector; } | null>>;
  setReleaseArtifactsConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector; } | null>>;
  setRemoveMemberConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector; } | null>>;
  // L'état du rappel des auras, le même que celui d'« État de mon monstre ».
  rappelAuras: boolean;
  listHasValidated: boolean;
  setReleaseAllConfirm: Dispatch<SetStateAction<string | null>>;
  // Forme de bureau des essentiels (`bureau/ListeDeTravailBureau.tsx`),
  // que le téléphone ne prend pas : ce que la rangée du titre porte après lui
  // (« Rechercher un monstre… », le monstre actif). Le titre y est toujours
  // « Ajouter un monstre à la liste » : il nomme le champ qui le suit.
  enTete?: ReactNode;
}

export default function MonstresDeLaListe({ activeList, activeMembers, ajoutListe, handleAddToList, setEquipeOuverte, lists, optimizer, exclusionData, artifacts, rapportZoneC, groupesMembres, runeById, artifactById, choisirMembreDeLaListe, setReleaseConfirm, setReleaseArtifactsConfirm, setRemoveMemberConfirm, rappelAuras, listHasValidated, setReleaseAllConfirm, enTete }: MonstresDeLaListeProps) {
  // Au bureau (`enTete`), le titre nomme toujours le champ qui le suit, sur
  // deux lignes, sans le nom de la liste ni son compte : « Liste active » la
  // nomme juste au-dessus (décision de l'utilisateur). L'espace avant le
  // retour à la ligne garde « monstre à » séparés dans le texte lu (copie,
  // recherche dans la page), sans rien changer à l'affichage.
  const titre = enTete ? (
    <p className="text-[12px] font-semibold leading-tight text-ink-dim">Ajouter un monstre{' '}<br />à la liste</p>
  ) : (
    <>
      <p className="truncate text-[12px] font-semibold text-ink-dim">
        {activeList ? `Monstres de « ${activeList.name} »` : 'Monstres de la liste'}
      </p>
      {activeList && <span className="flex-none text-[11px] text-ink-dimmer">{activeMembers.length}</span>}
    </>
  );
  // ⚠️ **Au bureau (`enTete`), pas de carte autour de la liste** : elle est
  // une section du panneau de sa colonne (docs/02-app/optimizer/ecran/README.md,
  // « Panneaux et sections ») ; chaque monstre garde sa propre carte. Le
  // téléphone garde aussi la carte de la liste.
  const bureau = enTete !== undefined;
  return (
    <div className={bureau ? 'relative' : 'rounded-lg border border-border-soft bg-panel2/60 p-2.5'}>
      {enTete ? (
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex min-w-0 max-w-[150px] flex-none items-baseline gap-1.5">{titre}</div>
          {enTete}
        </div>
      ) : (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">{titre}</div>
      )}

      {/* Le rapport des critères se lit hors du flux, depuis une icône à place
          réservée au bout de la ligne d'annonce ; la liste garde la hauteur. */}
      <OptimizerBackupBar debut={<><Bouton
        trait="pointille"
        taille="sm"
        pleineLargeur
        icone={<Plus size={14} />}
        libelle={ajoutListe.libelle}
        title={ajoutListe.libelle}
        disabled={!ajoutListe.actif}
        onClick={handleAddToList}
        className="min-w-0 [&>span]:min-w-0 [&>span]:truncate"
      />
      <Bouton libelle="Lier une équipe" title="Lier une équipe" taille="sm" pleineLargeur disabled={!activeList}
        onClick={() => activeList && setEquipeOuverte({ listId: activeList.id, equipe: null })} /></>} listes={lists} optimizer={optimizer} data={exclusionData} artifactIds={new Set(artifacts.map(a => a.id))}
        fin={<span className="inline-flex h-6 w-6 flex-none compact:h-10 compact:w-10">
          {rapportZoneC.length > 0 && <MotifHorsFlux titre="Rapport des critères" messages={rapportZoneC}
            libelle={`Rapport des critères : ${rapportZoneC.length} message${rapportZoneC.length > 1 ? 's' : ''}`} />}
        </span>} />
      <div className="sr-only" role="status" aria-label="Rapport des critères">
        {rapportZoneC.map((message, index) => <p key={index}>{message}</p>)}
      </div>

      {activeMembers.length === 0 ? (
        <p className="px-0.5 py-3 text-center text-[12px] italic text-ink-dim">
          {activeList ? "Aucun monstre dans cette liste pour l'instant." : 'Choisis ou crée une liste ci-dessus.'}
        </p>
      ) : (
        // Bornés à 308 px aux deux formats : la liste prend la hauteur de ses
        // membres jusque-là, puis défile pour garder les critères accessibles.
        <div className="mt-1 max-h-[308px] space-y-1 overflow-y-auto">
          {groupesMembres.filter(g => g.members.length > 0).map((g, numero) => {
            const membres = g.members.map(m => {
              const resolved = resolveExclusionEntry(m.selector, exclusionData);
              const lead = resolved ? leadEffectifMembreOptimizer(lists, m.listId, m.selector, resolved.monster.element) : null;
              return { m, resolved, motif: g.equipe?.lead && lead?.type === 'aucun' ? lead.motif : undefined };
            });
            const inactifs = membres.filter(m => m.motif).length;
            return <section key={g.equipe?.id ?? 'sans-equipe'} aria-label={g.equipe ? `Équipe ${numero + 1}` : 'Sans équipe'} className={`space-y-0.5 ${g.equipe ? `rounded-lg p-1.5 ${numero % 2 === 0 ? 'bg-equipe-a' : 'bg-equipe-b'}` : ''}`}>
            {g.equipe && <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-1 py-0.5">
              {/* Lead, numéro et leader se lisent sur une seule ligne. */}
              <span className="flex h-7 items-center whitespace-nowrap">
                {g.equipe.lead ? <LeadPill ls={g.equipe.lead} titre={`Lead de l’équipe : +${g.equipe.lead.amount} % ${STAT_LABEL[g.equipe.lead.stat ?? ''] ?? g.equipe.lead.stat ?? ''} · ${g.equipe.lead.area === 'Guild' ? 'Guilde' : g.equipe.lead.area === 'Dungeon' ? 'Donjon' : g.equipe.lead.area === 'Arena' ? 'Arène' : g.equipe.lead.area === 'Element' ? 'Élément' : 'Général'}`} /> : <span className="text-xs text-ink-dim">Sans lead</span>}
              </span>
              <span title={`Équipe ${numero + 1}${g.equipe.leader ? ` · Leader : ${resolveExclusionEntry(g.equipe.leader, exclusionData)?.monster.name ?? 'Introuvable'}` : ''}`} className="min-w-0 truncate text-xs font-semibold text-ink">Équipe {numero + 1}
                {g.equipe.leader && <span className="ml-1 font-normal text-ink-dim">· Leader : {resolveExclusionEntry(g.equipe.leader, exclusionData)?.monster.name ?? 'Introuvable'}</span>}
              </span>
              <span className="inline-grid whitespace-nowrap text-micro text-warn">
                <span className="invisible col-start-1 row-start-1" aria-hidden>⚠ 5 leads inactifs</span>
                <span className={`col-start-1 row-start-1 ${inactifs ? '' : 'invisible'}`} aria-hidden={!inactifs}>⚠ {inactifs} lead{inactifs > 1 ? 's' : ''} inactif{inactifs > 1 ? 's' : ''}</span>
              </span>
              <Bouton taille="xs" fond="vide" libelle="Modifier l’équipe" onClick={() => setEquipeOuverte({ listId: g.equipe!.listId, equipe: g.equipe })} />
            </div>}
            {!g.equipe && <p className="py-1 text-xs font-semibold text-ink-dim">Sans équipe</p>}
          {membres.map(({ m, resolved, motif }) => {
            const key = exclusionSelectorKey(m.selector);
            const build = findValidatedBuild(lists.validated, lists.activeListId, key);
            const absentes = build ? runesManquantesDuBuild(build, runeById) : [];
            const artsAbsents = build ? artefactsManquantsDuBuild(build, artifactById) : [];
            return (
              // Chaque monstre garde sa carte, au bureau aussi (décision de
              // l'utilisateur : plus lisible que des lignes sous un trait).
              <div key={key} data-membre-optimizer={resolved?.monster.com2usId} className="flex flex-wrap items-center gap-x-2 rounded-lg border border-border-soft bg-panel/60 px-2 py-1.5">
                <ZoneCliquable
                  imbrique
                  disabled={!resolved}
                  onClick={() => choisirMembreDeLaListe(m, resolved)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MonsterAvatar monster={resolved?.monster ?? null} size={24} className="flex-none" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
                    {resolved?.monster.name ?? 'Introuvable'}
                    {m.selector.source === 'unowned' && (
                      <span className="ml-1 text-[10px] font-normal text-ink-dimmer">(non possédé)</span>
                    )}
                  </span>
                </ZoneCliquable>
                <OptimizerLeadInactif motif={motif} />
                {build ? (
                  <>
                    <span className={`flex flex-none items-center gap-1 text-[10.5px] font-semibold ${absentes.length || artsAbsents.length ? 'text-warn' : 'text-accent'}`}
                      title={absentes.length || artsAbsents.length ? 'Build conservé ; les pièces absentes du compte ne sont plus réservées.' : undefined}>
                      <CheckCircle2 size={12} />
                      {absentes.length || artsAbsents.length ? [absentes.length ? `${absentes.length} rune(s) absente(s)` : '',
                        artsAbsents.length ? `${artsAbsents.length} artéfact(s) absent(s)` : ''].filter(Boolean).join(' · ') : 'Validé'}
                    </span>
                    {/* ⚠️ **L’icône disait le contraire de l’action.** Ce
                        bouton LIBÈRE, et portait le `CheckCircle2` de la
                        validation — le même pictogramme que le badge
                        « Validé » posé juste à sa gauche. Il porte désormais
                        la roue barrée d’une interdiction, celle d’« Exclure
                        les runes déjà utilisées » : du point de vue du
                        monstre, libérer, c’est lui retirer ses runes. */}
                    <BoutonIcone
                      cadre
                      libelle="Libérer ce build (runes et artéfacts)"
                      icone={
                        <IconeInterdite cadre={false} taille={16}>
                          <img src={WHEEL_IMG} alt="" className="h-3.5 w-3.5 object-contain" />
                        </IconeInterdite>
                      }
                      onClick={() => setReleaseConfirm({ listId: m.listId, selector: m.selector })}
                      className="h-6 w-6 flex-none"
                    />
                    {/* ⚠️ **Rendre la PAIRE sans défaire le runage.** Un
                        artéfact physique ne se porte que sur un monstre à la
                        fois : on veut souvent le récupérer pour un autre sans
                        renoncer au runage déjà planifié. Affiché seulement
                        s’il y a quelque chose à rendre — un bouton qui ne
                        ferait rien serait pire qu’un bouton absent. */}
                    {(build.artifactIds ?? []).length > 0 && (
                      <BoutonIcone
                        cadre
                        libelle="Libérer les artéfacts (le runage reste réservé)"
                        icone={
                          <IconeInterdite cadre={false} taille={16}>
                            <GameIcon name="artifact" size={13} />
                          </IconeInterdite>
                        }
                        onClick={() => setReleaseArtifactsConfirm({ listId: m.listId, selector: m.selector })}
                        className="h-6 w-6 flex-none"
                      />
                    )}
                  </>
                ) : (
                  <span className="flex-none text-[10.5px] text-ink-dimmer">pas encore validé</span>
                )}
                <BoutonIcone
                  cadre
                  libelle="Retirer de la liste"
                  icone={<Trash2 size={14} className="text-ink-dim" />}
                  onClick={() =>
                    build
                      ? setRemoveMemberConfirm({ listId: m.listId, selector: m.selector })
                      : lists.removeMember(m.listId, m.selector)
                  }
                  className="h-6 w-6 flex-none"
                />
              </div>
            );
          })}
          </section>; })}
        </div>
      )}

      {/* ⚠️ **Le rappel des auras, AUSSI sous la liste**
          — là où l'on vient de cliquer : « État de mon monstre » est souvent
          hors de l'écran à ce moment, toujours au téléphone. Le MÊME rappel que la boîte des
          auras : même état (`rappelAuras`, posé par le seul geste d'un
          membre ci-dessus, `choisirMembreDeLaListe` d'OptimizerSection), donc même minuterie (`DUREE_ATTENTION_MS`) —
          jamais un second minuteur ni une seconde condition —, même message,
          même token (`warn` / `warn-soft`, un seul contour de 1 px).
          Au téléphone, rendu SANS condition du rappel, invisible le reste du
          temps : sa place est réservée sous la liste, rien ne bouge quand il
          paraît ni quand il s'efface. Monté avec la liste seulement : sans
          membre, aucun clic ne peut le poser.
          Pas d'`aria-live` : la boîte des auras, montée en permanence au
          téléphone, l'annonce déjà ; au bureau, où cette boîte ne l'est que
          colonne ouverte, la page l'annonce (`AnnonceRappelAuras`,
          PageBureau.tsx) — deux régions liraient deux fois la même phrase.
          Au téléphone, il vit dans le dépliement de la zone C, ouvert au
          moment du clic. */}
      {activeMembers.length > 0 && !enTete && (
        <p
          className={`mt-1 rounded-lg border border-warn bg-warn-soft px-2 py-1 text-xs font-semibold text-warn ${
            rappelAuras ? 'animate-[apparition_200ms_var(--ease-out)]' : 'invisible'
          }`}
        >
          Pense à vérifier les sets d&apos;aura externes.
        </p>
      )}
      {/* Au bureau (`enTete`), le rappel sort du flux : aucune place n'est
          réservée sous la liste, et il paraît en surimpression au bas de la
          carte (positionnée), DANS ses bords — la colonne des essentiels
          défile seule et rognerait un débordement. Fond `panel` plein : il
          reste lisible par-dessus les lignes. Sans événement de pointeur, il
          ne masque aucun bouton pendant ses 3 s. */}
      {activeMembers.length > 0 && enTete && rappelAuras && (
        <p className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-10 animate-[apparition_200ms_var(--ease-out)] rounded-lg border border-warn bg-panel px-2 py-1 text-xs font-semibold text-warn">
          Pense à vérifier les sets d&apos;aura externes.
        </p>
      )}

      {listHasValidated && activeList && (
        <Bouton
          ton="neutre"
          fond="vide"
          trait="plein"
          taille="sm"
          pleineLargeur
          icone={<Unlock size={13} />}
          libelle={`Libérer toutes les runes de « ${activeList.name} »`}
          onClick={() => setReleaseAllConfirm(activeList.id)}
          className="mt-2"
        />
      )}
    </div>
  );
}
