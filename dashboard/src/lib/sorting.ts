import { utc } from "moment";

type PosObject = { Position: string };
export const sortPos = (a: PosObject, b: PosObject) => {
	return parseInt(a.Position) - parseInt(b.Position);
};

type UtcObject = { Utc: string };
export const sortUtc = (a: UtcObject, b: UtcObject) => {
	return utc(b.Utc).diff(utc(a.Utc));
};
