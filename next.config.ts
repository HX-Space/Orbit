import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx", "exceljs"],
  // The Strategy download reads the client's Excel template from disk.
  outputFileTracingIncludes: {
    "/api/admin/strategy/template": ["./templates/alpha-strategy-template.xlsx"],
  },
};

export default nextConfig;
