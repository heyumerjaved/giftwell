import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import {
  DEFAULT_SETTINGS,
  codConfig,
  discountConfig,
  maxPerProductConfig,
  type GiftwellSettings,
  type Tier,
} from "./settings";

type Admin = AdminApiContext;

/** Titles identify Giftwell's own discount, payment customization and validation. */
const DISCOUNT_TITLE = "Giftwell: buy more, save more";
const COD_TITLE_PREFIX = "Giftwell: hide cash on delivery";
const MAX_TITLE_PREFIX = "Giftwell: max";

const codTitle = (total: number) => `${COD_TITLE_PREFIX} over $${total}`;
const maxTitle = (max: number) => `${MAX_TITLE_PREFIX} ${max} per product`;

const NAMESPACE = "$app";
const KEY = "function-configuration";

export type GiftwellStatus = {
  discountId: string | null;
  discountActive: boolean;
  codId: string | null;
  codEnabled: boolean;
  validationId: string | null;
  validationEnabled: boolean;
};

type Owner = {
  id: string;
  title?: string;
  enabled?: boolean;
  status?: string;
  config: Record<string, unknown> | null;
};

async function gql<T>(admin: Admin, query: string, variables?: object) {
  const response = await admin.graphql(query, { variables });
  const body = (await response.json()) as { data?: T; errors?: unknown };
  if (!body.data) throw new Error(`Admin API error: ${JSON.stringify(body.errors)}`);
  return body.data;
}

type SettingsQuery = {
  discountNodes: {
    nodes: {
      id: string;
      discount: { __typename: string; title?: string; status?: string };
      metafield: { jsonValue: Record<string, unknown> } | null;
    }[];
  };
  paymentCustomizations: {
    nodes: { id: string; title: string; enabled: boolean; metafield: { jsonValue: Record<string, unknown> } | null }[];
  };
  validations: {
    nodes: { id: string; title: string; enabled: boolean; metafield: { jsonValue: Record<string, unknown> } | null }[];
  };
};

async function findOwners(admin: Admin) {
  const data = await gql<SettingsQuery>(
    admin,
    `#graphql
      query GiftwellSettings {
        discountNodes(first: 25, query: "method:automatic") {
          nodes {
            id
            discount { __typename ... on DiscountAutomaticApp { title status } }
            metafield(namespace: "$app", key: "function-configuration") { jsonValue }
          }
        }
        paymentCustomizations(first: 25) {
          nodes { id title enabled metafield(namespace: "$app", key: "function-configuration") { jsonValue } }
        }
        validations(first: 25) {
          nodes { id title enabled metafield(namespace: "$app", key: "function-configuration") { jsonValue } }
        }
      }`,
  );

  const discountNode = data.discountNodes.nodes.find(
    (n) => n.discount.__typename === "DiscountAutomaticApp" && n.discount.title === DISCOUNT_TITLE,
  );
  const cod = data.paymentCustomizations.nodes.find((n) => n.title.startsWith(COD_TITLE_PREFIX));
  const validation = data.validations.nodes.find((n) => n.title.startsWith(MAX_TITLE_PREFIX));

  const owner = (n?: { id: string; metafield: { jsonValue: Record<string, unknown> } | null } & Partial<Owner>): Owner | null =>
    n ? { id: n.id, title: n.title, enabled: n.enabled, status: n.status, config: n.metafield?.jsonValue ?? null } : null;

  return {
    discount: discountNode
      ? owner({ ...discountNode, status: discountNode.discount.status })
      : null,
    cod: owner(cod),
    validation: owner(validation),
  };
}

const asTiers = (v: unknown): Tier[] | null =>
  Array.isArray(v) &&
  v.every((t) => Number.isInteger(t?.minQuantity) && typeof t?.percentage === "number")
    ? (v as Tier[])
    : null;

/** Current settings, read from each Function's metafield, with defaults for anything missing. */
export async function loadSettings(admin: Admin): Promise<{
  settings: GiftwellSettings;
  status: GiftwellStatus;
}> {
  const { discount, cod, validation } = await findOwners(admin);

  const names = cod?.config?.paymentMethodNames;
  const settings: GiftwellSettings = {
    tiers: asTiers(discount?.config?.tiers) ?? DEFAULT_SETTINGS.tiers,
    codMaxOrderTotal:
      typeof cod?.config?.maxOrderTotal === "number"
        ? cod.config.maxOrderTotal
        : DEFAULT_SETTINGS.codMaxOrderTotal,
    codPaymentMethodNames:
      Array.isArray(names) && names.length ? (names as string[]) : DEFAULT_SETTINGS.codPaymentMethodNames,
    maxPerProduct:
      typeof validation?.config?.maxPerProduct === "number"
        ? validation.config.maxPerProduct
        : DEFAULT_SETTINGS.maxPerProduct,
  };

  return {
    settings,
    status: {
      discountId: discount?.id ?? null,
      discountActive: discount?.status === "ACTIVE",
      codId: cod?.id ?? null,
      codEnabled: Boolean(cod?.enabled),
      validationId: validation?.id ?? null,
      validationEnabled: Boolean(validation?.enabled),
    },
  };
}

type UserErrors = { userErrors: { field?: string[] | null; message: string }[] };

const metafield = (value: object) => ({
  namespace: NAMESPACE,
  key: KEY,
  type: "json",
  value: JSON.stringify(value),
});

/**
 * Writes the settings to each Function's metafield. Anything that doesn't exist
 * yet (a fresh install) is created with these settings. Returns Shopify's
 * user-facing error messages, if any.
 */
export async function saveSettings(admin: Admin, settings: GiftwellSettings): Promise<string[]> {
  const { discount, cod, validation } = await findOwners(admin);
  const errors: string[] = [];
  const collect = (r?: UserErrors | null) => r?.userErrors.forEach((e) => errors.push(e.message));

  // Update the metafields of everything that already exists, in one call.
  const updates = [
    discount && { ownerId: discount.id, ...metafield(discountConfig(settings)) },
    cod && { ownerId: cod.id, ...metafield(codConfig(settings)) },
    validation && { ownerId: validation.id, ...metafield(maxPerProductConfig(settings)) },
  ].filter(Boolean);

  if (updates.length) {
    const data = await gql<{ metafieldsSet: UserErrors }>(
      admin,
      `#graphql
        mutation SaveGiftwellConfig($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { userErrors { field message } }
        }`,
      { metafields: updates },
    );
    collect(data.metafieldsSet);
  }

  // Keep the titles in the Shopify admin in step with the numbers.
  if (cod && cod.title !== codTitle(settings.codMaxOrderTotal)) {
    const data = await gql<{ paymentCustomizationUpdate: UserErrors }>(
      admin,
      `#graphql
        mutation RenameCod($id: ID!, $input: PaymentCustomizationInput!) {
          paymentCustomizationUpdate(id: $id, paymentCustomization: $input) { userErrors { field message } }
        }`,
      { id: cod.id, input: { title: codTitle(settings.codMaxOrderTotal) } },
    );
    collect(data.paymentCustomizationUpdate);
  }
  if (validation && validation.title !== maxTitle(settings.maxPerProduct)) {
    const data = await gql<{ validationUpdate: UserErrors }>(
      admin,
      `#graphql
        mutation RenameValidation($id: ID!, $input: ValidationUpdateInput!) {
          validationUpdate(id: $id, validation: $input) { userErrors { field message } }
        }`,
      { id: validation.id, input: { title: maxTitle(settings.maxPerProduct) } },
    );
    collect(data.validationUpdate);
  }

  // Create anything missing.
  if (!discount) {
    const data = await gql<{ discountAutomaticAppCreate: UserErrors }>(
      admin,
      `#graphql
        mutation CreateGiftwellDiscount($input: DiscountAutomaticAppInput!) {
          discountAutomaticAppCreate(automaticAppDiscount: $input) { userErrors { field message } }
        }`,
      {
        input: {
          title: DISCOUNT_TITLE,
          functionHandle: "tiered-discount",
          discountClasses: ["PRODUCT"],
          startsAt: new Date().toISOString(),
          combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
          metafields: [metafield(discountConfig(settings))],
        },
      },
    );
    collect(data.discountAutomaticAppCreate);
  }
  if (!cod) {
    const data = await gql<{ paymentCustomizationCreate: UserErrors }>(
      admin,
      `#graphql
        mutation CreateCod($input: PaymentCustomizationInput!) {
          paymentCustomizationCreate(paymentCustomization: $input) { userErrors { field message } }
        }`,
      {
        input: {
          title: codTitle(settings.codMaxOrderTotal),
          functionHandle: "hide-cod",
          enabled: true,
          metafields: [metafield(codConfig(settings))],
        },
      },
    );
    collect(data.paymentCustomizationCreate);
  }
  if (!validation) {
    const data = await gql<{ validationCreate: UserErrors }>(
      admin,
      `#graphql
        mutation CreateValidation($input: ValidationCreateInput!) {
          validationCreate(validation: $input) { userErrors { field message } }
        }`,
      {
        input: {
          title: maxTitle(settings.maxPerProduct),
          functionHandle: "max-per-product",
          enable: true,
          blockOnFailure: true,
          metafields: [metafield(maxPerProductConfig(settings))],
        },
      },
    );
    collect(data.validationCreate);
  }

  return errors;
}
