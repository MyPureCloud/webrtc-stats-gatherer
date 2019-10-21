import WildEmitter from 'wildemitter';

let IS_BROWSER;

class StatsGatherer extends WildEmitter {
  constructor (peerConnection, opts = {}) {
    IS_BROWSER = typeof window !== 'undefined';
    super();

    this.connection = peerConnection;
    this.session = opts.session;
    this.initiator = opts.initiator;
    this.conference = opts.conference;

    this.statsInterval = (opts.interval || 5) * 1000;
    this.lastResult = null;
    this.lastActiveLocalCandidate = null;

    this._pollingInterval = null;

    this._haveConnectionMetrics = false;
    this._iceStartTime = null;
    this._iceConnectionTime = null;

    this.traceData = [];

    this.logger = opts.logger || console;

    this.collectTraces();
  }

  _polyFillStats (results) {
    if (!results || Array.isArray(results)) {
      return results;
    }
    const betterResults = [];
    if (typeof window.RTCStatsReport !== 'undefined' && results instanceof window.RTCStatsReport) {
      results.forEach((value, key) => {
        betterResults.push({ key, value });
      });
    } else if (Object.keys(results).length > 0) {
      Object.keys(results).forEach(key => {
        betterResults.push({
          key,
          value: results[key]
        });
      });
    } else {
      this.logger.warn('Unknown stats results format, returning unmodified', results);
      return results;
    }
    return betterResults;
  }

  _gatherStats () {
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

  _checkLastActiveCandidate ({ localId, remoteId, key, report }) {
    if (localId && report.type === 'local-candidate' && report.id === localId) {
      this.lastActiveLocalCandidate = report;
    }
    if (remoteId && report.type === 'remote-candidate' && report.id === remoteId) {
      this.lastActiveRemoteCandidate = report;
    }
  }

  _processSelectedCandidatePair ({ report, event, results }) {
    // this is the active candidate pair, check if it's the same id as last one
    const localId = report.localCandidateId;
    const remoteId = report.remoteCandidateId;

    event.localCandidateChanged = !!this.lastActiveLocalCandidate && localId !== this.lastActiveLocalCandidate.id;
    event.remoteCandidateChanged = !!this.lastActiveRemoteCandidate && remoteId !== this.lastActiveRemoteCandidate.id;

    if (!this.lastActiveLocalCandidate || event.localCandidateChanged || event.remoteCandidateChanged) {
      results.forEach(result => {
        this._checkLastActiveCandidate({
          localId,
          remoteId,
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

    event.bytesSent = report.bytesSent;
    event.bytesReceived = report.bytesReceived;
    event.requestsReceived = report.requestsReceived;
    event.requestsSent = report.requestsSent;
    event.responsesReceived = report.responsesReceived;
    event.responsesSent = report.responsesSent;
    event.consentRequestsSent = report.consentRequestsSent;
    event.totalRoundTripTime = report.totalRoundTripTime;
  }

  _processSource ({ source, results, event }) {
    const now = new Date(source.timestamp);

    let lastResultSource, lastResultRemoteSource;

    lastResultSource = this.lastResult && this.lastResult.find(r => r.key === source.id);
    lastResultSource = lastResultSource && lastResultSource.value;
    if (lastResultSource) {
      lastResultRemoteSource = this.lastResult && this.lastResult.find(r => r.value.localId === lastResultSource.id);
      lastResultRemoteSource = lastResultRemoteSource && lastResultRemoteSource.value;
    }

    // for outbound-rtp, the correspondingRemoteSource will be remote-inbound-rtp
    // for inbound-rtp, the correspondingRemoteSource will be remote-outbound-rtp
    let correspondingRemoteSource, transport, candidatePair, track, mediaSource, codec;
    results.forEach(r => {
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
      candidatePair = results.find(r => r.key === transport.selectedCandidatePairId);
      candidatePair = candidatePair && candidatePair.value;
    }

    if (candidatePair) {
      event.candidatePairHadActiveSource = true;
    }

    const kind = source.kind || source.mediaType;
    const isOutbound = source.type === 'outbound-rtp';

    const bytes = parseInt(isOutbound ? source.bytesSent : source.bytesReceived, 10) || 0;
    let bitrate;
    if (lastResultSource) {
      const previousBytesTotal = parseInt(isOutbound ? lastResultSource.bytesSent : lastResultSource.bytesReceived, 10) || 0;
      const deltaTime = now - new Date(lastResultSource.timestamp);
      bitrate = Math.floor(8 * (bytes - previousBytesTotal) / deltaTime);
    }

    let roundTripTime, jitter, packetsLost, packetsSent, packetLoss;
    if (correspondingRemoteSource) {
      roundTripTime = correspondingRemoteSource.roundTripTime;
      jitter = correspondingRemoteSource.jitter;
      packetsLost = correspondingRemoteSource.packetsLost;
      packetsSent = source.packetsSent;
      packetLoss = packetsLost / packetsSent * 100;
    }

    let intervalPacketLoss, intervalPacketsSent, intervalPacketsLost;
    if (lastResultRemoteSource) {
      const previousPacketsSent = lastResultSource.packetsSent;
      const previousPacketsLost = lastResultRemoteSource.packetsLost;
      intervalPacketsSent = packetsSent - previousPacketsSent;
      intervalPacketsLost = packetsLost - previousPacketsLost;
      intervalPacketLoss = intervalPacketsLost / intervalPacketsSent * 100;
    }

    let echoReturnLoss, echoReturnLossEnhancement, audioLevel, totalAudioEnergy;
    if (track && kind === 'audio') {
      if (track.remoteSource) {
        audioLevel = track.audioLevel;
        totalAudioEnergy = track.totalAudioEnergy;
      } else {
        echoReturnLoss = track.echoReturnLoss;
        echoReturnLossEnhancement = track.echoReturnLossEnhancement;
      }
    }

    if (kind === 'audio' && mediaSource && (!track || !track.remoteSource)) {
      audioLevel = mediaSource.audioLevel;
      totalAudioEnergy = mediaSource.totalAudioEnergy;
    }

    let codecLabel;
    if (codec) {
      codecLabel = `${codec.payloadType} ${codec.mimeType} ${codec.clockRate}`;
    }

    const trackInfo = {
      track: track && track.trackIdentifier,
      kind,
      bitrate,
      roundTripTime,
      bytes,
      jitter,
      packetLoss,
      intervalPacketLoss,
      echoReturnLoss,
      echoReturnLossEnhancement,
      audioLevel,
      totalAudioEnergy,
      codec: codecLabel
    };

    // remove undefined properties
    Object.keys(trackInfo).forEach(key => trackInfo[key] === undefined && delete trackInfo[key]);

    if (isOutbound) {
      event.tracks.push(trackInfo);
    } else {
      event.remoteTracks.push(trackInfo);
    }
  }

  _createStatsReport (results, updateLastResult) {
    const event = {
      name: 'getStats',
      session: this.session,
      initiator: this.initiator,
      conference: this.conference,
      tracks: [],
      remoteTracks: []
    };

    results = this._polyFillStats(results);

    const sources = results.filter(r => ['inbound-rtp', 'outbound-rtp'].indexOf(r.value.type) > -1);

    sources.forEach(source => {
      this._processSource({
        source: source.value,
        event,
        results
      });
    });

    const candidatePair = results.find(r => r.value.type === 'candidate-pair' && r.value.state === 'succeeded');
    if (candidatePair) {
      this._processSelectedCandidatePair({ report: candidatePair.value, event, results });
    }

    if (updateLastResult) {
      this.lastResult = results;
    }

    return event;
  }

  collectTraces () {
    this.connection.on('PeerConnectionTrace', (data) => {
      this.traceData.push(data);
    });

    this.connection.on('error', () => {
      this.emit('traces', {
        name: 'trace',
        session: this.session,
        initiator: this.initiator,
        conference: this.conference,
        traces: this.traceData
      });
    });
  }

  collectStats () {
    this.connection.on('iceConnectionStateChange', () => {
      const state = this.connection.iceConnectionState;

      if (state === 'connected' || state === 'completed') {
        if (this._pollingInterval !== null) {
          return;
        }

        const statsPoll = () => {
          this._gatherStats().then((reports) => {
            const event = this._createStatsReport(reports, true);
            if (event.tracks.length > 0 || event.remoteTracks.length > 0) {
              this.emit('stats', event);
            }
          });
        };

        if (IS_BROWSER) {
          window.setTimeout(statsPoll, 0);
          this._pollingInterval = window.setInterval(statsPoll, this.statsInterval);
        }
      }

      if (state === 'disconnected') {
        if (this.connection.signalingState !== 'stable') {
          return;
        }

        this._gatherStats().then((reports) => {
          const event = this._createStatsReport(reports);
          event.type = 'iceDisconnected';
          this.emit('stats', event);
        });
      }

      if (state === 'closed') {
        if (this._pollingInterval) {
          if (IS_BROWSER) {
            window.clearInterval(this._pollingInterval);
          }
          this._pollingInterval = null;
        }
      }
    });
  }

  collectInitialConnectionStats () {
    this.connection.on('iceConnectionStateChange', () => {
      const state = this.connection.iceConnectionState;

      if (state === 'checking') {
        if (IS_BROWSER) {
          this._iceStartTime = window.performance.now();
        }
      }

      if (state === 'connected' || state === 'completed') {
        if (this._haveConnectionMetrics) {
          return;
        }

        this._haveConnectionMetrics = true;
        let userAgent, platform, cores;
        if (IS_BROWSER) {
          this._iceConnectionTime = window.performance.now() - this._iceStartTime;
          userAgent = window.navigator.userAgent;
          platform = window.navigator.platform;
          cores = window.navigator.hardwareConcurrency;
        }

        this._gatherStats().then((reports) => {
          const event = {
            name: 'connect',
            userAgent,
            platform,
            cores,
            session: this.session,
            initiator: this.initiator,
            conference: this.conference,
            connectTime: this._iceConnectionTime,
            hadLocalIPv6Candidate: this.connection.hadLocalIPv6Candidate,
            hadRemoteIPv6Candidate: this.connection.hadRemoteIPv6Candidate,
            hadLocalRelayCandidate: this.connection.hadLocalRelayCandidate,
            hadRemoteRelayCandidate: this.connection.hadremoteRelayCandidate
          };

          let activeCandidatePair = null;
          let activeCandidatePairId;
          reports.forEach(function ({ value }) {
            const report = value;
            const selected = report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded';

            if (selected) {
              activeCandidatePair = report;
            }

            if (report.selectedCandidatePairId) {
              activeCandidatePairId = report.selectedCandidatePairId;
            }
          });

          if (!activeCandidatePair && activeCandidatePairId) {
            const activeCandidatePair_ = reports.find(r => r.id === activeCandidatePairId);
            if (activeCandidatePair_) {
              activeCandidatePair = activeCandidatePair_.value;
            }
          }

          if (activeCandidatePair) {
            const localId = activeCandidatePair.localCandidateId;
            const remoteId = activeCandidatePair.remoteCandidateId;
            let localCandidate, remoteCandidate;

            reports.forEach(function ({ key, value }) {
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
                pair: activeCandidatePair
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
                  0: 'tls'
                };

                const priority = parseInt(localCandidate.priority, 10);
                event.turnType = turnTypes[priority >> 24];
                event.networkType = localCandidate.networkType;
              }

              event.usingIPv6 = localCandidate.ipAddress && localCandidate.ipAddress.indexOf('[') === 0;
            }
          }
          this.emit('stats', event);
        });
      }

      if (state === 'failed') {
        if (IS_BROWSER) {
          this._iceFailedTime = window.performance.now() - this._iceStartTime;
        }
        this._gatherStats().then((reports) => {
          const event = {
            name: 'failure',
            session: this.session,
            initiator: this.initiator,
            conference: this.conference,
            failTime: this._iceFailureTime,
            iceRW: 0,
            numLocalHostCandidates: 0,
            numLocalSrflxCandidates: 0,
            numLocalRelayCandidates: 0,
            numRemoteHostCandidates: 0,
            numRemoteSrflxCandidates: 0,
            numRemoteRelayCandidates: 0
          };

          const localCandidates = this.connection.pc.localDescription.sdp.split('\r\n').filter(function (line) {
            return line.indexOf('a=candidate:') > -1;
          });
          const remoteCandidates = this.connection.pc.remoteDescription.sdp.split('\r\n').filter(function (line) {
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
          this.emit('traces', {
            name: 'trace',
            session: this.session,
            initiator: this.initiator,
            conference: this.conference,
            traces: this.traceData
          });
        });
      }
    });
  }
}

module.exports = StatsGatherer;
