# WebRTC Stats Gatherer

[![Greenkeeper badge](https://badges.greenkeeper.io/MyPureCloud/webrtc-stats-gatherer.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/MyPureCloud/webrtc-stats-gatherer.svg?branch=master)](https://travis-ci.org/MyPureCloud/webrtc-stats-gatherer)

[![Coverage Status](https://coveralls.io/repos/github/MyPureCloud/webrtc-stats-gatherer/badge.svg?branch=master)](https://coveralls.io/github/MyPureCloud/webrtc-stats-gatherer?branch=master)

This module is designed to collect RTCPeerConnection stats on a regular interval
and emit stats and trace data as appropriate.

## API

`constructor(peerConnection, opts)`

`collectStats()`

`collectTraces()`

`collectInitialConnectionStats`
