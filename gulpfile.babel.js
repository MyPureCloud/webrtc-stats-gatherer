'use strict';

const gulp = require('gulp');
const mocha = require('gulp-mocha');
const istanbul = require('gulp-istanbul');
const isparta = require('isparta');
const runSequence = require('run-sequence');

// Transform all required files with Babel
require('babel-core/register');

// Files to process
const TEST_FILES = 'tests/test.js';

/*
 * Instrument files using istanbul and isparta
 */
gulp.task('coverage:instrument', function() {
  // Use the isparta instrumenter (code coverage for ES6)
  // Istanbul configuration (see https://github.com/SBoudrias/gulp-istanbul#istanbulopt)
  return gulp.src(TEST_FILES)
    .pipe(istanbul({
      instrumenter: isparta.Instrumenter
    }))
    .pipe(istanbul.hookRequire()); // Force `require` to return covered files
});

/*
 * Write coverage reports after test success
 */
gulp.task('coverage:report', function(done) {
  // Istanbul configuration (see https://github.com/SBoudrias/gulp-istanbul#istanbulwritereportsopt)
  return gulp.src(TEST_FILES, {read: false})
    .pipe(istanbul.writeReports({}))
    .pipe(istanbul.enforceThresholds({ thresholds: { global: 100 } }));;
});

gulp.task('test:coverage', function(done) {
  runSequence('coverage:instrument', 'coverage:report', done);
});