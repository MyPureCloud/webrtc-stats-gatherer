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

export interface GetStatsEvent {
  name: string;
  type?: string;
  session: string;
  initiator: string;
  conference: string;
  tracks: TrackStats[];
  remoteTracks: TrackStats[];
  candidatePairHadActiveSource?: boolean;
  localCandidateChanged?: boolean;
  remoteCandidateChanged?: false;
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
