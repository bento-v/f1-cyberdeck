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
