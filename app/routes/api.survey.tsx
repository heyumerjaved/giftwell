import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/** Answers the thank-you survey offers. Anything else is rejected. */
export const SURVEY_ANSWERS = [
  "instagram",
  "facebook",
  "google",
  "tiktok",
  "friend",
  "other",
] as const;

type SurveyAnswer = (typeof SURVEY_ANSWERS)[number];

// Browsers send a CORS preflight before the POST from the checkout extension.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { cors } = await authenticate.public.checkout(request);
  return cors(new Response(null, { status: 204 }));
};

/**
 * Saves one survey answer from the thank-you page extension.
 * The request carries the checkout session token, which proves which shop it
 * came from; the shop is never taken from the request body.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);
  // Checkout session tokens carry the shop as a bare domain
  // ("store.myshopify.com"); admin tokens use a full URL. Handle both.
  const shop = sessionToken.dest.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const body = (await request.json().catch(() => null)) as {
    answer?: string;
    otherText?: string;
    orderId?: string;
  } | null;

  const answer = body?.answer as SurveyAnswer | undefined;
  if (!answer || !SURVEY_ANSWERS.includes(answer)) {
    return cors(Response.json({ error: "Invalid answer" }, { status: 400 }));
  }

  const otherText =
    answer === "other" ? body?.otherText?.trim().slice(0, 200) || null : null;
  const orderId = body?.orderId?.slice(0, 100) || null;

  if (orderId) {
    // One answer per order: a second submission replaces the first.
    await db.surveyResponse.upsert({
      where: { shop_orderId: { shop, orderId } },
      create: { shop, orderId, answer, otherText },
      update: { answer, otherText },
    });
  } else {
    await db.surveyResponse.create({ data: { shop, answer, otherText } });
  }

  return cors(Response.json({ ok: true }));
};
