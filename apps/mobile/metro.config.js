// Metro bundler config for the monorepo-hosted mobile app.
// Ensures Metro can resolve workspace packages (`@housepoints/theme`,
// `@housepoints/contracts`) and root-hoisted node_modules, and watches the
// repo root so changes in shared packages hot-reload the app.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
