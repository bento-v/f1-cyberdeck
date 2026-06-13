"use client";

import clsx from "clsx";

import { useReducer, useRef, useEffect } from "react";

import { useSettingsStore } from "@/stores/useSettingsStore";

type Props = {
	className?: string;
	saveDelay?: number;
};

export default function DelayInput({ className, saveDelay }: Props) {
	const currentDelay = useSettingsStore((s) => s.delay);
	const setDelay = useSettingsStore((s) => s.setDelay);
	const isPaused = useSettingsStore((s) => s.delayIsPaused);

	type DelayAction =
		| { type: "input"; value: string }
		| { type: "sync"; value: string };
	const [delayState, dispatchDelay] = useReducer(
		(_: string, action: DelayAction) => action.value,
		currentDelay.toString(),
	);

	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const updateDelay = (updateInput: boolean = false) => {
		const delay = delayState ? Math.max(parseInt(delayState), 0) : 0;
		setDelay(delay);
		if (updateInput) dispatchDelay({ type: "sync", value: delay.toString() });
	};

	useEffect(() => {
		if (isPaused) return;
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(updateDelay, saveDelay || 0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [delayState]);

	// On unpause: sync display to current store value in case it changed while paused
	useEffect(() => {
		if (!isPaused) dispatchDelay({ type: "sync", value: currentDelay.toString() });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isPaused]);

	// While paused: keep display in sync if the delay changes externally
	useEffect(() => {
		if (isPaused) dispatchDelay({ type: "sync", value: currentDelay.toString() });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentDelay]);

	const handleChange = (v: string) => {
		dispatchDelay({ type: "input", value: v });
	};

	return (
		<input
			className={clsx(
				"w-12 [appearance:textfield] rounded-lg bg-zinc-800 p-1 text-center text-sm disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
				className,
			)}
			type="number"
			inputMode="numeric"
			min={0}
			placeholder="0s"
			value={delayState}
			onChange={(e) => handleChange(e.target.value)}
			onKeyDown={(e) => e.code == "Enter" && updateDelay(true)}
			onBlur={() => updateDelay(true)}
			disabled={isPaused}
		/>
	);
}
