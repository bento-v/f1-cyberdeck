import clsx from "clsx";

import type { TimingDataDriver } from "@/types/state.type";

type Props = {
	last: TimingDataDriver["LastLapTime"];
	best: TimingDataDriver["BestLapTime"];
	hasFastest: boolean;
};

export default function DriverLapTime({ last, best, hasFastest }: Props) {
	return (
		<div className="place-self-start">
			<p
				className={clsx("text-lg leading-none font-medium tabular-nums", {
					"text-fastest!": last.OverallFastest,
					"text-positive!": last.PersonalFastest,
					"text-t3!": !last.Value,
				})}
			>
				{!!last.Value ? last.Value : "-- -- ---"}
			</p>
			<p
				className={clsx("text-sm leading-none text-t3 tabular-nums", {
					"text-fastest!": hasFastest,
					"text-t3!": !best.Value,
				})}
			>
				{!!best.Value ? best.Value : "-- -- ---"}
			</p>
		</div>
	);
}
