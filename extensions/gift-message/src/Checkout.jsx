import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState } from "preact/hooks";

const NAMESPACE = "$app";
const KEY = "gift_message";
const MAX_LENGTH = 250;

export default async () => {
  render(<GiftMessage />, document.body);
};

/** @param {Event} event */
function valueOf(event) {
  return /** @type {HTMLTextAreaElement} */ (event.currentTarget).value ?? "";
}

function GiftMessage() {
  const { i18n, instructions, appMetafields, applyMetafieldChange } = shopify;

  const saved =
    appMetafields.value.find(
      ({ target, metafield }) =>
        target.type === "cart" &&
        metafield.namespace === NAMESPACE &&
        metafield.key === KEY,
    )?.metafield?.value ?? "";

  const [isGift, setIsGift] = useState(saved !== "");
  const [message, setMessage] = useState(saved);
  const [error, setError] = useState("");

  // Some checkouts (for example accelerated wallets) can't take cart metafields.
  if (!instructions.value.metafields.canSetCartMetafields) {
    return null;
  }

  async function save(value) {
    const trimmed = value.trim();
    const result = await applyMetafieldChange(
      trimmed
        ? {
            type: "updateCartMetafield",
            metafield: {
              namespace: NAMESPACE,
              key: KEY,
              value: trimmed,
              type: "multi_line_text_field",
            },
          }
        : { type: "removeCartMetafield", namespace: NAMESPACE, key: KEY },
    );
    setError(result.type === "error" ? i18n.translate("saveError") : "");
  }

  async function onToggle(event) {
    const checked = event.currentTarget.checked;
    setIsGift(checked);
    if (!checked) {
      setMessage("");
      await save("");
    }
  }

  return (
    <s-stack gap="base">
      <s-checkbox
        label={i18n.translate("isGift")}
        checked={isGift}
        onChange={onToggle}
      />
      {isGift && (
        <s-stack gap="small-200">
          <s-text-area
            label={i18n.translate("messageLabel")}
            value={message}
            maxLength={MAX_LENGTH}
            rows={3}
            error={error}
            onInput={(event) => setMessage(valueOf(event))}
            onChange={(event) => save(valueOf(event))}
          />
          <s-text>
            {i18n.translate("charactersLeft", {
              count: MAX_LENGTH - message.length,
            })}
          </s-text>
        </s-stack>
      )}
    </s-stack>
  );
}
