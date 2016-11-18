'use strict';

const gulp = require('gulp');
const mocha = require('gulp-mocha');
const istanbul = require('gulp-istanbul');
const isparta = require('isparta');
const runSequence = require('run-sequence');
const rimraf = require('gulp-rimraf');
const gutil = require('gulp-util');


// Transform all required files with Babel
require('babel-core/register');

// Files to process
const TEST_FILES = './test/test.js';
const JS_FILES  = './src/StatsGatherer.js';
let FILES = [TEST_FILES, JS_FILES];
const COVERAGE = './coverage';
let REPORTS = [ 'lcov', 'json', 'text', 'text-summary' ];

/**
 * Remove coverage folder on each run.
 */
gulp.task('delete:coverage', () => {
  return gulp.src(COVERAGE)
    .pipe(rimraf());
});

/*
 * Instrument files using istanbul and isparta
 */
gulp.task('coverage:instrument', () => {
  // Use the isparta instrumenter (code coverage for ES6)
  // Istanbul configuration (see https://github.com/SBoudrias/gulp-istanbul#istanbulopt)
  return gulp.src(FILES)
    .pipe(istanbul({
      instrumenter: isparta.Instrumenter,
      includeUntested: true
    }))
    .pipe(istanbul.hookRequire()); // Force `require` to return covered files
});

/*
 * Write coverage reports after test success
 */
gulp.task('coverage:report', done => {
  // Istanbul configuration (see https://github.com/SBoudrias/gulp-istanbul#istanbulwritereportsopt)
  gulp.src(FILES)
    .pipe(istanbul.writeReports({
      dir: COVERAGE,
      reporters: REPORTS,
      reportOpts: { 
        dir: COVERAGE 
      }
    }))
    .on('error', gutil.log)
    .pipe(istanbul.enforceThresholds({ 
      thresholds: {
        global: {
          statements: 17,
          branches: 26,
          lines: 1,
          functions: 29
        }
      } 
    }))
    .on('finish', done);
});

gulp.task('test:coverage', done => {
  runSequence('delete:coverage', 'coverage:instrument', 'coverage:report', done);
});