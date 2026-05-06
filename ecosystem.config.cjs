module.exports = {
  apps: [
    {
      name: "property-bot",
      script: "artifacts/api-server/dist/index.mjs",
      node_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
  ],
};
