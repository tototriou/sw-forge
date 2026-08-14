import { createPortal } from 'react-dom';
import { Monster } from '../../types';
import ElementIcon from '../ElementIcon';

// La carte qu'on tient au bout du pointeur pendant un déplacement.
//
// ⚠️ Le drag HTML5 fournissait cette image gratuitement (`setDragImage`). Les
// Pointer Events, non : sans elle, on déplace un monstre sans rien voir bouger,
// et on ne sait plus lequel on tient dès qu'il y a deux sections à l'écran.
//
// Volontairement RÉDUITE au portrait et au nom : c'est ce qui identifie le
// monstre. Reproduire la carte entière (vitesse, sets, sélecteur) donnerait un
// pavé qui masque les zones de dépôt qu'on vise justement.
export default function DragGhost({
  monster,
  x,
  y,
}: {
  monster: Monster;
  x: number;
  y: number;
}) {
  return createPortal(
    <div
      // `fixed` + coordonnées viewport : le fantôme suit le pointeur quel que
      // soit le défilement, et `pointer-events-none` l'empêche de s'intercepter
      // lui-même dans la détection de zone.
      className="pointer-events-none fixed z-[100] flex items-center gap-2 rounded-lg border border-accent
                 bg-panel2 px-2 py-1.5 shadow-glow shadow-black/60"
      style={{
        left: x,
        top: y,
        // Décalé sous le doigt plutôt que centré dessus : au tactile, le doigt
        // masque entièrement ce qu'il tient.
        transform: 'translate(12px, 12px)',
      }}
    >
      <div className="relative flex-none">
        <div className="hex-frame h-8 w-8 bg-panel">
          {monster.image && (
            <img src={monster.image} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <ElementIcon
          element={monster.element}
          size={12}
          className="absolute -right-1 -top-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        />
      </div>
      <span className="text-[12px] font-semibold text-ink">{monster.name}</span>
    </div>,
    document.body
  );
}
