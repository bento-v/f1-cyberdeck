import type { ReactNode } from "react";

// The one header treatment for every slide and the post-race summary: a red
// brand eyebrow, an optically-tracked title, and an optional subtitle. Replaces
// the three ad-hoc header variants that existed across the panels.
type Props = {
	eyebrow: string;
	title: string;
	subtitle?: ReactNode;
	/** Right-aligned content (e.g. a season badge) shown on the title row. */
	aside?: ReactNode;
};

export default function PanelHeader({ eyebrow, title, subtitle, aside }: Props) {
	return (
		<div className="flex items-end justify-between gap-4">
			<div className="min-w-0">
				<p className="t-eyebrow">{eyebrow}</p>
				<h2 className="t-title mt-1.5 truncate text-3xl text-t1">{title}</h2>
				{subtitle && <p className="mt-1 truncate text-base text-t2">{subtitle}</p>}
			</div>
			{aside && <div className="shrink-0 text-right">{aside}</div>}
		</div>
	);
}
