const {
  expoRouterBabelPlugin,
} = require("babel-preset-expo/build/expo-router-plugin");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // In this npm workspace, babel-preset-expo is hoisted while expo-router
      // is installed in the mobile workspace. The preset cannot discover the
      // nested package, so register its Router transform explicitly.
      expoRouterBabelPlugin,
      // react-native-reanimated/plugin MUST be last in the plugins list.
      "react-native-reanimated/plugin",
    ],
  };
};
