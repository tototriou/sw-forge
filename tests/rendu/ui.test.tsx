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
import { egal, ok, titre } from '../outils';
import { bouton, boutons, rendre, texteVisible } from './outils-rendu';

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
