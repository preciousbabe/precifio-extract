"use strict";

/**
 * ============================================================
 * PRECIFIO — PADDLE PURCHASE FULFILLMENT
 * ============================================================
 * netlify/functions/paddle/fulfill.js
 * This module is the ONLY place responsible for turning a
 * verified Paddle purchase into Precifio credits.
 *
 * IMPORTANT:
 *
 * - Never trust frontend credit amounts.
 * - Never trust frontend prices.
 * - Never provision credits from checkout.completed.
 * - Only provision after a verified Paddle webhook.
 * - Paddle price_id determines the package.
 * - Fulfillment must be idempotent.
 *
 * ============================================================
 */

const {
  getPackageByPriceId,
} = require("./packages");

const {
  getSupabaseAdmin,
} = require("./supabase");


/* ============================================================
 * HELPERS
 * ============================================================
 */

function requireValue(value, name) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    throw new Error(
      `Missing required Paddle value: ${name}`
    );
  }

  return value;
}


/**
 * Extract a customer/user ID from Paddle custom data.
 *
 * custom_data is attached when the checkout is created.
 *
 * We intentionally require a UUID-like user_id rather than
 * accepting arbitrary credit ownership information.
 */
function getUserIdFromTransaction(transaction) {

  const customData =
    transaction?.customData ||
    transaction?.custom_data ||
    {};

  const userId =
    customData.user_id;

  if (
    !userId ||
    typeof userId !== "string"
  ) {
    throw new Error(
      "Paddle transaction is missing custom_data.user_id."
    );
  }

  return userId;
}


/**
 * Extract the Paddle transaction ID.
 */
function getTransactionId(transaction) {

  return requireValue(
    transaction?.id,
    "transaction.id"
  );
}


/**
 * Extract the Paddle price ID.
 *
 * A transaction may contain multiple items, but our current
 * credit purchases contain exactly one.
 */
function getPriceId(transaction) {

  const items =
    transaction?.items;

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      "Paddle transaction contains no items."
    );
  }

  if (items.length !== 1) {
    throw new Error(
      "Precifio credit purchases must contain exactly one item."
    );
  }

  const item =
    items[0];

  const priceId =
    item?.price?.id ||
    item?.price_id;

  if (!priceId) {
    throw new Error(
      "Unable to determine Paddle price ID."
    );
  }

  return priceId;
}


/**
 * Extract the transaction currency.
 */
function getCurrency(transaction) {

  return String(
    transaction?.currencyCode ||
    transaction?.currency_code ||
    ""
  ).toUpperCase();
}


/**
 * Extract the transaction amount.
 *
 * Paddle amounts are represented in the smallest currency
 * denomination as strings.
 */
function getAmount(transaction) {

  const item =
    transaction?.items?.[0];

  const amount =
    item?.price?.unitPrice?.amount ||
    item?.price?.unit_price?.amount ||
    item?.unitPrice?.amount ||
    item?.unit_price?.amount;

  if (
    amount === undefined ||
    amount === null
  ) {
    throw new Error(
      "Unable to determine Paddle transaction amount."
    );
  }

  return String(amount);
}


/* ============================================================
 * FULFILL PURCHASE
 * ============================================================
 */

async function fulfillPaddlePurchase(
  transaction
) {

  if (!transaction) {
    throw new Error(
      "Missing Paddle transaction."
    );
  }


  const transactionId =
    getTransactionId(transaction);


  const userId =
    getUserIdFromTransaction(transaction);


  const priceId =
    getPriceId(transaction);


  const packageConfig =
    getPackageByPriceId(priceId);


  /**
   * NEVER fall back to another package.
   */
  if (!packageConfig) {
    throw new Error(
      `Unknown Paddle price ID: ${priceId}`
    );
  }


  const currency =
    getCurrency(transaction);


  const amount =
    getAmount(transaction);


  /**
   * Validate the expected currency.
   */
  if (
    packageConfig.expectedCurrency &&
    currency &&
    currency !== packageConfig.expectedCurrency
  ) {
    throw new Error(
      `Unexpected Paddle currency: ${currency}`
    );
  }


  /**
   * Validate the expected amount.
   *
   * This protects against a price being changed unexpectedly
   * in Paddle while retaining the same price ID.
   */
  if (
    packageConfig.expectedAmount &&
    amount !== packageConfig.expectedAmount
  ) {
    throw new Error(
      `Unexpected Paddle amount for ${priceId}: ${amount}`
    );
  }


  const supabase =
    getSupabaseAdmin();


  /**
   * ----------------------------------------------------------
   * IDEMPOTENCY
   * ----------------------------------------------------------
   *
   * Paddle can retry webhook delivery.
   *
   * Never award credits twice for the same transaction.
   *
   * The database should enforce this as well.
   * ----------------------------------------------------------
   */

  const {
    data: existingPurchase,
    error: existingPurchaseError,
  } = await supabase
    .from("credit_transactions")
    .select(
      "id, user_id, amount, balance_after, metadata, status"
    )
    .eq("reference_id", transactionId)
    .eq("type", "purchase")
    .maybeSingle();


  if (existingPurchaseError) {
    throw existingPurchaseError;
  }


  if (existingPurchase) {

    return {
      success: true,
      alreadyFulfilled: true,
      transactionId,
      userId: existingPurchase.user_id,
      credits: Number(
        existingPurchase.amount
      ),
      balanceAfter:
        existingPurchase.balance_after,
    };
  }


  /**
   * ----------------------------------------------------------
   * VERIFY USER
   * ----------------------------------------------------------
   */

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      "id, credits_remaining"
    )
    .eq("id", userId)
    .maybeSingle();


  if (profileError) {
    throw profileError;
  }


  if (!profile) {
    throw new Error(
      `Precifio profile not found for user ${userId}.`
    );
  }


  const currentBalance =
    Number(
      profile.credits_remaining
    ) || 0;


  const creditsToAdd =
    Number(
      packageConfig.credits
    );


  if (
    !Number.isFinite(creditsToAdd) ||
    creditsToAdd <= 0
  ) {
    throw new Error(
      "Invalid credit amount configured for Paddle package."
    );
  }


  const newBalance =
    Math.round(
      (
        currentBalance +
        creditsToAdd
      ) * 100
    ) / 100;


  /**
   * ----------------------------------------------------------
   * UPDATE CREDIT BALANCE
   * ----------------------------------------------------------
   */

  const {
    error: updateError,
  } = await supabase
    .from("profiles")
    .update({
      credits_remaining: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);


  if (updateError) {
    throw updateError;
  }


  /**
   * ----------------------------------------------------------
   * CREATE CREDIT LEDGER ENTRY
   * ----------------------------------------------------------
   */

  const {
    data: transactionRecord,
    error: transactionError,
  } = await supabase
    .from("credit_transactions")
    .insert({
      user_id: userId,

      /**
       * Purchase amount is positive because credits are being
       * added to the user's balance.
       */
      amount: creditsToAdd,

      type: "purchase",

      reference_id:
        transactionId,

      balance_after:
        newBalance,

      status: "completed",

      feature: "purchase",

      metadata: {
        provider: "paddle",

        paddle_transaction_id:
          transactionId,

        paddle_price_id:
          priceId,

        package_id:
          packageConfig.packageId,

        credits:
          creditsToAdd,

        currency,

        amount_paid:
          amount,

        description:
          packageConfig.description,
      },
    })
    .select(
      "id, user_id, amount, balance_after"
    )
    .single();


  if (transactionError) {

    /**
     * IMPORTANT:
     *
     * If the ledger insert fails after the profile update,
     * we don't silently pretend the operation succeeded.
     *
     * The webhook will be retried and we need the database
     * architecture to handle this safely.
     */
    throw transactionError;
  }


  return {
    success: true,

    alreadyFulfilled: false,

    transactionId,

    userId,

    packageId:
      packageConfig.packageId,

    credits:
      creditsToAdd,

    previousBalance:
      currentBalance,

    balanceAfter:
      newBalance,

    transaction:
      transactionRecord,
  };
}


module.exports = {
  fulfillPaddlePurchase,
};