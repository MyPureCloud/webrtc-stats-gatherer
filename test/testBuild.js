'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _chai = require('chai');

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _statsGatherer = require('../out/stats-gatherer');

var _statsGatherer2 = _interopRequireDefault(_statsGatherer);

var _mockInitialStats = require('./mock-initial-stats.json');

var _mockInitialStats2 = _interopRequireDefault(_mockInitialStats);

var _mockStats = require('./mock-stats-1.json');

var _mockStats2 = _interopRequireDefault(_mockStats);

var _mockStats3 = require('./mock-stats-2.json');

var _mockStats4 = _interopRequireDefault(_mockStats3);

var _mockStats5 = require('./mock-stats-3.json');

var _mockStats6 = _interopRequireDefault(_mockStats5);

var _mockSdp = require('./mock-sdp.json');

var _mockSdp2 = _interopRequireDefault(_mockSdp);

var _events = require('events');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/* global describe, it, beforeEach, afterEach */

if (typeof window === 'undefined') {
  GLOBAL.window = {
    navigator: {
      userAgent: 'user-agent',
      hardwareConcurrency: 8,
      platform: 'tests'
    },
    performance: {
      now: function now() {
        return new Date().getTime();
      }
    },
    location: { 'host': 'localhost', 'protocol': 'http' }
  };

  GLOBAL.window.setTimeout = setTimeout.bind(GLOBAL.window);
  GLOBAL.window.setInterval = setInterval.bind(GLOBAL.window);
  GLOBAL.window.clearInterval = clearInterval.bind(GLOBAL.window);
}

var MockRtcPeerConnection = function (_EventEmitter) {
  _inherits(MockRtcPeerConnection, _EventEmitter);

  function MockRtcPeerConnection() {
    _classCallCheck(this, MockRtcPeerConnection);

    var _this = _possibleConstructorReturn(this, (MockRtcPeerConnection.__proto__ || Object.getPrototypeOf(MockRtcPeerConnection)).apply(this, arguments));

    _this._localStreams = [];
    return _this;
  }

  _createClass(MockRtcPeerConnection, [{
    key: 'getLocalStreams',
    value: function getLocalStreams() {
      return this._localStreams;
    }
  }]);

  return MockRtcPeerConnection;
}(_events.EventEmitter);

describe('StatsGatherer', function () {
  var rtcPeerConnection = void 0;

  beforeEach(function () {
    rtcPeerConnection = new MockRtcPeerConnection();
    rtcPeerConnection.pc = {
      peerconnection: {
        getStats: function getStats() {
          return Promise.resolve(_mockStats2.default);
        }
      }
    };
  });

  describe('constructor', function () {
    it('should accept options and initialize the class', function () {
      var gatherer = new _statsGatherer2.default(rtcPeerConnection);

      _chai.assert.equal(gatherer.connection, rtcPeerConnection);
      _chai.assert.equal(gatherer.statsInterval, 5000);
      _chai.assert.deepEqual(gatherer.traceData, []);
    });
  });

  describe('_gatherStats', function () {
    it('should call into the native getstats method', function (done) {
      var gatherer = new _statsGatherer2.default(rtcPeerConnection);
      _sinon2.default.stub(gatherer.connection.pc.peerconnection, 'getStats', function () {
        done();
      });
      gatherer._gatherStats();
    });
  });

  describe('_createStatsReport', function () {
    var opts = void 0,
        gatherer = void 0,
        report1 = void 0,
        report2 = void 0,
        report3 = void 0;

    beforeEach(function () {
      opts = {
        session: {},
        conference: {}
      };
      gatherer = new _statsGatherer2.default(rtcPeerConnection, opts);
    });

    describe('intervalLoss', function () {
      it('should generate intervalLoss', function () {
        var stats1 = {
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

        var stats2 = {
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

        var stats3 = {
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
        report3 = gatherer._createStatsReport(stats3, true);

        _chai.assert.equal(report2.remoteTracks[0].intervalLoss, 10);
        _chai.assert.equal(report3.remoteTracks[0].intervalLoss, 30);
      });
    });

    describe('basic stats checking', function () {
      beforeEach(function () {
        report1 = gatherer._createStatsReport(_mockStats2.default, true);
        report2 = gatherer._createStatsReport(_mockStats4.default, true);
        report3 = gatherer._createStatsReport(_mockStats6.default, true);
      });

      it('should create a report', function () {
        _chai.assert.ok(report1);
        _chai.assert.equal(report1.name, 'getStats');
        _chai.assert.deepEqual(report1.session, opts.session);
        _chai.assert.deepEqual(report1.conference, opts.conference);
        _chai.assert.equal(report1.tracks.length, 0);

        _chai.assert.ok(report2);
        _chai.assert.equal(report2.name, 'getStats');
        _chai.assert.deepEqual(report2.session, opts.session);
        _chai.assert.deepEqual(report2.conference, opts.conference);
        _chai.assert.equal(report2.tracks.length, 2);

        _chai.assert.ok(report3);
        _chai.assert.equal(report3.name, 'getStats');
        _chai.assert.deepEqual(report3.session, opts.session);
        _chai.assert.deepEqual(report3.conference, opts.conference);
        _chai.assert.equal(report3.tracks.length, 0);
      });

      it('should accurately get track properties for the report', function () {
        var audioTrack = report2.tracks[0];
        _chai.assert.ok(audioTrack.track);
        _chai.assert.ok(audioTrack.bitrate);
        _chai.assert.equal(isNaN(audioTrack.bitrate), false);
        _chai.assert.equal(audioTrack.kind, 'audio');
        _chai.assert.equal(audioTrack.lost, 18);
        _chai.assert.equal(audioTrack.loss, 0);
        _chai.assert.equal(audioTrack.muted, false);

        var videoTrack = report2.tracks[1];
        _chai.assert.ok(videoTrack.track);
        _chai.assert.ok(videoTrack.bitrate);
        _chai.assert.equal(isNaN(videoTrack.bitrate), false);
        _chai.assert.equal(videoTrack.kind, 'video');
        _chai.assert.equal(videoTrack.lost, 10000);
        _chai.assert.equal(videoTrack.loss, 8);
        _chai.assert.equal(videoTrack.muted, false);
      });

      it('should include remote tracks', function () {
        _chai.assert.equal(report2.remoteTracks.length, 2);

        var audioTrack = report2.remoteTracks[0];
        _chai.assert.ok(audioTrack.track);
        _chai.assert.ok(audioTrack.bitrate);
        _chai.assert.equal(isNaN(audioTrack.bitrate), false);
        _chai.assert.equal(audioTrack.kind, 'audio');
        _chai.assert.equal(audioTrack.lost, 23);
        _chai.assert.equal(audioTrack.loss, 0);
        _chai.assert.equal(audioTrack.muted, false);

        var videoTrack = report2.remoteTracks[1];
        _chai.assert.ok(videoTrack.track);
        _chai.assert.ok(videoTrack.bitrate);
        _chai.assert.equal(isNaN(videoTrack.bitrate), false);
        _chai.assert.equal(videoTrack.kind, 'video');
        _chai.assert.equal(videoTrack.lost, 2521);
        _chai.assert.equal(videoTrack.loss, 2);
        _chai.assert.equal(videoTrack.muted, false);
      });

      it('should include rtt and jitter', function () {
        _chai.assert.equal(report2.audioRtt, 23);
        _chai.assert.equal(report2.videoRtt, 23);
        _chai.assert.equal(report2.audioJitter, 2);
        _chai.assert.equal(report2.videoJitter, undefined); // no video jitter reported in mock stats
      });

      it('should properly determine a track kind');
      it('should determine bitrate accurately');
      it('should determine the track kind from the code type if not available otherwise');
    });
  });

  describe('collectStats', function () {
    var opts = void 0,
        gatherer = void 0;

    beforeEach(function () {
      opts = {
        session: {},
        conference: {}
      };
      gatherer = new _statsGatherer2.default(rtcPeerConnection, opts);
    });

    afterEach(function () {
      gatherer.connection.iceConnectionState = 'closed';
      gatherer.connection.emit('iceConnectionStateChange');
    });

    it('should setup a polling interval when connected');
    it('should emit a stats event if already disconnected');

    it('should collect stats for a recvonly stream', function (done) {
      _sinon2.default.stub(gatherer, '_gatherStats').returns(Promise.resolve(_mockStats6.default));

      var gotInitial = false;
      gatherer.statsInterval = 10;

      gatherer.on('stats', function (stats) {
        if (gotInitial) {
          _chai.assert.ok(stats);
          gatherer.connection.iceConnectionState = 'closed';
          gatherer.connection.emit('iceConnectionStateChange');

          _chai.assert.equal(stats.remoteTracks.length, 1);
          _chai.assert.equal(stats.remoteTracks[0].bytesReceived, 3519798);
          done();
        } else {
          gotInitial = true;
        }
      });
      gatherer.collectStats();
      gatherer.connection.iceConnectionState = 'connected';
      gatherer.connection.emit('iceConnectionStateChange');
    });
  });

  describe('collectInitialConnectionStats', function () {
    var opts = void 0,
        gatherer = void 0;

    beforeEach(function () {
      opts = {
        session: {},
        conference: {}
      };
      gatherer = new _statsGatherer2.default(rtcPeerConnection, opts);
    });

    afterEach(function () {
      gatherer.connection.iceConnectionState = 'closed';
      gatherer.connection.emit('iceConnectionStateChange');
    });

    it('should get emit a stats event with all of the initial connection information', function (done) {
      _sinon2.default.stub(gatherer, '_gatherStats').returns(Promise.resolve(_mockInitialStats2.default));
      gatherer.on('stats', function (stats) {
        _chai.assert.ok(stats.userAgent);
        _chai.assert.ok(stats.platform);
        _chai.assert.ok(stats.cores);
        done();
      });
      gatherer.collectInitialConnectionStats();
      gatherer.connection.iceConnectionState = 'connected';
      gatherer.connection.emit('iceConnectionStateChange');
    });

    it('should emit a failure report if the state is failed', function (done) {
      _sinon2.default.stub(gatherer, '_gatherStats').returns(Promise.resolve(_mockStats2.default));
      gatherer.on('stats', function (event) {
        _chai.assert.equal(event.name, 'failure');
        try {
          _chai.assert.ok(event.numLocalHostCandidates > 0, 'has local host candidates');
          _chai.assert.ok(event.numLocalSrflxCandidates > 0, 'has local srflx candidates');
          _chai.assert.ok(event.numLocalRelayCandidates > 0, 'has local relay candidates');
          _chai.assert.ok(event.numRemoteHostCandidates > 0, 'has remote host candidates');
          _chai.assert.ok(event.numRemoteSrflxCandidates > 0, 'has remote srflx candidates');
          _chai.assert.ok(event.numRemoteRelayCandidates > 0, 'has remote relay candidates');
          done();
        } catch (e) {
          done(e);
        }
      });
      gatherer.collectInitialConnectionStats();
      gatherer.connection.iceConnectionState = 'failed';
      gatherer.connection.pc = {
        localDescription: { sdp: _mockSdp2.default.sdp },
        remoteDescription: { sdp: _mockSdp2.default.sdp }
      };
      gatherer.connection.emit('iceConnectionStateChange');
    });
  });

  describe('collectTraces', function () {
    it('should get all the trace data from the traceable connection and emit a report');
  });
});

