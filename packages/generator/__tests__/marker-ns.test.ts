import { describe, it, expect } from "vitest";
import { getMarkerNs } from "@/core/marker-ns";

describe("getMarkerNs", () => {
  it("从本包单 bin injectInfo 取 dc-generator", () => {
    expect(getMarkerNs()).toBe("dc-generator");
  });
});
