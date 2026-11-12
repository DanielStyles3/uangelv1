# Google Play setup: U Angel Foods and U Angel Affiliates

Everything you need to paste into Play Console. Do this once for each app.

| | U Angel Foods | U Angel Affiliates |
|---|---|---|
| Package name | `com.uangelfoods.app` | `com.uangelfoods.affiliates` |
| Category | Food & Drink | Business |
| Icon (512×512) | `foods-icon-512.png` | `affiliates-icon-512.png` |
| Feature graphic (1024×500) | `foods-feature-1024x500.png` | `affiliates-feature-1024x500.png` |
| Privacy policy URL | https://uangelfoods.com/privacy | https://uangelfoods.com/privacy |
| Account deletion URL | https://uangelfoods.com/delete-account | https://uangelfoods.com/delete-account |
| Contact email | uangelfoods@gmail.com | uangelfoods@gmail.com |
| Contact phone | +234 704 905 5555 | +234 704 905 5555 |
| Website | https://uangelfoods.com | https://uangelfoods.com |

**Screenshots:** take at least 2 (ideally 4–8) on a phone, portrait. Good ones:
- **Foods:** Home, a product page, Cart, Christmas pre-order, order tracking.
- **Affiliates:** Earnings, Referrals, Share my code, Withdraw.

---

## U Angel Foods: store listing

**App name** (max 30): `U Angel Foods`

**Short description** (max 80):
`Food, groceries, cakes & catering in Lagos. Every order feeds someone in need.`

**Full description:**
```
U Angel Foods brings good food to your door across Lagos, and every order helps feed someone in need.

WHAT YOU CAN ORDER
• Ready meals, snacks and drinks
• Groceries and local market items
• Birthday cakes made your way: choose the size, flavour, colour and message
• Wedding cakes and custom designs by enquiry
• Catering for events: one day, a date range or specific dates

EASY ORDERING
• Pay securely online with Paystack, or pay on delivery where available
• Choose when your order arrives, with clear delivery fees before you pay
• Save your cart for later and pick up where you left off
• Track every order from the kitchen to your door

CHRISTMAS GIVING
Pre-order a Christmas pack for someone in need, with no delivery fee. Add your name (or stay anonymous) and a note for the person who receives it.

U ARE AN ANGEL
The profit from every order funds outreach that feeds the homeless, the handicapped, orphans and widows. When you order, you help.

Questions? WhatsApp or call 0704 905 5555, or email uangelfoods@gmail.com.
```

## U Angel Affiliates: store listing

**App name** (max 30): `U Angel Affiliates`

**Short description** (max 80):
`Invite people to U Angel Foods and earn up to 5% on their orders.`

**Full description:**
```
U Angel Affiliates is the earning app for the U Angel Foods affiliate programme.

HOW IT WORKS
• Share your code and link with people: WhatsApp, Instagram, your status, anywhere
• Customers sign up to U Angel Foods with your code
• They're linked to you for good: every order they pay for earns you commission
• Earn up to 5% per product

TRACK EVERYTHING
• See who joined with your code
• See how much each person has spent and what you've earned, while their orders stay private
• Follow each commission from "being reviewed" to "ready to withdraw"

GET PAID
Withdraw to any Nigerian bank account from ₦2,000. Every payout is checked by U Angel Foods and sent by bank transfer.

Applications are reviewed by U Angel Foods before you can start earning.

Questions? WhatsApp or call 0704 905 5555, or email uangelfoods@gmail.com.
```

---

## App content forms (Policy → App content)

### Both apps
- **Privacy policy:** https://uangelfoods.com/privacy
- **Ads:** No, the app does not contain ads.
- **App access:** Some functionality is restricted, so give reviewers a login (see "Reviewer login" below).
- **Content rating questionnaire:** Category "All other app types". Answer **No** to violence, sexual content, language, controlled substances and gambling. Users can interact? **No** (there's no chat between users). Shares location? **No**. Digital purchases? **No** (food is a physical product). Expected rating: Everyone / PEGI 3.
- **Target audience:** 18 and over. This avoids Google's extra rules for apps aimed at children, and the apps take payments.
- **News app:** No. **COVID-19 app:** No. **Government app:** No.
- **Financial features:** Foods: "None of the above" (you sell physical goods). Affiliates: "None of the above" as well; paying commission to affiliates isn't a financial product.
- **Health:** No.

### Data safety: U Angel Foods
- Collects or shares data? **Yes**. Encrypted in transit? **Yes**. Users can request deletion? **Yes** (link: https://uangelfoods.com/delete-account).
- Data collected. For each: **Collected** (not shared), **required**, and the purpose is **App functionality** (plus **Account management** for personal info):
  - **Personal info:** Name, Email address, Phone number, Address
  - **Financial info:** Purchase history. Card details are entered on Paystack's page and never reach us.
  - **Messages:** Other in-app messages (enquiry notes and gift notes)
  - **App info and performance:** Crash logs and Diagnostics. These are optional for the user, not shared, and the purpose is **Analytics** (Sentry crash reports).
- Not collected: location, contacts, photos, files, calendar, health, web history, device IDs for ads.

### Data safety: U Angel Affiliates
- Collects or shares data? **Yes**. Encrypted in transit? **Yes**. Deletion? **Yes** (same link).
- Data collected (all **Collected**, not shared, **required**, purpose **App functionality** and **Account management**):
  - **Personal info:** Name, Email address, Phone number
  - **Financial info:** Other financial info (the bank account details used for payouts)
- No crash reporting in this app.

### Reviewer login (App access)
Create one test account before submitting:
1. Sign up in U Angel Foods with an email you control, for example `playreview.uangel@gmail.com`, then confirm it.
2. In the admin, approve it as an affiliate (Affiliates → Applications → Approve), so reviewers can see the Affiliates app.
3. In Play Console → App access, enter the email and password with this note: *"Sign in with this account. The same login works in U Angel Foods and U Angel Affiliates."*

---

## Releasing

1. **Personal developer account:** first create a **Closed testing** release, add at least **12 testers** (their Gmail addresses) and keep it running for **14 days**. Then apply for production.
   **Organisation account:** go straight to **Production**.
2. Build the Play version (an `.aab` file): ask Claude, or run `npx eas-cli build --platform android --profile production` in each app folder.
3. Upload the `.aab` to the release, and let Google manage the app signing key (Play App Signing) when it asks.
4. Before every new upload, the `versionCode` in `app.json` must go up.
5. After the first manual upload, later updates can be sent automatically with `eas submit`. That needs a Google service account key from Play Console.
