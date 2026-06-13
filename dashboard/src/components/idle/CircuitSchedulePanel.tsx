"use client";

import type { Round } from "@/types/schedule.type";

function sessionDotColor(kind: string): string {
	const k = kind.toLowerCase();
	if (k === "race") return "bg-red-600";
	if (k.startsWith("sprint")) return "bg-orange-500";
	if (k.includes("qualifying")) return "bg-yellow-500";
	return "bg-blue-500";
}

type Props = { round: Round | null };

export default function CircuitSchedulePanel({ round }: Props) {
	if (!round) {
		return (
			<div className="flex h-full items-center justify-center text-zinc-500">
				No upcoming race weekend
			</div>
		);
	}

	const now = new Date();

	return (
		<div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
			<div>
				<p className="text-xs font-semibold uppercase tracking-widest text-red-500">Circuit &amp; Schedule</p>
				<h2 className="text-3xl font-bold text-white">{round.name}</h2>
				<p className="text-base text-zinc-400">{round.countryName}</p>
			</div>

			<div className="flex flex-col gap-1.5">
				{round.sessions.map((session) => {
					const start = new Date(session.start);
					const isPast = start < now;
					return (
						<div
							key={session.kind + session.start}
							className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${
								isPast ? "bg-zinc-800/40 opacity-40" : "bg-zinc-800"
							}`}
						>
							<div className={`h-3 w-3 shrink-0 rounded-full ${sessionDotColor(session.kind)}`} />

							<span className="flex-1 text-sm font-medium">{session.kind}</span>

							<span className="text-sm text-zinc-400">
								{start.toLocaleDateString("en-GB", {
									weekday: "short",
									month: "short",
									day: "numeric",
								})}
							</span>

							<span className="w-14 text-right font-mono text-sm font-semibold">
								{start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
