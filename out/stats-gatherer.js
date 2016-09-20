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
      }
      throw TypeError('Uncaught, unspecified "error" event.');
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

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var IS_BROWSER = void 0;

var StatsGatherer = function (_EventEmitter) {
  _inherits(StatsGatherer, _EventEmitter);

  function StatsGatherer(peerConnection) {
    var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, StatsGatherer);

    IS_BROWSER = typeof window !== 'undefined';

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

    _this.logger = opts.logger || console;

    _this.collectTraces();
    return _this;
  }

  _createClass(StatsGatherer, [{
    key: '_gatherStats',
    value: function _gatherStats() {
      try {
        return this.connection.pc.peerconnection.getStats(null);
      } catch (e) {
        this.logger.error('Failed to gather stats. Are you using RTCPeerConnection as your connection? {expect connection.pc.peerconnection.getStats}', this.connection);
      }
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
        tracks: [],
        remoteTracks: []
      };

      Object.keys(results).forEach(function (key) {
        var report = results[key];
        var now = new Date(report.timestamp);
        var track = report.trackIdentifier || report.googTrackId || report.id;
        var kind = report.mediaType;

        var activeSource = !!(report.type === 'ssrc' && (report.bytesSent || report.bytesReceived));

        if (!activeSource) {
          return;
        }
        var local = !!report.bytesSent;

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

        var bytes = parseInt(local ? report.bytesSent : report.bytesReceived, 10) || 0;
        var lastResultReport = _this2.lastResult[report.id];
        var previousBytesTotal = parseInt(local ? lastResultReport.bytesSent : lastResultReport.bytesReceived, 10) || 0;
        var deltaTime = now - new Date(lastResultReport.timestamp);
        var bitrate = Math.floor(8 * (bytes - previousBytesTotal) / deltaTime);

        var lost = 0;
        var previousLost = 0;
        var total = 0;
        var previousTotal = 0;
        if (report.remoteId && results[report.remoteId]) {
          lost = results[report.remoteId].packetsLost;
          previousLost = lastResultReport.packetsLost;

          if (lost < previousLost) {
            _this2.logger.warn('Possible stats bug: current lost should not be less than previousLost. Overriding current lost with previousLost.', { lost: lost, previousLost: previousLost });
            lost = previousLost;
            results[report.remoteId].packetsLost = lost;
          }
        } else if (report.packetsLost || report.packetsSent || report.packetsReceived) {
          if (report.packetsLost) {
            lost = parseInt(report.packetsLost, 10) || 0;
            previousLost = parseInt(lastResultReport.packetsLost, 10) || 0;

            if (lost < previousLost) {
              _this2.logger.warn('Possible stats bug: current lost should not be less than previousLost. Overriding current lost with previousLost.', { lost: lost, previousLost: previousLost });
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
        var trackInfo = { track: track, kind: kind, bitrate: bitrate, lost: lost, muted: muted, loss: loss, intervalLoss: intervalLoss };
        if (local) {
          event.tracks.push(trackInfo);
        } else {
          event.remoteTracks.push(trackInfo);
        }
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

          if (IS_BROWSER) {
            window.setTimeout(statsPoll, 0);
            _this4._pollingInterval = window.setInterval(statsPoll, _this4.statsInterval);
          }
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
            if (IS_BROWSER) {
              window.clearInterval(_this4._pollingInterval);
            }
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
          if (IS_BROWSER) {
            _this5._iceStartTime = window.performance.now();
          }
        }

        if (state === 'connected' || state === 'completed') {
          var _ret = function () {
            if (_this5._haveConnectionMetrics) {
              return {
                v: void 0
              };
            }

            _this5._haveConnectionMetrics = true;
            var userAgent = void 0,
                platform = void 0,
                cores = void 0;
            if (IS_BROWSER) {
              _this5._iceConnectionTime = window.performance.now() - _this5._iceStartTime;
              userAgent = window.navigator.userAgent;
              platform = window.navigator.platform;
              cores = window.navigator.hardwareConcurrency;
            }

            _this5._gatherStats().then(function (reports) {
              var event = {
                name: 'connect',
                userAgent: userAgent,
                platform: platform,
                cores: cores,
                session: _this5.session,
                initiator: _this5.initiator,
                conference: _this5.conference,
                connectTime: _this5._iceConnectionTime,
                hadLocalIPv6Candidate: _this5.connection.hadLocalIPv6Candidate,
                hadRemoteIPv6Candidate: _this5.connection.hadRemoteIPv6Candidate,
                hadLocalRelayCandidate: _this5.connection.hadLocalRelayCandidate,
                hadRemoteRelayCandidate: _this5.connection.hadremoteRelayCandidate
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
              _this5.emit('stats', event);
            });
          }();

          if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
        }

        if (state === 'failed') {
          if (IS_BROWSER) {
            _this5._iceFailedTime = window.performance.now() - _this5._iceStartTime;
          }
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
              return line.indexOf('a=candidate:') > -1;
            });
            var remoteCandidates = _this5.connection.pc.remoteDescription.sdp.split('\r\n').filter(function (line) {
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

},{"events":1}]},{},[2])(2)
});