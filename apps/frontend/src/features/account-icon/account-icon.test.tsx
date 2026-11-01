import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountIcon } from "./account-icon";
import { readAccountIcon } from "./account-icon-meta";

const png = "data:image/png;base64,iVBORw0KGgo=";

describe("account icon", () => {
  it("reads a PNG data URL from the account meta", () => {
    expect(
      readAccountIcon(JSON.stringify({ accounting: { costBasisMethod: "WAC" }, icon: png })),
    ).toBe(png);
  });

  it("ignores missing, malformed, non-PNG and oversized icons", () => {
    for (const meta of [
      undefined,
      "",
      "not json",
      "[]",
      JSON.stringify({}),
      JSON.stringify({ icon: "https://example.com/logo.png" }),
      JSON.stringify({ icon: "data:image/svg+xml;base64,PHN2Zz4=" }),
      JSON.stringify({ icon: `data:image/png;base64,${"A".repeat(210_000)}` }),
    ]) {
      expect(readAccountIcon(meta)).toBeNull();
    }
  });

  it("renders a decorative image only when there is an icon", () => {
    const { container, rerender } = render(<AccountIcon meta={JSON.stringify({ icon: png })} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(png);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    rerender(<AccountIcon meta={null} />);
    expect(container.querySelector("img")).toBeNull();
  });
});
