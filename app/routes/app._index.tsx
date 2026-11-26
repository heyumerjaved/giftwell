import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

/** Must match the handle in extensions/tiered-discount/shopify.extension.toml */
const FUNCTION_HANDLE = "tiered-discount";
const DISCOUNT_TITLE = "Giftwell: buy more, save more";

/** Default tiers. Phase 5 replaces this with an editable settings page. */
const DEFAULT_TIERS = [
  { minQuantity: 2, percentage: 10 },
  { minQuantity: 3, percentage: 15 },
];

type GiftwellDiscount = { id: string; title: string; status: string };
type DiscountNode = {
  id: string;
  discount: { __typename: string; title?: string; status?: string };
};
type UserError = { field?: string[] | null; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query GiftwellDiscounts {
        discountNodes(first: 25, query: "method:automatic") {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticApp {
                title
                status
              }
            }
          }
        }
      }`,
  );
  const { data } = await response.json();

  const discount: GiftwellDiscount | null =
    data?.discountNodes.nodes
      .filter(
        (node: DiscountNode) =>
          node.discount.__typename === "DiscountAutomaticApp" &&
          node.discount.title === DISCOUNT_TITLE,
      )
      .map((node: DiscountNode) => ({
        id: node.id,
        title: node.discount.title ?? "",
        status: node.discount.status ?? "",
      }))[0] ?? null;

  return { discount, tiers: DEFAULT_TIERS };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      mutation CreateGiftwellDiscount($discount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $discount) {
          automaticAppDiscount {
            discountId
            title
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        discount: {
          title: DISCOUNT_TITLE,
          functionHandle: FUNCTION_HANDLE,
          discountClasses: ["PRODUCT"],
          startsAt: new Date().toISOString(),
          combinesWith: {
            orderDiscounts: false,
            productDiscounts: false,
            shippingDiscounts: true,
          },
          metafields: [
            {
              namespace: "$app",
              key: "function-configuration",
              type: "json",
              value: JSON.stringify({ tiers: DEFAULT_TIERS }),
            },
          ],
        },
      },
    },
  );
  const { data } = await response.json();
  const result = data?.discountAutomaticAppCreate;

  return {
    created: result?.automaticAppDiscount ?? null,
    errors: (result?.userErrors ?? []) as UserError[],
  };
};

export default function Index() {
  const { discount, tiers } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isCreating = fetcher.state !== "idle";
  const errors = fetcher.data?.errors ?? [];

  useEffect(() => {
    if (fetcher.data?.created) {
      shopify.toast.show("Tiered discount is live");
    }
  }, [fetcher.data?.created, shopify]);

  return (
    <s-page heading="Giftwell">
      <s-section heading="Buy more, save more">
        <s-paragraph>
          An automatic discount, powered by a Shopify Function. No code needed
          at checkout: the more products a buyer adds, the bigger the discount.
        </s-paragraph>

        <s-table>
          <s-table-header-row>
            <s-table-header>Products in cart</s-table-header>
            <s-table-header>Discount on every product</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {tiers.map((tier) => (
              <s-table-row key={tier.minQuantity}>
                <s-table-cell>{tier.minQuantity} or more</s-table-cell>
                <s-table-cell>{tier.percentage}% off</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>

        {discount ? (
          <s-banner tone="success" heading="The tiered discount is active">
            {discount.title} ({discount.status.toLowerCase()})
          </s-banner>
        ) : (
          <s-stack gap="base">
            <s-paragraph>The discount is not set up on this store yet.</s-paragraph>
            <s-button
              variant="primary"
              onClick={() => fetcher.submit({}, { method: "POST" })}
              {...(isCreating ? { loading: true } : {})}
            >
              Activate tiered discount
            </s-button>
          </s-stack>
        )}

        {errors.length > 0 && (
          <s-banner tone="critical" heading="The discount couldn't be created">
            {errors.map((e) => e.message).join(" ")}
          </s-banner>
        )}
      </s-section>

      <s-section heading="Gift message" slot="aside">
        <s-paragraph>
          Buyers can mark an order as a gift and add a message in checkout. The
          message is saved on the order as the Giftwell gift message field.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
