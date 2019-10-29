/* global describe, it, beforeEach, afterEach */

import { assert } from 'chai';
import sinon from 'sinon';
import StatsGatherer from '../src/StatsGatherer';

import mockSpecStatsInitial from './mock-spec-stats-initial.json';
import mockSpecStats1 from './mock-spec-stats-1.json';
import mockSpecStats2 from './mock-spec-stats-2.json';
import mockSpecStats3 from './mock-spec-stats-3.json';
import mockStatsRecvOnly from './mock-spec-stats-recvonly.json';
import mockSdp from './mock-sdp.json';
import { EventEmitter } from 'events';

if (typeof window === 'undefined') {
  global.window = {
    navigator: {
      userAgent: 'user-agent',
      hardwareConcurrency: 8,
      platform: 'tests'
    },
    performance: {
      now: () => new Date().getTime()
    },
    location: { 'host': 'localhost', 'protocol': 'http' }
  };

  global.window.setTimeout = setTimeout.bind(global.window);
  global.window.setInterval = setInterval.bind(global.window);
  global.window.clearInterval = clearInterval.bind(global.window);
}

class MockRtcPeerConnection extends EventEmitter {
  constructor () {
    super(...arguments);
    this._localStreams = [];
  }
  getLocalStreams () {
    return this._localStreams;
  }
}

describe('StatsGatherer', function () {
  let rtcPeerConnection;

  const suites = [
    // [mockInitialStats, mockStats1, mockStats2, mockStats3],
    // [mockInitialStatsSpec, mockStats1Spec, mockStats2Spec, mockStats3Spec],
    [mockSpecStatsInitial, mockSpecStats1, mockSpecStats2, mockSpecStats3]
  ];

  suites.forEach(function ([mockInitialStats, mockStats1, mockStats2, mockStats3]) {
    beforeEach(function () {
      rtcPeerConnection = new MockRtcPeerConnection();
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
      it('should call into the native getstats method', function () {
        const gatherer = new StatsGatherer(rtcPeerConnection);
        sinon.stub(gatherer.connection.pc.peerconnection, 'getStats').callsFake(() => {
          return Promise.resolve(mockStats1);
        });
        return gatherer._gatherStats();
      });
    });

    describe('_createStatsReport', function () {
      let opts, gatherer, report1, report2, report3;

      beforeEach(function () {
        opts = {
          session: {},
          conference: {}
        };
        gatherer = new StatsGatherer(rtcPeerConnection, opts);
      });

      describe('intervalLoss', function () {
        it('should generate intervalLoss', function () {
          const stats1 = [{
            'key': 'RTCRemoteInboundRtpAudioStream_545464236',
            'value': {
              'id': 'RTCRemoteInboundRtpAudioStream_545464236',
              'timestamp': 1571687960465.791,
              'type': 'remote-inbound-rtp',
              'ssrc': 545464236,
              'kind': 'audio',
              'transportId': 'RTCTransport_audio_1',
              'codecId': 'RTCCodec_audio_Outbound_111',
              'packetsLost': 1,
              'jitter': 0.0017708333333333332,
              'localId': 'RTCOutboundRTPAudioStream_545464236',
              'roundTripTime': 0.052
            }
          }, {
            'key': 'RTCOutboundRTPAudioStream_545464236',
            'value': {
              'id': 'RTCOutboundRTPAudioStream_545464236',
              'timestamp': 1571687966413.522,
              'type': 'outbound-rtp',
              'ssrc': 545464236,
              'isRemote': false,
              'mediaType': 'audio',
              'kind': 'audio',
              'trackId': 'RTCMediaStreamTrack_sender_1',
              'transportId': 'RTCTransport_audio_1',
              'codecId': 'RTCCodec_audio_Outbound_111',
              'mediaSourceId': 'RTCAudioSource_1',
              'packetsSent': 2481,
              'retransmittedPacketsSent': 18,
              'bytesSent': 210799,
              'retransmittedBytesSent': 0
            }
          }];

          const stats2 = [{
            'key': 'RTCRemoteInboundRtpAudioStream_545464236',
            'value': {
              'id': 'RTCRemoteInboundRtpAudioStream_545464236',
              'timestamp': 1571687961465.791,
              'type': 'remote-inbound-rtp',
              'ssrc': 545464236,
              'kind': 'audio',
              'transportId': 'RTCTransport_audio_1',
              'codecId': 'RTCCodec_audio_Outbound_111',
              'packetsLost': 61,
              'jitter': 0.0017708333333333332,
              'localId': 'RTCOutboundRTPAudioStream_545464236',
              'roundTripTime': 0.052
            }
          }, {
            'key': 'RTCOutboundRTPAudioStream_545464236',
            'value': {
              'id': 'RTCOutboundRTPAudioStream_545464236',
              'timestamp': 1571687967413.522,
              'type': 'outbound-rtp',
              'ssrc': 545464236,
              'isRemote': false,
              'mediaType': 'audio',
              'kind': 'audio',
              'trackId': 'RTCMediaStreamTrack_sender_1',
              'transportId': 'RTCTransport_audio_1',
              'codecId': 'RTCCodec_audio_Outbound_111',
              'mediaSourceId': 'RTCAudioSource_1',
              'packetsSent': 3481,
              'retransmittedPacketsSent': 18,
              'bytesSent': 210799,
              'retransmittedBytesSent': 0
            }
          }];

          gatherer._createStatsReport(stats1, true);
          const report2 = gatherer._createStatsReport(stats2, true);
          assert.equal(report2.tracks[0].intervalPacketLoss, 6);
        });
      });

      describe('basic stats checking', function () {
        beforeEach(function () {
          report1 = gatherer._createStatsReport(mockStats1, true);
          report2 = gatherer._createStatsReport(mockStats2, true);
          report3 = gatherer._createStatsReport(mockStats3, true);
        });

        it('should create a report', function () {
          assert.ok(report1);
          assert.equal(report1.name, 'getStats');
          assert.deepEqual(report1.session, opts.session);
          assert.deepEqual(report1.conference, opts.conference);
          assert.equal(report1.tracks.length, 2);
          assert.equal(report1.networkType, 'ethernet');
          assert.equal(report1.localCandidateChanged, false);
          assert.equal(report1.candidatePair, 'prflx;host');

          assert.ok(report2);
          assert.equal(report2.name, 'getStats');
          assert.deepEqual(report2.session, opts.session);
          assert.deepEqual(report2.conference, opts.conference);
          assert.equal(report2.tracks.length, 2);
          // report 2 has same candidates
          assert.equal(report2.localCandidateChanged, false);
          assert.equal(report2.networkType, 'ethernet');
          assert.equal(report2.candidatePair, 'prflx;host');
          assert.equal(report2.candidatePairHadActiveSource, true);

          assert.ok(report3);
          assert.equal(report3.name, 'getStats');
          assert.deepEqual(report3.session, opts.session);
          assert.deepEqual(report3.conference, opts.conference);
          assert.equal(report3.tracks.length, 0);
          // report 3 has different candidates
          assert.equal(report3.localCandidateChanged, true);
          assert.equal(report2.networkType, 'ethernet');
          assert.equal(report2.candidatePair, 'prflx;host');
        });

        it('should accurately get track properties for the report', function () {
          const audioTrack = report2.tracks[0];
          assert.ok(audioTrack.track);
          assert.ok(audioTrack.bitrate);
          assert.equal(isNaN(audioTrack.bitrate), false);
          assert.equal(audioTrack.kind, 'audio');
          assert.equal(audioTrack.packetLoss, 0.04030632809351068);
          assert.equal(audioTrack.jitter, 0.0017708333333333332);
          assert.equal(audioTrack.echoReturnLoss, -100);
          assert.equal(audioTrack.echoReturnLossEnhancement, 0.18);
          assert.equal(audioTrack.audioLevel, 0.0008239997558519242);
          assert.equal(audioTrack.totalAudioEnergy, 1.227674190176716);
          assert.equal(audioTrack.codec, '111 audio/opus 48000');

          const videoTrack = report2.tracks[1];
          assert.ok(videoTrack.track);
          assert.ok(videoTrack.bitrate);
          assert.equal(videoTrack.bitrate, 527);
          assert.equal(videoTrack.kind, 'video');
          assert.equal(videoTrack.packetLoss, 0.565859792518076);
          assert.equal(videoTrack.codec, '100 video/VP8 90000');
        });

        // the test data is kind of bad for testing this since it requires
        // two stats reports which include the same track for most things, and in
        // the current state, it only has remote stats in mock-spec-stats-2, so there's no
        // delta to measure loss, bitrate, etc
        it('should include remote tracks', function () {
          assert.equal(report2.remoteTracks.length, 2);
          const audioTrack = report2.remoteTracks[0];
          assert.ok(audioTrack.track);
          assert.equal(audioTrack.audioLevel, 0.0008239997558519242);
          assert.equal(audioTrack.totalAudioEnergy, 2.077036001267227);
          assert.equal(audioTrack.codec, '111 audio/opus 48000');

          const videoTrack = report2.remoteTracks[1];
          assert.ok(videoTrack.track);
          assert.equal(videoTrack.bytes, 7637399);
          assert.equal(videoTrack.codec, '100 video/VP8 90000');
        });

        it('should properly determine a track kind');
        it('should determine bitrate accurately');
        it('should determine the track kind from the code type if not available otherwise');
      });
    });

    describe('collectStats', function () {
      let opts, gatherer;

      beforeEach(function () {
        opts = {
          session: {},
          conference: {}
        };
        gatherer = new StatsGatherer(rtcPeerConnection, opts);
      });

      afterEach(function () {
        gatherer.connection.iceConnectionState = 'closed';
        gatherer.connection.emit('iceConnectionStateChange');
      });

      it('should setup a polling interval when connected');
      it('should emit a stats event if already disconnected');

      it('should collect stats for a recvonly stream', function (done) {
        sinon.stub(gatherer.connection.pc.peerconnection, 'getStats').returns(Promise.resolve(mockStatsRecvOnly));

        let gotInitial = false;
        gatherer.statsInterval = 10;

        gatherer.on('stats', function (stats) {
          if (gotInitial) {
            assert.ok(stats);
            gatherer.connection.iceConnectionState = 'closed';
            gatherer.connection.emit('iceConnectionStateChange');

            assert.equal(stats.remoteTracks.length, 1);
            assert.equal(stats.remoteTracks[0].bytes, 7637399);
            done();
          } else {
            console.log('got initial');
            gotInitial = true;
          }
        });
        gatherer.collectStats();
        gatherer.connection.iceConnectionState = 'connected';
        gatherer.connection.emit('iceConnectionStateChange');
      });
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

      afterEach(function () {
        gatherer.connection.iceConnectionState = 'closed';
        gatherer.connection.emit('iceConnectionStateChange');
      });

      it('should get emit a stats event with all of the initial connection information', function (done) {
        sinon.stub(gatherer.connection.pc.peerconnection, 'getStats').returns(Promise.resolve(mockInitialStats));
        gatherer.on('stats', function (stats) {
          assert.ok(stats.userAgent, 'userAgent');
          assert.ok(stats.platform, 'platform');
          assert.ok(stats.cores, 'cores');
          assert.ok(stats.networkType, 'networkType');
          assert.ok(stats.candidatePair, 'candidatePair');
          assert.ok(stats.candidatePairDetails, 'candidatePairDetails');
          done();
        });
        gatherer.collectInitialConnectionStats();
        gatherer.connection.iceConnectionState = 'connected';
        gatherer.connection.emit('iceConnectionStateChange');
      });

      it('should emit a failure report if the state is failed', function (done) {
        sinon.stub(gatherer.connection.pc.peerconnection, 'getStats').returns(Promise.resolve(mockStats1));
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
        gatherer.connection.pc.localDescription = { sdp: mockSdp.sdp };
        gatherer.connection.pc.remoteDescription = { sdp: mockSdp.sdp };
        gatherer.connection.emit('iceConnectionStateChange');
      });
    });

    describe('collectTraces', function () {
      it('should get all the trace data from the traceable connection and emit a report');
    });
  });
});
