# ORBI mobile

Expo (SDK 58) Android app. Requires a **development build**; MapLibre Native does not run in Expo Go.

See the root README for setup. Quick start:

```bash
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your computer LAN IP
pnpm android           # builds and installs the dev build (needs Android SDK + JDK)
pnpm dev               # starts Metro for an installed dev build
```
