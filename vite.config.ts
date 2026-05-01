import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
          react(),
          VitePWA({
                  registerType: "autoUpdate",
                  includeAssets: ["favicon.ico", "icons/*.png"],
                  manifest: {
                            name: "Lobo Marley Frotas",
                            short_name: "LM Frotas",
                            description: "Sistema de gestao de frotas Lobo Marley",
                            theme_color: "#1a1a2e",
                            background_color: "#ffffff",
                            display: "standalone",
                            orientation: "portrait",
                            scope: "/",
                            start_url: "/",
                            icons: [
                              {
                                            src: "/icons/icon-192x192.png",
                                            sizes: "192x192",
                                            type: "image/png",
                                            purpose: "any maskable",
                              },
                              {
                                            src: "/icons/icon-512x512.png",
                                            sizes: "512x512",
                                            type: "image/png",
                                            purpose: "any maskable",
                              },
                                      ],
                  },
                  workbox: {
                            globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
                            runtimeCaching: [
                              {
                                            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                                            handler: "NetworkFirst",
                                            options: {
                                                            cacheName: "supabase-cache",
                                                            expiration: {
                                                                              maxEntries: 50,
                                                                              maxAgeSeconds: 60 * 60 * 24,
                                                            },
                                            },
                              },
                                      ],
                  },
          }),
        ],
    resolve: {
          alias: {
                  "@": path.resolve(__dirname, "./src"),
          },
    },
});
