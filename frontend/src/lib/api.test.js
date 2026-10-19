import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, transformReport } from "./api.js";

const pdf = new File(["%PDF-1.7"], "report.pdf", { type: "application/pdf" });

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("transformReport", () => {
  it("posts the file to the local API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { rows: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(transformReport(pdf)).resolves.toEqual({ rows: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/transform");
    expect(init.method).toBe("POST");
    expect(init.body.get("file").name).toBe("report.pdf");
  });

  it("surfaces the server's error detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(422, { detail: "No rows." })));
    await expect(transformReport(pdf)).rejects.toMatchObject({ status: 422, message: "No rows." });
  });

  it("explains how to start the server when it cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await transformReport(pdf).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain("make run");
  });

  it("treats a non-JSON 5xx response as the server being down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));
    await expect(transformReport(pdf)).rejects.toThrow("make run");
  });
});
