import { createModel, RoutingState } from '@captaincodeman/rdx';
import {Store} from '../store';
import {Diff, DiffState} from "../state";
import {endpoint} from "../endpoint";

export default createModel({
  state: <DiffState>{
    entities: [],
    added: 0,
    changed: 0,
    removed: 0,
    kept: 0,
    timestamp: 0,
    loading: false,
    report: "",
    syncing: false,
    error: "",
  },
  reducers: {
    requestDiff(state) {
      return { ...state, loading: true, error: "" };
    },
    receivedDiff(state, payload: Diff[]) {
      return { ...state,
        added: payload.filter(diff => diff.change === "added").length,
        changed: payload.filter(diff => diff.change === "changed").length,
        removed: payload.filter(diff => diff.change === "removed").length,
        kept: [...payload, {change: "kept", kept: 0}].filter(diff => diff.change === "kept")[0].kept,
        entities: payload.filter(diff => diff.change !== "kept"),
        report: "",
        timestamp: Date.now(),
        loading: false,
      };
    },
    error(state, message) {
      return { ...state,
        loading: false,
        syncing: false,
        error: message,
      }
    },
  },

  effects: (store: Store) => ({
    async load() {
      const dispatch = store.getDispatch();
      const state = store.getState();

      if (Date.now() - state.asvwebuntis.timestamp > 3000) {
        dispatch.asvwebuntis.requestDiff();
        // @ts-ignore
        const resp = await fetch(endpoint.diff("asv", "webuntis"), endpoint.get);
        if (resp.ok) {
          const json = await resp.json();
          dispatch.asvwebuntis.receivedDiff(json);
        }
        else {
          const message = await resp.text();
          // @ts-ignore
          dispatch.asvwebuntis.error(message);
        }
      }
    },

    'routing/change': async function(payload: RoutingState<string>) {
      const dispatch = store.getDispatch();

      switch (payload.page) {
        case 'page-main':
        case 'page-asvwebuntis':
          dispatch.asvwebuntis.load();
          break
      }
    }
  })
})
