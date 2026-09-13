const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

/**
 * The web and mobile workspaces intentionally use different React versions:
 * Next.js uses the root copy while Expo SDK 54 requires React 19.1. Metro can
 * otherwise resolve React imports from hoisted dependencies to the web copy,
 * producing two React runtimes and an immediate invalid-hook crash in release
 * builds. Route every React import in the native bundle to mobile's copy.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return context.resolveRequest(
      context,
      require.resolve(moduleName, { paths: [__dirname] }),
      platform,
    );
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
