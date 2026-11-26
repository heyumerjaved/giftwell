# Giftwell

A Shopify app that turns a standard checkout into a gifting checkout, built with **Checkout UI extensions** and **Shopify Functions**.

> Status: in progress. Phase 1 (foundation) is done. Follow the build in the [build journal](docs/journal/BUILD-JOURNAL.md).

## What it does

| Feature | Built with | Status |
|---|---|---|
| Gift message at checkout, saved to the order | Checkout UI extension | Planned |
| "Add gift wrap for $5" upsell in checkout | Checkout UI extension | Planned |
| Buy 2 get 10% off, buy 3+ get 15% off | Function: Discount API | Planned |
| Hide Cash on Delivery above a set order value | Function: Payment Customization | Planned |
| Max 5 of any product per order | Function: Cart and Checkout Validation | Planned |
| "How did you hear about us?" on the thank-you page | Checkout UI extension | Planned |
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
