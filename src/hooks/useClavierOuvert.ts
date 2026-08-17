import { useEffect, useState } from 'react';

// Le clavier virtuel est-il déployé ?
//
// ⚠️ **Il n'existe aucun événement « clavier ouvert ».** Le seul signal est la
// FENÊTRE VISUELLE (`visualViewport`), que le clavier rétrécit en se déployant.
// On compare donc sa hauteur à celle de la fenêtre de mise en page : un écart
// important ne peut venir que de lui.
//
// ⚠️ **Pourquoi il faut le savoir** : la barre d'onglets est en `position:
// fixed; bottom: 0`. Quand le clavier monte, le navigateur la recolle juste
// au-dessus de lui — elle remonte donc au milieu de l'écran, par-dessus le
// formulaire qu'on est en train de remplir. Ce n'est pas un bug qu'on corrige en
// CSS : c'est le comportement voulu du navigateur pour une barre d'outils. La
// seule sortie est de la RETIRER pendant la saisie, ce qui rend au passage
// quarante pixels de hauteur à un écran qui en manque.

// Seuil : la fenêtre visuelle doit perdre plus de 15 % de sa hauteur.
//
// ⚠️ Ni zéro ni une valeur en pixels. À zéro, la barre d'adresse qui se replie
// au défilement suffisait à déclencher la détection ; en pixels, un même écart
// vaut un clavier sur un téléphone et une barre d'outils sur une tablette. Un
// clavier occupe toujours au moins un quart de l'écran, la marge est donc large.
const SEUIL = 0.85;

export function useClavierOuvert(): boolean {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    // Navigateur sans `visualViewport` (ou rendu côté serveur) : on répond
    // « fermé ». ⚠️ Mieux vaut une barre d'onglets présente en trop qu'une barre
    // absente sur un appareil où l'on ne sait pas mesurer — elle est la
    // navigation principale du format.
    if (!vv) return;

    const mesurer = () => {
      setOuvert(vv.height / window.innerHeight < SEUIL);
    };
    mesurer();

    // ⚠️ `resize` ET `scroll` : sur iOS, déployer le clavier fait aussi défiler
    // la fenêtre visuelle pour amener le champ au-dessus de lui, et cet
    // événement-là arrive parfois seul.
    vv.addEventListener('resize', mesurer);
    vv.addEventListener('scroll', mesurer);
    return () => {
      vv.removeEventListener('resize', mesurer);
      vv.removeEventListener('scroll', mesurer);
    };
  }, []);

  return ouvert;
}
