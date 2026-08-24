import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Castle, Trash2, Gauge } from 'lucide-react';
import { Monster, ElementKey, SiegeTeam as SiegeTeamData } from '../../types';
import { LoadState } from '../../hooks/useMonsters';
import { SiegeSide, UseSiegeState } from '../../hooks/useSiegeState';
import { useStickyState } from '../../hooks/useStickyState';
import SiegeTeam from './SiegeTeam';
import SpeedTuneModale from '../outils/SpeedTuneModale';
import CreateMonster from '../CreateMonster';
import { ConfirmDialog } from '../../ui/Dialogs';
import MobileSheet from '../../ui/MobileSheet';
import { Bouton } from '../../ui';
import { CustomLead } from '../../hooks/useCustomMonsters';

interface Props {
  side: SiegeSide;
  siege: UseSiegeState;
  monsters: Monster[];
  // Les équipes des DEUX camps : l'outil de speed tuning, ouvert en modale
  // depuis une équipe, propose d'importer n'importe quel deck — pas seulement
  // ceux du côté qu'on regarde.
  siegeDefenseTeams: SiegeTeamData[];
  siegeOffenseTeams: SiegeTeamData[];
  loadState: LoadState;
  onCreateMonster: (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => Monster;
  customMonsters: Monster[];
  onDeleteMonster: (id: string) => void;
  // Panneau d'actions mobile — piloté par le bouton « Options » de la barre
  // d'onglets (voir App.tsx).
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

// L'import se fait globalement depuis la barre de nav (voir AccountImportControl) :
// un seul import alimente RTA + défense + offense. Ce board ne gère que la
// composition/édition des équipes de son côté.
export default function SiegeBoard({
  side,
  siege,
  monsters,
  siegeDefenseTeams,
  siegeOffenseTeams,
  loadState,
  onCreateMonster,
  customMonsters,
  onDeleteMonster,
  menuOuvert,
  onFermerMenu,
}: Props) {
  // ⚠️ **Éteint par défaut** : les équipes s'affichent telles quelles, et c'est
  // un geste délibéré qui demande la vérification. Tout ce que l'app calcule
  // ensuite est automatique — statut, message, ordre d'une équipe Swift : le
  // bouton dit QUAND on veut voir, pas ce qu'il faut recalculer soi-même.
  const [checkTicks, setCheckTicks] = useStickyState(`siege.checkTicks.${side}`, false);

  const noun = side === 'defense' ? 'défense' : 'attaque';

  // « Voir le speed tune » : l'outil s'ouvre EN MODALE par-dessus le deck.
  //
  // ⚠️ **On ne change pas de page.** Y aller déposait l'équipe dans
  // `sessionStorage`, obligeait à retenir d'où l'on venait et à offrir un
  // « retour » — pour revenir à un écran qu'on n'avait pas de raison de quitter.
  // La page reste là, dessous : fermer la modale rend exactement sa place, son
  // défilement et ses équipes dépliées.
  const [speedTune, setSpeedTune] = useState<string | null>(null);

  // Mode vérification des ticks : désactivé par défaut (équipes neutres), on
  // l'active volontairement pour faire passer les auras de couleur.

  // Équipes en cours d'édition : remontées ici pour que la grille leur donne la
  // pleine largeur (les 3 slots seraient trop à l'étroit sur une demi-colonne).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (teamId: string) =>
    setExpandedIds((s) => {
      const next = new Set(s);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });

  // Scroll automatique vers l'équipe qu'on vient d'ajouter (rendue en dernier).
  const [scrollToLast, setScrollToLast] = useState(false);
  const [effacementAConfirmer, setEffacementAConfirmer] = useState(false);
  const lastTeamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollToLast) return;
    lastTeamRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollToLast(false);
  }, [scrollToLast]);

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  // Les actions du board, rendues une seule fois et posées à DEUX endroits
  // selon la largeur : dans la page au-dessus de `lg`, dans le panneau en
  // dessous. Deux copies auraient divergé au premier bouton ajouté.
  // ⚠️ « Tout effacer » est SÉPARÉ des autres actions : dans la page il se pose
  // à l'opposé (`ml-auto`), loin des gestes de construction — un bouton
  // destructeur ne se met pas à côté de celui qu'on presse en boucle. Dans le
  // panneau il garde la même distance, en bas et détaché.
  // ⚠️ **Boutons de la librairie, pas des `<button>` redessinés.** Ce board les
  // écrivait à la main — trois fois la même paire de classes, un `lg:hidden` /
  // `hidden lg:inline` recopié pour chaque libellé court. `Bouton` porte déjà
  // ça par ses axes (`icone`+`libelle`+`libelleCourt`, `actif` pour un
  // interrupteur) : voir le même geste sur RTA (`RtaBackupBar`).
  // ⚠️ **Même bouton que RTA (`boutonEffacer` dans RtaPage.tsx), au trait
  // près.** Deux habillages selon le contenant, pas deux boutons : nu dans la
  // page, où il vit au bout d'une rangée d'actions déjà cadrées (un cadre de
  // plus y ferait du bruit) ; fond + contour rouges et PLEINE LARGEUR dans le
  // panneau, où il est seul sur sa ligne sous un filet — à sa largeur propre,
  // il y flottait au milieu d'une bande vide dont rien n'expliquait la
  // présence.
  // ⚠️ **Toujours affiché, désactivé s'il n'y a rien à effacer** — jamais
  // retiré. Un bouton qui apparaît une fois la première équipe créée ne
  // s'explique pas : on ne l'a jamais vu apparaître d'un geste, il était
  // juste absent. Désactivé, c'est un repère fixe de la page — même règle
  // partout dans l'app, voir RecoBoard.tsx.
  const effacer = (dansLePanneau: boolean) => (
    <Bouton
      onClick={() => {
        setEffacementAConfirmer(true);
        onFermerMenu();
      }}
      disabled={siege.state.teams.length === 0}
      ton="danger"
      fond={dansLePanneau ? 'doux' : 'vide'}
      trait={dansLePanneau ? 'plein' : 'aucun'}
      pleineLargeur={dansLePanneau}
      taille="sm"
      icone={<Trash2 size={13} />}
      libelle="Tout effacer"
      title={siege.state.teams.length === 0 ? "Aucune équipe à effacer" : undefined}
      // ⚠️ `leading-none` : l'interligne du libellé donne au texte une boîte
      // plus haute que sa lettre. Centrées boîte contre boîte, la poubelle et
      // le mot ne le sont plus à l'œil.
      className="leading-none"
    />
  );

  const actions = (
    <>
      {/* ⚠️ Deux longueurs : en grille à trois colonnes, un bouton dispose d'un
          tiers de 348 px. « Ajouter une équipe » y passait à la ligne et
          déformait la rangée. `libelleCourt` porte « Équipe » sous `lg`,
          l'infobulle et `aria-label` gardent la phrase entière. */}
      <Bouton
        onClick={() => {
          siege.addTeam();
          setScrollToLast(true);
          onFermerMenu();
        }}
        aria-label="Ajouter une équipe"
        icone={<Plus size={15} />}
        libelle="Ajouter une équipe"
        libelleCourt="Équipe"
      />

      {/* ⚠️ Toujours affiché, désactivé sans équipe — même règle que
          « Tout effacer ». */}
      <Bouton
        onClick={() => {
          setCheckTicks((v) => !v);
          onFermerMenu();
        }}
        actif={checkTicks}
        disabled={siege.state.teams.length === 0}
        title={
          siege.state.teams.length === 0
            ? 'Aucune équipe à vérifier'
            : checkTicks
              ? 'Masquer les auras de vérification'
              : // ⚠️ Le bouton couvre les DEUX questions : une équipe Swift se
                // juge sur son speed tune, les autres sur leur tick. « Vérifier
                // mes tick ATB » n'en nommait qu'une, et pas celle qui compte
                // pour les équipes speed.
                'Colorer les équipes selon leur vitesse : speed tune pour une équipe Swift, calage sur les ticks ATB pour les autres'
        }
        icone={<Gauge size={15} />}
        libelle="Vérifier mes speed"
        libelleCourt="Speed"
      />

      {/* En dernier des actions : c'est le geste le plus rare. */}
      <CreateMonster
        onCreate={onCreateMonster}
        customMonsters={customMonsters}
        onDelete={onDeleteMonster}
      />
    </>
  );

  return (
    <div>
      {/* ⚠️ Sous `lg`, les trois actions descendent dans le panneau
          « Options » : à 40 px avec leur libellé complet, elles remplissaient
          deux rangées avant la première équipe. Le COMPTEUR reste, lui — c'est
          une information, pas une action, et elle tient sur une ligne. */}
      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <div className="hidden lg:contents">{actions}</div>
        <span className="font-mono text-xs text-ink-dim">
          {siege.state.teams.length} équipe{siege.state.teams.length > 1 ? 's' : ''}
        </span>
        <div className="ml-auto hidden lg:contents">{effacer(false)}</div>
      </div>

      <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre={`Actions — ${noun}`}>
        <div data-rangee-actions>{actions}</div>
        <div data-zone-destructive className="mt-4 border-t border-border pt-3">
          {effacer(true)}
        </div>
      </MobileSheet>

      {effacementAConfirmer && (
        <ConfirmDialog
          titre={`Effacer toutes les équipes d'${noun} ?`}
          message="Toutes les équipes de ce côté seront supprimées, avec leurs monstres et leurs vitesses. L'autre côté n'est pas touché."
          libelleAction="Tout effacer"
          destructif
          onCancel={() => setEffacementAConfirmer(false)}
          onConfirm={() => {
            setEffacementAConfirmer(false);
            siege.clearAll();
          }}
        />
      )}

      {loadState === 'loading' && monsters.length === 0 && (
        <p className="mt-4 text-ink-dim text-sm">Chargement des monstres…</p>
      )}

      {siege.state.teams.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-panel/40 py-16 px-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-panel2 border border-border mb-4">
            <Castle size={26} className="text-ink-dim" />
          </div>
          <p className="text-ink-dim text-sm max-w-md">
            Aucune équipe d'{noun} pour l'instant. Clique sur{' '}
            <b className="text-ink">Ajouter une équipe</b> pour composer, ou importe ton compte
            depuis la barre du haut.
          </p>
        </div>
      ) : (
        // 2 équipes par ligne sur grand écran ; une équipe en édition reprend
        // toute la largeur. `items-start` évite d'étirer les cartes basses.
        // ⚠️ Écarts réduits sous `sm` : la page empile jusqu'à huit équipes, et
        // chaque `gap-4` se paie autant de fois — un écran entier de vide sur un
        // téléphone.
        <div className="mt-3 grid grid-cols-1 gap-2 items-start sm:mt-6 sm:gap-4 xl:grid-cols-2">
          {siege.state.teams.map((team, i) => (
            <div
              key={team.id}
              ref={i === siege.state.teams.length - 1 ? lastTeamRef : undefined}
              className={expandedIds.has(team.id) ? 'xl:col-span-2' : undefined}
            >
            <SiegeTeam
              team={team}
              index={i}
              monsters={monsters}
              monsterById={monsterById}
              checkTicks={checkTicks}
              onVoirSpeedTune={setSpeedTune}
              expanded={expandedIds.has(team.id)}
              onToggleExpand={toggleExpand}
              onRemoveTeam={siege.removeTeam}
              onPickMonster={siege.setSlotMonster}
              onClearSlot={siege.clearSlot}
              onSlotRune={siege.setSlotRune}
              onSlotTick={siege.setSlotTick}
              onDismissAlert={siege.dismissTickAlert}
              onSwap={siege.swapSlots}
            />
            </div>
          ))}
        </div>
      )}

      {/* L'outil de speed tuning, par-dessus le deck. ⚠️ Monté seulement quand
          on le demande : il charge les kits des monstres à l'ouverture. */}
      {speedTune && (
        <SpeedTuneModale
          deck={{ source: side, teamId: speedTune }}
          allMonsters={monsters}
          siegeDefenseTeams={siegeDefenseTeams}
          siegeOffenseTeams={siegeOffenseTeams}
          onClose={() => setSpeedTune(null)}
        />
      )}
    </div>
  );
}
