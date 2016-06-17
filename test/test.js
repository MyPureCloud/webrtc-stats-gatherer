/* global describe, it, beforeEach */

import { assert } from 'chai';
import sinon from 'sinon';
import StatsGatherer from '../src/StatsGatherer';
// import mockInitialStats from './mock-initial-stats.json';
import mockStats1 from './mock-stats-1.json';
import mockStats2 from './mock-stats-2.json';

describe('StatsGatherer', function () {
  let rtcPeerConnection;

  beforeEach(function () {
    rtcPeerConnection = {
      on: function () {},
      pc: {
        peerconnection: {
          getStats: () => Promise.resolve(mockStats1)
        }
      }
    };
  });

  describe('constructor', function () {
    it('should accept options and initialize the class', function () {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      assert.equal(gatherer.connection, rtcPeerConnection);
      assert.equal(gatherer.statsInterval, 5000);
      assert.deepEqual(gatherer.traceData, []);
    });
  });

  describe('_gatherStats', function () {
    it('should call into the native getstats method', function (done) {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      sinon.stub(gatherer.connection.pc.peerconnection, 'getStats', function () {
        done();
      });
      gatherer._gatherStats();
    });
  });

  describe('_createStatsReport', function () {
    it('should create a report', function () {
      const opts = {
        session: {},
        conference: {}
      };
      const gatherer = new StatsGatherer(rtcPeerConnection, opts);
      const report1 = gatherer._createStatsReport(mockStats1, true);

      assert.ok(report1);
      assert.equal(report1.name, 'getStats');
      assert.deepEqual(report1.session, opts.session);
      assert.deepEqual(report1.conference, opts.conference);

      assert.equal(report1.tracks.length, 0);

      const report2 = gatherer._createStatsReport(mockStats2, true);
      assert.ok(report2);
      assert.equal(report2.name, 'getStats');
      assert.deepEqual(report2.session, opts.session);
      assert.deepEqual(report2.conference, opts.conference);

      assert.equal(report2.tracks.length, 2);

      const audioTrack = report2.tracks[0];
      assert.ok(audioTrack.track);
      assert.ok(audioTrack.bitrate);
      assert.equal(audioTrack.kind, 'audio');
      assert.equal(audioTrack.lost, 0);
      assert.equal(audioTrack.loss, 0);
      assert.equal(audioTrack.muted, false);

      const videoTrack = report2.tracks[1];
      assert.ok(videoTrack.track);
      assert.ok(videoTrack.bitrate);
      assert.equal(videoTrack.kind, 'video');
      assert.equal(videoTrack.lost, 100);
      assert.equal(videoTrack.loss, 7);
      assert.equal(videoTrack.muted, false);
    });

    it('should properly determine a track kind');
    it('should determine bitrate accurately');
    it('should determine the track kind from the code type if not available otherwise');
  });

  describe('collectStats', function () {
    it('should setup a polling interval when connected');
    it('should emit a stats event if already disconnected');
  });

  describe('collectInitialConnectionStats', function () {
    it('should get emit a stats event with all of the initial connection information');
    it('should emit a failure report if the state is failed');
  });

  describe('collectTraces', function () {
    it('should get all the trace data from the traceable connection and emit a report');
  });
});
