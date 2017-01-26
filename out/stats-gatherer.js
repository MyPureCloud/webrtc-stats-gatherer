(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.StatsGatherer = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var IS_BROWSER = void 0;

var StatsGatherer = function (_EventEmitter) {
  _inherits(StatsGatherer, _EventEmitter);

  function StatsGatherer(peerConnection) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, StatsGatherer);

    IS_BROWSER = typeof window !== 'undefined';

    var _this = _possibleConstructorReturn(this, (StatsGatherer.__proto__ || Object.getPrototypeOf(StatsGatherer)).call(this));

    _this.connection = peerConnection;
    _this.session = opts.session;
    _this.initiator = opts.initiator;
    _this.conference = opts.conference;

    _this.statsInterval = (opts.interval || 5) * 1000;
    _this.lastResult = {};
    _this.lastActiveLocalCandidate = null;

    _this._pollingInterval = null;

    _this._haveConnectionMetrics = false;
    _this._iceStartTime = null;
    _this._iceConnectionTime = null;

    _this.traceData = [];

    _this.logger = opts.logger || console;

    _this.collectTraces();
    return _this;
  }

  _createClass(StatsGatherer, [{
    key: '_polyFillStats',
    value: function _polyFillStats(results) {
      if (!results || Array.isArray(results)) {
        return results;
      }
      var betterResults = [];
      Object.keys(results).forEach(function (key) {
        betterResults.push({
          key: key,
          value: results[key]
        });
      });
      return betterResults;
    }
  }, {
    key: '_gatherStats',
    value: function _gatherStats() {
      try {
        if (this.connection.pc.peerconnection) {
          return this.connection.pc.peerconnection.getStats().then(this._polyFillStats);
        }
        return this.connection.pc.getStats().then(this._polyFillStats);
      } catch (e) {
        this.logger.error('Failed to gather stats. Are you using RTCPeerConnection as your connection? {expect connection.pc.peerconnection.getStats}', this.connection);
      }
    }
  }, {
    key: '_checkLastActiveCandidate',
    value: function _checkLastActiveCandidate(_ref) {
      var localId = _ref.localId,
          remoteId = _ref.remoteId,
          key = _ref.key,
          report = _ref.report;

      if (localId && report.type === 'localcandidate' && report.id === localId) {
        this.lastActiveLocalCandidate = report;
      }
      if (remoteId && report.type === 'remotecandidate' && report.id === remoteId) {
        this.lastActiveRemoteCandidate = report;
      }
    }
  }, {
    key: '_processReport',
    value: function _processReport(_ref2) {
      var _this2 = this;

      var key = _ref2.key,
          report = _ref2.report,
          results = _ref2.results,
          event = _ref2.event;

      var now = new Date(report.timestamp);
      var track = report.trackIdentifier || report.googTrackId || key;
      var kind = report.mediaType;

      var activeSource = !!(report.type === 'ssrc' && (report.bytesSent || report.bytesReceived));

      if (!activeSource) {
        // if not active source, is this the active candidate pair?
        var selected = report.type === 'candidatepair' && report.selected;
        var chromeSelected = report.type === 'googCandidatePair' && report.googActiveConnection === 'true';

        if (selected || chromeSelected) {
          (function () {
            // this is the active candidate pair, check if it's the same id as last one
            var localId = report.localCandidateId;
            var remoteId = report.remoteCandidateId;

            event.localCandidateChanged = !!_this2.lastActiveLocalCandidate && localId !== _this2.lastActiveLocalCandidate.id;
            event.remoteCandidateChanged = !!_this2.lastActiveRemoteCandidate && remoteId !== _this2.lastActiveRemoteCandidate.id;

            if (!_this2.lastActiveLocalCandidate || event.localCandidateChanged || event.remoteCandidateChanged) {
              results.forEach(function (result) {
                _this2._checkLastActiveCandidate({
                  localId: localId,
                  remoteId: remoteId,
                  key: result.key,
                  report: result.value
                });
              });
            }

            if (_this2.lastActiveLocalCandidate) {
              event.networkType = _this2.lastActiveLocalCandidate.networkType;
              if (_this2.lastActiveRemoteCandidate) {
                event.candidatePair = _this2.lastActiveLocalCandidate.candidateType + ';' + _this2.lastActiveRemoteCandidate.candidateType;
              }
            }
          })();
        }
        return;
      }

      var local = !!report.bytesSent;

      var lastResultReport = void 0;
      if (!this.lastResult) {
        return;
      }
      lastResultReport = this.lastResult.find && this.lastResult.find(function (r) {
        return r.key === key;
      });
      lastResultReport = lastResultReport && lastResultReport.value;
      if (!lastResultReport || lastResultReport.timestamp >= now) {
        return;
      }

      // Chrome does not provide a mediaType field, so we have to manually inspect
      // the tracks to find the media type.
      if (!kind) {
        this.connection.getLocalStreams()[0].getTracks().forEach(function (track) {
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

      var bytes = parseInt(local ? report.bytesSent : report.bytesReceived, 10) || 0;
      var previousBytesTotal = parseInt(local ? lastResultReport.bytesSent : lastResultReport.bytesReceived, 10) || 0;
      var deltaTime = now - new Date(lastResultReport.timestamp);
      var bitrate = Math.floor(8 * (bytes - previousBytesTotal) / deltaTime);
      var bytesSent = parseInt(report.bytesSent, 10) || -1;
      var bytesReceived = parseInt(report.bytesReceived, 10) || -1;

      var rtt = parseInt(report.googRtt || report.mozRtt || report.roundTripTime, 10) || -1;
      if (rtt !== -1) {
        event[kind + 'Rtt'] = rtt;
      }

      var jitter = parseInt(report.googJitterReceived || report.mozJitterReceived || report.jitter, 10) || -1;
      if (jitter !== -1) {
        event[kind + 'Jitter'] = jitter;
      }

      var lost = 0;
      var previousLost = 0;
      var total = 0;
      var previousTotal = 0;
      var remoteItem = void 0;

      remoteItem = results.find(function (r) {
        return r.key === report.remoteId;
      });
      if (report.remoteId && remoteItem) {
        lost = remoteItem.packetsLost;
        previousLost = lastResultReport.packetsLost;

        if (lost < previousLost) {
          this.logger.warn('Possible stats bug: current lost should not be less than previousLost. Overriding current lost with previousLost.', { lost: lost, previousLost: previousLost });
          lost = previousLost;
          remoteItem.packetsLost = lost;
        }
      } else if (report.packetsLost || report.packetsSent || report.packetsReceived) {
        if (report.packetsLost) {
          lost = parseInt(report.packetsLost, 10) || 0;
          previousLost = parseInt(lastResultReport.packetsLost, 10) || 0;

          if (lost < previousLost) {
            this.logger.warn('Possible stats bug: current lost should not be less than previousLost. Overriding current lost with previousLost.', { lost: lost, previousLost: previousLost });
            lost = previousLost;
            report.packetsLost = '' + lost;
          }
        }
        if (local && report.packetsSent) {
          total = parseInt(report.packetsSent, 10) || 0;
          previousTotal = parseInt(lastResultReport.packetsSent, 10) || 0;
        }
        if (!local && report.packetsReceived) {
          total = parseInt(report.packetsReceived, 10) || 0;
          previousTotal = parseInt(lastResultReport.packetsReceived, 10) || 0;
        }
      }

      var loss = 0;
      if (total > 0) {
        loss = Math.floor(lost / total * 100);
      }

      var intervalLoss = Math.floor((lost - previousLost) / (total - previousTotal) * 100) || 0;

      // TODO: for 2.0 - remove `lost` which is an integer of packets lost,
      // and use only `loss` which is percentage loss
      var trackInfo = {
        track: track,
        kind: kind,
        bitrate: bitrate,
        lost: lost,
        muted: muted,
        loss: loss,
        intervalLoss: intervalLoss,
        bytesSent: bytesSent,
        bytesReceived: bytesReceived
      };

      if (kind === 'audio') {
        trackInfo.aecDivergentFilterFraction = parseInt(report.aecDivergentFilterFraction, 10) || 0;
        trackInfo.googEchoCanellationEchoDelayMedian = parseInt(report.googEchoCanellationEchoDelayMedian, 10) || 0;
        trackInfo.googEchoCancellationEchoDelayStdDev = parseInt(report.googEchoCancellationEchoDelayStdDev, 10) || 0;
        trackInfo.googEchoCancellationReturnLoss = parseInt(report.googEchoCancellationReturnLoss, 10) || 0;
        trackInfo.googEchoCancellationReturnLossEnhancement = parseInt(report.googEchoCancellationReturnLossEnhancement, 10) || 0;
      }

      if (local) {
        event.tracks.push(trackInfo);
      } else {
        event.remoteTracks.push(trackInfo);
      }
    }
  }, {
    key: '_createStatsReport',
    value: function _createStatsReport(results, updateLastResult) {
      var _this3 = this;

      var event = {
        name: 'getStats',
        session: this.session,
        initiator: this.initiator,
        conference: this.conference,
        tracks: [],
        remoteTracks: []
      };

      results = this._polyFillStats(results);

      results.forEach(function (result) {
        _this3._processReport({
          key: result.key,
          report: result.value,
          results: results,
          event: event
        });
      });

      if (updateLastResult) {
        this.lastResult = results;
      }

      return event;
    }
  }, {
    key: 'collectTraces',
    value: function collectTraces() {
      var _this4 = this;

      this.connection.on('PeerConnectionTrace', function (data) {
        _this4.traceData.push(data);
      });

      this.connection.on('error', function () {
        _this4.emit('traces', {
          name: 'trace',
          session: _this4.session,
          initiator: _this4.initiator,
          conference: _this4.conference,
          traces: _this4.traceData
        });
      });
    }
  }, {
    key: 'collectStats',
    value: function collectStats() {
      var _this5 = this;

      this.connection.on('iceConnectionStateChange', function () {
        var state = _this5.connection.iceConnectionState;

        if (state === 'connected' || state === 'completed') {
          if (_this5._pollingInterval !== null) {
            return;
          }

          var statsPoll = function statsPoll() {
            _this5._gatherStats().then(function (reports) {
              var event = _this5._createStatsReport(reports, true);
              if (event.tracks.length > 0 || event.remoteTracks.length > 0) {
                _this5.emit('stats', event);
              }
            });
          };

          if (IS_BROWSER) {
            window.setTimeout(statsPoll, 0);
            _this5._pollingInterval = window.setInterval(statsPoll, _this5.statsInterval);
          }
        }

        if (state === 'disconnected') {
          if (_this5.connection.signalingState !== 'stable') {
            return;
          }

          _this5._gatherStats().then(function (reports) {
            var event = _this5._createStatsReport(reports);
            event.type = 'iceDisconnected';
            _this5.emit('stats', event);
          });
        }

        if (state === 'closed') {
          if (_this5._pollingInterval) {
            if (IS_BROWSER) {
              window.clearInterval(_this5._pollingInterval);
            }
            _this5._pollingInterval = null;
          }
        }
      });
    }
  }, {
    key: 'collectInitialConnectionStats',
    value: function collectInitialConnectionStats() {
      var _this6 = this;

      this.connection.on('iceConnectionStateChange', function () {
        var state = _this6.connection.iceConnectionState;

        if (state === 'checking') {
          if (IS_BROWSER) {
            _this6._iceStartTime = window.performance.now();
          }
        }

        if (state === 'connected' || state === 'completed') {
          var _ret2 = function () {
            if (_this6._haveConnectionMetrics) {
              return {
                v: void 0
              };
            }

            _this6._haveConnectionMetrics = true;
            var userAgent = void 0,
                platform = void 0,
                cores = void 0;
            if (IS_BROWSER) {
              _this6._iceConnectionTime = window.performance.now() - _this6._iceStartTime;
              userAgent = window.navigator.userAgent;
              platform = window.navigator.platform;
              cores = window.navigator.hardwareConcurrency;
            }

            _this6._gatherStats().then(function (reports) {
              var event = {
                name: 'connect',
                userAgent: userAgent,
                platform: platform,
                cores: cores,
                session: _this6.session,
                initiator: _this6.initiator,
                conference: _this6.conference,
                connectTime: _this6._iceConnectionTime,
                hadLocalIPv6Candidate: _this6.connection.hadLocalIPv6Candidate,
                hadRemoteIPv6Candidate: _this6.connection.hadRemoteIPv6Candidate,
                hadLocalRelayCandidate: _this6.connection.hadLocalRelayCandidate,
                hadRemoteRelayCandidate: _this6.connection.hadremoteRelayCandidate
              };

              var activeCandidatePair = null;
              Object.keys(reports).forEach(function (key) {
                var report = reports[key];

                var selected = report.type === 'candidatepair' && report.selected;
                var chromeSelected = report.type === 'googCandidatePair' && report.googActiveConnection === 'true';
                if (selected || chromeSelected) {
                  activeCandidatePair = report;
                }

                event.dtlsCipher = event.dtlsCipher || report.dtlsCipher;
                event.srtpCipher = event.srtpCipher || report.srtpCipher;
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
                      event.networkType = localCandidate.networkType;
                    }

                    event.usingIPv6 = localCandidate.ipAddress && localCandidate.ipAddress.indexOf('[') === 0;
                  }
                })();
              }
              _this6.emit('stats', event);
            });
          }();

          if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
        }

        if (state === 'failed') {
          if (IS_BROWSER) {
            _this6._iceFailedTime = window.performance.now() - _this6._iceStartTime;
          }
          _this6._gatherStats().then(function (reports) {
            var event = {
              name: 'failure',
              session: _this6.session,
              initiator: _this6.initiator,
              conference: _this6.conference,
              failTime: _this6._iceFailureTime,
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

            var localCandidates = _this6.connection.pc.localDescription.sdp.split('\r\n').filter(function (line) {
              return line.indexOf('a=candidate:') > -1;
            });
            var remoteCandidates = _this6.connection.pc.remoteDescription.sdp.split('\r\n').filter(function (line) {
              return line.indexOf('a=candidate:') > -1;
            });

            ['Host', 'Srflx', 'Relay'].forEach(function (type) {
              event['numLocal' + type + 'Candidates'] = localCandidates.filter(function (line) {
                return line.split(' ')[7] === type.toLowerCase();
              }).length;
              event['numRemote' + type + 'Candidates'] = remoteCandidates.filter(function (line) {
                return line.split(' ')[7] === type.toLowerCase();
              }).length;
            });

            _this6.emit('stats', event);
            _this6.emit('traces', {
              name: 'trace',
              session: _this6.session,
              initiator: _this6.initiator,
              conference: _this6.conference,
              traces: _this6.traceData
            });
          });
        }
      });
    }
  }]);

  return StatsGatherer;
}(_events.EventEmitter);

exports.default = StatsGatherer;

},{"events":1}]},{},[2])(2)
});