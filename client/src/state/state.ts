export interface Student {
  account: string
  firstName: string
  lastName: string
  gender: string
  birthday: string
  clazz: string
}

export interface StudentsState {
  entities: Student[]
  filtered: Student[]
  filter: string
  timestamp: number
  loading: boolean
  error: string
}

export interface Diff {
  account: string
  change: string
  firstName: string
  firstNameE: string
  lastName: string
  lastNameE: string
  gender: string
  genderE: string
  birthday: string
  birthdayE: string
  clazz: string
  clazzE: string
  kept: number
}

export interface DiffState {
  entities: Diff[]
  added: number
  changed: number
  removed: number
  kept: number
  timestamp: number
  loading: boolean
  syncing: boolean
  report: string
  error: string
}

export interface TaskReportState {
  report: []
  timestamp: number
  executing: boolean
  error: string
}

export interface ConfigState {
  config: object
  reading: boolean
  writing: boolean
}
