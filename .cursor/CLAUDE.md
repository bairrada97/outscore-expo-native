## Architecture

- **Website:** Expo Router website with Tailwind + HeroUI Web.
- **Native app:** Expo Router app with CNG + HeroUI Native.
- **Secrets:** Use .env files and API routes for secret management. Never use `EXPO_PUBLIC_` prefix for sensitive data.

## Code Style

- Use TypeScript whenever possible.
- Use kebab-case for all file names. Avoid capital letters.
- Use `@/` path aliases for imports.
- Use root src directory.

## CLI

- Install packages: npx expo install
- Ensure the rules of React are enforced: npx expo lint
- Create native modules: npx create-expo-module --local
- Deploy iOS: npx testflight
- Deploy Android: eas build -p android -s
- Deploy web and server: npx expo export -p web && eas deploy

## Extra rules

- Use { display: contents } style for intercepting events w/o changing layout.
- Prefer CSS boxShadow to RN legacy shadow props.
- Use Biome for linting