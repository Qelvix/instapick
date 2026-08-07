import { NextResponse } from "next/server";
import { fetchRecentMedia } from "@/lib/instagram";
import { getIgAccount, NoIgAccountError } from "@/lib/getIgAccount";

export async function GET() {
  try {
    const { igBusinessAccountId, accessToken } = await getIgAccount();
    const media = await fetchRecentMedia(igBusinessAccountId, accessToken);
    return NextResponse.json({ media });
  } catch (err) {
    if (err instanceof NoIgAccountError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  }
}
