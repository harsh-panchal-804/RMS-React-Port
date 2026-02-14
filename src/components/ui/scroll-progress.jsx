import { motion, useScroll, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

export function ScrollProgress({ className }) {
  const { scrollYProgress } = useScroll();

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className={cn(
        "fixed top-0 left-0 right-0 z-[60] h-1 origin-left bg-gradient-to-r from-cyan-500 via-violet-500 via-pink-500 to-orange-500",
        className
      )}
      style={{ scaleX }}
    />
  );
}
