// Dimensions de cadre partagées entre plusieurs pièces de l'interface.
//
// ⚠️ **Ici et non dans le composant qui les porte.** La hauteur de la barre
// d'onglets est lue par TROIS pièces : la barre elle-même
// ([MobileTabs](src/components/MobileTabs.tsx)), le bouton « Options » qui se
// pose juste au-dessus, et le panneau de navigation
// ([MobileSheet](src/ui/MobileSheet.tsx), variante `surLesOnglets`). La déclarer
// dans `MobileTabs` obligeait `src/ui/` à importer `src/components/` — soit un
// CYCLE, puisque `MobileTabs` importe déjà la librairie (`Bouton`). Or la
// librairie est la couche du dessous : elle ne connaît pas les écrans.
// Elle était écrite en dur (`68px` = 52 + 16 d'écart) dans le bouton
// « Options » ; une copie de plus et elles auraient divergé au premier
// changement de rembourrage.

// Hauteur de la barre d'onglets mobile, **hors encoche du bas**
// (`env(safe-area-inset-bottom)`, ajoutée par-dessus).
// 52 px = 10 (haut) + 17 (icône) + 4 (écart) + 11 (libellé) + 10 (bas).
export const HAUTEUR_ONGLETS = 52;
