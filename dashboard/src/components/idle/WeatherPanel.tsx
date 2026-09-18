"use client";

import { useEffect, useState } from "react";

import Panel from "@/components/idle/Panel";
import PanelHeader from "@/components/idle/PanelHeader";

const WEATHER_CACHE_TTL = 15 * 60_000; // 15 minutes

type WeatherCache = { data: WeatherData; ts: number };
const weatherCache = new Map<string, WeatherCache>();

type WeatherData = {
	temperature_2m: number;
	apparent_temperature: number;
	relative_humidity_2m: number;
	precipitation: number;
	weather_code: number;
	wind_speed_10m: number;
	wind_direction_10m: number;
};

async function fetchWeather(lat: string, lon: string): Promise<WeatherData | null> {
	const key = `${lat},${lon}`;
	const hit = weatherCache.get(key);
	if (hit && Date.now() - hit.ts < WEATHER_CACHE_TTL) return hit.data;

	try {
		const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${res.status}`);
		const json = await res.json();
		const data: WeatherData = json.current;
		weatherCache.set(key, { data, ts: Date.now() });
		return data;
	} catch {
		return hit?.data ?? null;
	}
}

function wmoDescription(code: number): string {
	if (code === 0) return "Clear sky";
	if (code === 1) return "Mainly clear";
	if (code === 2) return "Partly cloudy";
	if (code === 3) return "Overcast";
	if (code === 45 || code === 48) return "Fog";
	if (code >= 51 && code <= 55) return "Drizzle";
	if (code >= 56 && code <= 57) return "Freezing drizzle";
	if (code >= 61 && code <= 65) return "Rain";
	if (code >= 66 && code <= 67) return "Freezing rain";
	if (code >= 71 && code <= 75) return "Snow";
	if (code === 77) return "Snow grains";
	if (code >= 80 && code <= 82) return "Rain showers";
	if (code >= 85 && code <= 86) return "Snow showers";
	if (code === 95) return "Thunderstorm";
	if (code >= 96 && code <= 99) return "Thunderstorm w/ hail";
	return "Unknown";
}

function windDirection(deg: number): string {
	const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
	return dirs[Math.round(deg / 45) % 8];
}

type Props = {
	lat: string | null;
	lon: string | null;
	circuitName: string | null;
	locality: string | null;
};

type StatCardProps = {
	label: string;
	value: string;
};

function StatCard({ label, value }: StatCardProps) {
	return (
		<div className="flex flex-col items-center justify-center rounded-lg bg-s2 px-4 py-3">
			<span className="t-eyebrow text-t3">{label}</span>
			<span className="nums mt-1.5 text-lg font-bold text-t1">{value}</span>
		</div>
	);
}

export default function WeatherPanel({ lat, lon, circuitName, locality }: Props) {
	const [weather, setWeather] = useState<WeatherData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!lat || !lon) {
			setLoading(false);
			return;
		}
		setLoading(true);
		fetchWeather(lat, lon).then((data) => {
			setWeather(data);
			setLoading(false);
		});
	}, [lat, lon]);

	return (
		<Panel>
			<PanelHeader eyebrow="Track Weather" title={circuitName ?? "Circuit"} subtitle={locality ?? undefined} />

			{loading && (
				<div className="flex flex-1 items-center justify-center">
					<div className="h-12 w-48 animate-pulse rounded-lg bg-s2" />
				</div>
			)}

			{!loading && !weather && (
				<div className="flex flex-1 items-center justify-center text-t3">Weather data unavailable</div>
			)}

			{!loading && weather && (
				<div className="flex flex-1 flex-col gap-4">
					{/* Main temperature */}
					<div className="flex items-end gap-4">
						<span className="t-display nums text-7xl text-t1">{Math.round(weather.temperature_2m)}°C</span>
						<span className="mb-2 text-xl text-t2">{wmoDescription(weather.weather_code)}</span>
					</div>

					{/* Stat grid */}
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<StatCard label="Feels like" value={`${Math.round(weather.apparent_temperature)}°C`} />
						<StatCard label="Humidity" value={`${weather.relative_humidity_2m}%`} />
						<StatCard
							label="Wind"
							value={`${Math.round(weather.wind_speed_10m)} km/h ${windDirection(weather.wind_direction_10m)}`}
						/>
						<StatCard label="Precipitation" value={`${weather.precipitation.toFixed(1)} mm`} />
					</div>
				</div>
			)}
		</Panel>
	);
}
