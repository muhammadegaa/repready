import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./[id]/route";
import { imageForName, IMAGE_SOURCE_SHA, matchExercise } from "@/lib/library";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as Parameters<typeof GET>[1];
const call = (id: string) => GET(new Request(`http://x/api/exercise-image/${id}`), ctx(id));

afterEach(() => vi.unstubAllGlobals());

describe("exercise picture route", () => {
  it("rejects ids that are not in the library, without fetching anything", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    for (const id of ["../../etc/passwd", "http://evil.test/x.jpg", "nope", ""]) expect((await call(id)).status).toBe(404);
    expect(f).not.toHaveBeenCalled();
  });

  it("serves a known picture from the pinned commit with a long cache", async () => {
    const f = vi.fn(async () => new Response("jpegbytes", { headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", f);
    const res = await call("Barbell_Full_Squat");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain(`/${IMAGE_SOURCE_SHA}/exercises/Barbell_Full_Squat/0.jpg`);
  });

  it("does not cache a failed or non-image upstream answer", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>rate limited</html>", { status: 200, headers: { "content-type": "text/html" } }));
    const a = await call("Barbell_Full_Squat");
    expect(a.status).toBe(502);
    expect(a.headers.get("cache-control")).toBe("no-store");
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    expect((await call("Barbell_Full_Squat")).status).toBe(502);
  });
});

describe("which exercises get a picture", () => {
  it("shows one for an exact library name and for the football entry whose alias is that name", () => {
    expect(imageForName("Romanian Deadlift")).toMatch(/^\/api\/exercise-image\//);
    expect(imageForName("Back squat")).toBe("/api/exercise-image/Barbell_Full_Squat"); // alias "barbell full squat" is an exact twin
  });
  it("shows none where the library has no picture, and none for unknown or near-miss names", () => {
    const nordic = matchExercise("Nordic hamstring curl");
    expect(nordic.status === "matched" && nordic.exercise.image).toBeNull();
    expect(imageForName("Nordic hamstring curl")).toBeNull();
    expect(imageForName("Zzz mystery lift")).toBeNull();
  });
});
