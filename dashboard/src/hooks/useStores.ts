import type { CarsData, Positions, State } from "@/types/state.type";

import { useDataStore } from "@/stores/useDataStore";

type Fns = {
	updateState: (state: State) => void;
	updatePosition: (pos: Positions) => void;
	updateCarData: (car: CarsData) => void;
};

export const useStores = (): Fns => {
	// Select the (stable) setters only — subscribing to the whole store would
	// re-render the layout on every 200ms data tick during live sessions
	const setState = useDataStore((store) => store.setState);
	const setPositions = useDataStore((store) => store.setPositions);
	const setCarsData = useDataStore((store) => store.setCarsData);

	return {
		updateState: setState,
		updatePosition: setPositions,
		updateCarData: setCarsData,
	};
};
