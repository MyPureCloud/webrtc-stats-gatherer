export interface StatsEvent {
  name: string;
  session?: string;
  conference?: string;
  initiator?: string;
}

export interface StatsConnectEvent extends StatsEvent {
  name: 'connect';
  userAgent: string;
  platform: string;
  cores: number;
  connectTime: number;
  localCandidateType?: string;
  remoteCandidateType?: string;
  candidatePair?: string;
  candidatePairDetails?: {
    local?: {
      id?: string;
      timestamp?: number;
      type?: string;
      transportId?: string;
      isRemote?: boolean;
      networkType?: string;
      ip?: string;
      port?: number;
      protocol?: string;
      candidateType?: string;
      priority?: number;
      deleted?: boolean;
    };
    remote?: {
      id?: string;
      timestamp?: number;
      type?: string;
      transportId?: string;
      isRemote?: boolean;
      ip?: string;
      port?: number;
      protocol?: string;
      candidateType?: string;
      priority?: number;
      deleted?: boolean;
    };
    pair?: {
      id?: string;
      timestamp?: number;
      type?: string;
      transportId?: string;
      localCandidateId?: string;
      remoteCandidateId?: string;
      state?: string;
      priority?: number;
      nominated?: boolean;
      writable?: boolean;
      bytesSent?: number;
      bytesReceived?: number;
      totalRoundTripTime?: number;
      currentRoundTripTime?: number;
      availableOutgoingBitrate?: number;
      requestsReceived?: number;
      requestsSent?: number;
      responsesReceived?: number;
      responsesSent?: number;
      consentRequestsSent?: number;
    };
  };
  transport?: string;
  networkType?: string;
}

export interface FailureEvent extends StatsEvent {
  name: 'failure';
  failTime: number;
  iceRW?: number;
  numLocalHostCandidates?: number;
  numLocalSrflxCandidates?: number;
  numLocalRelayCandidates?: number;
  numRemoteHostCandidates?: number;
  numRemoteSrflxCandidates?: number;
  numRemoteRelayCandidates?: number;
}

export interface GetStatsEvent extends StatsEvent {
  name: 'getStats';
  tracks: TrackStats[];
  remoteTracks: TrackStats[];
  type?: string;
  candidatePairHadActiveSource?: boolean;
  localCandidateChanged?: boolean;
  remoteCandidateChanged?: boolean;
  networkType?: string;
  candidatePair?: string;
  bytesSent?: number;
  bytesReceived?: number;
  requestsReceived?: number;
  requestsSent?: number;
  responsesReceived?: number;
  responsesSent?: number;
  consentRequestsSent?: number;
  totalRoundTripTime?: number;
}

export interface TrackStats {
  track: string;
  kind: 'audio' | 'video';
  bytes: number;
  codec?: string;
  bitrate?: number;
  jitter?: number;
  roundTripTime: number;

  packetsSent?: number;
  packetsLost: number;
  packetLoss: number;
  intervalPacketsSent?: number;
  intervalPacketsLost?: number;
  intervalPacketLoss?: number;

  retransmittedBytesSent?: number;
  retransmittedPacketsSent?: number;

  packetsReceived?: number;
  intervalPacketsReceived?: number;

  audioLevel?: number;
  totalAudioEnergy?: number;
  echoReturnLoss?: number;
  echoReturnLossEnhancement?: number;
}
