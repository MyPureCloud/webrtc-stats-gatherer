import { EventEmitter } from 'events';
import { FailureEvent, GetStatsEvent, StatsConnectEvent, TrackStats } from './interfaces';

export * from './interfaces';

let IS_BROWSER;

const MAX_CANDIDATE_WAIT_ATTEMPTS = 3;

export interface StatsGathererOpts {
  session?: string; // sessionId
  initiator?: string;
  conference?: string; // conversationId
  interval?: number;
  logger?: { error(...any); warn(...any) };
}

export default class StatsGatherer extends EventEmitter {
  private session: string;
  private initiator: string;
  private conference: string;

  private statsInterval: number;
  private pollingInterval: number;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private lastResult: Array<{ key: RTCStatsType; value: any }>;
  private lastActiveLocalCandidate: any;
  private lastActiveRemoteCandidate: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  private haveConnectionMetrics = false;
  private iceStartTime: number;
  private iceFailedTime: number;
  private iceConnectionTime: number;

  private logger: { error(...any); warn(...any) };

  private statsArr: Array<object> = [];

  constructor(
    public peerConnection: RTCPeerConnection,
    opts: StatsGathererOpts = {},
  ) {
    super();
    IS_BROWSER = typeof window !== 'undefined';

    this.session = opts.session;
    this.initiator = opts.initiator;
    this.conference = opts.conference;

    this.statsInterval = (opts.interval || 5) * 1000;

    this.logger = opts.logger || console;

    if (['new', 'checking'].includes(peerConnection.iceConnectionState)) {
      if (peerConnection.iceConnectionState === 'checking') {
        this.logger.warn(`iceConnectionState is already in checking state so ice connect time may not be accurate`);
        this.handleIceStateChange();
      }

      peerConnection.addEventListener('iceconnectionstatechange', this.handleIceStateChange.bind(this));
    }

    peerConnection.addEventListener('connectionstatechange', this.handleConnectionStateChange.bind(this));
    if (peerConnection.connectionState === 'connected') {
      this.pollForStats();
    }
  }

  private handleIceStateChange() {
    const state = this.peerConnection.iceConnectionState;

    if (state === 'checking') {
      if (IS_BROWSER) {
        this.iceStartTime = window.performance.now();
      }
    }

    if (state === 'connected') {
      if (this.haveConnectionMetrics) {
        return;
      }

      this.haveConnectionMetrics = true;
      let userAgent;
      let platform;
      let cores;
      if (IS_BROWSER) {
        this.iceConnectionTime = window.performance.now() - this.iceStartTime;
        userAgent = window.navigator.userAgent;
        platform = window.navigator.platform;
        cores = window.navigator.hardwareConcurrency;
      }

      const event: StatsConnectEvent = {
        name: 'connect',
        userAgent,
        platform,
        cores,
        session: this.session,
        conference: this.conference,
        connectTime: this.iceConnectionTime,
      };

      return this.waitForSelectedCandidatePair().then((stats) => {
        this.gatherSelectedCandidateInfo(stats, event);
        this.emit('stats', event);
      });
    }

    if (state === 'failed') {
      if (IS_BROWSER) {
        this.iceFailedTime = window.performance.now() - this.iceStartTime;
      }
      return this.gatherStats().then(() => {
        const event: FailureEvent = {
          name: 'failure',
          session: this.session,
          initiator: this.initiator,
          conference: this.conference,
          failTime: this.iceFailedTime,
          iceRW: 0,
          numLocalHostCandidates: 0,
          numLocalSrflxCandidates: 0,
          numLocalRelayCandidates: 0,
          numRemoteHostCandidates: 0,
          numRemoteSrflxCandidates: 0,
          numRemoteRelayCandidates: 0,
        };

        const localCandidates = this.peerConnection.localDescription.sdp.split('\r\n').filter(function (line) {
          return line.indexOf('a=candidate:') > -1;
        });
        const remoteCandidates = this.peerConnection.remoteDescription.sdp.split('\r\n').filter(function (line) {
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

        this.emit('stats', event);
      });
    }
  }

  private waitForSelectedCandidatePair(delay = 300, attempt = 1) {
    return this.gatherStats().then((reports) => {
      if (!this.getSelectedCandidatePair(reports)) {
        if (attempt > MAX_CANDIDATE_WAIT_ATTEMPTS) {
          return Promise.reject(new Error('Max wait attempts for connected candidate info reached'));
        }

        return new Promise((resolve, reject) => {
          setTimeout(() => this.waitForSelectedCandidatePair(delay, attempt + 1).then(resolve, reject), delay);
        });
      } else {
        return reports;
      }
    });
  }

  private getSelectedCandidatePair(reports) {
    let activeCandidatePair = null;
    reports.forEach(function ({ value }) {
      const report = value;
      const selected = report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded';

      if (selected) {
        activeCandidatePair = report;
      }
    });

    return activeCandidatePair;
  }

  private gatherSelectedCandidateInfo(reports, event) {
    const activeCandidatePair = this.getSelectedCandidatePair(reports);

    if (activeCandidatePair) {
      const localId = activeCandidatePair.localCandidateId;
      const remoteId = activeCandidatePair.remoteCandidateId;
      let localCandidate;
      let remoteCandidate;

      reports.forEach(function ({ value }) {
        const report = value;
        if (localId && report.type === 'local-candidate' && report.id === localId) {
          localCandidate = report;
          event.localCandidateType = report.candidateType;
        }

        if (remoteId && report.type === 'remote-candidate' && report.id === remoteId) {
          remoteCandidate = report;
          event.remoteCandidateType = report.candidateType;
        }
      });

      if (localCandidate && remoteCandidate) {
        event.candidatePair = localCandidate.candidateType + ';' + remoteCandidate.candidateType;
        event.candidatePairDetails = {
          local: localCandidate,
          remote: remoteCandidate,
          pair: activeCandidatePair,
        };
      }

      if (localCandidate) {
        event.transport = localCandidate.transport || localCandidate.protocol;
        if (localCandidate.priority) {
          // Chrome-specific mapping;
          // but only chrome has priority set on the candidate currently.
          const turnTypes = {
            2: 'udp',
            1: 'tcp',
            0: 'tls',
          };

          const priority = parseInt(localCandidate.priority, 10);
          event.turnType = turnTypes[priority >> 24];
          event.networkType = localCandidate.networkType;
        }

        event.usingIPv6 = localCandidate.ipAddress && localCandidate.ipAddress.indexOf('[') === 0;
      }
    }
  }

  private async handleConnectionStateChange() {
    const state = this.peerConnection.connectionState;

    if (state === 'connected') {
      this.pollForStats();
    } else if (state === 'disconnected') {
      if (this.peerConnection.signalingState !== 'stable') {
        return;
      }

      return this.gatherStats().then((reports) => {
        const event = this.createStatsReport(reports);
        event.type = 'disconnected';
        this.emit('stats', event);
      });
    } else if (['closed', 'failed'].includes(state) && this.pollingInterval) {
      if (IS_BROWSER) {
        window.clearInterval(this.pollingInterval);
      }
      this.pollingInterval = null;
    }
  }

  private pollForStats() {
    if (this.pollingInterval) {
      return;
    }

    const statsPoll = () => {
      return this.gatherStats().then((reports) => {
        if (reports.length === 0) {
          this.logger.warn('Empty stats gathered, ignoring and not emitting stats');
          return;
        }

        const event = this.createStatsReport(reports, true);
        if (event.tracks.length > 0 || event.remoteTracks.length > 0) {
          // If the last five stat events have a remote bitrate of 0, stop emitting.
          if (this.checkBitrate(event)) {
            this.emit('stats', event);
          }
        }
      });
    };

    if (IS_BROWSER) {
      window.setTimeout(statsPoll, 0);
      this.pollingInterval = window.setInterval(statsPoll, this.statsInterval);
    }
  }

  private checkBitrate(stat) {
    // If the stat does not have a bitrate of zero, automatically emit and clear the array.
    if (stat.remoteTracks.length && stat.remoteTracks[0]?.bitrate !== 0) {
      this.statsArr = [];
      return true;
    }

    // If we get five consecutive stats with zero bitrate, stop emitting.
    if (this.statsArr.length >= 5) {
      return false;
    }

    // Record stat with zero bitrate to array.
    this.statsArr.push(stat);
    return true;
  }

  private polyFillStats(results: RTCStatsReport): Array<{ key: RTCStatsType; value: unknown }> {
    if (!results) {
      return [];
    }

    if (Array.isArray(results)) {
      return results;
    }

    const betterResults = [];

    if (this.isNativeStatsReport(results)) {
      results.forEach((value, key) => {
        betterResults.push({ key, value });
      });
    } else if (Object.keys(results).length > 0) {
      Object.keys(results).forEach((key) => {
        betterResults.push({
          key,
          value: results[key],
        });
      });
    } else {
      this.logger.warn('Unknown stats results format, returning unmodified', results);
      return [];
    }
    return betterResults as Array<{ key: RTCStatsType; value: unknown }>;
  }

  private isNativeStatsReport(results: RTCStatsReport) {
    return typeof window.RTCStatsReport !== 'undefined' && results instanceof window.RTCStatsReport;
  }

  private async gatherStats(): Promise<Array<{ key: RTCStatsType; value: unknown }>> {
    try {
      if (['connecting', 'connected'].includes(this.peerConnection.connectionState)) {
        const stats = await this.peerConnection.getStats(null).then(this.polyFillStats.bind(this));
        return stats;
      } else if (this.peerConnection.connectionState === 'closed') {
        if (this.pollingInterval) {
          if (IS_BROWSER) {
            window.clearInterval(this.pollingInterval);
          }
          this.pollingInterval = null;
        }
        return [];
      } else {
        return [];
      }
    } catch (e) {
      this.logger.error(
        'Failed to gather stats. Are you using RTCPeerConnection as your connection? {expect peerconnection.getStats}',
        { peerConnection: this.peerConnection, err: e },
      );
      return Promise.reject(e);
    }
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private createStatsReport(
    results: Array<{ key: RTCStatsType; value: any }>,
    updateLastResult: boolean = true,
  ): GetStatsEvent {
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const event: GetStatsEvent = {
      name: 'getStats',
      session: this.session,
      initiator: this.initiator,
      conference: this.conference,
      tracks: [],
      remoteTracks: [],
    };

    if (results.length === 0) {
      return event;
    }

    const sources = results.filter((r) => ['inbound-rtp', 'outbound-rtp'].indexOf(r.value.type) > -1);

    sources.forEach((source) => {
      this.processSource({
        source: source.value,
        event,
        results,
      });
    });

    const candidatePair = results.find(
      (r) => r.value.type === 'candidate-pair' && r.value.state === 'succeeded' && r.value.nominated === true,
    );
    if (candidatePair) {
      this.processSelectedCandidatePair({
        report: candidatePair.value,
        event,
        results,
      });
    }

    if (updateLastResult) {
      this.lastResult = results;
    }

    return event;
  }

  // todo source should be RTCInboundRTPStreamStats | RTCOutboundRTPStreamStats but the lib.dom definitions are out of date or not accurate
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private processSource({
    source,
    results,
    event,
  }: {
    source: any;
    results: Array<{ key: RTCStatsType; value: any }>;
    event: GetStatsEvent;
  }) {
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const now = new Date(source.timestamp);

    // todo lastResultSource should be RTCInboundRTPStreamStats | RTCOutboundRTPStreamStats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastResultSource: any = this.lastResult && this.lastResult.find((r) => r.key === source.id);
    lastResultSource = lastResultSource && lastResultSource.value;

    let lastResultRemoteSource;
    if (lastResultSource) {
      lastResultRemoteSource = this.lastResult && this.lastResult.find((r) => r.value.localId === lastResultSource.id);
      lastResultRemoteSource = lastResultRemoteSource && lastResultRemoteSource.value;
    }

    // for outbound-rtp, the correspondingRemoteSource will be remote-inbound-rtp
    // for inbound-rtp, the correspondingRemoteSource will be remote-outbound-rtp
    let correspondingRemoteSource;
    let transport;
    let candidatePair;
    let track;
    let mediaSource;
    let codec;

    results.forEach((r) => {
      if (r.value.localId === source.id) {
        correspondingRemoteSource = r.value;
      } else if (r.key === source.transportId) {
        transport = r.value;
      } else if (r.key === source.trackId) {
        track = r.value;
      } else if (r.key === source.mediaSourceId) {
        mediaSource = r.value;
      } else if (r.key === source.codecId) {
        codec = r.value;
      }
    });
    if (transport) {
      candidatePair = results.find((r) => r.key === transport.selectedCandidatePairId);
      candidatePair = candidatePair && candidatePair.value;
    }

    if (candidatePair) {
      event.candidatePairHadActiveSource = true;
    }

    const kind = source.kind || source.mediaType;
    const isOutbound = source.type === 'outbound-rtp';
    const trackInfo: TrackStats = {
      track: track && track.trackIdentifier,
      kind,
      jitter: getDefinedValue('jitter', source, correspondingRemoteSource),
      roundTripTime: getDefinedValue('roundTripTime', source, correspondingRemoteSource),
      packetsLost: getDefinedValue('packetsLost', source, correspondingRemoteSource) || 0,
      packetLoss: 0,
      bytes: parseInt(isOutbound ? source.bytesSent : source.bytesReceived, 10) || 0,
    };

    if (codec) {
      trackInfo.codec = `${codec.payloadType} ${codec.mimeType} ${codec.clockRate}`;
    }

    if (lastResultSource) {
      const previousBytesTotal =
        parseInt(isOutbound ? lastResultSource.bytesSent : lastResultSource.bytesReceived, 10) || 0;
      const deltaTime = now.getTime() - new Date(lastResultSource.timestamp).getTime();
      trackInfo.bitrate = Math.floor((8 * (trackInfo.bytes - previousBytesTotal)) / deltaTime);
    }

    const lastPacketsLost = getDefinedValue('packetsLost', lastResultSource, lastResultRemoteSource);

    if (isOutbound) {
      trackInfo.packetsSent = source.packetsSent;
      trackInfo.packetLoss = (trackInfo.packetsLost / (trackInfo.packetsSent || 1)) * 100;

      if (lastResultSource) {
        trackInfo.intervalPacketsSent = trackInfo.packetsSent - (lastResultSource.packetsSent || 0);
        trackInfo.intervalPacketsLost = trackInfo.packetsLost - (lastPacketsLost || 0);
        trackInfo.intervalPacketLoss = (trackInfo.intervalPacketsLost / (trackInfo.intervalPacketsSent || 1)) * 100;
      }

      trackInfo.retransmittedBytesSent = source.retransmittedBytesSent;
      trackInfo.retransmittedPacketsSent = source.retransmittedPacketsSent;
    } else {
      trackInfo.packetsReceived = source.packetsReceived;
      trackInfo.packetLoss = (trackInfo.packetsLost / (trackInfo.packetsReceived || 1)) * 100;

      if (lastResultSource) {
        trackInfo.intervalPacketsReceived = trackInfo.packetsReceived - lastResultSource.packetsReceived;
        trackInfo.intervalPacketsLost = trackInfo.packetsLost - lastPacketsLost;
        trackInfo.intervalPacketLoss = (trackInfo.intervalPacketsLost / (trackInfo.intervalPacketsReceived || 1)) * 100;
      }
    }

    if (track && kind === 'audio') {
      if (track.remoteSource) {
        trackInfo.audioLevel = track.audioLevel;
        trackInfo.totalAudioEnergy = track.totalAudioEnergy;
      } else {
        trackInfo.echoReturnLoss = track.echoReturnLoss;
        trackInfo.echoReturnLossEnhancement = track.echoReturnLossEnhancement;
      }
    }

    if (kind === 'audio' && mediaSource && (!track || !track.remoteSource)) {
      trackInfo.audioLevel = mediaSource.audioLevel;
      trackInfo.totalAudioEnergy = mediaSource.totalAudioEnergy;
    }

    // remove undefined properties from trackInfo
    Object.keys(trackInfo).forEach((key) => trackInfo[key] === undefined && delete trackInfo[key]);

    if (isOutbound) {
      event.tracks.push(trackInfo);
    } else {
      event.remoteTracks.push(trackInfo);
    }
  }

  private processSelectedCandidatePair({ report, event, results }) {
    // this is the active candidate pair, check if it's the same id as last one
    const localId = report.localCandidateId;
    const remoteId = report.remoteCandidateId;

    event.localCandidateChanged = !!this.lastActiveLocalCandidate && localId !== this.lastActiveLocalCandidate.id;
    event.remoteCandidateChanged = !!this.lastActiveRemoteCandidate && remoteId !== this.lastActiveRemoteCandidate.id;

    if (!this.lastActiveLocalCandidate || event.localCandidateChanged || event.remoteCandidateChanged) {
      results.forEach((result) => {
        this.checkLastActiveCandidate({
          localId,
          remoteId,
          report: result.value,
        });
      });
    }

    if (this.lastActiveLocalCandidate) {
      event.networkType = this.lastActiveLocalCandidate.networkType;
      if (this.lastActiveRemoteCandidate) {
        event.candidatePair =
          this.lastActiveLocalCandidate.candidateType + ';' + this.lastActiveRemoteCandidate.candidateType;
      }
    }

    event.bytesSent = report.bytesSent;
    event.bytesReceived = report.bytesReceived;
    event.requestsReceived = report.requestsReceived;
    event.requestsSent = report.requestsSent;
    event.responsesReceived = report.responsesReceived;
    event.responsesSent = report.responsesSent;
    event.consentRequestsSent = report.consentRequestsSent;
    event.totalRoundTripTime = report.totalRoundTripTime;
  }

  private checkLastActiveCandidate({ localId, remoteId, report }) {
    if (localId && report.type === 'local-candidate' && report.id === localId) {
      this.lastActiveLocalCandidate = report;
    }
    if (remoteId && report.type === 'remote-candidate' && report.id === remoteId) {
      this.lastActiveRemoteCandidate = report;
    }
  }
}

// returns the first value in the list of objects that is not undefined or null
function getDefinedValue(propertyName, ...objects) {
  const item = objects.find((obj) => obj && (obj[propertyName] || obj[propertyName] === 0));
  return item && item[propertyName];
}
