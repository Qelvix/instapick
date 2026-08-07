const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

export type IgMedia = {
  id: string;
  caption?: string;
  media_url?: string;
  permalink: string;
  timestamp: string;
};

export type IgComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  like_count?: number;
  parent_id?: string;
};

export async function fetchRecentMedia(igBusinessAccountId: string, accessToken: string) {
  const url = new URL(`${GRAPH_API_BASE}/${igBusinessAccountId}/media`);
  url.searchParams.set("fields", "id,caption,media_url,permalink,timestamp");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch media: ${await res.text()}`);
  }
  const body = (await res.json()) as { data: IgMedia[] };
  return body.data;
}

export async function fetchAllComments(mediaId: string, accessToken: string) {
  const comments: IgComment[] = [];
  let url: string | null = buildCommentsUrl(mediaId, accessToken);

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch comments: ${await res.text()}`);
    }
    const body = (await res.json()) as {
      data: IgComment[];
      paging?: { next?: string };
    };
    comments.push(...body.data);
    url = body.paging?.next ?? null;
  }

  return comments;
}

function buildCommentsUrl(mediaId: string, accessToken: string) {
  const url = new URL(`${GRAPH_API_BASE}/${mediaId}/comments`);
  url.searchParams.set("fields", "id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}");
  url.searchParams.set("access_token", accessToken);
  return url.toString();
}

/** Flattens top-level comments + their nested replies into one list, tagging replies with their parent id. */
export function flattenComments(raw: (IgComment & { replies?: { data: IgComment[] } })[]) {
  const flat: IgComment[] = [];
  for (const comment of raw) {
    flat.push({ ...comment, parent_id: undefined });
    for (const reply of comment.replies?.data ?? []) {
      flat.push({ ...reply, parent_id: comment.id });
    }
  }
  return flat;
}
