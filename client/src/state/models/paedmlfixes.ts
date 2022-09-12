import {createModel} from '@captaincodeman/rdx';
import {Store} from '../store';
import {TaskReportState} from "../state";
import {endpoint} from "../endpoint";

export default createModel({
  state: <TaskReportState>{
    report: [],
    timestamp: 0,
    executing: false,
    error: "",
  },
  reducers: {
    request(state) {
      return {
        ...state,
        report: [],
        executing: true,
        error: "",
      };
    },
    receivedReport(state, payload: []) {
      return { ...state,
        report: payload,
        timestamp: Date.now(),
        executing: false,
      };
    },
    error(state, message) {
      return { ...state,
        executing: false,
        error: message,
      }
    },
  },

  effects: (store: Store) => ({
    async execute() {
      const dispatch = store.getDispatch();

      dispatch.paedmlfixes.request();
      // @ts-ignore
      const resp = await fetch(endpoint.task("paedml-fixes"), endpoint.get);
      if (resp.ok) {
        const json = await resp.json();
        // @ts-ignore
        dispatch.paedmlfixes.receivedReport(json);
      }
      else {
        const message = await resp.text();
        // @ts-ignore
        dispatch.paedmlfixes.error(message);
      }
    },
    /*
    'routing/change': async function(payload: RoutingState<string>) {
      const dispatch = store.getDispatch();

      switch (payload.page) {
        case 'page-main':
          dispatch.paedmlfixes.execute();
          break
      }
    }
    */
  })
})
