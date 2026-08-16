import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Swords } from 'lucide-react';
import {
  Monster,
  ElementKey,
  RUNE_SETS,
  RTA_UNASSIGNED,
  RTA_OTHER,
  sectionLabel,
  sectionAccent,
} from '../types';
import { LoadState } from '../hooks/useMonsters';
import { UseRtaState } from '../hooks/useRtaState';
import RtaSearch from '../components/rta/RtaSearch';
import RtaSection from '../components/rta/RtaSection';
import CategoryBar from '../components/rta/CategoryBar';
import RtaBackupBar from '../components/rta/RtaBackupBar';
import MobileSheet from '../components/MobileSheet';
import RtaFriendView from '../components/rta/RtaFriendView';
import { RtaVueAmi } from '../lib/rtaShare';
import { ConfirmDialog } from '../components/Dialogs';
import { useRtaCategories } from '../hooks/useRtaCategories';
import { useRtaBackup } from '../hooks/useRtaBackup';
import { gearSpeedMismatch } from '../lib/gearSync';
import DesyncBadge from '../components/rta/DesyncBadge';
import RtaCard from '../components/rta/RtaCard';
import MonsterGear from '../components/MonsterGear';
import TurnOrder, { TurnItem } from '../components/rta/TurnOrder';
import CreateMonster from '../components/CreateMonster';
import { CustomLead } from '../hooks/useCustomMonsters';

interface Props {
  rta: UseRtaState;
  monsters: Monster[];
  loadState: LoadState;
  onCreateMonster: (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => Monster;
  customMonsters: Monster[];
  onDeleteMonster: (id: string) => void;
  // Tiroir d'actions mobile — piloté par la barre supérieure (voir App.tsx).
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

function totalSpeed(it: TurnItem): number | null {
  const b = it.monster.stats.speed;
  const r = it.entry.runeSpeed;
  return b !== null || r !== null ? (b ?? 0) + (r ?? 0) : null;
}

export default function RtaPage({
  rta,
  monsters,
  loadState,
  onCreateMonster,
  customMonsters,
  onDeleteMonster,
  menuOuvert,
  onFermerMenu,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newSection, setNewSection] = useState('');
  // Un seul détail de runes ouvert à la fois, toutes sections confondues.
  const [openId, setOpenId] = useState<string | null>(null);
  const [effacementAConfirmer, setEffacementAConfirmer] = useState(false);
  const toggleDetail = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  // Regroupe les entrées par section + construit la liste globale pour l'ordre de tour.
  const { groups, allItems } = useMemo(() => {
    const groups: Record<string, TurnItem[]> = { [RTA_UNASSIGNED]: [] };
    for (const key of rta.state.sections) groups[key] = [];
    const allItems: TurnItem[] = [];
    for (const entry of Object.values(rta.state.entries)) {
      const monster = monsterById.get(entry.monsterId);
      if (!monster) continue; // monstre absent des données chargées
      const item: TurnItem = { monster, entry };
      (groups[entry.section] ??= []).push(item);
      allItems.push(item);
    }
    // Tri interne de chaque section : plus rapide en premier.
    for (const list of Object.values(groups)) {
      list.sort((a, b) => {
        const ta = totalSpeed(a);
        const tb = totalSpeed(b);
        if (ta === null && tb === null) return a.monster.name.localeCompare(b.monster.name);
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta || a.monster.name.localeCompare(b.monster.name);
      });
    }
    return { groups, allItems };
  }, [rta.state, monsterById]);

  const addedIds = useMemo(() => new Set(Object.keys(rta.state.entries)), [rta.state.entries]);

  // Catégories libres (« Striper », « Lead SPD »…) : lecture transversale de la
  // box, en plus du classement par set. Voir ../../spec/rta/categories.md.
  const cats = useRtaCategories();
  // Point de restauration manuel (« Sauvegarder » / « Reprendre »), distinct de
  // la conservation automatique. Voir hooks/useRtaBackup.ts.
  const backup = useRtaBackup();

  // ⚠️ À chaque import de compte, on fige la prépa **telle que le fichier vient
  // de la produire** : c'est le point de retour de « Réinitialiser ».
  //
  // Posé ici et non dans App : le point embarque les CATÉGORIES, qui vivent dans
  // cette page. Le déclencheur est le compteur d'imports de `useRtaState` — un
  // compteur, donc deux imports successifs posent bien deux points.
  //
  // ⚠️ L'état est lu APRÈS que l'import l'a modifié : l'effet se déclenche sur
  // le rendu qui suit, `rta.state` y est déjà le nouveau.
  const dernierImport = useRef(0);
  useEffect(() => {
    if (rta.importCount === 0 || rta.importCount === dernierImport.current) return;
    dernierImport.current = rta.importCount;
    backup.poserImport(rta.state, cats.categories);
  }, [rta.importCount, rta.state, cats.categories, backup]);
  // Prépa d'un ami ouverte en consultation. ⚠️ Volontairement en état LOCAL et
  // non persisté : c'est une lecture de passage, pas une donnée de l'utilisateur.
  // La conserver d'une session à l'autre laisserait la prépa de quelqu'un
  // d'autre à l'écran sans qu'on sache d'où elle vient.
  const [vueAmi, setVueAmi] = useState<RtaVueAmi | null>(null);
  // Monstres réellement présents dans la prépa : ce sont eux qu'on propose dans
  // le panneau d'affectation.
  const pageMonsters = useMemo(
    () => allItems.map((it) => it.monster),
    [allItems]
  );
  // « Lead SPD » proposée d'office à la première prépa non vide : c'est le
  // classement que tout le monde fait de tête en RTA.
  useEffect(() => {
    cats.ensureDefault(pageMonsters);
  }, [cats, pageMonsters]);

  const availableSets = useMemo(
    () => RUNE_SETS.filter((s) => !rta.state.sections.includes(s.key)),
    [rta.state.sections]
  );

  function handleDrop(section: string, id: string) {
    const realId = id || draggingId;
    if (realId) rta.moveMonster(realId, section);
    setDraggingId(null);
  }

  // Destinations proposées dans le sélecteur des cartes (repli tactile du drag).
  const moveTargets = [RTA_UNASSIGNED, ...rta.state.sections];

  function renderCards(items: TurnItem[]) {
    return items.map((it) => (
      <RtaCard
        key={it.monster.id}
        monster={it.monster}
        entry={it.entry}
        desync={gearSpeedMismatch(it.entry.gear, it.entry.runeSpeed)}
        showSpeed={cats.showSpeeds}
        markDesync={cats.markDesync}
        categoryColors={cats.visible ? cats.categoriesOf(String(it.monster.id)).map((c) => c.color) : []}
        categoryLabels={cats.categoriesOf(String(it.monster.id)).map((c) => c.label)}
        sectionKeys={moveTargets}
        open={openId === String(it.monster.id)}
        onToggleDetail={toggleDetail}
        onMove={rta.moveMonster}
        onRemove={rta.removeMonster}
        onDragStart={setDraggingId}
        onDragEnd={() => setDraggingId(null)}
      />
    ));
  }

  // Détail du monstre ouvert dans CETTE section (sinon rien) : position de la
  // carte + panneau, que la grille insère sous la ligne concernée.
  function detailOf(items: TurnItem[]) {
    const openIndex = openId ? items.findIndex((it) => String(it.monster.id) === openId) : -1;
    const entry = openIndex >= 0 ? items[openIndex].entry : undefined;
    const gear = entry?.gear;
    if (openIndex < 0 || !gear) return { openIndex: -1, detail: undefined };
    // Vitesse saisie à la main ≠ vitesse des runes importées : le détail
    // ci-dessous ne correspond plus à la vitesse annoncée, on le signale.
    const ecart = gearSpeedMismatch(gear, entry?.runeSpeed ?? null);
    return {
      openIndex,
      detail: (
        <div className="rounded-xl border border-accent bg-panel/60 p-3">
          {ecart && (
            <div className="mb-2">
              <DesyncBadge ecart={ecart} size={16} />
            </div>
          )}
          <MonsterGear gear={gear} spdCible={ecart ? ecart.saisi : null} />
        </div>
      ),
    };
  }

  // Crée un monstre perso et l'ajoute directement en « Non classé ».
  function handleCreateMonster(
    name: string,
    element: ElementKey,
    speed: number,
    lead: CustomLead | null
  ) {
    const mon = onCreateMonster(name, element, speed, lead);
    rta.addMonster(String(mon.id));
  }

  const runeSections = rta.state.sections;

  // ⚠️ Rendus une seule fois, posés à DEUX endroits selon la largeur : dans la
  // page au-dessus de `lg`, dans le panneau en dessous. Deux copies auraient
  // divergé au premier ajustement.
  const creation = (
    <CreateMonster
      onCreate={handleCreateMonster}
      customMonsters={customMonsters}
      onDelete={onDeleteMonster}
    />
  );

  // ⚠️ « Tout effacer » reste SÉPARÉ des gestes de construction : dans la page
  // il se pose à l'opposé (`ml-auto`), dans le panneau il est détaché en bas
  // sous un filet. Un bouton destructeur ne se met pas au contact de celui
  // qu'on presse en boucle.
  const effacer = addedIds.size > 0 && (
    <button
      onClick={() => {
        setEffacementAConfirmer(true);
        onFermerMenu();
      }}
      className="flex items-center gap-1.5 text-xs text-ink-dim hoverable:text-fire transition"
    >
      <Trash2 size={13} /> Tout effacer
    </button>
  );

  return (
    <div>
      <div>
        <RtaSearch monsters={monsters} addedIds={addedIds} onAdd={rta.addMonster} />
      </div>

      {/* ⚠️ Seul le COMPTEUR reste dans la page — c'est une information, pas
          une action. La création et l'effacement descendent dans le panneau
          « Options » sous `lg`. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-ink-dim">
          {addedIds.size} monstre{addedIds.size > 1 ? 's' : ''} en prépa
        </span>

        <div className="hidden lg:contents">{creation}</div>
        <div className="ml-auto hidden lg:contents">{effacer}</div>
      </div>

      {effacementAConfirmer && (
        <ConfirmDialog
          titre="Effacer toute la prépa RTA ?"
          message={
            <>
              Tous les monstres ajoutés, leurs vitesses et leurs sections seront retirés. Tes
              catégories de couleur sont conservées.
              {/* ⚠️ Le point de sauvegarde SURVIT volontairement : c'est ce qui
                  permet de revenir sur un effacement. L'effacer aussi ferait de
                  ce bouton une perte sans retour. */}
              {backup.backup && (
                <>
                  {' '}
                  Ton point de sauvegarde n'est pas touché :{' '}
                  <b className="text-ink">« Reprendre » te ramènera à ta prépa.</b>
                </>
              )}
            </>
          }
          libelleAction="Tout effacer"
          destructif
          onCancel={() => setEffacementAConfirmer(false)}
          onConfirm={() => {
            setEffacementAConfirmer(false);
            rta.clearAll();
          }}
        />
      )}

      {/* ⚠️ La barre d'actions vit à DEUX endroits selon la largeur, mais
          c'est le MÊME composant rendu une seule fois — pas une copie. Au-dessus
          de `lg` elle est en tête de page ; en dessous elle passe dans le
          tiroir, faute de place : six boutons, deux rangées de catégories et un
          champ de recherche repoussaient la prépa de trois écrans. */}
      <div className="hidden lg:block">
        <RtaBackupBar
          rta={rta}
          cats={cats}
          backup={backup}
          monsters={monsters}
          onConsulter={setVueAmi}
          onCreateMonster={onCreateMonster}
        />
      </div>

      {/* ⚠️ **Une rangée par TYPE d'action.** Empilés en une seule colonne, six
          boutons de nature différente se lisaient comme une liste indifférenciée
          où il fallait relire chaque libellé. Regroupés — créer, puis sauver et
          revenir, puis échanger un fichier — on vise la bonne rangée d'abord et
          le bon bouton ensuite. `RtaBackupBar` porte ses deux rangées ; celle-ci
          ajoute la création avant, les catégories et l'effacement après. */}
      <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre="Ma prépa RTA">
        <div className="flex flex-col gap-3">
          {/* ⚠️ Marqué comme les autres : ce bouton seul occupe UNE cellule de
              la grille, pas toute la largeur. Sans cela il s'étirait sur les
              trois colonnes et écrasait par sa taille les six boutons en
              dessous, alors qu'il ne vaut pas plus qu'eux. */}
          <div data-rangee-actions>{creation}</div>

          <RtaBackupBar
            rta={rta}
            cats={cats}
            backup={backup}
            monsters={monsters}
            onConsulter={(v) => {
              setVueAmi(v);
              onFermerMenu();
            }}
            onCreateMonster={onCreateMonster}
          />

          <CategoryBar cats={cats} monsters={pageMonsters} />
        </div>

        {effacer && <div data-zone-destructive className="mt-4 border-t border-border pt-3">{effacer}</div>}
      </MobileSheet>

      {/* ⚠️ La prépa consultée s'affiche AVANT la sienne, et encadrée : c'est ce
          qu'on vient d'ouvrir, on doit la voir sans chercher. Elle se ferme d'un
          bouton et ne laisse aucune trace. */}
      {vueAmi && <RtaFriendView vue={vueAmi} onClose={() => setVueAmi(null)} />}

      {/* ⚠️ Les catégories descendent AUSSI dans le panneau sous `lg` : deux
          rangées de pastilles plus le bouton de création, soit un tiers d'écran
          de téléphone consacré à un outil d'ORGANISATION — pas au contenu qu'on
          vient organiser. */}
      <div className="hidden lg:block">
        <CategoryBar cats={cats} monsters={pageMonsters} />
      </div>

      {loadState === 'loading' && monsters.length === 0 && (
        <p className="mt-4 text-ink-dim text-sm">Chargement des monstres…</p>
      )}

      {/* Zone tampon : les monstres ajoutés y arrivent avant classement */}
      <div className="mt-5">
        <RtaSection
          sectionKey={RTA_UNASSIGNED}
          label="Non classé"
          accent={sectionAccent(RTA_UNASSIGNED)}
          count={groups[RTA_UNASSIGNED]?.length ?? 0}
          onDropMonster={handleDrop}
          {...detailOf(groups[RTA_UNASSIGNED] ?? [])}
        >
          {renderCards(groups[RTA_UNASSIGNED] ?? [])}
        </RtaSection>
      </div>

      {/* Sections par set de runes */}
      <div className="mt-6 flex flex-col gap-4">
        {runeSections.map((key) => (
          <RtaSection
            key={key}
            sectionKey={key}
            label={sectionLabel(key)}
            accent={sectionAccent(key)}
            count={groups[key]?.length ?? 0}
            removable={key !== RTA_OTHER}
            onRemoveSection={rta.removeSection}
            onDropMonster={handleDrop}
            {...detailOf(groups[key] ?? [])}
          >
            {renderCards(groups[key] ?? [])}
          </RtaSection>
        ))}
      </div>

      {/* Ajout d'une nouvelle section par set de runes */}
      <div className="mt-4 flex items-center gap-2.5 flex-wrap">
        <span className="label">
          Ajouter une section
        </span>
        <select
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm outline-none"
        >
          <option value="">Choisir un set de runes…</option>
          {availableSets.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          disabled={!newSection}
          onClick={() => {
            rta.addSection(newSection);
            setNewSection('');
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-sm
                     text-ink-dim hoverable:text-ink hoverable:border-accent transition
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} /> Créer
        </button>
      </div>

      {/* Ordre de tour global, trié par vitesse totale */}
      <section className="mt-10">
        <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap pb-2.5 mb-4 border-b border-border">
          <h2 className="font-display text-lg tracking-wide">Ordre de tour</h2>
          <span className="font-mono text-ink-dim text-xs">par vitesse combat totale</span>
        </div>
        {/* ⚠️ Les catégories sont passées ENTIÈRES, le masquage est le rôle de
            `categoriesVisible`. Les filtrer ici les retirait du composant, dont
            l'interrupteur ne pouvait alors plus rien réafficher. */}
        <TurnOrder
          items={allItems}
          onRuneSpeed={rta.setRuneSpeed}
          categories={cats.categories}
          categoriesVisible={cats.visible}
          onToggleCategories={cats.setVisible}
          estVisible={cats.estVisible}
          onToggleCategorie={cats.toggleVisible}
        />
      </section>
    </div>
  );
}
