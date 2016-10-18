/* global describe, it, beforeEach */

if (typeof window === 'undefined') {
  GLOBAL.window = {
    navigator: {
      userAgent: 'user-agent',
      hardwareConcurrency: 8,
      platform: 'tests'
    },
    performance: {
      now: () => new Date().getTime()
    }
  };
}

import { assert } from 'chai';
import sinon from 'sinon';
import StatsGatherer from '../src/StatsGatherer';
import mockInitialStats from './mock-initial-stats.json';
import mockStats1 from './mock-stats-1.json';
import mockStats2 from './mock-stats-2.json';
import mockSdp from './mock-sdp.json';
import { EventEmitter } from 'events';

describe('StatsGatherer', function () {
  let rtcPeerConnection;

  beforeEach(function () {
    rtcPeerConnection = new EventEmitter();
    rtcPeerConnection.pc = {
      peerconnection: {
        getStats: () => Promise.resolve(mockStats1)
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
    let opts, gatherer, report1, report2;

    beforeEach(function () {
      opts = {
        session: {},
        conference: {}
      };
      gatherer = new StatsGatherer(rtcPeerConnection, opts);
    });

    describe('intervalLoss', function () {
      it('should generate intervalLoss', function () {
        const stats1 = {
          'ssrc_2422518318_recv': {
            'id': 'ssrc_2422518318_recv',
            'timestamp': '2016-06-17T12:22:21.374Z',
            'type': 'ssrc',
            'packetsLost': '0',
            'packetsReceived': '0',
            'ssrc': '2422518318',
            'googTrackId': 'c25d5324-45ef-4653-8444-25b468afa76b',
            'transportId': 'Channel-video-1',
            'mediaType': 'audio',
            'googCodecName': 'opus',
            'bytesReceived': '0'
          }
        };

        const stats2 = {
          'ssrc_2422518318_recv': {
            'id': 'ssrc_2422518318_recv',
            'timestamp': '2016-06-17T12:22:21.374Z',
            'type': 'ssrc',
            'packetsLost': '100',
            'packetsReceived': '1000',
            'ssrc': '2422518318',
            'googTrackId': 'c25d5324-45ef-4653-8444-25b468afa76b',
            'transportId': 'Channel-video-1',
            'mediaType': 'audio',
            'googCodecName': 'opus',
            'bytesReceived': '0'
          }
        };

        const stats3 = {
          'ssrc_2422518318_recv': {
            'id': 'ssrc_2422518318_recv',
            'timestamp': '2016-06-17T12:22:21.374Z',
            'type': 'ssrc',
            'packetsLost': '400',
            'packetsReceived': '2000',
            'ssrc': '2422518318',
            'googTrackId': 'c25d5324-45ef-4653-8444-25b468afa76b',
            'transportId': 'Channel-video-1',
            'mediaType': 'audio',
            'googCodecName': 'opus',
            'bytesReceived': '0'
          }
        };

        report1 = gatherer._createStatsReport(stats1, true);
        report2 = gatherer._createStatsReport(stats2, true);
        let report3 = gatherer._createStatsReport(stats3, true);

        assert.equal(report2.remoteTracks[0].intervalLoss, 10);
        assert.equal(report3.remoteTracks[0].intervalLoss, 30);
      });
    });

    describe('basic stats checking', function () {
      beforeEach(function () {
        report1 = gatherer._createStatsReport(mockStats1, true);
        report2 = gatherer._createStatsReport(mockStats2, true);
      });

      it('should create a report', function () {
        assert.ok(report1);
        assert.equal(report1.name, 'getStats');
        assert.deepEqual(report1.session, opts.session);
        assert.deepEqual(report1.conference, opts.conference);
        assert.equal(report1.tracks.length, 0);

        assert.ok(report2);
        assert.equal(report2.name, 'getStats');
        assert.deepEqual(report2.session, opts.session);
        assert.deepEqual(report2.conference, opts.conference);
        assert.equal(report2.tracks.length, 2);
      });

      it('should accurately get track properties for the report', function () {
        const audioTrack = report2.tracks[0];
        assert.ok(audioTrack.track);
        assert.ok(audioTrack.bitrate);
        assert.equal(isNaN(audioTrack.bitrate), false);
        assert.equal(audioTrack.kind, 'audio');
        assert.equal(audioTrack.lost, 18);
        assert.equal(audioTrack.loss, 0);
        assert.equal(audioTrack.muted, false);

        const videoTrack = report2.tracks[1];
        assert.ok(videoTrack.track);
        assert.ok(videoTrack.bitrate);
        assert.equal(isNaN(videoTrack.bitrate), false);
        assert.equal(videoTrack.kind, 'video');
        assert.equal(videoTrack.lost, 10000);
        assert.equal(videoTrack.loss, 8);
        assert.equal(videoTrack.muted, false);
      });

      it('should include remote tracks', function () {
        assert.equal(report2.remoteTracks.length, 2);

        const audioTrack = report2.remoteTracks[0];
        assert.ok(audioTrack.track);
        assert.ok(audioTrack.bitrate);
        assert.equal(isNaN(audioTrack.bitrate), false);
        assert.equal(audioTrack.kind, 'audio');
        assert.equal(audioTrack.lost, 23);
        assert.equal(audioTrack.loss, 0);
        assert.equal(audioTrack.muted, false);

        const videoTrack = report2.remoteTracks[1];
        assert.ok(videoTrack.track);
        assert.ok(videoTrack.bitrate);
        assert.equal(isNaN(videoTrack.bitrate), false);
        assert.equal(videoTrack.kind, 'video');
        assert.equal(videoTrack.lost, 2521);
        assert.equal(videoTrack.loss, 2);
        assert.equal(videoTrack.muted, false);
      });

      it('should properly determine a track kind');
      it('should determine bitrate accurately');
      it('should determine the track kind from the code type if not available otherwise');
    });
  });

  describe('collectStats', function () {
    it('should setup a polling interval when connected');
    it('should emit a stats event if already disconnected');
  });

  describe('collectInitialConnectionStats', function () {
    let opts, gatherer;

    beforeEach(function () {
      opts = {
        session: {},
        conference: {}
      };
      gatherer = new StatsGatherer(rtcPeerConnection, opts);
    });

    it('should get emit a stats event with all of the initial connection information', function (done) {
      sinon.stub(gatherer, '_gatherStats').returns(Promise.resolve(mockInitialStats));
      gatherer.on('stats', function (stats) {
        assert.ok(stats.userAgent);
        assert.ok(stats.platform);
        assert.ok(stats.cores);
        done();
      });
      gatherer.collectInitialConnectionStats();
      gatherer.connection.iceConnectionState = 'connected';
      gatherer.connection.emit('iceConnectionStateChange');
    });

    it('should emit a failure report if the state is failed', function (done) {
      sinon.stub(gatherer, '_gatherStats').returns(Promise.resolve(mockStats1));
      gatherer.on('stats', function (event) {
        assert.equal(event.name, 'failure');
        try {
          assert.ok(event.numLocalHostCandidates > 0, 'has local host candidates');
          assert.ok(event.numLocalSrflxCandidates > 0, 'has local srflx candidates');
          assert.ok(event.numLocalRelayCandidates > 0, 'has local relay candidates');
          assert.ok(event.numRemoteHostCandidates > 0, 'has remote host candidates');
          assert.ok(event.numRemoteSrflxCandidates > 0, 'has remote srflx candidates');
          assert.ok(event.numRemoteRelayCandidates > 0, 'has remote relay candidates');
          done();
        } catch (e) {
          done(e);
        }
      });
      gatherer.collectInitialConnectionStats();
      gatherer.connection.iceConnectionState = 'failed';
      gatherer.connection.pc = {
        localDescription: { sdp: mockSdp.sdp },
        remoteDescription: { sdp: mockSdp.sdp }
      };
      gatherer.connection.emit('iceConnectionStateChange');
    });
  });

  describe('collectTraces', function () {
    it('should get all the trace data from the traceable connection and emit a report');
  });
});
