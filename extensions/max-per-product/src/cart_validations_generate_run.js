// @ts-check

/**
 * @typedef {import("../generated/api").CartValidationsGenerateRunInput} CartValidationsGenerateRunInput
 * @typedef {import("../generated/api").CartValidationsGenerateRunResult} CartValidationsGenerateRunResult
 */

/** Used when the validation has no configuration metafield yet. */
export const DEFAULT_MAX_PER_PRODUCT = 5;

/**
 * @param {unknown} raw
 * @returns {number}
 */
export function readMaxPerProduct(raw) {
  const value =
    raw && typeof raw === "object" ? Number(raw.maxPerProduct) : NaN;
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_PER_PRODUCT;
}

/**
 * Blocks checkout when any single product (all its variants together) is in
 * the cart more times than the configured limit. Stops one buyer from clearing
 * out limited stock.
 *
 * @param {CartValidationsGenerateRunInput} input
 * @returns {CartValidationsGenerateRunResult}
 */
export function cartValidationsGenerateRun(input) {
  const max = readMaxPerProduct(input.validation?.metafield?.jsonValue);

  /** @type {Map<string, { title: string, quantity: number }>} */
  const perProduct = new Map();
  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;
    const { id, title } = line.merchandise.product;
    const entry = perProduct.get(id) ?? { title, quantity: 0 };
    entry.quantity += line.quantity;
    perProduct.set(id, entry);
  }

  const errors = [...perProduct.values()]
    .filter(({ quantity }) => quantity > max)
    .map(({ title }) => ({
      message: `You can order up to ${max} of ${title} per order. Please lower the quantity to continue.`,
      target: "$.cart",
    }));

  return { operations: [{ validationAdd: { errors } }] };
}
