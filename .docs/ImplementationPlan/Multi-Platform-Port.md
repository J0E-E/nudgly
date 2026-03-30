# Nudgly – Multi-Platform Port Sprint Plan

**Purpose:** Ship Nudgly as native apps on Android, iOS, Windows, and macOS. Break the work into small epics that can be completed, tested, and validated independently.

**Approach:** Capacitor (mobile: Android + iOS) and Electron (desktop: Windows + macOS). All platforms share the same Django backend on DigitalOcean. The Electron desktop apps load the hosted web URL — no asset bundling needed, always up to date, same server for all devices.

**Prerequisites across all epics:**
- Working local dev environment (Docker Compose, frontend builds successfully)
- DigitalOcean production deployment (web app live)
- Firebase project for push notifications

**Machine key:** 🖥️ = Windows PC, 🍎 = Mac

---

## Epic 1: Android — Scaffold & Local Run 🖥️

**Objective:** Get the app running on an Android emulator or physical device.

**Complexity:** Easy · **Est. time:** 1 day

**Prerequisites:**
- Android Studio installed with SDK (API 34+)
- JDK 17+ installed
- `ANDROID_HOME` environment variable set

### Steps

1. **Install Android Studio**
   - Download from https://developer.android.com/studio
   - During setup, install Android SDK, Android SDK Platform-Tools, and an emulator image (e.g. Pixel 7 API 34)
   - Set `ANDROID_HOME` env var to the SDK location (usually `C:\Users\<you>\AppData\Local\Android\Sdk`)
   - Add `%ANDROID_HOME%\platform-tools` to PATH

2. **Scaffold the Android project**
   ```bash
   cd frontend
   npm run build
   npx cap add android
   npx cap sync android
   ```
   This creates `frontend/android/` with a full native Android project.

3. **Open in Android Studio**
   ```bash
   npx cap open android
   ```
   Android Studio opens the project. Wait for Gradle sync to finish.

4. **Run on emulator**
   - In Android Studio: select an emulator device from the toolbar dropdown
   - Click the Run (▶️) button
   - The app should build, deploy to the emulator, and launch

5. **Test core flows**
   - Register/login
   - Create a task, edit it, complete it
   - Navigate between Tasks, Lists, Habits screens
   - Verify WebSocket notifications arrive (in-app notification bell)

6. **Update `.gitignore`**
   - Ensure `frontend/android/` build artifacts are excluded but the project structure is committed
   - Add entries: `frontend/android/.gradle/`, `frontend/android/app/build/`, `frontend/android/build/`

### Deliverables
- [ ] `frontend/android/` directory exists and is committed
- [ ] App runs on Android emulator with full CRUD functionality
- [ ] Navigation, auth, and real-time notifications work

---

## Epic 2: Android Push Notifications (FCM) 🖥️

**Objective:** Receive push notifications on Android when reminders fire.

**Complexity:** Medium · **Est. time:** 1 day

**Prerequisites:** Epic 1 complete, Firebase account

### Steps

1. **Create Firebase project**
   - Go to https://console.firebase.google.com
   - Create a new project (e.g. "Nudgly")
   - Skip Google Analytics (optional)

2. **Add Android app in Firebase**
   - Click "Add app" → Android
   - Package name: `com.nudgly.app` (must match `appId` in `capacitor.config.ts`)
   - Download `google-services.json`

3. **Place config file**
   - Copy `google-services.json` to `frontend/android/app/google-services.json`
   - **Do NOT commit this file** — add `frontend/android/app/google-services.json` to `.gitignore`

4. **Verify Capacitor plugin is synced**
   ```bash
   cd frontend
   npx cap sync android
   ```
   The `@capacitor/push-notifications` plugin auto-configures the Android project.

5. **Re-enable Android push registration**
   - In `frontend/src/hooks/usePushNotifications.ts`, remove the early-return guard:
     ```ts
     // Remove this line:
     if (Capacitor.getPlatform() === 'android') return
     ```
   - This guard was added in Epic 1 because without `google-services.json`, `PushNotifications.register()` triggers a native crash (`Default FirebaseApp is not initialized`). Once the Firebase config is in place, this guard must be removed.
   - Rebuild and sync: `npm run build && npx cap sync android`

6. **Configure backend FCM**
   - In Firebase Console → Project Settings → Service accounts → Generate new private key
   - Download the service account JSON file
   - On the DigitalOcean server, set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
   - Set `NOTIFICATION_SENDER=fcm` in backend `.env`

7. **Test end-to-end**
   - Run the app on emulator or physical device
   - Create a task with a reminder
   - Wait for the Celery Beat cycle (60 seconds) to trigger
   - Verify push notification appears on the device

### Deliverables
- [ ] Firebase project created with Android app registered
- [ ] `google-services.json` in place (not committed)
- [ ] Backend FCM adapter configured on server
- [ ] Push notifications arrive on Android device

---

## Epic 3: App Icons & Splash Screens 🖥️

**Objective:** Generate proper app icons and splash screens for Android and iOS.

**Complexity:** Easy · **Est. time:** 0.5 day

**Prerequisites:** App icon design ready (use `graphics/LogoIdea.jpg` as starting point)

### Steps

1. **Prepare source assets**
   - Create a `frontend/resources/` directory
   - Create these source images:
     - `icon-only.png` — 1024×1024, transparent background, icon only
     - `icon-foreground.png` — 1024×1024, adaptive icon foreground (Android)
     - `icon-background.png` — 1024×1024, adaptive icon background (Android)
     - `splash.png` — 2732×2732, centered logo on background color
     - `splash-dark.png` — 2732×2732, dark mode splash variant

2. **Install Capacitor Assets tool**
   ```bash
   cd frontend
   npm install -D @capacitor/assets
   ```

3. **Generate all platform assets**
   ```bash
   npx capacitor-assets generate
   ```
   This auto-generates all required sizes for Android (and iOS when that project exists).

4. **Sync to native projects**
   ```bash
   npx cap sync
   ```

5. **Verify**
   - Run on Android emulator — check app icon on home screen and splash screen on launch

### Deliverables
- [ ] `frontend/resources/` with source icon and splash images committed
- [ ] Generated icons appear correctly on Android
- [ ] Splash screen displays on app launch

---

## Epic 4: Electron — Windows Desktop App 🖥️

**Objective:** Wrap the web app in Electron and run it as a native Windows application.

**Complexity:** Medium · **Est. time:** 1–2 days

**Prerequisites:** Web app deployed and accessible at a public URL (e.g. `https://app.nudgly.com`)

### Steps

1. **Create the desktop project**
   ```bash
   mkdir desktop
   cd desktop
   npm init -y
   npm install electron --save-dev
   npm install electron-builder --save-dev
   ```

2. **Create `desktop/main.js`** — Electron main process
   ```javascript
   const { app, BrowserWindow } = require('electron')
   const path = require('path')

   function createWindow() {
     const win = new BrowserWindow({
       width: 420,
       height: 820,
       icon: path.join(__dirname, 'icon.png'),
       webPreferences: {
         preload: path.join(__dirname, 'preload.js'),
         contextIsolation: true,
         nodeIntegration: false
       }
     })

     // Load the hosted web app
     win.loadURL('https://app.nudgly.com')
   }

   app.whenReady().then(createWindow)

   app.on('window-all-closed', () => {
     if (process.platform !== 'darwin') app.quit()
   })

   app.on('activate', () => {
     if (BrowserWindow.getAllWindows().length === 0) createWindow()
   })
   ```

3. **Create `desktop/preload.js`**
   ```javascript
   // Preload script — exposes safe APIs to renderer if needed
   // For now, empty since we load a remote URL
   ```

4. **Configure `desktop/package.json`**
   ```json
   {
     "name": "nudgly-desktop",
     "version": "1.0.0",
     "main": "main.js",
     "scripts": {
       "start": "electron .",
       "build:win": "electron-builder --win",
       "build:mac": "electron-builder --mac"
     },
     "build": {
       "appId": "com.nudgly.desktop",
       "productName": "Nudgly",
       "win": {
         "target": "nsis",
         "icon": "icon.png"
       },
       "mac": {
         "target": "dmg",
         "category": "public.app-category.productivity",
         "icon": "icon.png"
       }
     }
   }
   ```

5. **Add app icon**
   - Place a 512×512+ `icon.png` in `desktop/`
   - For Windows, also provide `icon.ico` (use an online converter)

6. **Test locally**
   ```bash
   cd desktop
   npm start
   ```
   The app should open in an Electron window loading your hosted web app.

7. **Build Windows installer**
   ```bash
   npm run build:win
   ```
   Produces an `.exe` installer in `desktop/dist/`.

### Key Design Decision
The Electron app loads the **remote hosted URL** (not local files). Benefits:
- No need to bundle frontend assets into Electron
- App always shows the latest version (updates happen server-side)
- Same server, same code, same experience
- Dramatically simpler build and update process

### Deliverables
- [ ] `desktop/` directory with Electron project committed
- [ ] App opens in Electron window on Windows with full functionality
- [ ] Windows `.exe` installer builds successfully

---

## Epic 5: Desktop Notifications (Electron) 🖥️

**Objective:** Ensure native desktop notifications work in the Electron app.

**Complexity:** Easy · **Est. time:** 0.5 day

**Prerequisites:** Epic 4 complete

### Steps

1. **Test Browser Notification API**
   - The web app already uses `useBrowserNotifications.ts` for browser notifications
   - Electron supports the Browser Notification API natively
   - Run the Electron app, trigger a reminder, verify a desktop notification appears

2. **If notifications don't appear** — check Electron permissions:
   - Windows: ensure notification permissions are granted in Windows Settings → Notifications
   - Electron may need `Notification.permission` to be checked/requested

3. **Test WebSocket notifications**
   - Verify the notification bell updates in real-time via WebSocket
   - The WebSocket connection to the backend should work since we're loading a remote URL

4. **Optional: Tray icon (future enhancement)**
   - Add system tray icon with unread notification badge
   - Keep app running in background when window is closed

### Deliverables
- [ ] Desktop notifications appear when reminders fire
- [ ] WebSocket real-time notifications work in Electron
- [ ] Notifications respect OS notification settings

---

## Epic 6: Backend — CORS & Security for All Platforms 🖥️

**Objective:** Ensure the backend accepts requests from Capacitor mobile apps.

**Complexity:** Easy · **Est. time:** 0.5 day

**Prerequisites:** At least one mobile platform running (Epic 1)

### Steps

1. **Understand Capacitor origins**
   - **iOS Capacitor:** Requests come from `capacitor://localhost`
   - **Android Capacitor:** Requests come from `https://localhost` (because `androidScheme: 'https'` is set)
   - **Electron (remote URL):** No CORS change needed — requests originate from the web app's own domain

2. **Update Django CORS settings**
   - Add to `CORS_ALLOWED_ORIGINS` in `.env`:
     ```
     CORS_ALLOWED_ORIGINS=https://app.nudgly.com,capacitor://localhost,https://localhost
     ```
   - Alternatively, update `backend/config/settings.py` to include these origins

3. **Update WebSocket allowed origins**
   - In `backend/config/settings.py`, ensure the ASGI/Channels config allows WebSocket connections from Capacitor origins

4. **Deploy and test**
   - Deploy the updated backend to DigitalOcean
   - Test API calls from Android emulator → no CORS errors
   - Test WebSocket connection from Android emulator → notifications arrive

### Deliverables
- [ ] Backend CORS allows Capacitor origins
- [ ] No CORS errors from Android or iOS apps
- [ ] WebSocket notifications work from mobile apps

---

## Epic 7: iOS — Scaffold & Local Run 🍎

**Objective:** Get the app running on an iOS simulator from the Mac.

**Complexity:** Easy–Medium · **Est. time:** 1 day

**Prerequisites:**
- Mac with Xcode 15+ installed
- Apple Developer account ($99/year) — needed for physical device testing and distribution
- Repo cloned on Mac

### Steps

1. **Set up the Mac environment**
   ```bash
   # Install Xcode from Mac App Store (if not already)
   # Install Xcode command line tools
   xcode-select --install

   # Install CocoaPods (Capacitor iOS uses it)
   sudo gem install cocoapods
   ```

2. **Clone and set up the project**
   ```bash
   git clone <repo-url>
   cd nudgly/frontend
   npm ci
   npm run build
   ```

3. **Scaffold the iOS project**
   ```bash
   npx cap add ios
   npx cap sync ios
   ```
   This creates `frontend/ios/` with a full Xcode project.

4. **Open in Xcode**
   ```bash
   npx cap open ios
   ```

5. **Run on simulator**
   - In Xcode: select a simulator (e.g. iPhone 15) from the device dropdown
   - Click Run (▶️)
   - The app builds and launches in the iOS simulator

6. **Run on physical device** (requires Apple Developer account)
   - Connect iPhone via USB
   - In Xcode → Signing & Capabilities: select your Team, set Bundle Identifier to `com.nudgly.app`
   - Select the physical device and run

7. **Generate iOS icons** (if Epic 3 was done before iOS project existed)
   ```bash
   npx capacitor-assets generate
   npx cap sync ios
   ```

### Deliverables
- [ ] `frontend/ios/` directory exists and is committed
- [ ] App runs on iOS simulator with full functionality
- [ ] Navigation, auth, and real-time notifications work

---

## Epic 8: iOS Push Notifications (APNs + FCM) 🍎

**Objective:** Receive push notifications on iOS via Apple Push Notification service (APNs) through FCM.

**Complexity:** Medium–Hard · **Est. time:** 1–2 days

**Prerequisites:** Epic 7 complete, Firebase project (from Epic 2), physical iOS device (push doesn't work on simulator)

### Steps

1. **Create APNs Key in Apple Developer portal**
   - Go to https://developer.apple.com → Certificates, Identifiers & Profiles → Keys
   - Click (+) → check "Apple Push Notifications service (APNs)"
   - Download the `.p8` key file — **save it securely, you can only download it once**
   - Note the **Key ID** and your **Team ID**

2. **Upload APNs key to Firebase**
   - Firebase Console → Project Settings → Cloud Messaging → Apple app configuration
   - Upload the `.p8` file, enter Key ID and Team ID

3. **Add iOS app to Firebase**
   - In Firebase Console: Add app → iOS
   - Bundle ID: `com.nudgly.app`
   - Download `GoogleService-Info.plist`

4. **Add config to Xcode project**
   - Copy `GoogleService-Info.plist` to `frontend/ios/App/App/`
   - Add to `.gitignore`: `frontend/ios/App/App/GoogleService-Info.plist`

5. **Enable Push Notifications capability in Xcode**
   - Open Xcode → select the App target → Signing & Capabilities
   - Click "+ Capability" → add "Push Notifications"
   - Also add "Background Modes" → check "Remote notifications"

6. **Sync and build**
   ```bash
   cd frontend
   npx cap sync ios
   npx cap open ios
   ```
   Build and run on a **physical device** (push notifications require a real device).

7. **Test end-to-end**
   - Open the app on iPhone → it should prompt for notification permission
   - Grant permission → device token registers with backend
   - Create a task with a reminder
   - Wait for Celery Beat to fire → push notification should appear

### Deliverables
- [ ] APNs key created and uploaded to Firebase
- [ ] `GoogleService-Info.plist` in Xcode project (not committed)
- [ ] Push notification capability enabled in Xcode
- [ ] Push notifications arrive on physical iOS device

---

## Epic 9: Electron — macOS Desktop App 🍎

**Objective:** Build and test the Electron app on macOS.

**Complexity:** Easy · **Est. time:** 0.5 day

**Prerequisites:** Epic 4 complete (Electron project exists), Mac

### Steps

1. **Set up on Mac**
   ```bash
   cd nudgly/desktop
   npm ci
   ```

2. **Test locally**
   ```bash
   npm start
   ```
   Verify the app opens and works correctly on macOS.

3. **Build macOS installer**
   ```bash
   npm run build:mac
   ```
   Produces a `.dmg` file in `desktop/dist/`.

4. **Test the .dmg**
   - Open the `.dmg`, drag app to Applications
   - Launch from Applications
   - Verify full functionality including notifications

5. **Code signing (for distribution)**
   - For unsigned local use: macOS will warn "unidentified developer" — users can right-click → Open to bypass
   - For proper distribution: sign with Apple Developer certificate
     - Export Developer ID Application certificate from Keychain
     - Set env vars: `CSC_LINK` (path to .p12) and `CSC_KEY_PASSWORD`
     - Rebuild: `npm run build:mac`

### Deliverables
- [ ] Electron app runs on macOS
- [ ] `.dmg` installer builds successfully
- [ ] Desktop notifications work on macOS

---

## Epic 10: CI/CD — Automated Build Pipelines 🖥️🍎

**Objective:** Automate builds for all 4 platforms via GitHub Actions.

**Complexity:** Medium–Hard · **Est. time:** 2–3 days

**Prerequisites:** All platform epics complete (1–9)

### Android Build (`.github/workflows/build-android.yml`)

1. Trigger: on release tag (e.g. `v*`) or manual dispatch
2. Runner: `ubuntu-latest`
3. Steps:
   - Setup Java 17, Node 22
   - `cd frontend && npm ci && npm run build && npx cap sync android`
   - `cd android && ./gradlew assembleRelease` (or `bundleRelease` for AAB)
   - Upload APK/AAB as GitHub Actions artifact
4. Signing: store keystore as GitHub secret, reference in Gradle config

### iOS Build (`.github/workflows/build-ios.yml`)

1. Trigger: on release tag or manual dispatch
2. Runner: `macos-latest`
3. Steps:
   - Setup Node 22 (Xcode pre-installed on macOS runners)
   - `cd frontend && npm ci && npm run build && npx cap sync ios`
   - Build with `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -archivePath build/App.xcarchive archive`
   - Export IPA with `xcodebuild -exportArchive`
   - Upload IPA as artifact
4. Signing: store provisioning profile + certificate as GitHub secrets

### Windows Desktop Build (`.github/workflows/build-desktop-win.yml`)

1. Trigger: on release tag or manual dispatch
2. Runner: `windows-latest`
3. Steps:
   - Setup Node 22
   - `cd desktop && npm ci && npm run build:win`
   - Upload `.exe` installer as artifact

### macOS Desktop Build (`.github/workflows/build-desktop-mac.yml`)

1. Trigger: on release tag or manual dispatch
2. Runner: `macos-latest`
3. Steps:
   - Setup Node 22
   - `cd desktop && npm ci && npm run build:mac`
   - Sign with Apple certificate (GitHub secrets)
   - Upload `.dmg` as artifact

### Deliverables
- [ ] 4 GitHub Actions workflows created
- [ ] All builds produce downloadable artifacts
- [ ] Signing secrets configured in GitHub repo settings

---

## Epic 11: Google Play Submission 🖥️

**Objective:** Publish the Android app on Google Play Store.

**Complexity:** Medium · **Est. time:** 1–2 days

**Prerequisites:** Epic 2 complete (push working), Google Play Developer account ($25 one-time fee)

### Steps

1. **Create Google Play Developer account**
   - https://play.google.com/console → sign up and pay $25

2. **Generate release signing key**
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore nudgly-release.keystore -alias nudgly -keyalg RSA -keysize 2048 -validity 10000
   ```
   - **Store this keystore securely** — losing it means you can never update the app
   - Configure signing in `frontend/android/app/build.gradle`

3. **Build signed Android App Bundle**
   ```bash
   cd frontend/android
   ./gradlew bundleRelease
   ```
   Output: `app/build/outputs/bundle/release/app-release.aab`

4. **Create app in Google Play Console**
   - Create app → fill in: app name, default language, app type (app), free/paid
   - Complete the store listing: description, screenshots (phone + tablet), feature graphic, app icon
   - Set content rating (complete questionnaire)
   - Set up privacy policy URL

5. **Upload to internal testing**
   - Go to Testing → Internal testing → Create new release
   - Upload the `.aab` file
   - Add test email addresses
   - Roll out to internal testing

6. **Test via internal testing link**
   - Testers receive a Play Store link to install the app
   - Verify everything works on a real device

7. **Promote to production**
   - After successful testing, promote the release to Production
   - Google review typically takes a few hours to a few days

### Deliverables
- [ ] Google Play Developer account created
- [ ] Release keystore generated and securely stored
- [ ] App published to at least internal testing on Google Play
- [ ] Store listing complete with screenshots and privacy policy

---

## Epic 12: Apple App Store Submission 🍎

**Objective:** Publish the iOS app on the Apple App Store.

**Complexity:** Hard · **Est. time:** 2–3 days

**Prerequisites:** Epic 8 complete (push working on iOS), Apple Developer account ($99/year)

### Steps

1. **Create App ID and Provisioning Profiles**
   - Apple Developer portal → Identifiers → register App ID: `com.nudgly.app`
   - Create a Distribution provisioning profile (App Store type)
   - Download and install the profile in Xcode

2. **Prepare the app for release**
   - In Xcode: set version number and build number
   - Select "Any iOS Device" as build target
   - Product → Archive

3. **Upload to App Store Connect**
   - In Xcode Organizer: select the archive → Distribute App → App Store Connect
   - Or use `xcrun altool --upload-app`

4. **Configure App Store Connect listing**
   - Go to https://appstoreconnect.apple.com
   - Create a new app: name "Nudgly", bundle ID `com.nudgly.app`
   - Fill in:
     - Description, keywords, support URL, marketing URL
     - Screenshots for each required device size (6.7", 6.5", 5.5" at minimum)
     - App icon (1024×1024, no transparency, no rounded corners — Apple applies them)
     - Privacy policy URL
     - Age rating (complete questionnaire)
     - App Review information (demo account credentials, notes)

5. **Submit for TestFlight**
   - Select the uploaded build
   - Submit for Beta App Review (usually approved within a day)
   - Add internal testers → they get a TestFlight notification

6. **Test via TestFlight**
   - Install via TestFlight app on iPhone
   - Full end-to-end testing including push notifications

7. **Submit for App Store Review**
   - After TestFlight validation, submit the same build for full review
   - Apple review takes 1–3 days
   - Common rejection reasons to watch for:
     - Missing privacy policy
     - Login required but no demo account provided
     - Broken features or crashes
     - Incomplete metadata

### Deliverables
- [ ] App ID and provisioning profiles created
- [ ] App uploaded to App Store Connect
- [ ] Available on TestFlight for testing
- [ ] Submitted for App Store review

---

## Epic 13: Auto-Updates for Desktop (Optional, Post-Launch)

**Objective:** Enable automatic updates for Electron desktop apps.

**Complexity:** Medium · **Est. time:** 1 day

**Prerequisites:** Epics 4 + 9 complete

### Assessment

Since the Electron app loads a **remote URL**, the web content updates automatically when the server is redeployed. This means:

- **Web content updates:** Automatic — no action needed
- **Electron shell updates:** Only needed if changing Electron version, window behavior, or native features

If Electron shell updates are ever needed:

1. Install `electron-updater`: `npm install electron-updater`
2. Configure to check GitHub Releases for new versions
3. Add auto-update check on app startup in `main.js`
4. Publish new versions by creating GitHub Releases with build artifacts

**For MVP: this epic can be skipped.** The remote URL approach means the app auto-updates via server deployment.

### Deliverables
- [ ] Decision documented: skip for MVP (remote URL = auto-updating content)
- [ ] If needed later: `electron-updater` configured with GitHub Releases

---

## Recommended Execution Order

Group work by machine to minimize context-switching:

### Phase A: Windows PC Work (Epics 1–6)
| Order | Epic | Focus | Est. Time |
|-------|------|-------|-----------|
| 1 | Epic 1 | Android scaffold & run | 1 day |
| 2 | Epic 2 | Android push notifications | 1 day |
| 3 | Epic 3 | App icons & splash screens | 0.5 day |
| 4 | Epic 4 | Electron Windows desktop | 1–2 days |
| 5 | Epic 5 | Desktop notifications | 0.5 day |
| 6 | Epic 6 | Backend CORS updates | 0.5 day |

### Phase B: Mac Work (Epics 7–9)
| Order | Epic | Focus | Est. Time |
|-------|------|-------|-----------|
| 7 | Epic 7 | iOS scaffold & run | 1 day |
| 8 | Epic 8 | iOS push notifications | 1–2 days |
| 9 | Epic 9 | Electron macOS desktop | 0.5 day |

### Phase C: CI/CD & Distribution (Epics 10–12)
| Order | Epic | Focus | Est. Time |
|-------|------|-------|-----------|
| 10 | Epic 10 | CI/CD build pipelines | 2–3 days |
| 11 | Epic 11 | Google Play submission | 1–2 days |
| 12 | Epic 12 | Apple App Store submission | 2–3 days |

### Phase D: Optional
| Order | Epic | Focus | Est. Time |
|-------|------|-------|-----------|
| 13 | Epic 13 | Desktop auto-updates | Skip for MVP |

**Total estimated: ~13–18 days of work**

---

## Key Files Created/Modified

### New directories
- `frontend/android/` — Capacitor Android project (Epic 1)
- `frontend/ios/` — Capacitor iOS project (Epic 7)
- `frontend/resources/` — Icon and splash source assets (Epic 3)
- `desktop/` — Electron desktop app (Epic 4)
- `.github/workflows/build-*.yml` — Platform build pipelines (Epic 10)

### Modified files
- `backend/config/settings.py` — CORS origins (Epic 6)
- `.env` / `.env.example` — New env vars for FCM, CORS (Epics 2, 6)
- `.gitignore` — Exclude native build artifacts, signing keys, Firebase configs
- `frontend/capacitor.config.ts` — Potential plugin config additions

### Files NOT to commit (secrets)
- `google-services.json` (Android Firebase config)
- `GoogleService-Info.plist` (iOS Firebase config)
- `*.keystore` (Android signing key)
- `*.p8` (APNs key)
- `*.p12` (Apple signing certificate)
- Firebase service account JSON
