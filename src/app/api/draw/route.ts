import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { applyFilters, pickWinners, type PickerFilters } from "@/lib/picker";
import { getIgAccount, NoIgAccountError } from "@/lib/getIgAccount";

type DrawRequestBody = {
  mediaId: string;
  mediaUrl: string;
  filters: PickerFilters;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getIgAccount();
    const body = (await request.json()) as DrawRequestBody;

    if (!body.mediaId) {
      return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
    }

    const comments = await prisma.cachedComment.findMany({ where: { mediaId: body.mediaId } });
    if (comments.length === 0) {
      return NextResponse.json(
        { error: "No cached comments for this media. Fetch comments first." },
        { status: 400 }
      );
    }

    const pool = applyFilters(comments, body.filters);
    if (pool.length === 0) {
      return NextResponse.json({ error: "No comments match the given filters" }, { status: 400 });
    }

    const seed = randomUUID();
    const winnerCount = body.filters.winnerCount ?? 1;
    const winners = pickWinners(pool, winnerCount, seed);

    const draw = await prisma.draw.create({
      data: {
        userId,
        mediaId: body.mediaId,
        mediaUrl: body.mediaUrl,
        filters: body.filters as never,
        winnerCommentIds: winners.map((w) => w.commentId),
        seed,
      },
    });

    return NextResponse.json({ draw, winners, poolSize: pool.length });
  } catch (err) {
    if (err instanceof NoIgAccountError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to draw winner" }, { status: 500 });
  }
}
