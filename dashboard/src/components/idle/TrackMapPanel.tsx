"use client";

import { useEffect, useState } from "react";

import type { Map } from "@/types/map.type";
import { fetchMap } from "@/lib/fetchMap";
import { getCircuitKey } from "@/lib/circuitKeys";
import { rotate } from "@/lib/map";

const SPACE = 1000;
const ROTATION_FIX = 90;

type Props = {
	circuitId: string | null;
	circuitName: string | null;
	countryName: string | null;
};

export default function TrackMapPanel({ circuitId, circuitName, countryName }: Props) {
	const [loading, setLoading] = useState(true);
	const [points, setPoints] = useState<{ x: number; y: number }[] | null>(null);
	const [viewBox, setViewBox] = useState<string | null>(null);

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
		fetchMap(key).then((data) => {
			if (!data) {
				setLoading(false);
				return;
			}

			const cx = (Math.max(...data.x) - Math.min(...data.x)) / 2;
			const cy = (Math.max(...data.y) - Math.min(...data.y)) / 2;
			const rotation = data.rotation + ROTATION_FIX;

			const rotated = data.x.map((x, i) => rotate(x, data.y[i], rotation, cx, cy));
			const xs = rotated.map((p) => p.x);
			const ys = rotated.map((p) => p.y);

			const minX = Math.min(...xs) - SPACE;
			const minY = Math.min(...ys) - SPACE;
			const w = Math.max(...xs) - minX + SPACE * 2;
			const h = Math.max(...ys) - minY + SPACE * 2;

			setPoints(rotated);
			setViewBox(`${minX} ${minY} ${w} ${h}`);
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
					</svg>
				)}
			</div>
		</div>
	);
}
