export type JolpicaDriverStanding = {
	position: string;
	points: string;
	wins: string;
	Driver: {
		driverId: string;
		code: string;
		givenName: string;
		familyName: string;
		permanentNumber: string;
	};
	Constructors: {
		constructorId: string;
		name: string;
	}[];
};

export type JolpicaConstructorStanding = {
	position: string;
	points: string;
	wins: string;
	Constructor: {
		constructorId: string;
		name: string;
	};
};

export type JolpicaDriverStandingsResponse = {
	MRData: {
		StandingsTable: {
			StandingsLists: {
				season: string;
				round: string;
				DriverStandings: JolpicaDriverStanding[];
			}[];
		};
	};
};

export type JolpicaConstructorStandingsResponse = {
	MRData: {
		StandingsTable: {
			StandingsLists: {
				season: string;
				round: string;
				ConstructorStandings: JolpicaConstructorStanding[];
			}[];
		};
	};
};

export type JolpicaResult = {
	number: string;
	position: string;
	positionText: string;
	points: string;
	Driver: {
		driverId: string;
		permanentNumber: string;
		code: string;
		givenName: string;
		familyName: string;
	};
	Constructor: {
		constructorId: string;
		name: string;
	};
	grid: string;
	laps: string;
	status: string;
	Time?: { millis: string; time: string };
	FastestLap?: {
		rank: string;
		lap: string;
		Time: { time: string };
		AverageSpeed: { units: string; speed: string };
	};
};

export type JolpicaRace = {
	season: string;
	round: string;
	raceName: string;
	Circuit: {
		circuitId: string;
		circuitName: string;
		Location: {
			lat: string;
			long: string;
			locality: string;
			country: string;
		};
	};
	date: string;
	time?: string;
	Results: JolpicaResult[];
};

export type JolpicaLastRaceResponse = {
	MRData: {
		RaceTable: {
			Races: JolpicaRace[];
		};
	};
};
