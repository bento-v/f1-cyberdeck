import { NextResponse } from "next/server";

export async function GET() {
	const apiUrl = process.env.API_URL;

	if (!apiUrl) {
		return NextResponse.json(null, { status: 503 });
	}

	try {
		const res = await fetch(`${apiUrl}/api/schedule/next`, {
			next: { revalidate: 300 },
		});

		if (!res.ok) {
			return NextResponse.json(null, { status: 200 });
		}

		const data = await res.json();
		return NextResponse.json(data);
	} catch {
		return NextResponse.json(null, { status: 200 });
	}
}
