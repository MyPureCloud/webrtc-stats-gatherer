/* tslint:disable:no-string-literal */
import StatsGatherer from '../src';

import mockSpecStatsInitial from './mock-spec-stats-initial.json';
import mockSpecStats1 from './mock-spec-stats-1.json';
import mockSpecStats2 from './mock-spec-stats-2.json';
import mockSpecStats3 from './mock-spec-stats-3.json';
import mockStatsRecvOnly from './mock-spec-stats-recvonly.json';
import mockSdp from './mock-sdp.json';

// if (typeof window === 'undefined') {
//   global.window = {
//     navigator: {
//       userAgent: 'user-agent',
//       hardwareConcurrency: 8,
//       platform: 'tests'
//     },
//     performance: {
//       now: () => new Date().getTime()
//     },
//     location: { 'host': 'localhost', 'protocol': 'http' }
//   };

//   global.window.setTimeout = setTimeout.bind(global.window);
//   global.window.setInterval = setInterval.bind(global.window);
//   global.window.clearInterval = clearInterval.bind(global.window);
// }

class MockRtcPeerConnection extends EventTarget {
  constructor () {
    super();
  }

  getStats () {
    return Promise.resolve();
  }
}

describe('StatsGatherer', () => {
  let rtcPeerConnection;

  beforeEach(function () {
    rtcPeerConnection = new MockRtcPeerConnection();
  });

  describe('constructor', function () {
    it('should accept options and initialize the class', function () {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      expect(gatherer.peerConnection).toEqual(rtcPeerConnection);
      expect(gatherer['statsInterval']).toEqual(5000);
    });

    it('should poll stats immediately if already connected', () => {
      jest.useFakeTimers();
      rtcPeerConnection.connectionState = 'connected';
      const spy = jest.spyOn(rtcPeerConnection, 'getStats');
      const gatherer = new StatsGatherer(rtcPeerConnection);

      jest.advanceTimersByTime(500);

      expect(spy).toHaveBeenCalled();
      jest.useRealTimers()
    });

    it('should warn if iceConnectionState is already checking', () => {
      const logger = {
        warn: jest.fn()
      };

      rtcPeerConnection.iceConnectionState = 'checking';

      const gatherer = new StatsGatherer(rtcPeerConnection, { logger });

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('iceConnectionState is already in checking'));
    });
  });

  describe('_gatherStats', function () {
    it('should call into the native getstats method', function () {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      jest.spyOn(gatherer.peerConnection, 'getStats').mockResolvedValue(mockSpecStats1 as any);
      return gatherer['gatherStats']();
    });
  });

  describe('createStatsReport', function () {
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

        gatherer['createStatsReport'](stats1, true);
        const report2 = gatherer['createStatsReport'](stats2, true);
        expect(report2.tracks[0].intervalPacketLoss).toEqual(6);
      });
    });

    describe('basic stats checking', function () {
      beforeEach(function () {
        report1 = gatherer['createStatsReport'](mockSpecStats1, true);
        report2 = gatherer['createStatsReport'](mockSpecStats2, true);
        report3 = gatherer['createStatsReport'](mockSpecStats3, true);
      });

      it('should create a report', function () {
        expect(report1).toBeTruthy();
        expect(report1.name).toEqual('getStats');
        expect(report1.session).toEqual(opts.session);
        expect(report1.conference).toEqual(opts.conference);
        expect(report1.tracks.length).toEqual(2);
        expect(report1.networkType).toEqual('ethernet');
        expect(report1.localCandidateChanged).toEqual(false);
        expect(report1.candidatePair).toEqual('prflx;host');

        expect(report2).toBeTruthy();
        expect(report2.session).toEqual(opts.session);
        expect(report2.conference).toEqual(opts.conference);
        expect(report2.tracks.length).toEqual(2);
        expect(report2.name).toEqual('getStats');
        // report 2 has same candidates
        expect(report2.localCandidateChanged).toEqual(false);
        expect(report2.networkType).toEqual('ethernet');
        expect(report2.candidatePair).toEqual('prflx;host');
        expect(report2.candidatePairHadActiveSource).toEqual(true);

        expect(report2).toBeTruthy();
        expect(report3.name).toEqual('getStats');
        expect(report3.session).toEqual(opts.session);
        expect(report3.conference).toEqual(opts.conference);
        expect(report3.tracks.length).toEqual(0);
        // report 3 has different candidates
        expect(report3.localCandidateChanged).toEqual(true);
        expect(report2.networkType).toEqual('ethernet');
        expect(report2.candidatePair).toEqual('prflx;host');
      });

      it('should accurately get track properties for the report', function () {
        const audioTrack = report2.tracks[0];
        expect(audioTrack.track).toBeTruthy();
        expect(audioTrack.bitrate).toBeTruthy();
        expect(isNaN(audioTrack.bitrate)).toBeFalsy();
        expect(audioTrack.kind).toEqual('audio');
        expect(audioTrack.packetLoss).toEqual(0.04030632809351068);
        expect(audioTrack.jitter).toEqual(0.0017708333333333332);
        expect(audioTrack.echoReturnLoss).toEqual(-100);
        expect(audioTrack.echoReturnLossEnhancement).toEqual(0.18);
        expect(audioTrack.audioLevel).toEqual(0.0008239997558519242);
        expect(audioTrack.totalAudioEnergy).toEqual(1.227674190176716);
        expect(audioTrack.codec).toEqual('111 audio/opus 48000');

        const videoTrack = report2.tracks[1];
        expect(videoTrack.track).toBeTruthy();
        expect(videoTrack.bitrate).toBeTruthy();
        expect(videoTrack.bitrate).toEqual(527);
        expect(videoTrack.kind).toEqual('video');
        expect(videoTrack.packetLoss).toEqual(0.565859792518076);
        expect(videoTrack.codec).toEqual('100 video/VP8 90000');
      });

      // the test data is kind of bad for testing this since it requires
      // two stats reports which include the same track for most things, and in
      // the current state, it only has remote stats in mock-spec-stats-2, so there's no
      // delta to measure loss, bitrate, etc
      it('should include remote tracks', function () {
        expect(report2.remoteTracks.length).toEqual(2);
        const audioTrack = report2.remoteTracks[0];
        expect(audioTrack.track).toBeTruthy();
        expect(audioTrack.audioLevel).toEqual(0.0008239997558519242);
        expect(audioTrack.totalAudioEnergy).toEqual(2.077036001267227);
        expect(audioTrack.codec).toEqual('111 audio/opus 48000');

        const videoTrack = report2.remoteTracks[1];
        expect(videoTrack.track).toBeTruthy();
        expect(videoTrack.bytes).toEqual(7637399);
        expect(videoTrack.codec).toEqual('100 video/VP8 90000');
      });

      it.skip('should properly determine a track kind', () => {});
      it.skip('should determine bitrate accurately', () => {});
      it.skip('should determine the track kind from the code type if not available otherwise', () => {});
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
      gatherer.peerConnection.iceConnectionState = 'closed';
      const event = new Event('iceconnectionstatechange');
      gatherer.peerConnection.dispatchEvent(event);
    });

    it.skip('should setup a polling interval when connected', () => {});
    it.skip('should emit a stats event if already disconnected', () => {});

    it('should collect stats for a recvonly stream', () => {
      return new Promise((resolve) => {
        jest.spyOn(gatherer.peerConnection, 'getStats').mockResolvedValue(mockStatsRecvOnly);

        let gotInitial = false;
        gatherer.statsInterval = 10;

        gatherer.on('stats', function (stats) {
          if (gotInitial) {
            expect(stats).toBeTruthy();
            gatherer.peerConnection.iceConnectionState = 'closed';
            var event = new Event('iceconnectionstatechange');
            gatherer.peerConnection.dispatchEvent(event);

            expect(stats.remoteTracks.length).toEqual(1);
            expect(stats.remoteTracks[0].bytes).toEqual(7637399);
            resolve();
          } else {
            console.log('got initial');
            gotInitial = true;
          }
        });
        gatherer.peerConnection.connectionState = 'connected';
        const event = new Event('connectionstatechange');
        gatherer.peerConnection.dispatchEvent(event);
      });
    });
  });

  describe('collectInitialConnectionStats', function () {
    let opts, gatherer;

    beforeEach(function () {
      opts = {
        session: {},
        conference: {}
      };
      rtcPeerConnection.iceConnectionState = 'new';
      gatherer = new StatsGatherer(rtcPeerConnection, opts);
    });

    afterEach(function () {
      gatherer.peerConnection.iceConnectionState = 'closed';
      const event = new Event('iceconnectionstatechange');
      gatherer.peerConnection.dispatchEvent(event);
    });

    it('should get emit a stats event with all of the initial connection information', function (done) {
      jest.spyOn(gatherer.peerConnection, 'getStats').mockResolvedValue(mockSpecStatsInitial);
      gatherer.on('stats', function (stats) {
        expect(stats.cores).toBeTruthy();
        expect(stats.networkType).toEqual('ethernet');
        expect(stats.candidatePair).toEqual('prflx;host');
        expect(stats.candidatePairDetails).toBeTruthy();
        done();
      });
      gatherer.peerConnection.iceConnectionState = 'connected';
      const event = new Event('iceconnectionstatechange');
      gatherer.peerConnection.dispatchEvent(event);
    });

    it('should emit a failure report if the state is failed', function (done) {
      jest.spyOn(gatherer.peerConnection, 'getStats').mockResolvedValue(mockSpecStats1);
      gatherer.on('stats', function (event) {
        expect(event.name).toEqual('failure');
        try {
          expect(event.numLocalHostCandidates > 0).toBeTruthy();
          expect(event.numLocalSrflxCandidates > 0).toBeTruthy();
          expect(event.numLocalRelayCandidates > 0).toBeTruthy();
          expect(event.numRemoteHostCandidates > 0).toBeTruthy();
          expect(event.numRemoteSrflxCandidates > 0).toBeTruthy();
          expect(event.numRemoteRelayCandidates > 0).toBeTruthy();
          done();
        } catch (e) {
          done(e);
        }
      });
      gatherer.peerConnection.iceConnectionState = 'failed';
      gatherer.peerConnection.localDescription = { sdp: mockSdp.sdp };
      gatherer.peerConnection.remoteDescription = { sdp: mockSdp.sdp };
      const event = new Event('iceconnectionstatechange');
      gatherer.peerConnection.dispatchEvent(event);
    });
  });

  describe('gatherStats', function () {
    it('should log failure', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      const err = new Error('fake Error');
      jest.spyOn(rtcPeerConnection, 'getStats').mockRejectedValue(err);
      const loggerSpy = jest.spyOn(gatherer['logger'], 'error').mockReturnValueOnce(null);

      await expect(gatherer['gatherStats']()).rejects.toThrowError();
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to gather stats'), { peerConnection: rtcPeerConnection, err });
    });
  });

  describe('polyFillStats', () => {
    it('should convert statsMap to array', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      const map = new Map();
      map.set('one', {});
      map.set('two', { roger: 'dodger' });

      jest.spyOn(gatherer as any, 'isNativeStatsReport').mockReturnValue(true);

      const stats = gatherer['polyFillStats'](map as any);
      expect(stats).toEqual([
        {
          key: 'one',
          value: {}
        },
        {
          key: 'two',
          value: {
            roger: 'dodger'
          }
        }
      ]);
    });

    it('should return empty array if no stats', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      const stats = gatherer['polyFillStats'](null as any);
      expect(stats).toEqual([]);
    });

    it('should return results if already an array', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      const stats = gatherer['polyFillStats']([] as any);
      expect(stats).toEqual([]);
    });

    it('should convert map to array', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      const map = {
        one: {},
        two: {
          roger: 'dodger'
        }
      };

      const stats = gatherer['polyFillStats'](map as any);
      expect(stats).toEqual([
        {
          key: 'one',
          value: {}
        },
        {
          key: 'two',
          value: {
            roger: 'dodger'
          }
        }
      ]);
    });

    it('should return empty array if empty object', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      const map = new Map();
      map.set('one', {});
      map.set('two', { roger: 'dodger' });

      const stats = gatherer['polyFillStats']({} as any);
      expect(stats).toEqual([]);
    });
  });

  describe('pollForStats', () => {
    it('should not poll stats if there is already an interval', () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      gatherer['pollingInterval'] = 101280;
      const timeout = jest.spyOn(window, 'setTimeout');
      const interval = jest.spyOn(window, 'setInterval');

      gatherer['pollForStats']();

      expect(timeout).not.toHaveBeenCalled();
      expect(interval).not.toHaveBeenCalled();
    });
  });

  describe('checkBitrate', () => {
    it('should return false if the last five remote audio bitrates are zero', () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      const stat = {
        remoteTracks: [{bitrate: 0}]
      };
      gatherer['statsArr'] = [stat, stat, stat, stat, stat];

      expect(gatherer['checkBitrate'](stat)).toEqual(false);

    });

    it('should return true if the bitrate is zero but array is not full.', () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      const stat = {
        remoteTracks: [{bitrate: 0}]
      };
      gatherer['statsArr'] = [];

      expect(gatherer['checkBitrate'](stat)).toEqual(true);

    });
  })
  describe('handleConnectionStateChange', () => {
    it('should pollStats if connected', () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      rtcPeerConnection.connectionState = 'connected';

      const spy = jest.spyOn(gatherer as any, 'pollForStats').mockReturnValue(null);
      gatherer['handleConnectionStateChange']();

      expect(spy).toHaveBeenCalled();
    });

    it('should do nothing if signaling state is not stable', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      rtcPeerConnection.connectionState = 'disconnected';
      rtcPeerConnection.signalingState = 'bleh';

      const pollSpy = jest.spyOn(gatherer as any, 'pollForStats').mockReturnValue(null);
      const gatherSpy = jest.spyOn(gatherer as any, 'gatherStats').mockResolvedValue(null);
      const reportSpy = jest.spyOn(gatherer as any, 'createStatsReport').mockReturnValue({} as any);
      const intervalSpy = jest.spyOn(window, 'clearInterval');

      gatherer.on('stats', (event) => {
        expect(event.type).toEqual('disconnected');
      });
      await gatherer['handleConnectionStateChange']();

      expect(pollSpy).not.toHaveBeenCalled();
      expect(gatherSpy).not.toHaveBeenCalled();
      expect(intervalSpy).not.toHaveBeenCalled();
      expect(pollSpy).not.toHaveBeenCalled();
      expect.assertions(4);
    });

    it('should generate a statsReport on disconnect', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      rtcPeerConnection.connectionState = 'disconnected';
      rtcPeerConnection.signalingState = 'stable';

      const pollSpy = jest.spyOn(gatherer as any, 'pollForStats').mockReturnValue(null);
      const gatherSpy = jest.spyOn(gatherer as any, 'gatherStats').mockResolvedValue(null);
      const reportSpy = jest.spyOn(gatherer as any, 'createStatsReport').mockReturnValue({} as any);

      gatherer.on('stats', (event) => {
        expect(event.type).toEqual('disconnected');
      });
      await gatherer['handleConnectionStateChange']();

      expect(pollSpy).not.toHaveBeenCalled();
      expect.assertions(2);
    });

    it('should clear interval if closed', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      gatherer['pollingInterval'] = 12412;
      rtcPeerConnection.connectionState = 'closed';
      rtcPeerConnection.signalingState = 'bleh';

      const pollSpy = jest.spyOn(gatherer as any, 'pollForStats').mockReturnValue(null);
      const gatherSpy = jest.spyOn(gatherer as any, 'gatherStats').mockResolvedValue(null);
      const reportSpy = jest.spyOn(gatherer as any, 'createStatsReport').mockReturnValue({} as any);
      const intervalSpy = jest.spyOn(window, 'clearInterval');

      gatherer.on('stats', (event) => {
        expect(event.type).toEqual('disconnected');
      });
      await gatherer['handleConnectionStateChange']();

      expect(pollSpy).not.toHaveBeenCalled();
      expect(gatherSpy).not.toHaveBeenCalled();
      expect(intervalSpy).toHaveBeenCalled();
      expect(pollSpy).not.toHaveBeenCalled();
      expect.assertions(4);
    });
  });

  describe('waitForSelectedCandidatePair', () => {
    let reportWithCandidatePair: any;

    beforeEach(() => {
      jest.useFakeTimers();
      reportWithCandidatePair = [
        {
          key: 'RTCIceCandidatePair_WzsdBtXT_nq8LUB9k',
          value: {
            id: 'RTCIceCandidatePair_WzsdBtXT_nq8LUB9k',
            timestamp: 1571687916415.012,
            type: 'candidate-pair',
            transportId: 'RTCTransport_audio_1',
            localCandidateId: 'RTCIceCandidate_WzsdBtXT',
            remoteCandidateId: 'RTCIceCandidate_nq8LUB9k',
            state: 'in-progress',
            priority: 7962116751041233000,
            nominated: false,
            writable: true,
            bytesSent: 155,
            bytesReceived: 0,
            totalRoundTripTime: 0.047,
            currentRoundTripTime: 0.047,
            requestsReceived: 0,
            requestsSent: 1,
            responsesReceived: 1,
            responsesSent: 0,
            consentRequestsSent: 1
          }
        },
        {
          key: 'RTCIceCandidatePair_yI+kvNvF_kJy6c1E9',
          value: {
            id: 'RTCIceCandidatePair_yI+kvNvF_kJy6c1E9',
            timestamp: 1571687916415.012,
            type: 'candidate-pair',
            transportId: 'RTCTransport_audio_1',
            localCandidateId: 'RTCIceCandidate_yI+kvNvF',
            remoteCandidateId: 'RTCIceCandidate_kJy6c1E9',
            state: 'waiting',
            priority: 179896594039051780,
            nominated: false,
            writable: false,
            bytesSent: 0,
            bytesReceived: 0,
            totalRoundTripTime: 0,
            requestsReceived: 0,
            requestsSent: 0,
            responsesReceived: 0,
            responsesSent: 0,
            consentRequestsSent: 0
          }
        },
      ]
    });

    it('should wait for candidate pair', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      const gatherSpy = jest.spyOn(gatherer as any, 'gatherStats')
        .mockImplementationOnce(() => Promise.resolve(reportWithCandidatePair))
        .mockImplementationOnce(() => {
          reportWithCandidatePair[0].value.state = 'succeeded';
          return Promise.resolve(reportWithCandidatePair);
        })
        .mockImplementationOnce(() => {
          reportWithCandidatePair[0].value.nominated = true;
          return Promise.resolve(reportWithCandidatePair);
        });

      const promise = gatherer['waitForSelectedCandidatePair']();
      await Promise.resolve();
      expect(gatherSpy).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(250);
      expect(gatherSpy).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(51);
      expect(gatherSpy).toHaveBeenCalledTimes(2);
      await Promise.resolve();
      jest.advanceTimersByTime(300);
      expect(gatherSpy).toHaveBeenCalledTimes(3);
      await Promise.resolve();

      await promise;

      // make sure we stopped polling for stats
      jest.advanceTimersByTime(1300);
      expect(gatherSpy).toHaveBeenCalledTimes(3);
    });

    it('should fail after too many tries', async () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);

      const gatherSpy = jest.spyOn(gatherer as any, 'gatherStats').mockResolvedValue(reportWithCandidatePair);

      const promise = gatherer['waitForSelectedCandidatePair']();
      await Promise.resolve();
      expect(gatherSpy).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(250);
      expect(gatherSpy).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(51);
      expect(gatherSpy).toHaveBeenCalledTimes(2);
      await Promise.resolve();
      jest.advanceTimersByTime(300);
      expect(gatherSpy).toHaveBeenCalledTimes(3);
      await Promise.resolve();
      jest.advanceTimersByTime(300);
      expect(gatherSpy).toHaveBeenCalledTimes(4);

      await expect(promise).rejects.toThrowError(/Max wait attempts/);

      // make sure we stopped polling for stats
      jest.advanceTimersByTime(1300);
      expect(gatherSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('handleIceStateChange', () => {
    it('should do nothing if connected and already have connection metrics', () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      rtcPeerConnection.iceConnectionState = 'connected';
      gatherer['haveConnectionMetrics'] = true;
      const gatherSpy = jest.spyOn(gatherer as any, 'waitForSelectedCandidatePair');

      gatherer['handleIceStateChange']();

      expect(gatherSpy).not.toHaveBeenCalled();
    });

    it('should set iceStartTime', () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      rtcPeerConnection.iceConnectionState = 'checking';
      const gatherSpy = jest.spyOn(gatherer as any, 'waitForSelectedCandidatePair');

      expect(gatherer['iceStartTime']).toBeFalsy();

      gatherer['handleIceStateChange']();

      expect(gatherSpy).not.toHaveBeenCalled();
      expect(gatherer['iceStartTime']).toBeTruthy();
    });
  });

  describe('processSelectedCandidatePair', () => {
    it('should set network pair', () => {
      const gatherer = new StatsGatherer(rtcPeerConnection);
      gatherer['lastActiveLocalCandidate'] = { networkType: 'srflx' };
      gatherer['lastActiveRemoteCandidate'] = { networkType: 'prflx' };

      const event: any = {};

      const candidatePairReport = mockSpecStats1.find((report) => report.key === 'RTCIceCandidatePair_WzsdBtXT_nq8LUB9k');
      gatherer['processSelectedCandidatePair']({ results: mockSpecStats1, event, report: candidatePairReport.value });

      expect(event.candidatePair).toEqual('prflx;host');
    });

  });
});
