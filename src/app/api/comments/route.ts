import { NextRequest, NextResponse } from "next/server";
import { fetchAllComments, flattenComments } from "@/lib/instagram";
import { getIgAccount, NoIgAccountError } from "@/lib/getIgAccount";
import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const mediaId = request.nextUrl.searchParams.get("mediaId");
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  try {
    const cached = await prisma.cachedComment.findMany({ where: { mediaId } });
    const isFresh = cached.length > 0 && Date.now() - cached[0].fetchedAt.getTime() < CACHE_TTL_MS;

    if (isFresh) {
      return NextResponse.json({ comments: cached, source: "cache" });
    }

    const { accessToken } = await getIgAccount();
    const raw = await fetchAllComments(mediaId, accessToken);
    const flat = flattenComments(raw as never);

    await prisma.$transaction([
      prisma.cachedComment.deleteMany({ where: { mediaId } }),
      prisma.cachedComment.createMany({
        data: flat.map((c) => ({
          mediaId,
          commentId: c.id,
          parentCommentId: c.parent_id ?? null,
          username: c.username,
          text: c.text,
          timestamp: new Date(c.timestamp),
          likeCount: c.like_count ?? 0,
        })),
      }),
    ]);

    const fresh = await prisma.cachedComment.findMany({ where: { mediaId } });
    return NextResponse.json({ comments: fresh, source: "live" });
  } catch (err) {
    if (err instanceof NoIgAccountError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 502 });
  }
}
