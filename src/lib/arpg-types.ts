export type SeasonLaunch = {
  name: string
  /** Game patch / client version at league or season launch (PoE1, PoE2, Last Epoch). */
  version?: string
  date_utc: string
}

export type ArpgSeasonsData = {
  diablo4: SeasonLaunch[]
  poe1: SeasonLaunch[]
  poe2: SeasonLaunch[]
  last_epoch: SeasonLaunch[]
}

export type GameId = keyof ArpgSeasonsData
