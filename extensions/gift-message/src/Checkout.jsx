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
  const [savedMessage, setSavedMessage] = useState(saved);

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
    if (result.type === "error") {
      setError(i18n.translate("saveError"));
    } else {
      setError("");
      setSavedMessage(trimmed);
    }
  }

  async function onToggle(event) {
    const checked = event.currentTarget.checked;
    setIsGift(checked);
    if (!checked) {
      setMessage("");
      await save("");
    }
  }

  const charactersLeft = MAX_LENGTH - message.length;
  const isSaved =
    isGift && savedMessage !== "" && savedMessage === message.trim();

  return (
    <s-box
      border="base"
      borderRadius="large"
      padding="base"
      background={isGift ? "subdued" : "base"}
    >
      <s-stack gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-icon
            type="gift-card"
            size="large"
            tone={isGift ? "success" : "info"}
          />
          <s-stack gap="none">
            <s-text type="strong">{i18n.translate("heading")}</s-text>
            <s-text color="subdued">{i18n.translate("subheading")}</s-text>
          </s-stack>
        </s-stack>

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
            <s-stack direction="inline" gap="base" justifyContent="space-between">
              {isSaved ? (
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-icon type="check-circle-filled" size="small" tone="success" />
                  <s-text type="small" tone="success">
                    {i18n.translate("saved")}
                  </s-text>
                </s-stack>
              ) : (
                <s-text type="small" color="subdued">
                  {i18n.translate("savesAutomatically")}
                </s-text>
              )}
              <s-text
                type="small"
                color="subdued"
                tone={charactersLeft <= 20 ? "warning" : "auto"}
              >
                {i18n.translate("charactersLeft", { count: charactersLeft })}
              </s-text>
            </s-stack>
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
