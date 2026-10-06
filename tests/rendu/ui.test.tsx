// Tests de rendu — bibliothèque `src/ui/`. Écrits AVANT le lot 3 de la refonte
// graphique (`spec/chantiers/refonte-graphique.md` § B.3) : le lot change le
// RENDU INTERNE des composants, jamais ce qu'ils exposent. Ces tests fixent
// ce qui est exposé — nom accessible, infobulle, état désactivé, état actif —
// et doivent rester verts sans que leurs assertions changent.

import Bouton from '../../src/ui/Bouton';
import BoutonIcone from '../../src/ui/BoutonIcone';
import Pastille from '../../src/ui/Pastille';
import Interrupteur from '../../src/ui/Interrupteur';
import Case from '../../src/ui/Case';
import Segmented from '../../src/ui/Segmented';
import Option from '../../src/ui/Option';
import Jeton from '../../src/ui/Jeton';
import Selecteur from '../../src/ui/Selecteur';
import Menu from '../../src/ui/Menu';
import { BandeauNotification } from '../../src/ui/Notification';
import Palette from '../../src/components/Palette';
import type { GroupePalette } from '../../src/components/palette/recherchePalette';
import { egal, ok, titre } from '../outils';
import { auTelephone, bouton, boutons, rendre, texteVisible } from './outils-rendu';

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

// Menu d'actions « ⋯ » — ajouté au lot 6 de la refonte (décision 13).
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
}

// Lot 13 (décision 29) : la palette Ctrl K — ajoutée avec elle. La Modale passe
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

// Lot 13 (décision 29) : la notification « … · Annuler » — ajoutée avec elle.
export function testRenduUiNotification() {
  titre('rendu · Notification « … · Annuler »');
  const rien = () => {};
  const avec = rendre(<BandeauNotification annonce={{ message: 'Deck supprimé', action: rien }} onFermer={rien} />);
  ok(/role="status"/.test(avec), 'annoncée sans voler le focus (role="status")');
  ok(texteVisible(avec).startsWith('Deck supprimé Annuler'), 'le message, puis « Annuler » (libellé par défaut)');
  ok(!!bouton(avec, 'Annuler') && !!bouton(avec, 'Fermer la notification'), '« Annuler » et la croix');
  const sans = rendre(<BandeauNotification annonce={{ message: 'Compte importé' }} onFermer={rien} />);
  ok(!bouton(sans, 'Annuler') && !!bouton(sans, 'Fermer la notification'), 'sans retour possible : pas de « Annuler », la croix reste');
  // Application de bureau, lot 5 : le libellé de l'action est un axe.
  const maj = rendre(<BandeauNotification annonce={{ message: 'Mise à jour prête', action: rien, libelleAction: 'Redémarrer' }} onFermer={rien} />);
  ok(texteVisible(maj).startsWith('Mise à jour prête Redémarrer'), 'libellé donné : « Redémarrer »');
  ok(!!bouton(maj, 'Redémarrer') && !bouton(maj, 'Annuler'), '« Redémarrer » remplace « Annuler », pas les deux');
}
