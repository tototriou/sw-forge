import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

// « Sauvegardé il y a … » — l'heure du DERNIER CHANGEMENT de la prépa, donc de
// son dernier enregistrement automatique (refonte graphique, lot 13, décision
// 29, la maquette). Voir docs/02-app/rta/.
//
// ⚠️ Il DIT la conservation automatique, il ne l'imite pas : ce n'est pas un
// bouton « enregistrer », qui mentirait (la prépa est déjà écrite à chaque
// changement). Et il ne se confond pas avec le POINT de sauvegarde, posé à la
// main par « Sauvegarder ».

// Une durée écoulée, en mots : « à l'instant », « il y a 3 min », « il y a
// 2 h », « il y a 4 j ». Pure, pour être testée.
export function depuis(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

// ⚠️ La prépa ET ses catégories, passées SÉPARÉMENT : ce sont les références
// d'état des hooks, stables tant que rien ne change. Un tableau `[a, b]`
// recréé à chaque rendu relancerait l'effet à chaque rendu — donc en boucle,
// puisque l'effet pose un état.
export default function IndicateurSauvegarde({ prepa, categories }: { prepa: unknown; categories: unknown }) {
  // L'heure du dernier changement VU dans cette session. ⚠️ `null` avant le
  // premier : celle d'une session précédente n'est pas connue, et on ne
  // l'invente pas — d'où « Enregistré sur cet appareil ».
  const [dernier, setDernier] = useState<number | null>(null);
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    setDernier(Date.now());
  }, [prepa, categories]);

  // Rafraîchi chaque minute : « il y a 1 min » ne doit pas rester figé.
  const [, setTic] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTic((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-dim" role="status">
      <Check size={13} className="flex-none text-good" aria-hidden />
      {dernier === null ? 'Enregistré sur cet appareil' : `Sauvegardé ${depuis(Date.now() - dernier)}`}
    </span>
  );
}
