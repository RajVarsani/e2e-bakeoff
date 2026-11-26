import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ports, urls } from "../../ports";
export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(urls.api),
    "import.meta.env.VITE_CRM_URL": JSON.stringify(urls.crm),
  },
  server: { host: "127.0.0.1", port: ports.admin, strictPort: true, allowedHosts: [".localhost"] },
});
