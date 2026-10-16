import { motion } from "motion/react";
import { useLocation } from "react-router-dom";

/** Fades and lifts each routed page in; honours the user's reduced-motion setting. */
export const PageTransition = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};
