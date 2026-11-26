import { describe, expect, test } from "vitest";
import { parseSettingsForm } from "./settings";

const form = (values: Record<string, string>) => {
  const f = new FormData();
  const base = {
    tier0Min: "2",
    tier0Percent: "10",
    tier1Min: "3",
    tier1Percent: "15",
    tier2Min: "",
    tier2Percent: "",
    codMaxOrderTotal: "200",
    codPaymentMethodNames: "cash on delivery, cod",
    maxPerProduct: "5",
  };
  Object.entries({ ...base, ...values }).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe("parseSettingsForm", () => {
  test("accepts the defaults and skips the empty tier row", () => {
    const result = parseSettingsForm(form({}));
    expect(result).toEqual({
      ok: true,
      settings: {
        tiers: [
          { minQuantity: 2, percentage: 10 },
          { minQuantity: 3, percentage: 15 },
        ],
        codMaxOrderTotal: 200,
        codPaymentMethodNames: ["cash on delivery", "cod"],
        maxPerProduct: 5,
      },
    });
  });

  test("sorts tiers by quantity", () => {
    const result = parseSettingsForm(
      form({ tier0Min: "5", tier0Percent: "20", tier1Min: "2", tier1Percent: "5" }),
    );
    expect(result.ok && result.settings.tiers.map((t) => t.minQuantity)).toEqual([2, 5]);
  });

  test("rejects duplicate tier quantities", () => {
    const result = parseSettingsForm(form({ tier1Min: "2" }));
    expect(result).toEqual({
      ok: false,
      errors: { tier1Min: "Each tier needs a different quantity." },
    });
  });

  test("rejects a percentage over 100 and a quantity below 2", () => {
    const result = parseSettingsForm(form({ tier0Min: "1", tier0Percent: "150" }));
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
      "tier0Min",
      "tier0Percent",
    ]);
  });

  test("needs at least one tier", () => {
    const result = parseSettingsForm(
      form({ tier0Min: "", tier0Percent: "", tier1Min: "", tier1Percent: "" }),
    );
    expect(!result.ok && result.errors.tier0Min).toBe("Add at least one tier.");
  });

  test("rejects a negative COD limit, empty names and a zero product limit", () => {
    const result = parseSettingsForm(
      form({ codMaxOrderTotal: "-1", codPaymentMethodNames: " , ", maxPerProduct: "0" }),
    );
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
      "codMaxOrderTotal",
      "codPaymentMethodNames",
      "maxPerProduct",
    ]);
  });

  test("rounds the COD limit to cents", () => {
    const result = parseSettingsForm(form({ codMaxOrderTotal: "149.999" }));
    expect(result.ok && result.settings.codMaxOrderTotal).toBe(150);
  });
});
