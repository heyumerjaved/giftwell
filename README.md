# Giftwell

A Shopify app that turns a standard checkout into a gifting checkout, built with **Checkout UI extensions** and **Shopify Functions**.

> Status: in progress. Phases 1 to 3 are done: gift message, tiered discount, hide cash on delivery and max per product, all verified on the dev store. Follow the build in the [build journal](docs/journal/BUILD-JOURNAL.md).

## What it does

| Feature | Built with | Status |
|---|---|---|
| Gift message at checkout, saved to the order | Checkout UI extension | Done |
| "Add gift wrap for $5" upsell in checkout | Checkout UI extension | Planned |
| Buy 2 get 10% off, buy 3+ get 15% off | Function: Discount API | Done |
| Hide Cash on Delivery above a set order value | Function: Payment Customization | Done |
| Max 5 of any product per order | Function: Cart and Checkout Validation | Done |
| "How did you hear about us?" on the thank-you page | Checkout UI extension | Planned |
| Gift message shown right on the admin order page | Admin UI extension (order details block) | Planned |
| Admin settings page, read by every Function through metafields | Embedded app (React Router + Polaris) | Planned |

## Stack

- Shopify app: React Router template, TypeScript, Polaris
- Checkout UI extensions: Preact and Polaris web components
- Shopify Functions: JavaScript, with one also written in Rust
- Sessions: Prisma + SQLite (dev)

## Run it locally

You need Node 20+, Shopify CLI and a Shopify Plus dev store (checkout extensions on the information, shipping and payment steps need Plus).

```bash
npm install
shopify app dev
```

## Author

Built by [Umer J.](https://umerconnects.com), Shopify developer.
The original Shopify template README is in [docs/TEMPLATE-README.md](docs/TEMPLATE-README.md).
