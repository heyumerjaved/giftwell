import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { APP_URL } from "./config.js";

/** Must match SURVEY_ANSWERS in ../../server/lib.php */
const ANSWERS = ["google", "facebook", "instagram", "pinterest", "ai", "friend", "other"];

export default async () => {
  render(<ThankYouSurvey />, document.body);
};

function ThankYouSurvey() {
  const { i18n, orderConfirmation, sessionToken, storage } = shopify;
  const orderId = orderConfirmation.value?.order?.id ?? "";
  const storageKey = `survey-answered:${orderId}`;

  const [answer, setAnswer] = useState("");
  const [otherText, setOtherText] = useState("");
  const [status, setStatus] = useState(
    /** @type {"idle" | "sending" | "done" | "error" | "loading"} */ ("loading"),
  );

  // Don't ask twice on the same order (for example after a page reload).
  useEffect(() => {
    storage
      .read(storageKey)
      .then((v) => setStatus(v ? "done" : "idle"))
      .catch(() => setStatus("idle"));
  }, [storageKey]);

  async function submit() {
    if (!answer) return;
    setStatus("sending");
    try {
      const token = await sessionToken.get();
      const response = await fetch(`${APP_URL}/survey.php`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answer, otherText, orderId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await storage.write(storageKey, true);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "loading") return null;

  return (
    <s-box border="base" borderRadius="large" padding="base">
      {status === "done" ? (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type="check-circle-filled" tone="success" />
          <s-text tone="success">{i18n.translate("thanks")}</s-text>
        </s-stack>
      ) : (
        <s-stack gap="base">
          <s-stack gap="none">
            <s-text type="strong">{i18n.translate("heading")}</s-text>
            <s-text color="subdued">{i18n.translate("subheading")}</s-text>
          </s-stack>

          <s-choice-list
            label={i18n.translate("question")}
            name="heard-about-us"
            onChange={(event) =>
              setAnswer(
                /** @type {any} */ (event.currentTarget).values?.[0] ?? "",
              )
            }
          >
            {ANSWERS.map((value) => (
              <s-choice key={value} value={value}>
                {i18n.translate(`answers.${value}`)}
              </s-choice>
            ))}
          </s-choice-list>

          {answer === "other" && (
            <s-text-field
              label={i18n.translate("otherLabel")}
              maxLength={200}
              value={otherText}
              onInput={(event) =>
                setOtherText(/** @type {any} */ (event.currentTarget).value ?? "")
              }
            />
          )}

          {status === "error" && (
            <s-text tone="critical">{i18n.translate("error")}</s-text>
          )}

          <s-button
            variant="primary"
            disabled={!answer}
            onClick={submit}
            {...(status === "sending" ? { loading: true } : {})}
          >
            {i18n.translate("send")}
          </s-button>
        </s-stack>
      )}
    </s-box>
  );
}
