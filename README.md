# UniConnect

### A Real-Time University Social Platform (Digital Campus Hub)

UniConnect is a full-stack real-time university social platform designed to connect students, faculty, and authorities in one unified digital ecosystem.

It provides social networking, messaging, events, marketplace, and campus management features — all powered by modern serverless technologies.

---

## Deployment Guide

## Free Stack
- **Firebase** — Auth, Firestore, Hosting (free Spark plan)
- **Cloudinary** — Image uploads (25 GB free)
- **EmailJS** — OTP email delivery (200 emails/month free)

---

## Prerequisites

```bash
node --version        # Must be 18+
npm --version         # Comes with Node
firebase --version    # Run: npm install -g firebase-tools
```

---

## STEP 1 — Firebase Setup

### A. Create / use your existing Firebase project
1. Go to **https://console.firebase.google.com**
2. Create a new project

### B. Enable Authentication
1. **Build → Authentication → Sign-in method**
2. Enable **Email/Password** → Save

### C. Enable Firestore
1. **Build → Firestore Database → Create database**
2. Mode: **Production** · Location: `asia-south1`

### D. Get your Web App config
1. **Project Settings** (⚙️) → **Your apps** → `</>`
2. Copy `firebaseConfig` — you need it in Step 4

---

## STEP 2 — Cloudinary Setup (Free Image Hosting)

1. Sign up FREE at **https://cloudinary.com** (no credit card)
2. Dashboard → copy your **Cloud name**
3. **Settings → Upload → Add upload preset**
   - Preset name: `uniconnect_uploads` (or any name you prefer)
   - Signing mode: **Unsigned** ← critical
4. Save

---

## STEP 3 — EmailJS Setup (OTP Emails)

Configure your credentials:
```
Public Key:  you_key
Service ID:  your_service_id
Template ID: your_template_id
```

But you must verify these are active in your EmailJS dashboard:

1. Login at **https://www.emailjs.com**
2. **Email Services** → confirm `service_id` is connected to a real email (e.g. Gmail)
3. **Email Templates** → confirm `template_id` exists

### Required Template Variables
Your EmailJS template must use these variable names:
```
{{to_email}}   — recipient email address
{{to_name}}    — recipient name
{{otp_code}}   — the 6-digit code
{{app_name}}   — "UniConnect"
```

### Sample Template Body:
```
Subject: {{otp_code}} is your UniConnect verification code

Hi {{to_name}},

Your verification code for {{app_name}} is:

  {{otp_code}}

This code expires in 10 minutes.
Do not share it with anyone.

— The UniConnect Team
```

---

## STEP 4 — Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in **all values**:

```env
# Firebase
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=uu-uniconnect.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=uu-uniconnect
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=uniconnect_uploads

# EmailJS 
VITE_EMAILJS_PUBLIC_KEY=your_key
VITE_EMAILJS_SERVICE_ID=service_id
VITE_EMAILJS_TEMPLATE_ID=template_id
```

---

## STEP 5 — Install Dependencies

```bash
cd uniconnect
npm install
```

This installs the new `@emailjs/browser` package along with everything else.

---

## STEP 6 — Test Locally

```bash
npm run dev
```

Open **http://localhost:5173** and test:
- [ ] Student signup → OTP email arrives → verify → can log in
- [ ] Authority signup → OTP email arrives → verify → can log in
- [ ] Gmail signup works (up to 5 accounts for testing)
- [ ] Forgot password → OTP → reset email sent
- [ ] Club role conflict: sign up two accounts with same club + role → second one rejected
- [ ] Post with image (via Cloudinary)
- [ ] Real-time feed updates

---

## STEP 7 — Deploy to Firebase

```bash
# Login
firebase login

# Link project (first time only)
firebase use --add
# Select uniconnect → alias: default

# Build + Deploy everything
npm run deploy
```

---

## 🌐 Live Demo

👉 https://uniconnectuu.web.app

---

## Re-deploy After Changes

```bash
npm run deploy
```

---

## Deploy Only Rules / Indexes

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only hosting
```

---

## Full Feature Test Checklist

### Auth
- [ ] Student signup with OTP email verification
- [ ] Authority signup with OTP email verification
- [ ] Gmail signup — 5 accounts max, 6th rejected
- [ ] Non-university email rejected for authority
- [ ] Login with email + password
- [ ] Login with Student ID + password
- [ ] Forgot password → OTP → Firebase reset email sent
- [ ] Club role conflict: duplicate President in same club rejected

### Feed
- [ ] Create text post
- [ ] Create post with image (Cloudinary upload)
- [ ] Create poll → vote → percentages update live
- [ ] React with 5 emotion types (hover to see picker)
- [ ] Click reaction count → see who reacted (modal)
- [ ] Edit own post → "(edited)" label shows
- [ ] Delete own post
- [ ] Comment with @mention → mentioned user gets notification
- [ ] Share post → creates new post on your feed
- [ ] Click post author name/photo → goes to their profile

### Messages
- [ ] Start DM from People page or Marketplace "Message Seller"
- [ ] Real-time message delivery
- [ ] Send image in chat
- [ ] Send emoji in chat
- [ ] Create group chat (up to 50 members)
- [ ] Add member to existing group
- [ ] Upload group photo
- [ ] Leave group
- [ ] Active status: green dot for online users
- [ ] Unread count in sidebar / bottom nav
- [ ] Messages do NOT appear in Notifications panel

### Events
- [ ] Create event with photo
- [ ] Department notifications sent on create
- [ ] "I'm Interested" button toggles
- [ ] Click interested count → see list of interested users
- [ ] Events auto-categorize: Upcoming / Today / Past

### Clubs
- [ ] View all 8 clubs
- [ ] Club detail shows committee + members from real user data

### Marketplace
- [ ] Post listing with image
- [ ] "Message Seller" opens DM with intro message auto-sent
- [ ] Category filter works
- [ ] Mobile card layout is clean

### Notice Board
- [ ] Authority can post notice with Google Drive link
- [ ] Students cannot post (button hidden)
- [ ] Department notifications sent on publish
- [ ] "View Full Notice" modal opens
- [ ] Drive link clickable in modal

### Notifications
- [ ] Reactions, comments, mentions, friend requests, events, notices all appear
- [ ] Messages do NOT appear in notifications
- [ ] Filter by notification type
- [ ] Mark all as read
- [ ] Click notification → navigates to correct page

### Friends / People
- [ ] See all registered users with search
- [ ] Search by name, student ID, email, department
- [ ] Send / withdraw friend request
- [ ] Accept / ignore incoming request
- [ ] Friend list shows
- [ ] Friend request and accept generate notifications

### Profile
- [ ] Cover photo upload
- [ ] Avatar upload
- [ ] Editable: bio, address, job/work, education, club, role
- [ ] Name, Department, Student ID are NOT editable
- [ ] Posts on profile are interactive (react, comment, delete)
- [ ] Authority badge displays
- [ ] Club position badge displays

---

## New Collections in v2

```
friendRequests/
  fromUid, toUid, fromName, fromPhoto
  status: 'pending' | 'accepted'
  createdAt

users/ (new fields)
  isActive: boolean
  lastActive: timestamp
  job: string
  education: string
  emailDomain: string   ← used for Gmail limit check
  friends: []           ← deprecated, use friendRequests
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| OTP email not received | Check spam. Verify EmailJS service is connected to real Gmail account. Check EmailJS dashboard for send logs. |
| "Invalid OTP" immediately | OTP expires in 10 min. Must be used in same browser tab (stored in sessionStorage). |
| Club role "already taken" | Another user with same club + role exists. Check Firestore → users collection. |
| Gmail limit error | 5 Gmail test accounts already created. Use university email or delete test accounts in Firebase Auth. |
| Images not uploading | Cloudinary preset must be set to **Unsigned**. Check VITE_CLOUDINARY_UPLOAD_PRESET is correct. |
| "Permission denied" | Redeploy rules: `firebase deploy --only firestore:rules` |
| Index errors in console | Click the auto-generated link in the error to create the index, or run `firebase deploy --only firestore:indexes` |
| Blank page after deploy | Check all `.env.local` values are correct and `npm run build` had no errors. |
| Active status not updating | Normal on first load — status updates after sign-in and clears on tab close. |

---

## Cost Summary — 100% Free for Pilot

| Service | Free Limit | Usage Estimate (50 users) |
|---|---|---|
| Firebase Auth | Unlimited users | ✅ Free |
| Firestore reads | 50,000/day | ✅ Free |
| Firestore writes | 20,000/day | ✅ Free |
| Firebase Hosting | 10 GB/month | ✅ Free |
| Cloudinary storage | 25 GB | ✅ Free |
| Cloudinary bandwidth | 25 GB/month | ✅ Free |
| EmailJS | 200 emails/month | ✅ Free |
| **Total** | — | **$0/month** |

---

## PWA / Add to Home Screen

UniConnect works as a PWA out of the box via Firebase Hosting.
Users can "Add to Home Screen" on iOS/Android for an app-like experience.

---
## Tech Stack

- React 18 + Vite
- TailwindCSS
- Firebase (Auth, Firestore, Hosting)
- Cloudinary (Image storage)
- EmailJS (OTP system)

---

## Author

**Md. Seam Sikder Nahid**  
CSE Student | Blockchain Developer | Cybersecurity Enthusiast

---

## Support

If you like this project, give it a ⭐ on GitHub.

*UniConnect — Uttara University Digital Hub*
