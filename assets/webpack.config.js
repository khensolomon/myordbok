const path = require('path');
const BundleTracker = require('webpack-bundle-tracker');
const { VueLoaderPlugin } = require('vue-loader');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  // The base directory for resolving entry points and loaders
  context: __dirname,
  mode: 'development',

  // The entry point for your application
  entry: {
    // The key 'main' is what we will reference in Django templates
    main: './webpack/index.js'
  },

  // How and where webpack emits results
  output: {
    // The target directory for all output files
    // path: path.resolve(__dirname, '../core/static/core/bundles/'),
    // path: path.resolve(__dirname, '/static/bundles/'),

    // The physical path where compiled files will be placed.
    // We'll use a new 'dist' folder inside 'assets'.
    // path: path.resolve(__dirname, 'dist/'),
    path: path.resolve(__dirname, '../static/'),

    // The public URL of the output directory when referenced in a browser
    // Must match Django's STATIC_URL + BUNDLE_DIR_NAME
    // publicPath: '/static/core/bundles/',
    // publicPath: '/static/bundles/',
    // The public URL path. This MUST match Django's STATIC_URL.
    publicPath: '',
    
    // Use [name]-[fullhash] for long-term caching. Django-webpack-loader needs this.
    filename: '[name]-[fullhash].js',
    assetModuleFilename: 'assets/[name]-[hash][ext]', // Organize assets into a subfolder
    clean: true,
  },

  resolve: {
    extensions: ['.js', '.vue', '.json'],
    alias: {
      // Use the bundler-aware version of Vue
      'vue$': 'vue/dist/vue.esm-bundler.js'
    }
  },

  plugins: [
    // This plugin is essential for django-webpack-loader to work.
    new BundleTracker({
      path: path.resolve(__dirname, '../static/'),
      filename: 'webpack-stats.json'
    }),
    
    // This plugin is required to handle .vue files
    new VueLoaderPlugin(),

    // This plugin extracts CSS into separate files.
    new MiniCssExtractPlugin({ 
      filename: '[name]-[fullhash].css' 
    }),
  ],

  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },
      {
        test: /\.(sa|sc|c)ss$/i,
        use: [
          // Extracts CSS into a file instead of injecting it into the DOM
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ]
      },
      {
        // Rule for handling image and font files
        test: /\.(png|ico|jpg|gif|svg|eot|ttf|woff|woff2|webmanifest)$/,
        type: 'asset/resource',
        generator: {
					filename: "[name][ext]"
				}
      }
    ]
  },
};

