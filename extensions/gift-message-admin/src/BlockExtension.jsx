import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

const GIFT_WRAP_HANDLE = "giftwell-gift-wrap";

const ORDER_QUERY = `query GiftwellOrder($id: ID!) {
  order(id: $id) {
    giftMessage: metafield(namespace: "$app", key: "gift_message") { value }
    lineItems(first: 50) {
      nodes { quantity product { handle } }
    }
  }
}`;

export default async () => {
  render(<GiftMessageBlock />, document.body);
};

/**
 * Shows the buyer's gift message and whether the order has gift wrap, right on
 * the admin order page, so a packer doesn't have to dig through metafields.
 */
function GiftMessageBlock() {
  const { i18n, data, query } = shopify;
  const orderId = data.selected?.[0]?.id;

  const [state, setState] = useState(
    /** @type {{ loading: boolean, message: string, giftWrap: number, error: boolean }} */ ({
      loading: true,
      message: "",
      giftWrap: 0,
      error: false,
    }),
  );

  useEffect(() => {
    if (!orderId) return;
    query(ORDER_QUERY, { variables: { id: orderId } })
      .then(({ data: result, errors }) => {
        const order = /** @type {any} */ (result)?.order;
        if (errors?.length || !order) throw new Error("query failed");
        const giftWrap = order.lineItems.nodes
          .filter((line) => line.product?.handle === GIFT_WRAP_HANDLE)
          .reduce((sum, line) => sum + line.quantity, 0);
        setState({
          loading: false,
          message: order.giftMessage?.value ?? "",
          giftWrap,
          error: false,
        });
      })
      .catch(() =>
        setState({ loading: false, message: "", giftWrap: 0, error: true }),
      );
  }, [orderId]);

  if (state.loading) {
    return (
      <s-admin-block heading={i18n.translate("heading")}>
        <s-spinner />
      </s-admin-block>
    );
  }

  if (state.error) {
    return (
      <s-admin-block heading={i18n.translate("heading")}>
        <s-text tone="critical">{i18n.translate("error")}</s-text>
      </s-admin-block>
    );
  }

  const isGift = state.message !== "" || state.giftWrap > 0;

  return (
    <s-admin-block heading={i18n.translate("heading")}>
      <s-stack gap="base">
        {isGift ? (
          <s-stack direction="inline" gap="small-200">
            <s-badge tone="success">{i18n.translate("isGift")}</s-badge>
            {state.giftWrap > 0 && (
              <s-badge tone="info">
                {i18n.translate("giftWrap", { count: state.giftWrap })}
              </s-badge>
            )}
          </s-stack>
        ) : (
          <s-text color="subdued">{i18n.translate("notGift")}</s-text>
        )}

        {state.message && (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-paragraph>{state.message}</s-paragraph>
          </s-box>
        )}

        {isGift && !state.message && (
          <s-text color="subdued">{i18n.translate("noMessage")}</s-text>
        )}
      </s-stack>
    </s-admin-block>
  );
}
