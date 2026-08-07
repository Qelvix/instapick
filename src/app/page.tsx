"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

type Media = { id: string; caption?: string; media_url?: string; permalink: string };
type Comment = { commentId: string; username: string; text: string; timestamp: string; parentCommentId: string | null };
type Winner = { commentId: string; username: string; text: string; timestamp: string };

export default function Home() {
  const { data: session, status } = useSession();

  const [media, setMedia] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winners, setWinners] = useState<Winner[] | null>(null);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [includeReplies, setIncludeReplies] = useState(false);
  const [dedupeByUsername, setDedupeByUsername] = useState(true);
  const [requireKeyword, setRequireKeyword] = useState("");
  const [winnerCount, setWinnerCount] = useState(1);

  async function loadMedia() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/media");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setMedia(body.media);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }

  async function loadComments(m: Media) {
    setSelectedMedia(m);
    setWinners(null);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comments?mediaId=${m.id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setComments(body.comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }

  async function draw() {
    if (!selectedMedia) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: selectedMedia.id,
          mediaUrl: selectedMedia.permalink,
          filters: {
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            includeReplies,
            dedupeByUsername,
            requireKeyword: requireKeyword || undefined,
            winnerCount,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setWinners(body.winners);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to draw winner");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return <main className="flex-1 flex items-center justify-center">Loading…</main>;
  }

  if (!session) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold">Instapick</h1>
        <p className="text-zinc-600 max-w-md text-center">
          Pick a random winner from your Instagram post comments. Connect your Facebook Page
          (with a linked Instagram Business account) to get started.
        </p>
        <button
          onClick={() => signIn("facebook")}
          className="rounded-full bg-blue-600 text-white px-6 py-3 font-medium hover:bg-blue-700"
        >
          Connect with Facebook
        </button>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Instapick</h1>
        <button onClick={() => signOut()} className="text-sm text-zinc-500 hover:underline">
          Sign out
        </button>
      </div>

      {error && <div className="rounded bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      {!selectedMedia && (
        <div className="flex flex-col gap-3">
          <button
            onClick={loadMedia}
            disabled={loading}
            className="self-start rounded bg-zinc-900 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load recent posts"}
          </button>
          <div className="grid grid-cols-3 gap-3">
            {media.map((m) => (
              <button
                key={m.id}
                onClick={() => loadComments(m)}
                className="border rounded p-2 text-left text-xs hover:border-blue-500"
              >
                <p className="line-clamp-3">{m.caption ?? "(no caption)"}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedMedia && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              setSelectedMedia(null);
              setComments([]);
              setWinners(null);
            }}
            className="self-start text-sm text-blue-600 hover:underline"
          >
            ← Back to posts
          </button>

          <p className="text-sm text-zinc-600">{comments.length} comments loaded</p>

          <div className="grid grid-cols-2 gap-4 border rounded p-4">
            <label className="flex flex-col gap-1 text-sm">
              Start time
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              End time
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeReplies}
                onChange={(e) => setIncludeReplies(e.target.checked)}
              />
              Include replies
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dedupeByUsername}
                onChange={(e) => setDedupeByUsername(e.target.checked)}
              />
              One entry per user
            </label>
            <label className="flex flex-col gap-1 text-sm col-span-2">
              Require keyword (optional)
              <input
                type="text"
                value={requireKeyword}
                onChange={(e) => setRequireKeyword(e.target.value)}
                placeholder="e.g. #giveaway"
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Number of winners
              <input
                type="number"
                min={1}
                value={winnerCount}
                onChange={(e) => setWinnerCount(Number(e.target.value))}
                className="border rounded px-2 py-1"
              />
            </label>
          </div>

          <button
            onClick={draw}
            disabled={loading || comments.length === 0}
            className="self-start rounded bg-blue-600 text-white px-6 py-3 font-medium disabled:opacity-50"
          >
            {loading ? "Drawing…" : "Draw winner"}
          </button>

          {winners && (
            <div className="flex flex-col gap-2">
              {winners.map((w) => (
                <div key={w.commentId} className="border rounded p-4 bg-green-50">
                  <p className="font-semibold">@{w.username}</p>
                  <p className="text-sm text-zinc-700">{w.text}</p>
                  <p className="text-xs text-zinc-400">{new Date(w.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
