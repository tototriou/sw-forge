// Tests de rendu — la page « Télécharger » (`#/telecharger`), application de
// bureau, lot 6, décision 14. Principe dans tests/rendu/outils-rendu.tsx :
// ce que la page dit et permet, jamais l'apparence.

import TelechargerPage from '../../src/pages/TelechargerPage';
import { RELEASES, libelleVersion } from '../../src/data/releases';
import { DEPOT, TELECHARGEMENTS } from '../../src/lib/bureau';
import { ok, titre } from '../outils';
import { rendre, texteVisible } from './outils-rendu';

export function testRenduTelecharger() {
  titre('rendu · Télécharger — ce que la page dit et permet');
  const html = rendre(<TelechargerPage />);
  const t = texteVisible(html);
  const ancres = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, contenu]) => ({
    href: attrs.match(/\shref="([^"]*)"/)?.[1] ?? '',
    texte: texteVisible(contenu),
    contenu,
    nouvelOnglet: /\starget="_blank"/.test(attrs),
  }));

  ok(t.startsWith('Télécharger'), 'titre « Télécharger »');
  ok(t.includes('SW Blacksmith existe en application de bureau pour Windows et Linux : la même boîte à outils, dans sa propre fenêtre.'), 'la phrase d\'introduction');
  for (const s of ['Sa propre fenêtre', 'La mise à jour proposée', '100 % local'])
    ok(t.includes(s), `ce que l'app apporte : « ${s} »`);
  ok(t.includes("C'est toi qui décides quand."), 'la mise à jour : c\'est lui qui décide (décision 11)');

  // Les deux téléchargements : le FICHIER, chacun avec le logo de son système.
  for (const [libelle, href, logo] of [
    ['Télécharger pour Windows', TELECHARGEMENTS.windows, 'windows'],
    ['Télécharger pour Linux', TELECHARGEMENTS.linux, 'linux'],
  ]) {
    const a = ancres.find((x) => x.texte === libelle);
    ok(a?.href === href, `« ${libelle} » → ${href}`);
    ok(!!a && a.contenu.includes(`data-logo="${logo}"`), `« ${libelle} » : le logo ${logo}`);
  }
  ok(t.includes('Windows peut afficher « Windows a protégé votre ordinateur » : clique sur « Informations complémentaires », puis sur « Exécuter quand même ».'), 'la phrase SmartScreen, avec les libellés de Windows');
  ok(t.includes('À installer depuis un ordinateur Windows ou Linux.'), 'au téléphone : la ligne à la place des boutons');

  const derniere = RELEASES.find((r) => r.version !== null) ?? RELEASES[0];
  ok(t.includes(`Version proposée : ${libelleVersion(derniere.version)}`), `la version proposée : ${libelleVersion(derniere.version)}`);
  const github = ancres.find((a) => a.texte === 'Toutes les versions sur GitHub');
  ok(github?.href === `${DEPOT}/releases` && github.nouvelOnglet, '« Toutes les versions sur GitHub », nouvel onglet');
}
