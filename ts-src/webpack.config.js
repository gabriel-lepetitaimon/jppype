const path = require("path");
const version = require("./package.json").version;

// Custom webpack rules are generally the same for all webpack bundles, hence
// stored in a separate local variable.
const rules = [
  { test: /\.ts$/, loader: "ts-loader" },
  { test: /\.[t|j]sx$/, loader: "babel-loader" },
  { test: /\.js$/, loader: "source-map-loader" },
  { test: /\.css$/, use: ["style-loader", "css-loader"] },
];

module.exports = (env, argv) => {
  const devtool = argv.mode === "development" ? "source-map" : false;
  // Packages that shouldn't be bundled but loaded at runtime
  // 'module' is the magic requirejs dependency used to set the publicPath
  const externals = ["@jupyter-widgets/base", "module"];

  const resolve = {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".webpack.js", ".web.js", ".ts", ".js", ".tsx", "jsx"],
  };

  return [
    /**
     * Notebook extension
     *
     * This bundle only contains the part of the JavaScript that is run on load of
     * the notebook.
     */
    {
      entry: "./src/extension.ts",
      output: {
        filename: "index.js",
        path: path.resolve(__dirname, "..", "jppype", "nbextension", "static"),
        libraryTarget: "amd",
        publicPath: "",
      },
      module: {
        rules: rules,
      },
      devtool: "source-map",
      externals,
      resolve,
    },
    {
      // Bundle for the notebook containing the custom widget views and models
      //
      // This bundle contains the implementation for the custom widget views and
      // custom widget.
      // It must be an amd module
      entry: ["./amd-public-path.js", "./src/index.ts"],
      output: {
        filename: "index.js",
        path: path.resolve(__dirname, "..", "jppype", "nbextension"),
        libraryTarget: "amd",
        publicPath: "", // Set in amd-public-path.js
      },
      devtool,
      module: {
        rules: rules,
      },
      externals,
      resolve,
    },
    /**
     * Embeddable jppype bundle
     *
     * This bundle is almost identical to the notebook extension bundle. The only
     * difference is in the configuration of the webpack public path for the
     * static assets.
     *
     * The target bundle is always `dist/index.ts`, which is the path required by
     * the custom widget embedder.
     */
    {
      entry: ["./amd-public-path.js", "./src/index.ts"],
      output: {
        filename: "index.ts",
        path: path.resolve(__dirname, "dist"),
        libraryTarget: "amd",
        library: "jppype",
        publicPath: "", // Set in amd-public-path.js
      },
      devtool: "source-map",
      module: {
        rules: rules,
      },
      // 'module' is the magic requirejs dependency used to set the publicPath
      externals,
      resolve,
    },
  ];
};
