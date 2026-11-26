use super::schema;
use shopify_function::prelude::*;
use shopify_function::Result;

/// Used when the validation has no configuration metafield yet.
const DEFAULT_MAX_PER_PRODUCT: i32 = 5;

/// The validation's `$app.function-configuration` metafield, e.g. `{"maxPerProduct": 5}`.
#[derive(Deserialize, Default, PartialEq)]
#[shopify_function(rename_all = "camelCase")]
pub struct Configuration {
    max_per_product: Option<i32>,
}

/// Rust port of the JavaScript `max-per-product` Function, with identical output.
/// Blocks checkout when any product (all its variants together) is in the cart
/// more times than the configured limit.
#[shopify_function]
fn cart_validations_generate_run(
    input: schema::cart_validations_generate_run::Input,
) -> Result<schema::CartValidationsGenerateRunResult> {
    let max = input
        .validation()
        .metafield()
        .and_then(|m| m.json_value().max_per_product)
        .filter(|&n| n > 0)
        .unwrap_or(DEFAULT_MAX_PER_PRODUCT);

    // Keep first-seen order so the errors come out in cart order, like the JS version.
    let mut per_product: Vec<(&str, &str, i32)> = Vec::new();
    for line in input.cart().lines() {
        let product = match line.merchandise() {
            schema::cart_validations_generate_run::input::cart::lines::Merchandise::ProductVariant(variant) => variant.product(),
            _ => continue,
        };
        let quantity = *line.quantity();
        match per_product.iter_mut().find(|(id, _, _)| *id == product.id().as_str()) {
            Some(entry) => entry.2 += quantity,
            None => per_product.push((product.id().as_str(), product.title().as_str(), quantity)),
        }
    }

    let errors = per_product
        .iter()
        .filter(|(_, _, quantity)| *quantity > max)
        .map(|(_, title, _)| schema::ValidationError {
            message: format!(
                "You can order up to {} of {} per order. Please lower the quantity to continue.",
                max, title
            ),
            target: "$.cart".to_owned(),
        })
        .collect();

    Ok(schema::CartValidationsGenerateRunResult {
        operations: vec![schema::Operation::ValidationAdd(
            schema::ValidationAddOperation { errors },
        )],
    })
}
