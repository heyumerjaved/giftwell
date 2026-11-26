// @ts-check

/**
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunInput} CartPaymentMethodsTransformRunInput
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunResult} CartPaymentMethodsTransformRunResult
 * @typedef {{ maxOrderTotal: number, paymentMethodNames: string[] }} Configuration
 */

/** Used when the payment customization has no configuration metafield yet. */
export const DEFAULT_CONFIGURATION = {
  maxOrderTotal: 200,
  paymentMethodNames: ["cash on delivery", "cod"],
};

/**
 * @param {unknown} raw
 * @returns {Configuration}
 */
export function readConfiguration(raw) {
  const config = raw && typeof raw === "object" ? raw : {};
  const maxOrderTotal = Number(config.maxOrderTotal);
  const names = Array.isArray(config.paymentMethodNames)
    ? config.paymentMethodNames.filter((n) => typeof n === "string" && n.trim())
    : [];

  return {
    maxOrderTotal:
      Number.isFinite(maxOrderTotal) && maxOrderTotal >= 0
        ? maxOrderTotal
        : DEFAULT_CONFIGURATION.maxOrderTotal,
    paymentMethodNames: (names.length
      ? names
      : DEFAULT_CONFIGURATION.paymentMethodNames
    ).map((n) => n.trim().toLowerCase()),
  };
}

/** Whole-word match, so "cod" matches "COD" and "Cash (COD)" but not "Barcode Pay". */
function matchesName(methodName, wanted) {
  const name = methodName.toLowerCase();
  return wanted.some((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(name);
  });
}

/**
 * Hides cash-on-delivery style payment methods when the order total is above
 * the configured limit, so large unpaid orders can't be placed.
 *
 * @param {CartPaymentMethodsTransformRunInput} input
 * @returns {CartPaymentMethodsTransformRunResult}
 */
export function cartPaymentMethodsTransformRun(input) {
  const { maxOrderTotal, paymentMethodNames } = readConfiguration(
    input.paymentCustomization?.metafield?.jsonValue,
  );
  const total = Number(input.cart.cost.totalAmount.amount);

  if (!(total > maxOrderTotal)) {
    return { operations: [] };
  }

  return {
    operations: input.paymentMethods
      .filter((method) => matchesName(method.name, paymentMethodNames))
      .map((method) => ({ paymentMethodHide: { paymentMethodId: method.id } })),
  };
}
