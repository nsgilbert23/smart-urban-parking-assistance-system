# Google sign-in setup

The app uses Google Identity Services for identity only. It requests the verified email and basic profile claims; it does not request Gmail or mailbox access. The backend validates the signed Google ID token before creating a driver account or issuing SUPAS tokens.

1. Create a **Web application** OAuth client in Google Cloud and configure the consent screen.
2. Add each frontend origin (for local development, `http://localhost:5173`) to the OAuth client's authorized JavaScript origins.
3. Set the same OAuth **client ID** in `frontend/.env` as `VITE_GOOGLE_CLIENT_ID` and in the backend environment as `GOOGLE_OAUTH_CLIENT_ID`.
4. Restart the frontend and backend.

For production, configure the deployed website origin in the OAuth client's authorized JavaScript origins, set `VITE_API_BASE_URL` to the HTTPS API address, and set `FRONTEND_BASE_URL` to the HTTPS website address. If the OAuth consent screen is still in testing mode, only the configured test users can sign in. Publish the consent configuration and complete any verification Google requires before opening sign-in to the public.

No Google client secret is used by this ID-token sign-in flow. Existing SUPAS accounts should sign in with their current password, then connect Google from **Profile**. Google accounts are never automatically linked to a password account just because their email matches.

New Google accounts are created as drivers. Customers add a vehicle before reserving and can add a phone number to receive mobile-money payment prompts.
