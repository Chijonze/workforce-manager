"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export function MotionSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}
