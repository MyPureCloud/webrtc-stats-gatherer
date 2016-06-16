'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var StatsGatherer = function (_EventEmitter) {
  _inherits(StatsGatherer, _EventEmitter);

  function StatsGatherer(peerConnection) {
    var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, StatsGatherer);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(StatsGatherer).call(this));

    _this.connection = peerConnection;
    _this.session = opts.session;
    _this.initiator = opts.initiator;
    _this.conference = opts.conference;

    _this.statsInterval = (opts.interval || 5) * 1000;
    _this.lastResult = {};

    _this._pollingInterval = null;

    _this._haveConnectionMetrics = false;
    _this._iceStartTime = null;
    _this._iceConnectionTime = null;

    _this.traceData = [];

    _this.collectTraces();
    return _this;
  }

  _createClass(StatsGatherer, [{
    key: '_gatherStats',
    value: function _gatherStats() {
      return this.connection.pc.peerconnection.getStats(null);
    }
  }, {
    key: '_createStatsReport',
    value: function _createStatsReport(results, updateLastResult) {
      var _this2 = this;

      var event = {
        name: 'getStats',
        session: this.session,
        initiator: this.initiator,
        conference: this.conference,
        tracks: []
      };

      Object.keys(results).forEach(function (key) {
        var report = results[key];
        var now = report.timestamp;
        var track = report.trackIdentifier || report.googTrackId || report.id;
        var kind = report.mediaType;

        var local = report.type === 'outboundrtp' && report.isRemote === false;
        var activeSource = report.type === 'ssrc' && report.bytesSent;

        if (!local && !activeSource) {
          return;
        }

        if (!_this2.lastResult || !_this2.lastResult[report.id] || _this2.lastResult[report.id].timestamp >= now) {
          return;
        }

        // Chrome does not provide a mediaType field, so we have to manually inspect
        // the tracks to find the media type.
        if (!kind) {
          _this2.connection.getLocalStreams()[0].getTracks().forEach(function (track) {
            if (track.id === report.googTrackId) {
              kind = track.kind;
            }
          });
        }

        var muted = false;
        // We still didn't find the media type, so the local track is muted
        if (!kind) {
          muted = true;
          // Try to guess the media type from the codec
          if (report.googCodecName) {
            var codec = report.googCodecName.toLowerCase();
            if (codec === 'vp8') {
              kind = 'video';
            } else if (codec === 'opus') {
              kind = 'audio';
            }
          }
        }

        var bytes = report.bytesSent;
        var previousBytesSent = _this2.lastResult[report.id].bytesSent;
        var deltaTime = now - _this2.lastResult[report.id].timestamp;
        var bitrate = Math.floor(8 * (bytes - previousBytesSent) / deltaTime);

        var lost = 0;
        if (report.remoteId && results[report.remoteId]) {
          lost = results[report.remoteId].packetsLost;
        } else if (report.packetsLost) {
          lost = parseInt(report.packetsLost, 10);
        }

        event.tracks.push({ track: track, kind: kind, bitrate: bitrate, lost: lost, muted: muted });
      });

      if (updateLastResult) {
        this.lastResult = results;
      }

      return event;
    }
  }, {
    key: 'collectTraces',
    value: function collectTraces() {
      var _this3 = this;

      this.connection.on('PeerConnectionTrace', function (data) {
        _this3.traceData.push(data);
      });

      this.connection.on('error', function () {
        _this3.emit('traces', {
          name: 'trace',
          session: _this3.session,
          initiator: _this3.initiator,
          conference: _this3.conference,
          traces: _this3.traceData
        });
      });
    }
  }, {
    key: 'collectStats',
    value: function collectStats() {
      var _this4 = this;

      this.connection.on('iceConnectionStateChange', function () {
        // Not interested in receive only streams
        if (_this4.connection.getLocalStreams().length === 0) {
          return;
        }

        var state = _this4.connection.iceConnectionState;

        if (state === 'connected' || state === 'completed') {
          if (_this4._pollingInterval !== null) {
            return;
          }

          var statsPoll = function statsPoll() {
            _this4._gatherStats().then(function (reports) {
              var event = _this4._createStatsReport(reports, true);
              if (event.tracks.length > 0) {
                _this4.emit('stats', event);
              }
            });
          };

          window.setTimeout(statsPoll, 0);
          _this4._pollingInterval = window.setInterval(statsPoll, _this4.statsInterval);
        }

        if (state === 'disconnected') {
          if (_this4.connection.signalingState !== 'stable') {
            return;
          }

          _this4._gatherStats().then(function (reports) {
            var event = _this4._createStatsReport(reports);
            event.type = 'iceDisconnected';
            _this4.emit('stats', event);
          });
        }

        if (state === 'closed') {
          if (_this4._pollingInterval) {
            window.clearInterval(_this4._pollingInterval);
            _this4._pollingInterval = null;
          }
        }
      });
    }
  }, {
    key: 'collectInitialConnectionStats',
    value: function collectInitialConnectionStats() {
      var _this5 = this;

      this.connection.on('iceConnectionStateChange', function () {
        var state = _this5.connection.iceConnectionState;

        if (state === 'checking') {
          _this5._iceStartTime = window.performance.now();
        }

        if (state === 'connected' || state === 'completed') {
          if (_this5._haveConnectionMetrics) {
            return;
          }

          _this5._haveConnectionMetrics = true;
          _this5._iceConnectionTime = window.performance.now() - _this5._iceStartTime;

          _this5._gatherStats().then(function (reports) {
            var event = {
              name: 'connect',
              session: this.session,
              initiator: this.initiator,
              conference: this.conference,
              connectTime: this._iceConnectionTime,
              hadLocalIPv6Candidate: this.connection.hadLocalIPv6Candidate,
              hadRemoteIPv6Candidate: this.connection.hadRemoteIPv6Candidate,
              hadLocalRelayCandidate: this.connection.hadLocalRelayCandidate,
              hadRemoteRelayCandidate: this.connection.hadremoteRelayCandidate
            };

            var activeCandidatePair = null;
            Object.keys(reports).forEach(function (key) {
              var report = reports[key];

              var selected = report.type === 'candidatepair' && report.selected;
              var chromeSelected = report.type === 'googCandidatePair' && report.googActiveConnection === 'true';
              if (selected || chromeSelected) {
                activeCandidatePair = report;
              }
            });

            if (activeCandidatePair) {
              (function () {
                var localId = activeCandidatePair.localCandidateId;
                var remoteId = activeCandidatePair.remoteCandidateId;
                var localCandidate = void 0,
                    remoteCandidate = void 0;

                Object.keys(reports).forEach(function (key) {
                  var report = reports[key];
                  if (localId && report.type === 'localcandidate' && report.id === localId) {
                    localCandidate = report;
                    event.localCandidateType = report.candidateType;
                  }

                  if (remoteId && report.type === 'remotecandidate' && report.id === remoteId) {
                    remoteCandidate = report;
                    event.remoteCandidateType = report.candidateType;
                  }
                });

                if (localCandidate && remoteCandidate) {
                  event.candidatePair = localCandidate.candidateType + ';' + remoteCandidate.candidateType;
                  event.candidatePairDetails = {
                    local: localCandidate,
                    remote: remoteCandidate
                  };
                }

                if (localCandidate) {
                  event.transport = localCandidate.transport;
                  if (localCandidate.priority) {
                    // Chrome-specific mapping;
                    // but only chrome has priority set on the candidate currently.
                    var turnTypes = {
                      2: 'udp',
                      1: 'tcp',
                      0: 'tls'
                    };

                    var priority = parseInt(localCandidate.priority, 10);
                    event.turnType = turnTypes[priority >> 24];
                  }

                  event.usingIPv6 = localCandidate.ipAddress && localCandidate.ipAddress.indexOf('[') === 0;
                }
              })();
            }

            this.emit('stats', event);
          });
        }

        if (state === 'failed') {
          _this5._iceFailedTime = window.performance.now() - _this5._iceStartTime;
          _this5._gatherStats().then(function (reports) {
            var event = {
              name: 'failure',
              session: _this5.session,
              initiator: _this5.initiator,
              conference: _this5.conference,
              failTime: _this5._iceFailureTime,
              iceRW: 0,
              numLocalHostCandidates: 0,
              numLocalSrflxCandidates: 0,
              numLocalRelayCandidates: 0,
              numRemoteHostCandidates: 0,
              numRemoteSrflxCandidates: 0,
              numRemoteRelayCandidates: 0
            };

            Object.keys(reports).forEach(function (key) {
              var report = reports[key];

              if (report.type === 'googCandidatePair') {
                if (report.googWritable === 'true' && report.googReadable === 'true') {
                  event.iceRW++;
                }
              }
            });

            var localCandidates = _this5.connection.pc.localDescription.sdp.split('\r\n').filter(function (line) {
              return line.indexOf('a=candidate:');
            });
            var remoteCandidates = _this5.connection.pc.remoteDescription.sdp.split('\r\n').filter(function (line) {
              return line.indexOf('a=candidate:');
            });

            ['Host', 'Srflx', 'Relay'].forEach(function (type) {
              event['numLocal' + type + 'Candidates'] = localCandidates.filter(function (line) {
                return line.split(' ')[7] === type.toLowerCase();
              }).length;
              event['numRemote' + type + 'Candidates'] = remoteCandidates.filter(function (line) {
                return line.split(' ')[7] === type.toLowerCase();
              }).length;
            });

            _this5.emit('stats', event);
            _this5.emit('traces', {
              name: 'trace',
              session: _this5.session,
              initiator: _this5.initiator,
              conference: _this5.conference,
              traces: _this5.traceData
            });
          });
        }
      });
    }
  }]);

  return StatsGatherer;
}(_events.EventEmitter);

exports.default = StatsGatherer;