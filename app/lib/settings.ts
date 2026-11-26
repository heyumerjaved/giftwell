/**
 * Giftwell settings: the shape each Function reads from its
 * `$app.function-configuration` metafield, the defaults, and the validation
 * applied before anything is saved. Pure functions, so they can be unit tested.
 */

export type Tier = { minQuantity: number; percentage: number };

export type GiftwellSettings = {
  tiers: Tier[];
  codMaxOrderTotal: number;
  codPaymentMethodNames: string[];
  maxPerProduct: number;
};

export const MAX_TIERS = 3;

export const DEFAULT_SETTINGS: GiftwellSettings = {
  tiers: [
    { minQuantity: 2, percentage: 10 },
    { minQuantity: 3, percentage: 15 },
  ],
  codMaxOrderTotal: 200,
  codPaymentMethodNames: ["cash on delivery", "cod"],
  maxPerProduct: 5,
};

export type FieldErrors = Partial<Record<string, string>>;

export type ParseResult =
  | { ok: true; settings: GiftwellSettings }
  | { ok: false; errors: FieldErrors };

const isWhole = (n: number) => Number.isInteger(n) && Number.isFinite(n);

/**
 * Reads the settings form. Tier rows left empty are ignored, so a merchant
 * can use one, two or three tiers. Field names: tier{i}Min, tier{i}Percent,
 * codMaxOrderTotal, codPaymentMethodNames (comma separated), maxPerProduct.
 */
export function parseSettingsForm(form: FormData): ParseResult {
  const errors: FieldErrors = {};
  const text = (name: string) => String(form.get(name) ?? "").trim();

  const tiers: Tier[] = [];
  for (let i = 0; i < MAX_TIERS; i++) {
    const minRaw = text(`tier${i}Min`);
    const pctRaw = text(`tier${i}Percent`);
    if (minRaw === "" && pctRaw === "") continue;

    const minQuantity = Number(minRaw);
    const percentage = Number(pctRaw);

    if (!isWhole(minQuantity) || minQuantity < 2) {
      errors[`tier${i}Min`] = "Use a whole number of 2 or more.";
    }
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      errors[`tier${i}Percent`] = "Use a percentage between 1 and 100.";
    }
    tiers.push({ minQuantity, percentage });
  }

  if (tiers.length === 0) {
    errors.tier0Min = "Add at least one tier.";
  }

  const seen = new Set<number>();
  tiers.forEach((tier, i) => {
    if (seen.has(tier.minQuantity) && !errors[`tier${i}Min`]) {
      errors[`tier${i}Min`] = "Each tier needs a different quantity.";
    }
    seen.add(tier.minQuantity);
  });

  const codMaxOrderTotal = Number(text("codMaxOrderTotal"));
  if (!Number.isFinite(codMaxOrderTotal) || codMaxOrderTotal < 0) {
    errors.codMaxOrderTotal = "Use an amount of 0 or more.";
  }

  const codPaymentMethodNames = text("codPaymentMethodNames")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  if (codPaymentMethodNames.length === 0) {
    errors.codPaymentMethodNames = "Add at least one payment method name.";
  }

  const maxPerProduct = Number(text("maxPerProduct"));
  if (!isWhole(maxPerProduct) || maxPerProduct < 1) {
    errors.maxPerProduct = "Use a whole number of 1 or more.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    settings: {
      tiers: [...tiers].sort((a, b) => a.minQuantity - b.minQuantity),
      codMaxOrderTotal: Math.round(codMaxOrderTotal * 100) / 100,
      codPaymentMethodNames,
      maxPerProduct,
    },
  };
}

/** Each Function's metafield value. */
export const discountConfig = (s: GiftwellSettings) => ({ tiers: s.tiers });
export const codConfig = (s: GiftwellSettings) => ({
  maxOrderTotal: s.codMaxOrderTotal,
  paymentMethodNames: s.codPaymentMethodNames,
});
export const maxPerProductConfig = (s: GiftwellSettings) => ({
  maxPerProduct: s.maxPerProduct,
});
