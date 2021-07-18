import { createModel, RoutingState } from '@captaincodeman/rdx';
import {Store} from '../store';
import {ConfigState} from "../state";
import {endpoint} from "../endpoint";

export default createModel({
  state: <ConfigState>{
    config: {},
    reading: false,
    writing: false,
  },
  reducers: {
    requestRead(state) {
      return { ...state, reading: true };
    },
    receivedRead(state, payload: object) {
      return { ...state,
        config: payload,
        reading: false,
      };
    },
    requestWrite(state) {
      return { ...state, writing: true };
    },
    receivedWrite(state) {
      return { ...state,
        writing: false,
      };
    },
  },

  effects: (store: Store) => ({
    async read() {
      const dispatch = store.getDispatch();

      dispatch.config.requestRead();
      // @ts-ignore
      const resp = await fetch(endpoint.settings("read"), endpoint.get);
      const json = await resp.json();
      dispatch.config.receivedRead(json);
    },
    async write(payload: object) {
      const dispatch = store.getDispatch();

      dispatch.config.requestWrite();
      // @ts-ignore
      const resp = await fetch(endpoint.settings("write"), {... endpoint.post, body: JSON.stringify(payload)});
      await resp.json();
      dispatch.config.receivedWrite();
    },

    'routing/change': async function(payload: RoutingState<string>) {
      const dispatch = store.getDispatch();

      switch (payload.page) {
        case 'page-config':
          dispatch.config.read();
          break
      }
    }
  })
})
