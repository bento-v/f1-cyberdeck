import clsx from "clsx";
import type { ReactNode } from "react";

// Standard carousel-slide shell: one padding scale, one surface, one radius.
// Every idle panel (and the post-race summary) renders inside this so the whole
// carousel reads as a single, consistent system — Apple §16 (familiarity/craft).
type Props = {
	children: ReactNode;
	className?: string;
	/** Panels that manage their own scroll/overflow (e.g. result lists) pass false. */
	padded?: boolean;
};

export default function Panel({ children, className, padded = true }: Props) {
	return (
		<div className={clsx("flex h-full w-full flex-col gap-5", padded && "p-6", className)}>{children}</div>
	);
}
