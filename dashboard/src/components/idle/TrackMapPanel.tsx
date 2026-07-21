"use client";

import { useEffect, useState } from "react";

import type { Map } from "@/types/map.type";
import { fetchMap } from "@/lib/fetchMap";
import { getCircuitKey } from "@/lib/circuitKeys";
import { rad, rotate } from "@/lib/map";

const SPACE = 1000;
const ROTATION_FIX = 90;

type Props = {
	circuitId: string | null;
	circuitName: string | null;
	countryName: string | null;
};

type CornerMark = {
	number: number;
	color: string;
	labelX: number;
	labelY: number;
	lineX1: number;
	lineY1: number;
	lineX2: number;
	lineY2: number;
};

export default function TrackMapPanel({ circuitId, circuitName, countryName }: Props) {
	const [loading, setLoading] = useState(true);
	const [points, setPoints] = useState<{ x: number; y: number }[] | null>(null);
	const [viewBox, setViewBox] = useState<string | null>(null);
	const [corners, setCorners] = useState<CornerMark[]>([]);

	useEffect(() => {
		if (!circuitId) {
			setLoading(false);
			return;
		}
		const key = getCircuitKey(circuitId);
		if (!key) {
			setLoading(false);
			return;
		}

		setLoading(true);
		setCorners([]);
		fetchMap(key).then((data) => {
			if (!data) {
				setLoading(false);
				return;
			}

			const cx = (Math.max(...data.x) - Math.min(...data.x)) / 2;
			const cy = (Math.max(...data.y) - Math.min(...data.y)) / 2;
			const rotation = data.rotation + ROTATION_FIX;

			const rotated = data.x.map((x, i) => rotate(x, data.y[i], rotation, cx, cy));

			// MultiViewer marks some long corners with several points sharing one
			// number (Hungaroring T1/T12) — keep only the first marker per corner
			// (data is in lap order) so each number appears once, like official maps.
			const seen = new Set<number>();
			const uniqueCorners = data.corners.filter((c) => {
				if (seen.has(c.number)) return false;
				seen.add(c.number);
				return true;
			});

			// Place each numbered label out from its corner, then draw a coloured
			// line from the number back to the corner apex on the track.
			const LABEL_OFFSET = 720;
			const TIP_GAP = 150; // stop the line at the track edge
			const NUM_GAP = 200; // start the line just outside the number glyph

			const cornerMarks: CornerMark[] = uniqueCorners.map((c, i) => {
				const cornerPt = rotate(c.trackPosition.x, c.trackPosition.y, rotation, cx, cy);
				const labelPt = rotate(
					c.trackPosition.x + LABEL_OFFSET * Math.cos(rad(c.angle)),
					c.trackPosition.y + LABEL_OFFSET * Math.sin(rad(c.angle)),
					rotation, cx, cy,
				);

				const dx = cornerPt.x - labelPt.x;
				const dy = cornerPt.y - labelPt.y;
				const len = Math.hypot(dx, dy) || 1;
				const ux = dx / len;
				const uy = dy / len;

				return {
					number: c.number,
					color: `hsl(${Math.round((i * 360) / uniqueCorners.length)}, 75%, 62%)`,
					labelX: labelPt.x,
					labelY: labelPt.y,
					lineX1: labelPt.x + ux * NUM_GAP,
					lineY1: labelPt.y + uy * NUM_GAP,
					lineX2: cornerPt.x - ux * TIP_GAP,
					lineY2: cornerPt.y - uy * TIP_GAP,
				};
			});

			// Bounds include the label positions so arrows/numbers never clip
			const xs = [...rotated.map((p) => p.x), ...cornerMarks.map((c) => c.labelX)];
			const ys = [...rotated.map((p) => p.y), ...cornerMarks.map((c) => c.labelY)];

			const minX = Math.min(...xs) - SPACE;
			const minY = Math.min(...ys) - SPACE;
			const w = Math.max(...xs) - minX + SPACE * 2;
			const h = Math.max(...ys) - minY + SPACE * 2;

			// Zoom in ~10% by shrinking the viewBox toward its centre
			const ZOOM = 0.9;
			const zw = w * ZOOM;
			const zh = h * ZOOM;
			const zx = minX + (w - zw) / 2;
			const zy = minY + (h - zh) / 2;

			setPoints(rotated);
			setViewBox(`${zx} ${zy} ${zw} ${zh}`);
			setCorners(cornerMarks);
			setLoading(false);
		});
	}, [circuitId]);

	const name = circuitName ?? "Track Map";
	const country = countryName ?? "";

	const pathD = points
		? `M${points[0].x},${points[0].y} ${points.map((p) => `L${p.x},${p.y}`).join(" ")}`
		: null;

	return (
		<div className="flex h-full flex-col gap-3 p-6">
			<div>
				<p className="text-xs font-semibold uppercase tracking-widest text-red-500">Track Map</p>
				<h2 className="text-3xl font-bold text-white">{name}</h2>
				{country && <p className="text-base text-zinc-400">{country}</p>}
			</div>

			<div className="min-h-0 flex-1">
				{loading && <div className="h-full w-full animate-pulse rounded-lg bg-zinc-800" />}

				{!loading && !pathD && (
					<div className="flex h-full items-center justify-center text-zinc-500">
						Track map unavailable
					</div>
				)}

				{!loading && pathD && viewBox && (
					<svg viewBox={viewBox} className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
						{/* Wide grey base */}
						<path
							stroke="#3f3f46"
							strokeWidth={300}
							strokeLinejoin="round"
							fill="transparent"
							d={pathD}
						/>
						{/* Red centre line */}
						<path
							stroke="#dc2626"
							strokeWidth={80}
							strokeLinejoin="round"
							strokeLinecap="round"
							fill="transparent"
							d={pathD}
						/>
						{/* Corner numbers with coloured lines pointing to each corner */}
						{corners.map((c) => (
							<g key={c.number}>
								<line
									x1={c.lineX1}
									y1={c.lineY1}
									x2={c.lineX2}
									y2={c.lineY2}
									stroke={c.color}
									strokeWidth={45}
									strokeLinecap="round"
								/>
								<text
									x={c.labelX}
									y={c.labelY}
									fill={c.color}
									fontSize={250}
									fontWeight="700"
									textAnchor="middle"
									dominantBaseline="middle"
								>
									{c.number}
								</text>
							</g>
						))}
					</svg>
				)}
			</div>
		</div>
	);
}
