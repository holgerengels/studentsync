import { createModel, RoutingState } from '@captaincodeman/rdx';
import {Store} from '../store';
import { Student, StudentsState } from "../state";
import {endpoint} from "../endpoint";

export default createModel({
  state: <StudentsState>{
    entities: [],
    filtered: [],
    filter: "",
    timestamp: 0,
    loading: false,
    error: "",
  },
  reducers: {
    requestList(state) {
      return { ...state, loading: true, error: "" };
    },
    receivedList(state, payload: Student[]) {
      return { ...state,
        entities: payload,
        filtered: [],
        timestamp: Date.now(),
        loading: false,
      };
    },

    requestFiltered(state, payload: string) {
      return { ...state, filter: payload, loading: true, error: "" };
    },
    receivedFiltered(state, payload: Student[]) {
      return { ...state,
        filtered: payload,
        loading: false,
      };
    },
    unsetFilter(state) {
      return { ...state, filter: "", loading: false };
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

      if (Date.now() - state.untis.timestamp > 3000) {
        dispatch.untis.requestList();
        // @ts-ignore
        const resp = await fetch(endpoint.list("untis"), endpoint.get);
        if (resp.ok) {
          const json = await resp.json();
          dispatch.untis.receivedList(json);
        }
        else {
          const message = await resp.text();
          // @ts-ignore
          dispatch.untis.error(message);
        }
      }
    },

    async filter(payload: string) {
      const dispatch = store.getDispatch();

      if (payload && payload.length > 2) {
        dispatch.untis.requestFiltered(payload);
        // @ts-ignore
        const resp = await fetch(endpoint.filter("untis", payload), endpoint.get);
        if (resp.ok) {
          const json = await resp.json();
          dispatch.untis.receivedFiltered(json);
        }
        else {
          const message = await resp.text();
          // @ts-ignore
          dispatch.untis.error(message);
        }
      }
      else if (!payload || payload.length === 0) {
        dispatch.untis.unsetFilter();
        dispatch.untis.load();
      }
    },

    'routing/change': async function(payload: RoutingState<string>) {
      const dispatch = store.getDispatch();

      switch (payload.page) {
        case 'page-untis':
          dispatch.untis.load();
          break
      }
    }
  })
})
