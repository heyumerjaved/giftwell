import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from "../generated/api";

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 * @typedef {{ minQuantity: number, percentage: number }} Tier
 */

/** Used when the discount has no configuration metafield yet. */
export const DEFAULT_TIERS = [
  { minQuantity: 2, percentage: 10 },
  { minQuantity: 3, percentage: 15 },
];

/**
 * Reads tiers from the discount's metafield and drops anything malformed.
 * @param {unknown} config
 * @returns {Tier[]}
 */
export function readTiers(config) {
  const raw =
    config && typeof config === "object" && Array.isArray(config.tiers)
      ? config.tiers
      : DEFAULT_TIERS;

  return raw
    .filter(
      (tier) =>
        tier &&
        Number.isInteger(tier.minQuantity) &&
        tier.minQuantity > 0 &&
        typeof tier.percentage === "number" &&
        tier.percentage > 0 &&
        tier.percentage <= 100,
    )
    .sort((a, b) => b.minQuantity - a.minQuantity);
}

/**
 * Tiered "buy more, save more" product discount.
 * Counts the units of every eligible product in the cart, picks the highest
 * tier reached and discounts every eligible line by that percentage.
 *
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const noDiscount = { operations: [] };

  if (!input.discount.discountClasses.includes(DiscountClass.Product)) {
    return noDiscount;
  }

  const eligibleLines = input.cart.lines.filter(
    (line) =>
      line.merchandise.__typename === "ProductVariant" &&
      !line.merchandise.product.excluded,
  );

  const totalQuantity = eligibleLines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );

  const tier = readTiers(input.discount.metafield?.jsonValue).find(
    (t) => totalQuantity >= t.minQuantity,
  );

  if (!tier) {
    return noDiscount;
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `Buy ${tier.minQuantity}+, save ${tier.percentage}%`,
              targets: eligibleLines.map((line) => ({
                cartLine: { id: line.id },
              })),
              value: { percentage: { value: tier.percentage } },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}
