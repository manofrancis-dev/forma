# Forma — considered objects for everyday

A responsive React + Vite storefront backed by Firebase Authentication and Cloud Firestore. The product list and admin order list use Firestore listeners for live updates. The cart is kept in the visitor's browser; checkout writes an order to Firestore.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and fill in the Firebase web app configuration.
3. In Firebase Console, create a project, add a Web app, enable **Email/Password** under Authentication → Sign-in method, and create a Cloud Firestore database.
4. Install dependencies and start the development server:

   ```sh
   npm install
   npm run dev
   ```

5. Publish the rules in `firestore.rules` in Firestore → Rules. They allow public product reads, restrict product writes to admins, protect user roles, and restrict order access to the owner and admins.

The storefront displays a small sample collection when the Firestore `products` collection is empty. Add products from the Admin studio after signing in as an admin. Product image fields accept public image URLs.

## Grant admin access

Create a normal account through the site first. In Firebase Console → Firestore Data, open `users`, find the document whose ID is that account's Firebase Authentication UID, and change its `role` field from `customer` to `admin`. Sign out and back in, then open the account icon to access Admin studio. Role changes are deliberately not available in the customer UI.

## Data collections

- `users/{uid}` — account name, email, and role (`customer` or `admin`).
- `products/{productId}` — name, category, price, stock, image URL, color/size, description, and optional badge.
- `orders/{orderId}` — customer UID/email, item snapshots, subtotal/total, status, and creation time.

## Deployment

The public site is published with GitHub Pages from `.github/workflows/pages.yml` at [https://manofrancis-dev.github.io/forma/](https://manofrancis-dev.github.io/forma/). The workflow builds with `GITHUB_PAGES=true` so asset paths use `/forma/`.

Add the `VITE_FIREBASE_*` values from `.env.example` as repository Actions secrets before the first deploy. Firebase web configuration is public client configuration; enforce access through the Firestore rules and Firebase Authentication, never by hiding the web API key.

Search engines read the title, description, canonical URL, Open Graph tags, and structured data in `index.html`, plus `public/robots.txt` and `public/sitemap.xml`. After the site is live, add the Pages URL in Google Search Console and submit the sitemap. Ranking follows the live page, not the GitHub repository alone. Generic searches such as “website” or “dev” are too broad to target; the page is written so Forma and Mano Francis Dev can be found by name.

## Current scope

Checkout records an order and shows an order confirmation. It does not collect payment or calculate tax. Add a payment provider and server-side order validation before accepting real payments. The newsletter form currently provides an in-page confirmation; it is not connected to an email marketing service.
