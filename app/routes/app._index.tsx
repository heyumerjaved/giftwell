import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { loadSettings, saveSettings } from "../lib/giftwell.server";
import { MAX_TIERS, parseSettingsForm, type FieldErrors } from "../lib/settings";

const ANSWER_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google search",
  tiktok: "TikTok",
  friend: "A friend or family member",
  other: "Other",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { settings, status } = await loadSettings(admin);

  const [grouped, otherReplies] = await Promise.all([
    db.surveyResponse.groupBy({
      by: ["answer"],
      where: { shop: session.shop },
      _count: { answer: true },
    }),
    db.surveyResponse.findMany({
      where: { shop: session.shop, answer: "other", otherText: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { otherText: true },
    }),
  ]);

  const counts = Object.keys(ANSWER_LABELS)
    .map((answer) => ({
      answer,
      label: ANSWER_LABELS[answer],
      count: grouped.find((g) => g.answer === answer)?._count.answer ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    settings,
    status,
    survey: {
      total: counts.reduce((sum, c) => sum + c.count, 0),
      counts,
      otherReplies: otherReplies.map((r) => r.otherText as string),
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const parsed = parseSettingsForm(await request.formData());

  if (!parsed.ok) {
    return { saved: false, fieldErrors: parsed.errors, errors: [] as string[] };
  }

  const errors = await saveSettings(admin, parsed.settings);
  return { saved: errors.length === 0, fieldErrors: {} as FieldErrors, errors };
};

export default function Index() {
  const { settings, status, survey } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  // Remount the form after a save or discard so every field shows the stored value.
  const [formKey, setFormKey] = useState(0);
  const fieldErrors = result?.fieldErrors ?? {};
  const saving = navigation.state === "submitting";

  useEffect(() => {
    if (result?.saved) {
      shopify.toast.show("Settings saved. Checkout is using them now.");
      setFormKey((k) => k + 1);
    }
  }, [result, shopify]);

  const tierRows = Array.from({ length: MAX_TIERS }, (_, i) => settings.tiers[i]);
  const allActive = status.discountActive && status.codEnabled && status.validationEnabled;
  const maxCount = Math.max(1, ...survey.counts.map((c) => c.count));

  return (
    <s-page heading="Giftwell">
      <s-section>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone={status.discountActive ? "success" : "warning"}>
            Tiered discount {status.discountActive ? "on" : "off"}
          </s-badge>
          <s-badge tone={status.codEnabled ? "success" : "warning"}>
            Cash on delivery rule {status.codEnabled ? "on" : "off"}
          </s-badge>
          <s-badge tone={status.validationEnabled ? "success" : "warning"}>
            Product limit {status.validationEnabled ? "on" : "off"}
          </s-badge>
        </s-stack>
        {!allActive && (
          <s-paragraph>
            Anything marked off will be set up the next time you save.
          </s-paragraph>
        )}
      </s-section>

      <Form
        method="post"
        data-save-bar
        data-discard-confirmation
        key={formKey}
        onReset={() => setFormKey((k) => k + 1)}
      >
        {result?.errors && result.errors.length > 0 && (
          <s-banner tone="critical" heading="Shopify didn't accept the change">
            {result.errors.join(" ")}
          </s-banner>
        )}

        <s-section heading="Buy more, save more">
          <s-paragraph>
            An automatic discount on every product once the cart reaches a tier.
            The highest tier reached applies. Leave a row empty to use fewer tiers.
          </s-paragraph>
          <s-stack gap="base">
            {tierRows.map((tier, i) => (
              <s-grid key={i} gridTemplateColumns="1fr 1fr" gap="base">
                <s-number-field
                  label={`Tier ${i + 1}: products in cart`}
                  name={`tier${i}Min`}
                  value={tier ? String(tier.minQuantity) : ""}
                  min={2}
                  step={1}
                  error={fieldErrors[`tier${i}Min`]}
                />
                <s-number-field
                  label={`Tier ${i + 1}: discount`}
                  name={`tier${i}Percent`}
                  value={tier ? String(tier.percentage) : ""}
                  min={1}
                  max={100}
                  suffix="%"
                  error={fieldErrors[`tier${i}Percent`]}
                />
              </s-grid>
            ))}
          </s-stack>
        </s-section>

        <s-section heading="Cash on delivery">
          <s-stack gap="base">
            <s-number-field
              label="Hide cash on delivery when the order total is above"
              name="codMaxOrderTotal"
              value={String(settings.codMaxOrderTotal)}
              min={0}
              step={1}
              prefix="$"
              details="Large unpaid orders are the riskiest. Buyers can still pay by card."
              error={fieldErrors.codMaxOrderTotal}
            />
            <s-text-field
              label="Payment methods that count as cash on delivery"
              name="codPaymentMethodNames"
              value={settings.codPaymentMethodNames.join(", ")}
              details="Comma separated. Matched as whole words, so “COD” won't match “Barcode Pay”."
              error={fieldErrors.codPaymentMethodNames}
            />
          </s-stack>
        </s-section>

        <s-section heading="Limit per product">
          <s-number-field
            label="Most units of one product per order"
            name="maxPerProduct"
            value={String(settings.maxPerProduct)}
            min={1}
            step={1}
            details="All variants of a product count together. Stops one buyer clearing out stock."
            error={fieldErrors.maxPerProduct}
          />
        </s-section>

        <s-section>
          <s-button variant="primary" type="submit" {...(saving ? { loading: true } : {})}>
            Save
          </s-button>
        </s-section>
      </Form>

      <s-section heading="How customers found you" slot="aside">
        {survey.total === 0 ? (
          <s-paragraph>
            Answers from the thank-you page survey will appear here.
          </s-paragraph>
        ) : (
          <s-stack gap="base">
            <s-text color="subdued">
              {survey.total} {survey.total === 1 ? "answer" : "answers"} from the thank-you page
            </s-text>
            {survey.counts.map((c) => (
              <s-stack key={c.answer} gap="small-300">
                <s-stack direction="inline" justifyContent="space-between">
                  <s-text>{c.label}</s-text>
                  <s-text fontVariantNumeric="tabular-nums">{c.count}</s-text>
                </s-stack>
                <div
                  role="img"
                  aria-label={`${c.label}: ${c.count}`}
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: "#f1ece4",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(c.count / maxCount) * 100}%`,
                      background: c.count ? "#7b1c2a" : "transparent",
                    }}
                  />
                </div>
              </s-stack>
            ))}
            {survey.otherReplies.length > 0 && (
              <s-stack gap="small-200">
                <s-text type="strong">Latest “Other” answers</s-text>
                {survey.otherReplies.map((text, i) => (
                  <s-text key={i} color="subdued">“{text}”</s-text>
                ))}
              </s-stack>
            )}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Gift message and gift wrap" slot="aside">
        <s-paragraph>
          Buyers add a gift message and gift wrap in checkout. Both show on the
          order page in the Gift details block. Choose the gift wrap product in
          the checkout editor.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
