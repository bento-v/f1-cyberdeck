"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// A calm, GPU-only enter transition (transform + opacity). Uses a critically
// damped spring (Apple §4: bounce 0, no overshoot for non-gesture UI) and
// collapses to a short opacity fade when the viewer prefers reduced motion
// (Apple §14). Used for full-screen mounts (countdown, post-race summary).
type Props = {
	children: ReactNode;
	className?: string;
};

export default function Reveal({ children, className }: Props) {
	const reduce = useReducedMotion();

	return (
		<motion.div
			className={className}
			initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.995 }}
			animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
			transition={reduce ? { duration: 0.2 } : { type: "spring", bounce: 0, duration: 0.35 }}
		>
			{children}
		</motion.div>
	);
}
