import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

/** Fallback when the merchant hasn't picked a variant in the checkout editor. */
const DEFAULT_HANDLE = "giftwell-gift-wrap";

const PRODUCT_QUERY = `query GiftWrap($handle: String!) {
  product(handle: $handle) {
    title
    featuredImage { url altText }
    variants(first: 1) {
      nodes { id price { amount currencyCode } }
    }
  }
}`;

const VARIANT_QUERY = `query GiftWrapVariant($id: ID!) {
  node(id: $id) {
    ... on ProductVariant {
      id
      price { amount currencyCode }
      image { url altText }
      product { title featuredImage { url altText } }
    }
  }
}`;

export default async () => {
  render(<GiftWrapUpsell />, document.body);
};

/**
 * @typedef {{ id: string, title: string, amount: number, currencyCode: string, imageUrl?: string, imageAlt?: string }} GiftWrap
 */

function GiftWrapUpsell() {
  const { i18n, instructions, lines, settings, query, applyCartLinesChange } =
    shopify;

  /** @type {[GiftWrap | null, (v: GiftWrap | null) => void]} */
  const [wrap, setWrap] = useState(/** @type {GiftWrap | null} */ (null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const variantSetting = /** @type {string | undefined} */ (
    settings.value.gift_wrap_variant
  );

  useEffect(() => {
    loadGiftWrap(variantSetting).then(setWrap).catch(() => setWrap(null));
  }, [variantSetting]);

  async function loadGiftWrap(variantId) {
    if (variantId) {
      const { data } = await query(VARIANT_QUERY, {
        variables: { id: variantId },
      });
      const v = /** @type {any} */ (data)?.node;
      if (!v?.id) return null;
      const image = v.image ?? v.product?.featuredImage;
      return {
        id: v.id,
        title: v.product.title,
        amount: Number(v.price.amount),
        currencyCode: v.price.currencyCode,
        imageUrl: image?.url,
        imageAlt: image?.altText ?? v.product.title,
      };
    }
    const { data } = await query(PRODUCT_QUERY, {
      variables: { handle: DEFAULT_HANDLE },
    });
    const p = /** @type {any} */ (data)?.product;
    const v = p?.variants?.nodes?.[0];
    if (!v?.id) return null;
    return {
      id: v.id,
      title: p.title,
      amount: Number(v.price.amount),
      currencyCode: v.price.currencyCode,
      imageUrl: p.featuredImage?.url,
      imageAlt: p.featuredImage?.altText ?? p.title,
    };
  }

  if (!wrap || !instructions.value.lines.canAddCartLine) {
    return null;
  }

  const wrapLine = lines.value.find((line) => line.merchandise.id === wrap.id);
  const price = i18n.formatCurrency(wrap.amount, {
    currency: wrap.currencyCode,
  });

  async function add() {
    setBusy(true);
    const result = await applyCartLinesChange({
      type: "addCartLine",
      merchandiseId: wrap.id,
      quantity: 1,
    });
    setError(result.type === "error" ? i18n.translate("addError") : "");
    setBusy(false);
  }

  async function remove() {
    if (!wrapLine) return;
    setBusy(true);
    const result = await applyCartLinesChange({
      type: "removeCartLine",
      id: wrapLine.id,
      quantity: wrapLine.quantity,
    });
    setError(result.type === "error" ? i18n.translate("removeError") : "");
    setBusy(false);
  }

  return (
    <s-box
      border="base"
      borderRadius="large"
      padding="base"
      background={wrapLine ? "subdued" : "base"}
    >
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="base" alignItems="center">
          {wrap.imageUrl ? (
            <s-product-thumbnail src={wrap.imageUrl} alt={wrap.imageAlt} />
          ) : (
            <s-icon type="gift-card" size="large" tone="info" />
          )}
          <s-stack gap="none">
            <s-text type="strong">{i18n.translate("heading")}</s-text>
            <s-text color="subdued">{i18n.translate("description")}</s-text>
            <s-text>{price}</s-text>
          </s-stack>
        </s-stack>

        {wrapLine ? (
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-icon type="check-circle-filled" size="small" tone="success" />
              <s-text tone="success">{i18n.translate("added")}</s-text>
            </s-stack>
            <s-button variant="secondary" onClick={remove} {...(busy ? { loading: true } : {})}>
              {i18n.translate("remove")}
            </s-button>
          </s-stack>
        ) : (
          <s-button variant="secondary" onClick={add} {...(busy ? { loading: true } : {})}>
            {i18n.translate("add", { price })}
          </s-button>
        )}

        {error && <s-text tone="critical">{error}</s-text>}
      </s-stack>
    </s-box>
  );
}
