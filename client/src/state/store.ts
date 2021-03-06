import { createStore, StoreState, StoreDispatch, ModelStore } from '@captaincodeman/rdx'
import { devtools, persist} from '@captaincodeman/rdx'
import { config } from './config'

let _store = createStore(config)

// These could be commented out if the extra functionality
// wasn't required, to create a production bundle without
// the redux devtools enabled for instance. This could be
// controlled using rollup with the replace plugin, e.g.
//
// if (process.env.NODE_ENV !== 'production') {
//   store = devtools(store)
// }
//
// the bundle size becomes 7.39 Kb minified, 2.81 Kb gzipped

_store = devtools(_store);
_store = persist(_store);

export const store = _store

export interface State extends StoreState<typeof config> {}
export interface Dispatch extends StoreDispatch<typeof config> {}
export interface Store extends ModelStore<Dispatch, State> {}
