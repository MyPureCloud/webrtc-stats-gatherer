(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.StatsGatherer = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],2:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
    }
  }return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
  };
}();

var _events = require('events');

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }return call && ((typeof call === "undefined" ? "undefined" : _typeof(call)) === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + (typeof superClass === "undefined" ? "undefined" : _typeof(superClass)));
  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

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
      if (typeof window.RTCStatsReport !== 'undefined' && results instanceof window.RTCStatsReport) {
        results.forEach(function (value, key) {
          betterResults.push({ key: key, value: value });
        });
      } else if (Object.keys(results).length > 0) {
        Object.keys(results).forEach(function (key) {
          betterResults.push({
            key: key,
            value: results[key]
          });
        });
      } else {
        this.logger.warn('Unknown stats results format, returning unmodified', results);
        return results;
      }
      return betterResults;
    }
  }, {
    key: '_gatherStats',
    value: function _gatherStats() {
      try {
        if (this.connection.pc.peerconnection) {
          return this.connection.pc.peerconnection.getStats(null).then(this._polyFillStats);
        }
        return this.connection.pc.getStats(null).then(this._polyFillStats);
      } catch (e) {
        this.logger.error('Failed to gather stats. Are you using RTCPeerConnection as your connection? {expect connection.pc.peerconnection.getStats}', this.connection);
        return Promise.reject(e);
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
        var specSepected = report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded';
        var chromeSelected = report.type === 'googCandidatePair' && report.googActiveConnection === 'true';

        if (selected || chromeSelected || specSepected) {
          // this is the active candidate pair, check if it's the same id as last one
          var localId = report.localCandidateId;
          var remoteId = report.remoteCandidateId;

          event.localCandidateChanged = !!this.lastActiveLocalCandidate && localId !== this.lastActiveLocalCandidate.id;
          event.remoteCandidateChanged = !!this.lastActiveRemoteCandidate && remoteId !== this.lastActiveRemoteCandidate.id;

          if (!this.lastActiveLocalCandidate || event.localCandidateChanged || event.remoteCandidateChanged) {
            results.forEach(function (result) {
              _this2._checkLastActiveCandidate({
                localId: localId,
                remoteId: remoteId,
                key: result.key,
                report: result.value
              });
            });
          }

          if (this.lastActiveLocalCandidate) {
            event.networkType = this.lastActiveLocalCandidate.networkType;
            if (this.lastActiveRemoteCandidate) {
              event.candidatePair = this.lastActiveLocalCandidate.candidateType + ';' + this.lastActiveRemoteCandidate.candidateType;
            }
          }
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

      if (kind === 'audio' && report.audioInputLevel) {
        trackInfo.audioInputLevel = parseInt(report.audioInputLevel, 10) || 0;
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
          if (_this6._haveConnectionMetrics) {
            return;
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
            var activeCandidatePairId = void 0;
            reports.forEach(function (_ref3) {
              var key = _ref3.key,
                  value = _ref3.value;

              var report = value;
              var selected = report.type === 'candidatepair' && report.selected;
              var specSepected = report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded';
              var chromeSelected = report.type === 'googCandidatePair' && report.googActiveConnection === 'true';
              if (selected || chromeSelected || specSepected) {
                activeCandidatePair = report;
              }

              if (report.selectedCandidatePairId) {
                activeCandidatePairId = report.selectedCandidatePairId;
              }

              event.dtlsCipher = event.dtlsCipher || report.dtlsCipher;
              event.srtpCipher = event.srtpCipher || report.srtpCipher;
            });

            if (!activeCandidatePair && activeCandidatePairId) {
              var report = reports.find(function (r) {
                return r.value.id === activeCandidatePairId;
              });
              if (report) {
                activeCandidatePair = report.value;
              }
            }

            if (activeCandidatePair) {
              var localId = activeCandidatePair.localCandidateId;
              var remoteId = activeCandidatePair.remoteCandidateId;
              var localCandidate = void 0,
                  remoteCandidate = void 0;

              reports.forEach(function (_ref4) {
                var key = _ref4.key,
                    value = _ref4.value;

                var report = value;
                if (localId && (report.type === 'localcandidate' || report.type === 'local-candidate') && report.id === localId) {
                  localCandidate = report;
                  event.localCandidateType = report.candidateType;
                }

                if (remoteId && (report.type === 'remotecandidate' || report.type === 'remote-candidate') && report.id === remoteId) {
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
                event.transport = localCandidate.transport || localCandidate.protocol;
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
            }
            _this6.emit('stats', event);
          });
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

            reports.forEach(function (_ref5) {
              var key = _ref5.key,
                  value = _ref5.value;

              var report = value;
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
