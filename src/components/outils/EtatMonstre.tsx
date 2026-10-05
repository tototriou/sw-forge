import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ArtifactDamageProfile, DamageSetup, LEADER_SKILL_STATS, LEADER_SKILL_VALEURS, LeaderSkillStat, SUMMONER_SKILLS_LABELS, SummonerSkills, type SetAura } from '../../lib/damage';
import { leadIconUrl, STAT_LABEL } from '../siege/LeadPill';
import { Bouton, BoutonIcone, Jeton, NumberField, Segmented, Selecteur } from '../../ui';
import type { RappelBuffDePassif } from '../../lib/buffsDePassif';
import HelpPopover from '../HelpPopover';
import EffetVignette from './EffetVignette';
import { ATK_BUFF_ICON, DEF_BUFF_ICON, SPD_BUFF_ICON } from '../../lib/damage';
import {
  PLAFOND_AURAS_EXTERNES,
  ajouterAura,
  changerNombreAura,
  changerSetAura,
  guideVersResPre,
  libelleNombreAura,
  nombreMaxDeLaLigne,
  nomSetAura,
  peutAjouterAura,
  retirerAura,
  setsDisponibles,
  sommeAurasExternes,
  type AuraExterne,
} from '../../lib/aurasExternes';

/**
 * « État de mon monstre » — ce qui rend le monstre plus fort, indépendamment
 * de qui il frappe.
 *
 * ⚠️ **Ces cinq réglages vivaient dans `DamageSetupCard`**, donc atteignables
 * seulement sous l'objectif « Dégâts réels » — alors qu'ils changent AUSSI les
 * dégâts supplémentaires bruts des artéfacts (codes 218-221), affichés quel
 * que soit l'objectif. Un joueur optimisant l'efficience subissait donc des
 * buffs qu'il ne pouvait ni voir ni régler. Aucun champ n'est créé ici : ce
 * sont les mêmes `DamageSetup.atkBuff`/`defBuff`/`spdBuff`/`leaderSkill`/
 * `summonerSkills`, montrés ailleurs.
 *
 * Un sixième contexte s'y ajoute au lot 7a de degats-et-aura : les sets
 * d'aura des AUTRES monstres de l'équipe (`DamageSetup.setsAuraExternes`),
 * jusque-là saisissables seulement dans une recette — voir
 * `AurasExternesSaisie` plus bas.
 *
 * ⚠️ **Le critère de la coupe, et il se vérifie** : sortent de la description
 * du combat EXACTEMENT les réglages qui modifient les statistiques propres du
 * monstre. Les dégâts bruts valant `%PV×PV + %ATQ×ATQ + %DEF×DEF + %VIT×VIT`,
 * ce sont exactement ceux qui les font bouger. Ce qui reste dans la fenêtre
 * (défense/PV/élément de la cible, sort, critique, réduction de DEF, marque,
 * effets d'alliés) n'y touche pas — voir les correctifs 7798557 et e26118c,
 * « un bonus +X % par effet ne majore pas les dégâts bruts ». Test : changer
 * un réglage d'ici DOIT faire bouger le « +X / coup » — sauf les auras
 * Accuracy et Tolerance (degats-et-aura 7a). Elles modifient bien des
 * statistiques propres du monstre, la Précision et la RES, mais aucune
 * n'entre dans les dégâts bruts : pour elles, ce qui bouge est la condition
 * RES/PRE (minimum ou maximum), quand `compterAurasResPre` est activé.
 *
 * ⚠️ **Rendus INCONDITIONNELLEMENT**, contrairement à leur ancienne place. Les
 * vignettes n'apparaissaient que si la formule du sort choisi lisait la
 * statistique (`utilise('ATK')`…) — la bonne question tant qu'elles
 * décrivaient un coup. Elle ne l'est plus : un buff change les statistiques du
 * monstre, donc les dégâts bruts des artéfacts, quel que soit le sort et même
 * sans sort du tout.
 */
export default function EtatMonstre({
  setup,
  maj,
  etroit,
  artefacts,
  rappelAuras,
  onGuiderResPre,
  rappelsBuffs,
}: {
  setup: DamageSetup;
  maj: (patch: Partial<DamageSetup>) => void;
  etroit: boolean;
  artefacts: ArtifactDamageProfile;
  // Passifs du monstre choisi qui posent un buff standard (degats-et-aura
  // P2, `rappelsBuffsDePassif`, buffsDePassif.ts) : un rappel, jamais un
  // réglage — le buff reste à allumer à la main dans la boîte ci-dessous.
  rappelsBuffs: RappelBuffDePassif[];
  // Rappel « Pense à vérifier les sets d'aura externes. » (degats-et-aura
  // 7b) : décidé et minuté par l'écran (`doitRappeler`, OptimizerSection.tsx,
  // au seul geste de la liste de travail) ; seul son rendu vit ici.
  rappelAuras: boolean;
  // Ouverture guidée vers l'interrupteur des auras RES/PRE (degats-et-aura
  // 7b) : appelée quand une écriture de l'utilisateur fait APPARAÎTRE
  // Accuracy ou Tolerance (`guideVersResPre`) ; défilement, ouverture et
  // surlignage appartiennent à l'écran, qui connaît les deux formats.
  onGuiderResPre: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <p className="label">État de mon monstre</p>
        <HelpPopover title="État de mon monstre">
          Ce qui rend ton monstre plus fort, <b className="text-ink">quel que soit l&apos;adversaire</b> : buffs
          reçus, leader skill de l&apos;équipe, compétences d&apos;invocateur, sets d&apos;aura des autres
          monstres. Ces réglages changent ses statistiques, donc les{' '}
          <b className="text-ink">dégâts supplémentaires</b> que lui apportent des artéfacts proportionnels
          aux PV, à l&apos;ATQ, à la DEF ou à la VIT.
          <br />
          <br />
          Ce qui décrit <b className="text-ink">le combat</b> — le sort, la cible, le coup critique — vit dans
          la fenêtre « Dégâts réels », qui s&apos;ouvre depuis l&apos;objectif de recherche.
        </HelpPopover>
      </div>

      {/* ⚠️ **Les trois groupes sur UNE rangée** (demande explicite) : buffs,
          leader skill et invocateur décrivent la même chose — l'état du
          monstre — et les empiler sur trois lignes donnait à la carte une
          hauteur sans rapport avec le peu qu'elle contient.
          ⚠️ `flex-wrap` et non une rangée rigide : au doigt, ou dans une
          colonne étroite, ils repassent à la ligne d'eux-mêmes plutôt que de
          comprimer les contrôles sous leur taille de cible. `gap-x-4` sépare
          les groupes plus franchement que `gap-y-2` ne sépare les lignes, pour
          qu'on lise trois groupes et non une file de contrôles. */}
      {/* ⚠️ **Trois BOÎTES, pas des barres verticales.** Une barre (`border-r`
          sur les deux premiers groupes) aurait été plus légère — c'est le
          patron des deux colonnes de « Critères de recherche ». Mais ces
          groupes-ci sont en `flex-wrap` : dès qu'un passe à la ligne, sa barre
          se retrouve à pendre dans le vide au bout d'une rangée. Un contour
          ferme le groupe où qu'il aille.
          ⚠️ Un SEUL contour, jamais deux superposés (spec/shared/design.md) :
          ces boîtes sont à l'intérieur de la carte, elles ne longent pas son
          bord. Même patron que les groupes du panneau « Options » mobile.
          ⚠️ `items-stretch` : les trois boîtes prennent la hauteur de la plus
          haute. Sans lui, une boîte d'une rangée flottait au milieu d'une
          boîte de deux, et l'œil lisait un décalage plutôt qu'un groupe. */}
      <div className="flex flex-wrap items-stretch gap-2">
      {/* Mêmes vignettes qu'avant, même composant : l'ICÔNE est le contrôle. */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
        <EffetVignette
          icone={ATK_BUFF_ICON}
          libelle="Buff ATQ"
          description="Augmente l’ATQ du monstre de 50 %."
          onClick={() => maj({ atkBuff: !setup.atkBuff })}
          actif={setup.atkBuff}
          etroit={etroit}
        />
        <EffetVignette
          icone={DEF_BUFF_ICON}
          libelle="Buff DEF"
          description="Augmente la DEF du monstre de 70 %."
          onClick={() => maj({ defBuff: !setup.defBuff })}
          actif={setup.defBuff}
          etroit={etroit}
        />
        <EffetVignette
          icone={SPD_BUFF_ICON}
          libelle="Buff VIT"
          description="Augmente la VIT du monstre de 30 %."
          onClick={() => maj({ spdBuff: !setup.spdBuff })}
          actif={setup.spdBuff}
          etroit={etroit}
        />
      </div>

      {/* La boîte est posée ICI et non dans le composant : les trois contours
          se lisent alors d'un coup dans ce fichier, et se corrigent ensemble. */}
      <div className="flex items-center rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
        <LeaderSkillPicker setup={setup} maj={maj} />
      </div>

      {/* ⚠️ **Libellé AU-DESSUS des crans, pas à leur gauche** (demande
          explicite) : côte à côte, « Invocateur » et ses deux crans
          formaient le groupe le plus large des trois et poussaient la rangée
          à se replier plus tôt. Empilé, le groupe ne fait plus que la largeur
          du segmenté.
          ⚠️ **Sans changer la hauteur de la carte** : le groupe passe à deux
          rangées, mais le voisin « Lead » en fait déjà deux et `items-stretch`
          aligne les trois boîtes sur la plus haute. Celle-ci reste donc celle
          du lead — l'invocateur se contente de remplir la place qui existait
          déjà. */}
      <div className="flex flex-col gap-1 rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
        {/* `justify-center` : le libellé se centre sur le segmenté en dessous,
            qui est plus large que lui (demande explicite). */}
        <div className="flex items-center justify-center gap-1.5">
        <span className="text-xs text-ink-dim">Invocateur</span>
        <HelpPopover title="Compétences d'invocateur">
          Remplacent les anciens <b className="text-ink">totems</b> (onglet Combat) et{' '}
          <b className="text-ink">drapeaux</b> de Guerre de Guilde (onglet Guilde), toujours supposées{' '}
          <b className="text-ink">maxées</b>. <b className="text-ink">Combat</b> s&apos;applique partout ;{' '}
          <b className="text-ink">Combat + Guilde</b> n&apos;a de sens qu&apos;en contenu de guilde, où les
          compétences de Combat comptent aussi — d&apos;où un choix unique plutôt que deux cases. La
          compétence <b className="text-ink">« Puis. d&apos;att. de {'<'}élément{'>'} »</b> est appliquée selon
          l&apos;élément du monstre, sans rien demander.
        </HelpPopover>
        </div>
        {/* `size="sm"` et non `lg` : dans une carte étroite,
            la taille d'origine (héritée d'une carte pleine largeur) débordait. */}
        <Segmented<SummonerSkills>
          options={SUMMONER_SKILLS_LABELS}
          value={setup.summonerSkills}
          onChange={(v) => maj({ summonerSkills: v })}
          size="sm"
        />
      </div>
      </div>
      {/* ⚠️ **Rappel des buffs posés par un passif** (degats-et-aura P2) :
          même grammaire que les lignes d'amplification juste dessous (texte
          `xs` atténué sous la rangée des buffs) ; le passif est nommé comme
          dans « Stats acquises en combat » (lot 11) — `Jeton` en lecture
          seule, icône et nom du jeu. La condition est un extrait LITTÉRAL de
          la prose, entre guillemets, jamais reformulé.
          ⚠️ Il dépend du MONSTRE, jamais d'un clic dans cette carte : il
          paraît au choix du monstre, dont le sélecteur et la liste vivent
          dans la carte du haut (avant celle-ci au téléphone, rangée 1 au
          bureau) — rien de ce qu'on vient de cliquer ne bouge. Les vignettes
          au-dessus ne bougent pas non plus : il vit sous elles. */}
      {rappelsBuffs.length > 0 && (
        <div className="space-y-0.5 text-xs text-ink-dim">
          {rappelsBuffs.map((r) => (
            <p key={r.skillCom2usId} className="flex flex-wrap items-center gap-1.5">
              <Jeton
                icone={r.icone ? <img src={r.icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
                libelle={r.nom}
              />
              <span>
                pose {r.buffs} — « {r.condition} »
              </span>
            </p>
          ))}
        </div>
      )}
      {(setup.atkBuff && artefacts.ampliAtkPct > 0) ||
      (setup.defBuff && artefacts.ampliDefPct > 0) ||
      (setup.spdBuff && artefacts.ampliVitPct > 0) ? (
        <div className="space-y-0.5 text-xs text-ink-dim">
          {setup.atkBuff && artefacts.ampliAtkPct > 0 && (
            <p>Buff ATQ actif : l'artéfact « Effet renforcement ATQ » amplifie ce buff de {artefacts.ampliAtkPct} %.</p>
          )}
          {setup.defBuff && artefacts.ampliDefPct > 0 && (
            <p>Buff DEF actif : l'artéfact « Effet renforcement DEF » amplifie ce buff de {artefacts.ampliDefPct} %.</p>
          )}
          {setup.spdBuff && artefacts.ampliVitPct > 0 && (
            <p>Buff VIT actif : l'artéfact « Effet aug. VIT » amplifie ce buff de {artefacts.ampliVitPct} %.</p>
          )}
        </div>
      ) : null}

      {/* ⚠️ **Sous la rangée des trois groupes, pas à côté** : la saisie des
          auras grandit d'une ligne par set, et la rangée « une seule ligne »
          (demande explicite) n'a pas à la porter. Même boîte que les trois
          groupes — un seul contour, à l'intérieur de la carte.
          ⚠️ **En dernier dans la carte** : ajouter une ligne ne pousse que
          vers le BAS, rien de ce qui précède — ni le bouton d'ajout, fixe en
          tête de sa boîte (spec/shared/design.md, réponse n° 3). */}
      <AurasExternesSaisie setup={setup} maj={maj} rappel={rappelAuras} onGuiderResPre={onGuiderResPre} />
    </div>
  );
}

/**
 * Les sets d'aura des AUTRES monstres de l'équipe (`setsAuraExternes`).
 *
 * ⚠️ **Toute écriture passe par `aurasExternes.ts`**, qui borne le nombre de 1
 * à `15 − somme des autres lignes` et refuse un set répété : `min`/`max` du
 * `NumberField` ne servent qu'à ses boutons ± et à la sortie du champ — une
 * frappe leur échappe, la fonction pure non.
 *
 * ⚠️ **Le bouton d'ajout est FIXE, en tête** (demande explicite) : les lignes
 * s'ajoutent SOUS lui, il ne bouge jamais sous le clic. Désactivé à somme 15
 * ou quand les cinq sets ont leur ligne, avec la raison en `title` — jamais
 * retiré du rendu (spec/shared/design.md, « un bouton d'action ne disparaît
 * jamais »).
 *
 * ⚠️ **Un champ vidé revient à 1 à la sortie du champ** (demande explicite) :
 * seule la corbeille retire une ligne. Pendant qu'il est vide, l'état porte
 * déjà 1 (la fonction pure l'écrit) ; seul l'affichage reste vide, jusqu'au
 * `onBlur`.
 *
 * ⚠️ **Le libellé explicite est SOUS les contrôles de sa ligne**, jamais
 * au-dessus : il change avec le set choisi (« Determination » est plus long
 * que « Fight ») et peut passer à la ligne ; au-dessus, il ferait descendre
 * le menu qu'on vient de cliquer. Dessous, il ne pousse que vers le bas. Le
 * menu occupe la colonne `1fr` : sa largeur vient de la boîte, jamais de
 * l'option choisie.
 *
 * ⚠️ **Le rappel (degats-et-aura 7b) recolore la boîte, il ne la redessine
 * pas** : contour `warn` et fond `warn-soft` À LA PLACE de `border-soft` et
 * `panel2` — toujours un seul contour de 1 px. Son message occupe la MÊME
 * case de grille que l'en-tête (libellé, aide, total), invisible le reste du
 * temps : la case a donc déjà la hauteur du plus haut des deux, et rien ne
 * bouge quand il paraît (spec/shared/design.md, réponse n° 1). Pendant les
 * 3 s, l'en-tête s'efface derrière lui.
 *
 * ⚠️ **L'ouverture guidée (7b) part d'`ecrire`, et de lui seul** : c'est le
 * point de passage de chaque geste de cette boîte, jamais celui d'une recette
 * importée (qui écrit `damageSetup` directement) — le guidage n'est donc
 * jamais rejoué à l'import ni au changement de monstre.
 */
function AurasExternesSaisie({
  setup,
  maj,
  rappel,
  onGuiderResPre,
}: {
  setup: DamageSetup;
  maj: (patch: Partial<DamageSetup>) => void;
  rappel: boolean;
  onGuiderResPre: () => void;
}) {
  const entrees = setup.setsAuraExternes ?? [];
  // Le set dont le champ du nombre est momentanément VIDE (affichage seul).
  const [ligneVide, setLigneVide] = useState<SetAura | null>(null);
  const ecrire = (suivantes: AuraExterne[]) => {
    if (suivantes === entrees) return;
    maj({ setsAuraExternes: suivantes });
    if (guideVersResPre({ aurasExternes: entrees }, { aurasExternes: suivantes })) onGuiderResPre();
  };
  const total = sommeAurasExternes(entrees);
  const ajoutPossible = peutAjouterAura(entrees);
  const raisonAjoutImpossible = ajoutPossible
    ? undefined
    : total >= PLAFOND_AURAS_EXTERNES
      ? `${PLAFOND_AURAS_EXTERNES} sets au total : cinq autres monstres à trois sets`
      : 'Les cinq sets d’aura ont déjà leur ligne';

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-2 py-1.5 transition-colors duration-200 ${
        rappel ? 'border-warn bg-warn-soft' : 'border-border-soft bg-panel2'
      }`}
    >
      <div className="grid">
      <div className={`col-start-1 row-start-1 flex items-center justify-between gap-2 ${rappel ? 'invisible' : ''}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-dim">Sets d&apos;aura des autres monstres</span>
          <HelpPopover title="Sets d'aura des autres monstres">
            Les sets <b className="text-ink">Fight</b>, <b className="text-ink">Determination</b>,{' '}
            <b className="text-ink">Enhance</b>, <b className="text-ink">Accuracy</b> et{' '}
            <b className="text-ink">Tolerance</b> portés par les <b className="text-ink">autres</b> monstres de
            l&apos;équipe : {PLAFOND_AURAS_EXTERNES} au plus, cinq monstres à trois sets.
            <br />
            <br />
            Les sets du monstre optimisé sont <b className="text-ink">comptés automatiquement</b> sur chaque
            build, même s&apos;ils ne sont pas recherchés : ne les saisis pas ici.
            <br />
            <br />
            Fight, Determination et Enhance ajoutent chacun 8 % de l&apos;ATQ, de la DEF ou des PV de base ;
            Accuracy et Tolerance, 8 points de Précision ou de RES.
          </HelpPopover>
        </div>
        <span className="font-mono text-micro tabular-nums text-ink-dim">
          {total} / {PLAFOND_AURAS_EXTERNES}
        </span>
      </div>
      {/* ⚠️ Rendu SANS condition, dans la case de l'en-tête : c'est ce qui
          réserve sa place (voir l'en-tête de ce composant). `aria-live` sur
          un conteneur toujours visible : le message qui y devient visible est
          annoncé. `apparition` : un message qui se pose en place
          (spec/shared/design.md, Mouvement). */}
      <div className="col-start-1 row-start-1 self-center" aria-live="polite">
        <p
          className={`text-xs font-semibold text-warn ${
            rappel ? 'animate-[apparition_200ms_var(--ease-out)]' : 'invisible'
          }`}
        >
          Pense à vérifier les sets d&apos;aura externes.
        </p>
      </div>
      </div>

      <Bouton
        trait="pointille"
        taille="sm"
        pleineLargeur
        icone={<Plus size={14} />}
        libelle="Ajouter un set d'aura"
        disabled={!ajoutPossible}
        title={raisonAjoutImpossible}
        onClick={() => ecrire(ajouterAura(entrees))}
      />

      {entrees.length > 0 && (
        <div className="divide-y divide-border">
          {entrees.map((entree, index) => {
            const libelle = libelleNombreAura(entree.set);
            return (
              // ⚠️ Clé par POSITION et non par set : changer le set d'une
              // ligne la garde montée, et le menu garde le focus.
              <div
                key={index}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-0.5 py-1.5 last:pb-0"
              >
                <Selecteur
                  value={entree.set}
                  onChange={(e) => {
                    setLigneVide(null);
                    ecrire(changerSetAura(entrees, entree.set, e.target.value as SetAura));
                  }}
                  taille="sm"
                  aria-label={`Set d'aura de la ligne ${index + 1}`}
                >
                  {setsDisponibles(entrees, entree.set).map((set) => (
                    <option key={set} value={set}>
                      {nomSetAura(set)}
                    </option>
                  ))}
                </Selecteur>
                <NumberField
                  value={ligneVide === entree.set ? null : entree.nombre}
                  allowEmpty
                  onChange={(v) => {
                    setLigneVide(v == null ? entree.set : null);
                    ecrire(changerNombreAura(entrees, entree.set, v));
                  }}
                  onBlur={() => setLigneVide(null)}
                  min={1}
                  max={nombreMaxDeLaLigne(entrees, entree.set)}
                  width="w-8"
                  placeholder="1"
                  ariaLabel={libelle}
                  title={libelle}
                />
                <BoutonIcone
                  libelle={`Retirer les sets ${nomSetAura(entree.set)}`}
                  icone={<Trash2 size={14} />}
                  ton="danger"
                  onClick={() => {
                    setLigneVide(null);
                    ecrire(retirerAura(entrees, entree.set));
                  }}
                />
                <span className="col-span-full text-micro leading-tight text-ink-dim">{libelle}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Leader skill d'ÉQUIPE — demande explicite : « choisir un leader skill…
// PV, ATQ, DEF, VIT, Taux Crit, Dégâts Crit. Il choisira d'abord le TYPE
// (avec actualisation de l'icône), puis la VALEUR ». Un CHOIX de
// l'utilisateur, jamais déduit d'un monstre chargé ici (le lead vient d'un
// AUTRE monstre de l'équipe).
//
// ⚠️ Icône et libellés RÉUTILISÉS depuis `siege/LeadPill.tsx`
// (`leadIconUrl`/`STAT_LABEL`, déjà l'icône OFFICIELLE du jeu pour un lead de
// monstre) plutôt que dupliqués — « deux tables de libellés auraient
// divergé ». `leadIconUrl` attend un objet `LeaderSkill` complet
// (portée/élément) que ce choix utilisateur n'a pas : traité comme portée
// `'General'`, sans élément, pour obtenir l'icône DE BASE.
function LeaderSkillPicker({ setup, maj }: { setup: DamageSetup; maj: (patch: Partial<DamageSetup>) => void }) {
  const lead = setup.leaderSkill;
  const icone = lead ? leadIconUrl({ stat: lead.stat, amount: lead.pct, area: 'General', element: null }) : null;
  const valeurs = lead ? LEADER_SKILL_VALEURS[lead.stat] : [];

  return (
    /* ⚠️ **Une GRILLE de trois colonnes — libellé, icône, menus — dont TOUTES
        les places sont tenues d'avance.**
        Trois choses bougeaient ici au moindre clic, et c'est le même défaut
        trois fois (spec/shared/design.md, « un clic ne déplace jamais ce qu'on
        vient de cliquer ») :
        1. le menu de la valeur se dépliait À DROITE du type, élargissant le
           groupe et poussant « Invocateur » ;
        2. il ferait grandir la carte en hauteur une fois passé en dessous, si
           sa rangée n'était pas réservée ;
        3. l'icône du lead, rendue sous condition, poussait le menu de type
           dès qu'un lead était choisi.
        D'où une grille : la colonne de l'icône existe même vide, la seconde
        rangée existe même sans lead, et la valeur se pose en `col-start-3`,
        donc exactement sous le type. L'alignement se DÉDUIT des colonnes — il
        n'est pas reproduit à coups de marges qui dériveraient au prochain
        changement de libellé. */
    <div className="grid w-fit grid-cols-[auto_auto_auto] items-center gap-x-2 gap-y-1">
      {/* « Lead » et non « Leader skill » : le libellé long mangeait la
          largeur d'une carte en colonne étroite, pour un mot que tout joueur
          abrège de toute façon. */}
      <span className="text-xs text-ink-dim">Lead</span>
      {/* ⚠️ **La place de l'icône est TENUE, elle aussi.** Rendue sous
          condition, elle poussait le menu de type à droite dès qu'un lead
          était choisi — le même défaut que celui qu'on vient de corriger sur
          la valeur, une colonne plus loin. */}
      <img
        src={icone ?? undefined}
        alt=""
        className={`h-6 w-6 ${icone ? '' : 'invisible'}`}
        loading="lazy"
        aria-hidden
      />
      <Selecteur
        value={lead?.stat ?? ''}
        onChange={(e) => {
          const stat = e.target.value as LeaderSkillStat | '';
          // Type changé : repart sur le premier palier connu de CE type —
          // jamais garder l'ancien pourcentage, qui n'a de sens que pour
          // l'ancien type (44 % ATQ n'est pas un palier de Taux Crit).
          maj({ leaderSkill: stat ? { stat, pct: LEADER_SKILL_VALEURS[stat][0] } : undefined });
        }}
        taille="sm"
        aria-label="Type de leader skill"
      >
        <option value="">Aucun</option>
        {LEADER_SKILL_STATS.map((stat) => (
          <option key={stat} value={stat}>
            {STAT_LABEL[stat] ?? stat}
          </option>
        ))}
      </Selecteur>

      {/* ⚠️ `col-start-3` : sous le TYPE, pas sous le libellé. `invisible` et
          non un rendu conditionnel — l'élément tient sa place sans se voir,
          avec `aria-hidden` et `disabled`, sinon on tabulerait dans un menu
          invisible. */}
      <div className={`col-start-3 ${lead ? '' : 'invisible'}`} aria-hidden={!lead}>
      {lead ? (
        /* ⚠️ **Un seul menu, plus de saisie libre.** Il y avait avant un menu
            de « paliers courants » ET un champ numérique, parce que la table
            ne prétendait pas être complète. `LEADER_SKILL_VALEURS` est
            désormais EXHAUSTIVE (liste fournie par l'utilisateur) : le champ
            libre n'a plus rien à rattraper.
            ⚠️ Ça corrige aussi un défaut signalé : l'ancien menu gagnait une
            option « 44 % (personnalisé) » dès que la valeur quittait un
            palier, et un `<select>` natif se dimensionne sur le texte de
            l'option SÉLECTIONNÉE — il s'élargissait donc d'un coup et poussait
            le champ voisin. Un clic qui déplace ce qu'on vient de cliquer,
            interdit par spec/shared/design.md. */
        <Selecteur
          value={String(lead.pct)}
          onChange={(e) => maj({ leaderSkill: { stat: lead.stat, pct: Number(e.target.value) } })}
          taille="sm"
          aria-label="Valeur du leader skill"
        >
          {valeurs.map((v) => (
            <option key={v} value={v}>
              {v} %
            </option>
          ))}
          {/* ⚠️ Une valeur HORS liste ne peut venir que d'une saisie faite à
              l'époque du champ libre (session en cours, recette importée). On
              l'affiche telle quelle plutôt que de la remplacer en silence :
              changer un chiffre sans prévenir serait pire que le défaut qu'on
              corrige. Elle disparaît dès que l'utilisateur choisit autre
              chose. */}
          {!valeurs.includes(lead.pct) && <option value={lead.pct}>{lead.pct} %</option>}
        </Selecteur>
      ) : (
        /* ⚠️ Un menu FIGURANT, désactivé : il ne sert qu'à tenir la hauteur
            quand aucun lead n'est choisi. Sans lui, la rangée réservée serait
            vide et donc plate — la carte grandirait quand même au premier
            choix, ce que toute cette structure existe pour éviter. */
        <Selecteur value="" onChange={() => {}} taille="sm" disabled aria-hidden tabIndex={-1}>
          <option value="">—</option>
        </Selecteur>
      )}
      </div>
    </div>
  );
}
