# CERTUS Frontend

React Native (Expo) mobile app for the insurance recommendation flow.

Four screens managed via local state (no backend required for the UI):

- **Home** -- onboarding with upload or manual entry options
- **Scanner** -- document upload with simulated AI extraction animation
- **Form** -- comprehensive insurance profile form grouped into cards, supports auto-fill from scanned data
- **Result** -- displays the predicted coverage bundle with SHAP-based AI explainability

## Run

```bash
npm install
npx expo start
```

Built with Expo SDK 54, React Navigation, and expo-document-picker.

