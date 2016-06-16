import { EventEmitter } from 'events';

class StatsGatherer extends EventEmitter {
  constructor (peerConnection, opts = {}) {
    super();

    this.connection = peerConnection;
    this.session = opts.session;
    this.initiator = opts.initiator;
    this.conference = opts.conference;

    this.statsInterval = (opts.interval || 5) * 1000;
    this.lastResult = {};

    this._pollingInterval = null;

    this._haveConnectionMetrics = false;
    this._iceStartTime = null;
    this._iceConnectionTime = null;

    this.traceData = [];

    this.collectTraces();
  }

  _gatherStats () {
    return this.connection.pc.peerconnection.getStats(null);
  }

  _createStatsReport (results, updateLastResult) {
    const event = {
      name: 'getStats',
      session: this.session,
      initiator: this.initiator,
      conference: this.conference,
      tracks: []
    };

    Object.keys(results).forEach((key) => {
      const report = results[key];
      const now = report.timestamp;
      const track = report.trackIdentifier || report.googTrackId || report.id;
      let kind = report.mediaType;

      const local = (report.type === 'outboundrtp' && report.isRemote === false);
      const activeSource = (report.type === 'ssrc' && report.bytesSent);

      if (!local && !activeSource) {
        return;
      }

      if (!this.lastResult || !this.lastResult[report.id] || this.lastResult[report.id].timestamp >= now) {
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

      const bytes = report.bytesSent;
      const previousBytesSent = this.lastResult[report.id].bytesSent;
      const deltaTime = now - this.lastResult[report.id].timestamp;
      const bitrate = Math.floor(8 * (bytes - previousBytesSent) / deltaTime);

      let lost = 0;
      if (report.remoteId && results[report.remoteId]) {
        lost = results[report.remoteId].packetsLost;
      } else if (report.packetsLost) {
        lost = parseInt(report.packetsLost, 10);
      }

      event.tracks.push({ track, kind, bitrate, lost, muted });
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
      // Not interested in receive only streams
      if (this.connection.getLocalStreams().length === 0) {
        return;
      }

      const state = this.connection.iceConnectionState;

      if (state === 'connected' || state === 'completed') {
        if (this._pollingInterval !== null) {
          return;
        }

        const statsPoll = () => {
          this._gatherStats().then((reports) => {
            const event = this._createStatsReport(reports, true);
            if (event.tracks.length > 0) {
              this.emit('stats', event);
            }
          });
        };

        window.setTimeout(statsPoll, 0);
        this._pollingInterval = window.setInterval(statsPoll, this.statsInterval);
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
          window.clearInterval(this._pollingInterval);
          this._pollingInterval = null;
        }
      }
    });
  }

  collectInitialConnectionStats () {
    this.connection.on('iceConnectionStateChange', () => {
      const state = this.connection.iceConnectionState;

      if (state === 'checking') {
        this._iceStartTime = window.performance.now();
      }

      if (state === 'connected' || state === 'completed') {
        if (this._haveConnectionMetrics) {
          return;
        }

        this._haveConnectionMetrics = true;
        this._iceConnectionTime = window.performance.now() - this._iceStartTime;

        this._gatherStats().then((reports) => {
          const event = {
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

          let activeCandidatePair = null;
          Object.keys(reports).forEach(function (key) {
            const report = reports[key];

            const selected = (report.type === 'candidatepair' && report.selected);
            const chromeSelected = (report.type === 'googCandidatePair' && report.googActiveConnection === 'true');
            if (selected || chromeSelected) {
              activeCandidatePair = report;
            }
          });

          if (activeCandidatePair) {
            const localId = activeCandidatePair.localCandidateId;
            const remoteId = activeCandidatePair.remoteCandidateId;
            let localCandidate, remoteCandidate;

            Object.keys(reports).forEach(function (key) {
              const report = reports[key];
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
                const turnTypes = {
                  2: 'udp',
                  1: 'tcp',
                  0: 'tls'
                };

                const priority = parseInt(localCandidate.priority, 10);
                event.turnType = turnTypes[priority >> 24];
              }

              event.usingIPv6 = localCandidate.ipAddress && localCandidate.ipAddress.indexOf('[') === 0;
            }
          }

          this.emit('stats', event);
        });
      }

      if (state === 'failed') {
        this._iceFailedTime = window.performance.now() - this._iceStartTime;
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

          Object.keys(reports).forEach(function (key) {
            const report = reports[key];

            if (report.type === 'googCandidatePair') {
              if (report.googWritable === 'true' && report.googReadable === 'true') {
                event.iceRW++;
              }
            }
          });

          const localCandidates = this.connection.pc.localDescription.sdp.split('\r\n').filter(function (line) {
            return line.indexOf('a=candidate:');
          });
          const remoteCandidates = this.connection.pc.remoteDescription.sdp.split('\r\n').filter(function (line) {
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
