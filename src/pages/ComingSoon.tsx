import { motion } from 'framer-motion';
import { Hammer } from 'lucide-react';

interface Props {
  title: string;
  icon: typeof Hammer;
  description?: string;
}

// Page placeholder pour les outils à venir (Siège, Arène…).
export default function ComingSoon({ title, icon: Icon, description }: Props) {
  return (
    <div className="mt-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-10 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-panel/40 py-20 px-6"
      >
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-panel2 border border-border mb-5">
          <Icon size={28} className="text-ink-dim" />
        </div>
        <h2 className="font-display text-[22px] tracking-wide mb-2">Bientôt disponible</h2>
        <p className="text-ink-dim text-[14px] max-w-md leading-relaxed">Cet outil est en cours de construction.</p>
      </motion.div>
    </div>
  );
}
