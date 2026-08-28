import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execFileSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";

function buildIdentifier() {
  const environmentSha = [
    process.env.VITE_APP_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.SOURCE_VERSION,
  ].find(Boolean);

  if (environmentSha) return environmentSha.slice(0, 12);

  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return `build-${new Date().toISOString().replace(/\D/g, "").slice(0, 12)}`;
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const builtAt = process.env.VITE_BUILD_TIMESTAMP || new Date().toISOString();

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildIdentifier()),
      __APP_BUILD_TIME__: JSON.stringify(builtAt),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0"),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
