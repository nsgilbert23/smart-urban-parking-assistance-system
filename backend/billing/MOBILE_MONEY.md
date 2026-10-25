# Parking mobile money collection

The operator's exit action calculates the final session fee. For MTN MoMo or Airtel Money, the backend sends a collection request to the driver's phone number saved on their profile when the operator checked them in. The driver must approve the request in their wallet; a sent prompt is not recorded as a successful payment. The driver session page checks the provider status and changes the session to paid only after a successful provider response.

Provider credentials stay in server environment variables. Do not put them in React code, commit real credentials, or send them through chat.

## MTN MoMo

Create and activate a Rwanda Collections app with MTN MoMo. Configure `MTN_MOMO_USER_ID`, `MTN_MOMO_CREDENTIAL_TOKEN`, `MTN_MOMO_COLLECTION_KEY`, and `MTN_MOMO_TARGET_ENVIRONMENT`. The current MoMo platform uses the partner-issued User ID and Credential Token, requires `X-Target-Environment`, and uses `https://momoapi.momo.africa` as its base URL. Verify the country target and credentials in the merchant portal before live traffic.

## Airtel Money

Register an app in the Airtel Africa Developer Portal, select Rwanda, and request the Collections product. Configure `AIRTEL_MONEY_CLIENT_ID`, `AIRTEL_MONEY_CLIENT_SECRET`, `AIRTEL_MONEY_COUNTRY`, `AIRTEL_MONEY_CURRENCY`, and the approved base URL. The example uses Airtel's UAT host; change it only after the merchant app is approved for production.

## Local setup

Copy the provider variables from `.env.example` into the environment used to launch Django. Leave credentials empty to keep the provider disabled. Requests then report a configuration error and the operator can still record cash or payment to be collected later. Apply migrations with `python manage.py migrate`.

Payment-status checks are available to the driver who owns the session and to parking operators. The backend calls the provider's status endpoint; only `SUCCESSFUL`/equivalent statuses mark the session paid.
