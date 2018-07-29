'use strict';

const path = require('path');

module.exports = {
  target: 'node',
  entry: './src/StatsGatherer.js',
  devtool: 'source-map',
  mode: process.env.MINIMIZE ? 'production' : 'development',
  optimization: {
    minimize: !!process.env.MINIMIZE
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: process.env.MINIMIZE ? 'webrtc-stats-gatherer.min.js' : 'webrtc-stats-gatherer.js',
    library: 'webrtc-troubleshooter',
    libraryTarget: 'umd'
  },
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
