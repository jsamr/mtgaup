const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: "production",
  target: "node",
  entry: {
    app: ["./index.js"]
  },
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "mtgaup"
  },
  plugins: [
    new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true }),
  ]
};