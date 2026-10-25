# Smart Urban Parking Assistance System

SUPAS provides customer accounts, vehicle management, nearby parking discovery, expiring reservations, operator check-in and checkout, and administrator tools. Mobile-money collection is an optional provider integration; cash can be recorded without provider credentials.

## Local development

1. In `backend`, copy `.env.example` to `.env`. Keep `DJANGO_DEBUG=True` for local development, replace `DJANGO_SECRET_KEY` with a random development value, and set `GOOGLE_OAUTH_CLIENT_ID` if you want Google sign-in.
2. Install backend requirements and prepare the database:

   ```powershell
   cd backend
   python -m pip install -r requirements.txt
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver 127.0.0.1:8000
   ```

3. In `frontend`, copy `.env.example` to `.env`, set `VITE_GOOGLE_CLIENT_ID` to the same web client ID, and start Vite:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

The frontend is served at `http://localhost:5173`; the API is served at `http://127.0.0.1:8000/api`. Local reset emails are printed by Django's console email backend. Google OAuth setup is described in [backend/accounts/GOOGLE_SIGN_IN.md](backend/accounts/GOOGLE_SIGN_IN.md).

## Before a public launch

- Set `DJANGO_DEBUG=False`, a random `DJANGO_SECRET_KEY` of at least 50 characters, production `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `FRONTEND_BASE_URL`.
- Use PostgreSQL (`DB_ENGINE=postgresql`) and HTTPS. Production startup refuses SQLite and missing PostgreSQL credentials, host, origin, secret, frontend URL, or SMTP host/from-address configuration.
- Set production SMTP details so customers can recover passwords. Reset messages do not disclose whether an account exists.
- Configure the live frontend API URL and the same Google OAuth client ID on the frontend and backend. Add the live website origin to the Google OAuth client; localhost origins are for development only.
- Configure and verify merchant credentials and production endpoints before enabling MTN MoMo or Airtel Money. Keep credentials in the server environment.
- Apply migrations, create the first administrator, provision operator accounts, assign each operator to a location, add location entrance coordinates and rates, and verify reservations and operator check-in/out.
- Schedule `python manage.py expire_parking_reservations` periodically, configure database backups and application logs, and complete the release checks below.

## Release checks

```powershell
cd frontend
npm run lint
npm run build

cd ../backend
python manage.py test
python manage.py makemigrations --check --dry-run
python manage.py check --deploy
```

All production environment variables and provider settings should be configured in the deployment platform, not committed to this repository.

## Render deployment setup

The repository includes a Render Blueprint in `render.yaml` for the React static site, Django API, managed PostgreSQL, and a five-minute reservation-expiry job. It uses Frankfurt resources, a paid Starter API instance, and a small paid PostgreSQL instance. Review current pricing and resource requirements in Render before applying the Blueprint; applying it provisions billable services. Static hosting has no compute plan.

### First deploy

1. Push this repository to a Git provider that Render can access, then create a Blueprint from the repository and review the resources and estimated charges before applying it.
2. Set the initial secret values when prompted: SMTP host, user, password, sender address, and the matching Google web OAuth client ID for both frontend and API. If Google sign-in is not ready, leave both Google client IDs unset and configure them later. SMTP is required for account recovery.
3. Render deploys to `supas-web.onrender.com` and `supas-api.onrender.com` as named in the Blueprint. Once the first deploy is healthy, verify `/` on the API responds with `status: ok`, then add the first production administrator through the Render Shell with `python manage.py createsuperuser`.
4. Configure Google OAuth's authorized JavaScript origin as `https://supas-web.onrender.com`. This app verifies Google ID tokens in the API; it does not use a Google redirect URI. Keep the web and API client IDs identical.
5. Verify email delivery and the password reset flow. The scheduled job runs `expire_parking_reservations` every five minutes.

### Custom domain

After the first deploy, add the chosen domain(s) in Render's service settings and complete the DNS records Render supplies. For a custom frontend such as `https://parking.example.com` and API such as `https://api.example.com`, update the Blueprint values for `DJANGO_ALLOWED_HOSTS`, `FRONTEND_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `VITE_API_BASE_URL`; then update Google OAuth's authorized JavaScript origin to the frontend domain and redeploy. Do not include URL paths in the origin settings.

### Credentials and launch mode

Payment integrations are optional. The app can record cash payments without provider credentials; leave MTN MoMo and Airtel Money unconfigured until merchant enrollment, production credentials, and live collection endpoints are ready. Enter credentials only in Render's environment settings, never in this repository or the frontend.

A previously shared administrator password must be considered compromised. After the production administrator account exists, rotate its password in the Render Shell with `python manage.py changepassword <admin-username>`, and invalidate any active sessions or tokens if that account was used before launch. Do not reuse the old password.

The Blueprint currently names services `supas-web` and `supas-api`; Render resource names must be available in your account. If they are taken, rename them in `render.yaml` and update every URL/origin value that refers to them before creating the Blueprint.
