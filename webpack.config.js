'use strict';

const path = require('path');
const webpack = require('webpack');

module.exports = (env) => {
  const minimize = env && env.production;
  const node = env && env.node;
  const file = minimize ? 'webrtc-stats-gatherer.min' : 'webrtc-stats-gatherer';
  const extension = node ? '.cjs' : '.js';
  const filename = file + extension;

  return {
    target: node ? 'node' : 'web',
    entry: './src/StatsGatherer.js',
    devtool: 'source-map',
    mode: process.env.MINIMIZE ? 'production' : 'development',
    optimization: {
      minimize
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename,
      library: 'webrtc-troubleshooter',
      libraryTarget: 'umd'
    },
    plugins: [
      new webpack.DefinePlugin({ 'global.GENTLY': false })
    ],
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          query: {
            presets: ['env']
          }
        }
      ]
    }
  };
};
