# Mobile Application - Mini Market Financial Control & Three-Day Audit

React Native + Expo application for Hamer Shop Financial Reconciliation and Periodic Internal Audits.

---

## Setup & Running in VS Code

This app uses Expo SDK 57. Use Node.js `20.19.4+`, `22.13.0+`, `24.3.0+`, or
`25+`; use the lockfile for reproducible installs.

1. **Install Dependencies:**
   ```bash
   cd mobile
   npm ci
   ```

2. **Configure API Base URL:**
   - For local development, the defaults are `http://localhost:5000/api/v1` on web/iOS and `http://10.0.2.2:5000/api/v1` on the Android emulator.
   - For a physical phone on the local network, create a local `.env` from `.env.example` and set `EXPO_PUBLIC_API_URL` to your computer's LAN API address, such as `http://192.168.1.50:5000/api/v1`.
   - For production, set `EXPO_PUBLIC_API_URL` to the deployed HTTPS API URL (for example `https://api.your-domain.com/api/v1`) in the build environment before exporting the app. The production build intentionally fails if this is missing or not HTTPS. This value is public configuration; never put secrets in `EXPO_PUBLIC_*` variables.

3. **Start Expo Development Server:**
   ```bash
   npx expo start
   ```

4. **Testing on Device / Web:**
   - Press `w` to open in Web Browser.
   - Press `a` to open in Android Emulator.
   - Scan the QR code using the **Expo Go** app on Android or Camera app on iOS.

## Production Web Deployment

Set `EXPO_PUBLIC_API_URL` in the web build environment to the public HTTPS API
URL, then run `npm run build:web`. Expo validates the API URL before exporting.
Deploy the generated `dist` directory to a static HTTPS host. Configure the backend `CORS_ORIGIN` to the
exact website origin (scheme and hostname, no path), and set backend
`PASSWORD_RESET_URL` to the public website URL so emailed reset links open the
deployed app. Do not share a build that still points to localhost or a private
LAN address.

---

## Accounts and Permissions

The first screen supports both sign-in and registration. Public registration is
limited to Recorder and Auditor accounts; a Manager must approve every new
account before it can sign in. Managers can add, edit, deactivate, and reactivate
users, assign any of the three roles, and approve pending registrations.
Application navigation is role-gated, and the backend independently enforces
the same authorization rules.

## Key Financial Controls Implemented

1. **Dashboard Overview:** Displays live balance of Physical Cash in Safe (*ካዝና*) and Bank Account (*ባንክ*).
2. **Aggregated Income & Expense Forms:** Recorders enter daily transactions; totals are calculated by server-side business logic.
3. **Daily Closing:** Formal shift reconciliation with discrepancy alerts (Shortage 🔴, Surplus 🟠, Balanced 🟢).
4. **Three-Day Audit (የሦስት ቀን ኦዲት):** Calculates multi-day formula target and provides verification against physical safe inventory.
5. **Investigation & Explanations:** Shortages/surpluses require registered reasons and supporting document references.
6. **Immutable Audit Trail:** All adjustments and changes are recorded in the security ledger.
