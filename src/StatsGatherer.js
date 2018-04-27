import { EventEmitter } from 'events';

let IS_BROWSER;

class StatsGatherer extends EventEmitter {
  constructor (peerConnection, opts = {}) {
    IS_BROWSER = typeof window !== 'undefined';
    super();

    this.connection = peerConnection;
    this.session = opts.session;
    this.initiator = opts.initiator;
    this.conference = opts.conference;

    this.statsInterval = (opts.interval || 5) * 1000;
    this.lastResult = {};
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
    if (localId && report.type === 'localcandidate' && report.id === localId) {
      this.lastActiveLocalCandidate = report;
    }
    if (remoteId && report.type === 'remotecandidate' && report.id === remoteId) {
      this.lastActiveRemoteCandidate = report;
    }
  }

  _processReport ({ key, report, results, event }) {
    const now = new Date(report.timestamp);
    const track = report.trackIdentifier || report.googTrackId || key;
    let kind = report.mediaType;

    const activeSource = !!(report.type === 'ssrc' && (report.bytesSent || report.bytesReceived));

    if (!activeSource) {
      // if not active source, is this the active candidate pair?
      const selected = (report.type === 'candidatepair' && report.selected);
      const specSepected = report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded';
      const chromeSelected = (report.type === 'googCandidatePair' && report.googActiveConnection === 'true');

      if (selected || chromeSelected || specSepected) {
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
      }
      return;
    }

    const local = !!report.bytesSent;

    let lastResultReport;
    if (!this.lastResult) {
      return;
    }
    lastResultReport = this.lastResult.find && this.lastResult.find(r => r.key === key);
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

    let muted = false;
    // We still didn't find the media type, so the local track is muted
    if (!kind) {
      muted = true;
      // Try to guess the media type from the codec
      if (report.googCodecName) {
        const codec = report.googCodecName.toLowerCase();
        if (codec === 'vp8') {
          kind = 'video';
        } else if (codec === 'opus') {
          kind = 'audio';
        }
      }
    }

    const bytes = parseInt(local ? report.bytesSent : report.bytesReceived, 10) || 0;
    const previousBytesTotal = parseInt(local ? lastResultReport.bytesSent : lastResultReport.bytesReceived, 10) || 0;
    const deltaTime = now - new Date(lastResultReport.timestamp);
    const bitrate = Math.floor(8 * (bytes - previousBytesTotal) / deltaTime);
    const bytesSent = parseInt(report.bytesSent, 10) || -1;
    const bytesReceived = parseInt(report.bytesReceived, 10) || -1;

    const rtt = parseInt(report.googRtt || report.mozRtt || report.roundTripTime, 10) || -1;
    if (rtt !== -1) {
      event[`${kind}Rtt`] = rtt;
    }

    const jitter = parseInt(report.googJitterReceived || report.mozJitterReceived || report.jitter, 10) || -1;
    if (jitter !== -1) {
      event[`${kind}Jitter`] = jitter;
    }

    let lost = 0;
    let previousLost = 0;
    let total = 0;
    let previousTotal = 0;
    let remoteItem;

    remoteItem = results.find(r => r.key === report.remoteId);
    if (report.remoteId && remoteItem) {
      lost = remoteItem.packetsLost;
      previousLost = lastResultReport.packetsLost;

      if (lost < previousLost) {
        this.logger.warn('Possible stats bug: current lost should not be less than previousLost. Overriding current lost with previousLost.', {lost, previousLost});
        lost = previousLost;
        remoteItem.packetsLost = lost;
      }
    } else if (report.packetsLost || report.packetsSent || report.packetsReceived) {
      if (report.packetsLost) {
        lost = parseInt(report.packetsLost, 10) || 0;
        previousLost = parseInt(lastResultReport.packetsLost, 10) || 0;

        if (lost < previousLost) {
          this.logger.warn('Possible stats bug: current lost should not be less than previousLost. Overriding current lost with previousLost.', {lost, previousLost});
          lost = previousLost;
          report.packetsLost = `${lost}`;
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

    let loss = 0;
    if (total > 0) {
      loss = Math.floor((lost / total) * 100);
    }

    const intervalLoss = Math.floor((lost - previousLost) / (total - previousTotal) * 100) || 0;

    // TODO: for 2.0 - remove `lost` which is an integer of packets lost,
    // and use only `loss` which is percentage loss
    const trackInfo = {
      track,
      kind,
      bitrate,
      lost,
      muted,
      loss,
      intervalLoss,
      bytesSent,
      bytesReceived
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

    results.forEach(result => {
      this._processReport({
        key: result.key,
        report: result.value,
        results,
        event
      });
    });

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
          reports.forEach(function ({ key, value }) {
            const report = value;
            const selected = (report.type === 'candidatepair' && report.selected);
            const specSepected = report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded';
            const chromeSelected = (report.type === 'googCandidatePair' && report.googActiveConnection === 'true');
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
            activeCandidatePair = reports.find(r => r.value.id === activeCandidatePairId);
          }

          if (activeCandidatePair) {
            const localId = activeCandidatePair.localCandidateId;
            const remoteId = activeCandidatePair.remoteCandidateId;
            let localCandidate, remoteCandidate;

            reports.forEach(function ({ key, value }) {
              const report = value;
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

          reports.forEach(function ({ key, value }) {
            const report = value;
            if (report.type === 'googCandidatePair') {
              if (report.googWritable === 'true' && report.googReadable === 'true') {
                event.iceRW++;
              }
            }
          });

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

export default StatsGatherer;
