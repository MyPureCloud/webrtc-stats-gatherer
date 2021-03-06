# WebRTC Stats Gatherer

[![Greenkeeper badge](https://badges.greenkeeper.io/MyPureCloud/webrtc-stats-gatherer.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/MyPureCloud/webrtc-stats-gatherer.svg?branch=master)](https://travis-ci.org/MyPureCloud/webrtc-stats-gatherer)

[![Coverage Status](https://coveralls.io/repos/github/MyPureCloud/webrtc-stats-gatherer/badge.svg?branch=master)](https://coveralls.io/github/MyPureCloud/webrtc-stats-gatherer?branch=master)

This module is designed to collect [RTCPeerConnection](https://github.com/otalk/rtcpeerconnection) stats on a regular interval
and emit stats and trace data as appropriate.

Note that this project makes use of event emitting capabilities of [RTCPeerConnection](https://github.com/otalk/rtcpeerconnection) as opposed to a raw browser RTCPeerConnection.

## API

`constructor(peerConnection: RTCPeerConnection, opts: StatsGathererOpts)`

```
interface StatsGathererOpts {
  session?: string;     // sessionId
  initiator?: string;
  conference?: string;  // conversationId
  interval?: number;    // interval, in seconds, at which stats are polled (default to 5)
  logger?: any;         // defaults to console
}
```

## Usage
```
import StatsGatherer from 'webrtc-stats-gatherer';

const gatherer = new StatsGatherer(myPeerConnection);
gatherer.on('stats', (statsEvent) => doSomethingWithStats(statsEvent));
```