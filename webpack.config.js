const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env = {}) => {
  const browser = env.browser || 'chrome';
  const isFirefox = browser === 'firefox';

  return {
    entry: {
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      popup: './src/popup/index.tsx',
      options: './src/options/index.tsx',
      'workers/ocr-worker': './src/workers/ocr-worker.ts',
      'workers/inpaint-worker': './src/workers/inpaint-worker.ts',
    },
    output: {
      path: path.resolve(__dirname, `dist/${browser}`),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              // Only compile src files, exclude test files from webpack
              configFile: 'tsconfig.json',
              reportFiles: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/__tests__/**'],
            },
          },
          exclude: [/node_modules/, /\.test\.tsx?$/, /__tests__/],
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
        },
        {
          test: /\.(png|jpg|gif|svg|woff2?)$/,
          type: 'asset/resource',
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: '[name].css' }),
      new HtmlWebpackPlugin({
        template: './src/popup/popup.html',
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      new HtmlWebpackPlugin({
        template: './src/options/options.html',
        filename: 'options.html',
        chunks: ['options'],
      }),
      new CopyPlugin({
        patterns: [
          {
            from: isFirefox ? 'src/manifest.firefox.json' : 'src/manifest.json',
            to: 'manifest.json',
          },
          { from: 'src/assets', to: 'assets' },
        ],
      }),
    ],
    optimization: {
      splitChunks: {
        chunks: (chunk) => !chunk.name?.startsWith('workers/'),
      },
    },
  };
};
