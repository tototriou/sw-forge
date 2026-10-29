// Tests de rendu — bibliothèque `src/ui/`. Le RENDU INTERNE des composants
// peut changer, jamais ce qu'ils exposent. Ces tests fixent
// ce qui est exposé — nom accessible, infobulle, état désactivé, état actif —
// et doivent rester verts sans que leurs assertions changent.

import Bouton from '../../src/ui/Bouton';
import BoutonIcone from '../../src/ui/BoutonIcone';
import Pastille from '../../src/ui/Pastille';
import Interrupteur from '../../src/ui/Interrupteur';
import Case from '../../src/ui/Case';
import Segmented from '../../src/ui/Segmented';
import Onglets from '../../src/ui/Onglets';
import Option from '../../src/ui/Option';
import Jeton from '../../src/ui/Jeton';
import Selecteur from '../../src/ui/Selecteur';
import SelecteurMultiple from '../../src/ui/SelecteurMultiple';
import Menu from '../../src/ui/Menu';
import { BandeauNotification } from '../../src/ui/Notification';
import Palette from '../../src/components/Palette';
import type { GroupePalette } from '../../src/components/palette/recherchePalette';
import { egal, ok, titre } from '../outils';
import { auTelephone, bouton, boutons, onglets, rendre, texteVisible } from './outils-rendu';

const rien = () => {};

export function testRenduUiBouton() {
  titre('rendu · src/ui — Bouton et BoutonIcone');

  const simple = rendre(<Bouton libelle="Exporter" onClick={rien} />);
  ok(bouton(simple, 'Exporter')?.desactive === false, 'Bouton : libellé visible, actif par défaut');

  // Un bouton ne disparaît jamais : il se désactive et DIT pourquoi.
  const inactif = rendre(<Bouton libelle="Tout exporter" disabled title="Rien à exporter" onClick={rien} />);
  const b = bouton(inactif, 'Tout exporter');
  ok(!!b?.desactive, 'Bouton désactivé : attribut disabled posé');
  egal(b?.title, 'Rien à exporter', 'Bouton désactivé : la raison reste en infobulle');

  // Bouton à deux états : aria-pressed suit `actif`.
  ok(/aria-pressed="true"/.test(rendre(<Bouton libelle="Vitesses" actif onClick={rien} />)), 'Bouton actif : aria-pressed="true"');
  ok(/aria-pressed="false"/.test(rendre(<Bouton libelle="Vitesses" actif={false} onClick={rien} />)), 'Bouton inactif : aria-pressed="false"');
  ok(!/aria-pressed/.test(simple), 'Bouton d\'action ordinaire : pas d\'aria-pressed');

  // `taille="lg"` : la même action, nommée et désactivable comme les autres
  // tailles, plus haute que `md` (40 px à la souris contre 32).
  const grand = rendre(<Bouton taille="lg" ton="accent" fond="plein" libelle="Rechercher" onClick={rien} />);
  ok(bouton(grand, 'Rechercher')?.desactive === false, 'Bouton lg : libellé visible, actif');
  ok(/lg:min-h-10/.test(grand) && !/lg:min-h-8/.test(grand), 'Bouton lg : plus haut que md (40 px à la souris)');
  ok(!!bouton(rendre(<Bouton taille="lg" libelle="Arrêter" disabled onClick={rien} />), 'Arrêter')?.desactive, 'Bouton lg désactivé : disabled posé');

  // Libellé court (panneau mobile) : les DEUX libellés existent, le long reste le nom.
  const court = rendre(<Bouton libelle="Créer un monstre" libelleCourt="Monstre" onClick={rien} />);
  const t = texteVisible(court);
  ok(t.includes('Créer un monstre') && t.includes('Monstre'), 'Bouton à libellé court : le libellé long et le court sont rendus');

  // BoutonIcone : le libellé est le nom accessible ET l'infobulle.
  const icone = rendre(<BoutonIcone icone={<span>×</span>} libelle="Supprimer l'équipe" onClick={rien} />);
  const bi = boutons(icone)[0];
  egal(bi?.ariaLabel, "Supprimer l'équipe", 'BoutonIcone : aria-label = libellé');
  egal(bi?.title, "Supprimer l'équipe", 'BoutonIcone : infobulle = libellé');
  ok(/aria-pressed="true"/.test(rendre(<BoutonIcone icone={<span>o</span>} libelle="Masquer" actif onClick={rien} />)), 'BoutonIcone actif : aria-pressed="true"');
  ok(!!boutons(rendre(<BoutonIcone icone={<span>o</span>} libelle="Retirer" disabled onClick={rien} />))[0]?.desactive, 'BoutonIcone désactivé : disabled posé');
}

export function testRenduUiEtats() {
  titre('rendu · src/ui — Pastille, Interrupteur, Case, Segmented, Option, Jeton, Selecteur');

  ok(/aria-pressed="true"/.test(rendre(<Pastille libelle="Swift" actif onClick={rien} />)), 'Pastille active : aria-pressed="true"');
  ok(/aria-pressed="false"/.test(rendre(<Pastille libelle="Swift" actif={false} onClick={rien} />)), 'Pastille inactive : aria-pressed="false"');
  ok(texteVisible(rendre(<Pastille libelle="Swift" actif onClick={rien} />)).includes('Swift'), 'Pastille : libellé visible');

  const inter = rendre(<Interrupteur actif onChange={rien} libelle="Garder mes données" />);
  ok(/role="switch"/.test(inter) && /aria-checked="true"/.test(inter), 'Interrupteur : role="switch", aria-checked="true" quand actif');
  ok(/aria-checked="false"/.test(rendre(<Interrupteur actif={false} onChange={rien} libelle="x" />)), 'Interrupteur inactif : aria-checked="false"');
  ok(texteVisible(inter).includes('Garder mes données'), 'Interrupteur : libellé visible');

  ok(/type="checkbox"[^>]*checked=""/.test(rendre(<Case libelle="Antiques" checked onChange={rien} />)), 'Case cochée : case à cocher native cochée');
  ok(!/checked=""/.test(rendre(<Case libelle="Antiques" checked={false} onChange={rien} />)), 'Case décochée : pas cochée');
  ok(texteVisible(rendre(<Case libelle="Antiques" checked onChange={rien} />)).includes('Antiques'), 'Case : libellé visible');

  const seg = rendre(
    <Segmented
      value="clair"
      onChange={rien}
      options={[
        { key: 'auto', label: 'Auto' },
        { key: 'clair', label: 'Clair' },
        { key: 'sombre', label: 'Sombre', disabled: true },
      ]}
    />
  );
  const bs = boutons(seg);
  egal(bs.map((x) => x.texte), ['Auto', 'Clair', 'Sombre'], 'Segmented : chaque option est un bouton libellé');
  egal(bs.filter((x) => x.presse).map((x) => x.texte), ['Clair'], 'Segmented : seule l\'option choisie est active (aria-pressed)');
  ok(bs[2].desactive && !bs[0].desactive, 'Segmented : une option désactivée l\'est, les autres non');

  // En grille (`colonnes`) : les mêmes crans, un seul cadre, un seul choix ; la
  // grille porte le nombre de colonnes demandé, et ses bords intérieurs sont
  // les écarts de 1 px d'une grille au fond `border` (pas de trait par cran).
  const grille = rendre(
    <Segmented value="ehp" onChange={rien} colonnes={2}
      options={[{ key: 'efficience', label: 'Efficience' }, { key: 'reel', label: 'Dégâts réels' }, { key: 'ehp', label: 'PV effectifs' }, { key: 'vitesse', label: 'Vitesse' }]} />,
  );
  const crans = boutons(grille);
  egal(crans.map((x) => x.texte), ['Efficience', 'Dégâts réels', 'PV effectifs', 'Vitesse'], 'Segmented en grille : chaque option reste un bouton libellé');
  egal(crans.filter((x) => x.presse).map((x) => x.texte), ['PV effectifs'], 'Segmented en grille : un seul choix actif');
  ok(/grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/.test(grille), 'Segmented en grille : deux colonnes de largeur égale');
  ok(!/w-px self-stretch bg-border/.test(grille), 'Segmented en grille : aucun trait de rangée par cran');
  ok(/class="grid gap-px bg-border"/.test(grille) && (grille.match(/class="flex items-stretch bg-panel2"/g) ?? []).length === 4,
    'Segmented en grille : bords intérieurs dessinés (grille au fond border, écarts de 1 px, chaque case au fond du cadre)');

  ok(/aria-pressed="true"/.test(rendre(<Option titre="Box" actif onClick={rien} />)), 'Option active : aria-pressed="true"');

  const jeton = rendre(<Jeton libelle="Veromos" onRetirer={rien} libelleRetrait="Retirer Veromos" />);
  ok(texteVisible(jeton).includes('Veromos'), 'Jeton : libellé visible');
  egal(boutons(jeton)[0]?.ariaLabel, 'Retirer Veromos', 'Jeton retirable : bouton de retrait nommé');
  egal(boutons(rendre(<Jeton libelle="Veromos" />)).length, 0, 'Jeton non retirable : aucun bouton');

  const sel = rendre(
    <Selecteur value="b" onChange={rien} disabled aria-label="Tri">
      <option value="a">Score</option>
      <option value="b">Efficience</option>
    </Selecteur>
  );
  ok(/<select[^>]*disabled/.test(sel) && /aria-label="Tri"/.test(sel), 'Selecteur : nom accessible et état désactivé transmis');
  ok(texteVisible(sel).includes('Score') && texteVisible(sel).includes('Efficience'), 'Selecteur : options rendues');
}

// Menu d'actions « ⋯ ».
export function testRenduUiMenu() {
  titre('rendu · src/ui — Menu');
  const html = rendre(
    <Menu
      libelle="Plus d'actions"
      elements={[
        { cle: 'a', libelle: 'Sauvegarder', onClick: () => {} },
        { cle: 'b', libelle: 'Reprendre', onClick: () => {}, disabled: true, title: 'Aucun point de sauvegarde' },
        { cle: 'c', libelle: 'Tout effacer', onClick: () => {}, danger: true },
      ]}
    />
  );
  const declencheur = bouton(html, "Plus d'actions");
  ok(!!declencheur && declencheur.ariaLabel === "Plus d'actions" && declencheur.title === "Plus d'actions", 'le bouton « ⋯ » est nommé (aria-label et infobulle)');
  ok(/aria-haspopup="menu"/.test(html) && /aria-expanded="false"/.test(html), 'il annonce un menu, fermé');
  ok(/role="menu"[^>]*aria-label="Plus d&#x27;actions"|aria-label="Plus d&#x27;actions"[^>]*role="menu"/.test(html), 'la liste porte role="menu" et le même nom');
  egal((html.match(/role="menuitem"/g) ?? []).length, 3, 'fermé, les trois entrées restent dans le DOM (masquées, pas retirées)');
  const reprendre = bouton(html, 'Reprendre');
  ok(!!reprendre && reprendre.desactive && reprendre.title === 'Aucun point de sauvegarde', 'une entrée désactivée le reste, avec sa raison');
  // L'entrée destructrice vient APRÈS les autres, derrière un filet.
  const ordre = boutons(html).filter((b) => ['Sauvegarder', 'Reprendre', 'Tout effacer'].includes(b.texte)).map((b) => b.texte);
  egal(ordre, ['Sauvegarder', 'Reprendre', 'Tout effacer'], 'l\'entrée destructrice est rangée en dernier');
  // Des dizaines d'invocateurs dans un dossier SW Exporter : la liste a un
  // plafond et défile, au lieu de sortir de l'écran.
  ok(/<div[^>]*class="[^"]*max-h-\[min\(70dvh,480px\)\][^"]*overflow-y-auto/.test(html), 'la liste est plafonnée et défile');

  // Application de bureau : un déclencheur fourni (la carte du compte)
  // et l'ancrage à gauche.
  const carte = rendre(
    <Menu
      libelle="Changer de compte"
      cote="gauche"
      declencheur={(p) => (
        <button type="button" {...p} aria-label="Changer de compte">
          Tototriou
        </button>
      )}
      elements={[
        { cle: 'a', libelle: 'tototriou', onClick: () => {}, actif: true },
        { cle: 'b', libelle: 'Importer un fichier…', onClick: () => {} },
      ]}
    />
  );
  ok(!bouton(carte, 'Plus d\'actions') && !/aria-label="Changer de compte"[^>]*>\s*<svg/.test(carte), 'déclencheur fourni : pas de « ⋯ »');
  ok(/<button[^>]*aria-haspopup="menu"[^>]*>Tototriou<\/button>|<button[^>]*aria-expanded="false"[^>]*>Tototriou/.test(carte), 'le déclencheur fourni reçoit l’ARIA du menu');
  ok(/role="menuitemcheckbox"[^>]*aria-checked="true"/.test(carte), 'l’entrée suivie est cochée (aria-checked)');
}

// La palette Ctrl K — ajoutée avec elle. La Modale passe
// par un portail : rendue par `auTelephone`, qui le pose en place.
export function testRenduPalette() {
  titre('rendu · Palette Ctrl K');
  const rien = () => {};
  const groupes = (saisie: string): GroupePalette[] =>
    saisie === 'rien'
      ? []
      : [
          { titre: 'Pages', entrees: [{ cle: 'p', libelle: 'Recommandations', contexte: 'Siège', faire: rien }] },
          { titre: 'Actions', entrees: [{ cle: 'a', libelle: 'Importer mon compte', faire: rien }] },
        ];
  const html = auTelephone(() => rendre(<Palette groupesPour={groupes} onFermer={rien} />));
  const t = texteVisible(html);
  ok(/placeholder="Rechercher une page, un monstre, une action…"/.test(html), 'le champ, et ce qu\'il cherche');
  ok(t.includes('Pages Recommandations Siège Actions Importer mon compte'), 'les groupes intitulés, chaque entrée avec son contexte');
  ok(/aria-selected="true"[^>]*>|data-actif="true"/.test(html), 'une entrée est sélectionnée d\'emblée (Entrée l\'ouvre)');
  const vide = texteVisible(auTelephone(() => rendre(<Palette groupesPour={groupes} onFermer={rien} saisieInitiale="rien" />)));
  ok(vide.includes('Aucun résultat pour « rien » Essaie un nom de monstre, de page ou d\'action.'), 'rien ne répond : le dire, et quoi essayer');
}

// La notification « … · Annuler » — ajoutée avec elle.
export function testRenduUiSelecteurMultiple() {
  titre('rendu · src/ui — SelecteurMultiple');
  const options = [
    { valeur: 2, libelle: 'PV%' },
    { valeur: 4, libelle: 'ATQ%' },
    { valeur: 8, libelle: 'VIT', disabled: true, title: 'Indisponible ici' },
  ];
  const vide = rendre(<SelecteurMultiple libelle="Slot 2" options={options} valeurs={[]} onChange={rien} vide="Libre" />);
  const dVide = bouton(vide, 'Slot 2 : Libre');
  ok(!!dVide && dVide.texte === 'Libre', 'fermée sans choix : le déclencheur dit « Libre », nommé par le réglage');
  ok(/aria-expanded="false"/.test(vide) && /aria-haspopup="true"/.test(vide), 'le déclencheur annonce une surface, fermée');
  ok(/role="group"[^>]*aria-label="Slot 2"|aria-label="Slot 2"[^>]*role="group"/.test(vide), 'la surface porte le nom du réglage');
  egal((vide.match(/type="checkbox"/g) ?? []).length, 3, 'fermée, chaque option reste dans le DOM (masquée, pas retirée)');
  ok(!/checked=""/.test(vide), 'sans choix, aucune case cochée');

  // Deux choix : résumés dans l'ordre des options, et cochés.
  const deux = rendre(<SelecteurMultiple libelle="Slot 2" options={options} valeurs={[4, 2]} onChange={rien} vide="Libre" />);
  const dDeux = bouton(deux, 'Slot 2 : PV%, ATQ%');
  ok(!!dDeux && dDeux.texte === 'PV%, ATQ%', 'fermée : les choix résumés dans l\'ordre des options');
  egal((deux.match(/checked=""/g) ?? []).length, 2, 'les deux options choisies sont cochées');
  ok(/disabled=""[^>]*title="Indisponible ici"|title="Indisponible ici"[^>]*disabled=""/.test(deux), 'une option désactivée le reste, avec sa raison');

  // Axes de structure : un résumé et une surface fournis par l'appelant.
  const libre = rendre(
    <SelecteurMultiple libelle="Set de runes recherché" vide="Aucun"
      resume={{ visuel: <span>icônes</span>, texte: 'Violent, Will' }} surface={<p>grille d&apos;ajout</p>} />
  );
  ok(!!bouton(libre, 'Set de runes recherché : Violent, Will'), 'résumé fourni : son texte nomme le déclencheur');
  ok(texteVisible(libre).includes('grille d\'ajout') && !/type="checkbox"/.test(libre), 'surface fournie : elle remplace les cases');
  ok(!!boutons(rendre(<SelecteurMultiple libelle="Slot 4" options={options} vide="Libre" disabled />))[0]?.desactive, 'désactivée : disabled posé sur le déclencheur');

  // Forme « surbrillance » : une liste classique, sans case ; la valeur choisie
  // est enfoncée et porte le marqueur d'accent.
  const surb = rendre(<SelecteurMultiple libelle="Slot 2" options={options} valeurs={[4]} onChange={rien} vide="Libre" forme="surbrillance" />);
  ok(!!bouton(surb, 'Slot 2 : ATQ%'), 'surbrillance : le champ fermé résume le choix');
  egal((surb.match(/type="checkbox"/g) ?? []).length, 0, 'surbrillance : aucune case');
  egal(boutons(surb).filter((b) => b.presse !== null).map((b) => [b.texte, b.presse]), [['PV%', false], ['ATQ%', true], ['VIT', false]], 'surbrillance : chaque valeur est un bouton, la choisie enfoncée');
  ok(/aria-pressed="true"[^>]*class="[^"]*border-accent bg-accent-soft|class="[^"]*border-accent bg-accent-soft[^"]*"[^>]*aria-pressed="true"/.test(surb), 'surbrillance : la valeur choisie porte le marqueur d\'accent');
  ok(!!boutons(surb).find((b) => b.texte === 'VIT')?.desactive, 'surbrillance : une option désactivée le reste');
  // Ouverture contrôlée : l'appelant décide.
  ok(/aria-expanded="true"/.test(rendre(<SelecteurMultiple libelle="Slot 2" options={options} vide="Libre" ouvert onOuvertChange={rien} />)), 'ouverture contrôlée : ouverte quand l\'appelant le dit');

  // Résumé entier : toutes les valeurs, à la ligne entre deux valeurs, jamais
  // tronqué ; sans hauteur réservée (la surface, elle, garde sa place à
  // l'ouverture : vérifié au navigateur, optimizer-gabarits-navigateur.test.ts).
  const entier = rendre(<SelecteurMultiple libelle="Slot 2" options={options} valeurs={[2, 4]} onChange={rien} vide="Libre" forme="surbrillance" resumeEntier />);
  const declencheurEntier = entier.match(/<button[^>]*aria-haspopup[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? '';
  ok(!!bouton(entier, 'Slot 2 : PV%, ATQ%'), 'résumé entier : le nom accessible résume les choix');
  ok(!/truncate/.test(declencheurEntier), 'résumé entier : rien de tronqué dans le champ fermé');
  egal([...declencheurEntier.matchAll(/class="whitespace-nowrap">([^<]*)</g)].map((m) => m[1]), ['PV%,', 'ATQ%'],
    'résumé entier : chaque valeur choisie insécable, la ligne ne se coupe qu\'entre deux valeurs');
  ok(/data-resume-entier/.test(declencheurEntier) && !/data-reserve-resume|invisible/.test(declencheurEntier),
    'résumé entier : aucune copie invisible qui réserve la place de toutes les options');
  const entierVide = rendre(<SelecteurMultiple libelle="Slot 2" options={options} valeurs={[]} onChange={rien} vide="Libre" resumeEntier />);
  ok(!!bouton(entierVide, 'Slot 2 : Libre') && /text-ink-dim">Libre</.test(entierVide), 'résumé entier sans choix : « Libre », atténué');
  ok(!/data-resume-entier/.test(surb) && /truncate/.test(surb), 'sans résumé entier : le champ fermé tronque (inchangé)');
}

export function testRenduUiNotification() {
  titre('rendu · Notification « … · Annuler »');
  const rien = () => {};
  const avec = rendre(<BandeauNotification annonce={{ message: 'Deck supprimé', action: rien }} onFermer={rien} />);
  ok(/role="status"/.test(avec), 'annoncée sans voler le focus (role="status")');
  ok(texteVisible(avec).startsWith('Deck supprimé Annuler'), 'le message, puis « Annuler » (libellé par défaut)');
  ok(!!bouton(avec, 'Annuler') && !!bouton(avec, 'Fermer la notification'), '« Annuler » et la croix');
  const sans = rendre(<BandeauNotification annonce={{ message: 'Compte importé' }} onFermer={rien} />);
  ok(!bouton(sans, 'Annuler') && !!bouton(sans, 'Fermer la notification'), 'sans retour possible : pas de « Annuler », la croix reste');
  // Application de bureau : le libellé de l'action est un axe.
  const maj = rendre(<BandeauNotification annonce={{ message: 'Mise à jour prête', action: rien, libelleAction: 'Redémarrer' }} onFermer={rien} />);
  ok(texteVisible(maj).startsWith('Mise à jour prête Redémarrer'), 'libellé donné : « Redémarrer »');
  ok(!!bouton(maj, 'Redémarrer') && !bouton(maj, 'Annuler'), '« Redémarrer » remplace « Annuler », pas les deux');
}

// Les onglets — ajoutés pour le Top 10 des artéfacts.
export function testRenduUiOnglets() {
  titre('rendu · src/ui — Onglets');
  const rien = () => {};
  const html = rendre(
    <Onglets
      aria-label="Attribut des artéfacts"
      valeur="feu"
      onChange={rien}
      options={[
        { cle: 'eau', libelle: 'Eau' },
        { cle: 'feu', libelle: 'Feu' },
        { cle: 'vent', libelle: 'Vent', desactive: true, title: 'Aucun artéfact de ce groupe' },
      ]}
    />
  );
  ok(/role="tablist"[^>]*aria-label="Attribut des artéfacts"|aria-label="Attribut des artéfacts"[^>]*role="tablist"/.test(html), 'une rangée d’onglets nommée (tablist)');
  const lus = onglets(html);
  egal(lus.map((o) => o.texte), ['Eau', 'Feu', 'Vent'], 'chaque option est un onglet, dans l’ordre');
  ok(lus.length === boutons(html).length, 'role="tab" sur chaque bouton');
  egal(lus.filter((o) => o.ouvert).map((o) => o.texte), ['Feu'], 'un seul ouvert (aria-selected)');
  egal(lus.filter((o) => o.focusable).map((o) => o.texte), ['Feu'], 'seul l’onglet ouvert est dans l’ordre de tabulation');
  ok(lus[2].desactive && lus[2].title === 'Aucun artéfact de ce groupe', 'un onglet indisponible : affiché, désactivé, avec sa raison');
  ok(!/border-2|ring-/.test(html), 'contour unique de 1 px : ni bordure double, ni anneau');
  const reserves = (source: string) => [...source.matchAll(/<span\b([^>]*data-reserve-onglet[^>]*)>([\s\S]*?)<\/span>/g)];
  egal(reserves(html).map(([, , texte]) => texteVisible(texte)), ['Eau', 'Feu', 'Vent'],
    'chaque libellé garde sa réserve, y compris les onglets fermés et désactivés');
  ok(reserves(html).every(([, attributs]) => /aria-hidden="true"/.test(attributs)
    && /invisible/.test(attributs) && /font-semibold/.test(attributs)
    && /col-start-1 row-start-1/.test(attributs)),
  'réserve invisible, en gras, superposée et hors du nom accessible');
  const autre = rendre(<Onglets aria-label="Attribut des artéfacts" valeur="eau" onChange={rien}
    options={[{ cle: 'eau', libelle: 'Eau' }, { cle: 'feu', libelle: 'Feu' }, { cle: 'vent', libelle: 'Vent', desactive: true }]} />);
  egal(reserves(autre).map(([, attributs, texte]) => [attributs, texte]),
    reserves(html).map(([, attributs, texte]) => [attributs, texte]), 'les réserves restent identiques quand l’onglet ouvert change');
  const compose = rendre(<Onglets aria-label="Builds" valeur="builds" onChange={rien}
    options={[{ cle: 'builds', libelle: <><span>Builds</span><b>2</b></> }]} />);
  egal(onglets(compose).map(o => o.texte), ['Builds 2'], 'un libellé composé ne se lit qu’une fois, sans sa copie invisible');
}
