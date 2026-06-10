import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/app": path.resolve(__dirname, "./src/app"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
      "@/features": path.resolve(__dirname, "./src/features"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://apibttd.ximangtaydo.vn",
        changeOrigin: true,
        secure: true,
        onProxyReq: (proxyReq, req) => {
          // Forward Authorization header explicitly
          const authHeader = req.headers["authorization"];
          if (authHeader) {
            proxyReq.setHeader("Authorization", authHeader);
          }
        },
      },
    },
  },
});
