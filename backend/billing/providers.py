"""Server-side collection requests for the MTN MoMo and Airtel Money APIs."""

import base64
import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache


class PaymentProviderError(Exception):
    pass


def _request(url, *, method="GET", headers=None, body=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers=headers or {},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raise PaymentProviderError(f"Provider rejected the request ({error.code}).") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise PaymentProviderError("Payment provider is not reachable right now.") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PaymentProviderError("Payment provider returned an unreadable response.") from error


def normalize_rwanda_phone(phone):
    digits = "".join(character for character in (phone or "") if character.isdigit())
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = "250" + digits[1:]
    elif len(digits) == 9:
        digits = "250" + digits
    if not digits.startswith("250") or len(digits) != 12:
        raise PaymentProviderError("Add a valid Rwanda mobile number to the driver's profile before requesting mobile money.")
    return digits


def _mtn_headers():
    user_id = getattr(settings, "MTN_MOMO_USER_ID", "")
    credential = getattr(settings, "MTN_MOMO_CREDENTIAL_TOKEN", "")
    subscription_key = getattr(settings, "MTN_MOMO_COLLECTION_KEY", "")
    target = getattr(settings, "MTN_MOMO_TARGET_ENVIRONMENT", "")
    if not all((user_id, credential, subscription_key, target)):
        raise PaymentProviderError("MTN MoMo collection credentials are not configured on the server.")
    base_url = settings.MTN_MOMO_BASE_URL.rstrip("/")
    cache_key = f"mtn-momo-token:{target}:{user_id}"
    cached_token = cache.get(cache_key)
    if cached_token:
        return base_url, {
            "Authorization": f"Bearer {cached_token}",
            "Ocp-Apim-Subscription-Key": subscription_key,
            "X-Target-Environment": target,
            "Content-Type": "application/json",
        }
    basic = base64.b64encode(f"{user_id}:{credential}".encode()).decode()
    headers = {
        "Authorization": f"Basic {basic}",
        "Ocp-Apim-Subscription-Key": subscription_key,
        "X-Target-Environment": target,
        "Content-Type": "application/json",
    }
    _, token = _request(f"{base_url}/collection/token", method="POST", headers=headers)
    access_token = token.get("access_token")
    if not access_token:
        raise PaymentProviderError("MTN MoMo did not return an access token.")
    cache.set(cache_key, access_token, timeout=max(30, int(token.get("expires_in") or 300) - 30))
    headers["Authorization"] = f"Bearer {access_token}"
    return base_url, headers


def _airtel_headers():
    client_id = getattr(settings, "AIRTEL_MONEY_CLIENT_ID", "")
    client_secret = getattr(settings, "AIRTEL_MONEY_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise PaymentProviderError("Airtel Money collection credentials are not configured on the server.")
    country = getattr(settings, "AIRTEL_MONEY_COUNTRY", "RW")
    currency = getattr(settings, "AIRTEL_MONEY_CURRENCY", "RWF")
    base_url = settings.AIRTEL_MONEY_BASE_URL.rstrip("/")
    headers = {"Accept": "*/*", "Content-Type": "application/json", "X-Country": country, "X-Currency": currency}
    cache_key = f"airtel-money-token:{country}:{client_id}"
    cached_token = cache.get(cache_key)
    if cached_token:
        headers["Authorization"] = f"Bearer {cached_token}"
        return base_url, headers
    _, token = _request(
        f"{base_url}/auth/oauth2/token",
        method="POST",
        headers=headers,
        body={"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"},
    )
    access_token = token.get("access_token")
    if not access_token:
        raise PaymentProviderError("Airtel Money did not return an access token.")
    cache.set(cache_key, access_token, timeout=max(30, int(token.get("expires_in") or 300) - 30))
    headers["Authorization"] = f"Bearer {access_token}"
    return base_url, headers


def request_collection(provider, *, phone, amount, currency, reference):
    """Ask the wallet provider to prompt the customer to approve this charge."""
    phone = normalize_rwanda_phone(phone)
    amount_string = str(amount)
    if provider == "MTN":
        base_url, headers = _mtn_headers()
        headers.update({"X-Reference-Id": reference, "X-Target-Environment": settings.MTN_MOMO_TARGET_ENVIRONMENT})
        body = {
            "amount": amount_string,
            "currency": currency,
            "externalId": reference,
            "payer": {"partyIdType": "MSISDN", "partyId": phone},
            "payerMessage": "Parking fee",
            "payeeNote": "Parking session payment",
        }
        status_code, response = _request(
            f"{base_url}/collection/v1_0/requesttopay", method="POST", headers=headers, body=body,
        )
        return {"status": "PENDING", "message": response.get("message", f"Request accepted ({status_code}).")}

    if provider == "AIRTEL":
        base_url, headers = _airtel_headers()
        headers["X-Reference-Id"] = reference
        body = {
            "reference": reference,
            "subscriber": {"country": settings.AIRTEL_MONEY_COUNTRY, "currency": currency, "msisdn": phone},
            "transaction": {"amount": amount_string, "id": reference},
        }
        _, response = _request(f"{base_url}/merchant/v1/payments/", method="POST", headers=headers, body=body)
        return {"status": "PENDING", "message": response.get("status", {}).get("message", "Payment prompt sent. Waiting for customer approval.")}

    raise PaymentProviderError("Choose MTN MoMo or Airtel Money.")


def get_collection_status(payment):
    if payment.provider == "MTN":
        base_url, headers = _mtn_headers()
        _, result = _request(
            f"{base_url}/collection/v1_0/requesttopay/{urllib.parse.quote(payment.provider_reference)}",
            headers=headers,
        )
        status = str(result.get("status", "PENDING")).upper()
        return status, result.get("reason", "")
    if payment.provider == "AIRTEL":
        base_url, headers = _airtel_headers()
        _, result = _request(
            f"{base_url}/standard/v1/payments/{urllib.parse.quote(payment.provider_reference)}",
            headers=headers,
        )
        status = str(result.get("data", {}).get("transaction", {}).get("status", "PENDING")).upper()
        message = result.get("data", {}).get("transaction", {}).get("message", "")
        return status, message
    raise PaymentProviderError("Unknown payment provider.")
