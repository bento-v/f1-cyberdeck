"use client";

import { now, utc } from "moment";
import clsx from "clsx";

import type { Round as RoundType } from "@/types/schedule.type";

import { groupSessionByDay } from "@/lib/groupSessionByDay";
import { formatDayRange, formatMonth } from "@/lib/dateFormatter";
import Flag from "@/components/Flag";

type Props = {
	round: RoundType;
	nextName?: string;
};

const countryCodeMap: Record<string, string> = {
	Australia: "aus",
	Austria: "aut",
	Azerbaijan: "aze",
	Bahrain: "brn",
	Belgium: "bel",
	Brazil: "bra",
	Canada: "can",
	China: "chn",
	Spain: "esp",
	France: "fra",
	"Great Britain": "gbr",
	"United Kingdom": "gbr",
	Germany: "ger",
	Hungary: "hun",
	Italy: "ita",
	Japan: "jpn",
	"Saudi Arabia": "ksa",
	Mexico: "mex",
	Monaco: "mon",
	Netherlands: "ned",
	Portugal: "por",
	Qatar: "qat",
	Singapore: "sgp",
	"United Arab Emirates": "uae",
	"United States": "usa",
};

export default function Round({ round, nextName }: Props) {
	const countryCode = countryCodeMap[round.countryName];

	return (
		<div className={clsx(round.over && "opacity-50")}>
			<div className="flex items-center justify-between border-b border-hairline pb-2">
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-2">
						<Flag countryCode={countryCode} className="h-8 w-11"></Flag>
						<p className="text-2xl font-semibold text-t1">{round.countryName}</p>
					</div>
					{round.name === nextName && (
						<span className="t-eyebrow">
							{utc().isBetween(utc(round.start), utc(round.end)) ? "Current" : "Up Next"}
						</span>
					)}
					{round.over && <span className="t-eyebrow text-negative">Over</span>}
				</div>

				<div className="nums flex items-baseline gap-1">
					<p className="text-xl text-t1">{formatMonth(round.start, round.end)}</p>
					<p className="text-t3">{formatDayRange(round.start, round.end)}</p>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-8 pt-2">
				{groupSessionByDay(round.sessions).map((day, i) => (
					<div className="flex flex-col" key={`round.day.${i}`}>
						<p className="my-3 text-lg font-semibold text-t1">{utc(day.date).local().format("dddd")}</p>

						<div className="grid grid-rows-2 gap-2">
							{day.sessions.map((session, j) => (
								<div
									key={`round.day.${i}.session.${j}`}
									className={clsx("flex flex-col", !round.over && utc(session.end).isBefore(now()) && "opacity-50")}
								>
									<p className="w-28 overflow-hidden text-ellipsis whitespace-nowrap text-t2 sm:w-auto">
										{session.kind}
									</p>

									<p className="nums text-sm leading-none text-t3">
										{utc(session.start).local().format("HH:mm")} - {utc(session.end).local().format("HH:mm")}
									</p>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
