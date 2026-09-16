export interface VoteHistory {
  index: number
  timestamp: string
  planet: string
  voter: string
  voter_tag: string
  candidate: string
  votes: number
}

/** voting.mc `config`. */

export interface VotingConfig {
  max_votes: number
  paused: number
  decay_per_day: string
}

/** voting.mc `candidates`: votes cast through Mission Control, per planet. */

export interface PlanetCandidate {
  wallet: string
  planet: string
  votes: number
  last_decay: string
}

/** dao.worlds `candidates` (scope = planet). */

export interface DaoCandidate {
  candidate_name: string
  is_active: number
  number_voters: number
  rank: number
}

/** Candidate profile from the Alien Worlds DAO API. */

export interface CandidateProfile {
  account: string
  givenName?: string
  description?: string
  image?: string
}

/** members.mc `reasons`: preset flag reasons for the support team. */
