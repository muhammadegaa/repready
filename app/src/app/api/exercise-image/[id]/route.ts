import { exerciseById, imageUrlFor } from "@/lib/library";

// Serves a library exercise picture from our own address, so a player's phone never contacts GitHub and the picture is cached at the edge.
// Only ids that exist in the bundled library resolve, so this cannot be used to fetch arbitrary URLs.
export async function GET(_req: Request, ctx: RouteContext<"/api/exercise-image/[id]">) {
  const { id } = await ctx.params;
  const ex = exerciseById(decodeURIComponent(id));
  // football entries share the picture of their exact general twin, so look it up by the file that entry carries
  const file = ex?.image_file;
  if (!ex || !file) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });

  // The id in the URL may be the general entry's id (what `image` points at) or any entry carrying that file.
  let upstream: Response;
  try {
    upstream = await fetch(imageUrlFor(file), { cache: "force-cache" });
  } catch {
    return new Response("Picture unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  if (!upstream.ok || !(upstream.headers.get("content-type") ?? "").startsWith("image/")) {
    return new Response("Picture unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type")!,
      // The source is pinned to one commit, so the bytes for an id never change.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
