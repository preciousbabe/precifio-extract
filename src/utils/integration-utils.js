const INTEGRATION_API = "/.netlify/functions";

/**
 * Generic OAuth connect.
 *
 * Starts the OAuth flow for any provider.
 */
export async function connectIntegration(
 provider,
 userId
) {

  if (!provider) {
    throw new Error("Provider is required.");
  }

  const res = await fetch(

    `${INTEGRATION_API}/connect-provider`,

    {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

 provider,

 userId

})
    }

  );

  const result = await res.json();

  if (!res.ok) {

    throw new Error(

      result.error ||

      "Unable to start OAuth."

    );

  }

  if (!result.authorizeUrl) {

    throw new Error(
      "Provider did not return an authorization URL."
    );

  }

  window.location.href =
    result.authorizeUrl;

}


/**
 * Disconnect any integration.
 */
export async function disconnectIntegration(
 provider,
 userId
) {

  if (!provider) {

    throw new Error(
      "Provider is required."
    );

  }

  const res = await fetch(

    `${INTEGRATION_API}/disconnect-provider`,

    {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

 provider,

 userId

})

    }

  );

  const result = await res.json();

  if (!res.ok) {

    throw new Error(

      result.error ||

      "Disconnect failed."

    );

  }

  return result;

}


/**
 * Returns the connection state
 * for a provider.
 */
export async function getIntegration(provider) {

  const res = await fetch(

    `${INTEGRATION_API}/integration-status?provider=${encodeURIComponent(provider)}`

  );

  const result =
    await res.json();

  if (!res.ok) {

    throw new Error(

      result.error ||

      "Unable to load integration."

    );

  }

  return result;

}


/**
 * Returns every connected provider.
 */
export async function getIntegrations() {

  const res = await fetch(

    `${INTEGRATION_API}/integration-status`

  );

  const result =
    await res.json();

  if (!res.ok) {

    throw new Error(

      result.error ||

      "Unable to load integrations."

    );

  }

  return result;

}