import {createModel, RoutingState} from '@captaincodeman/rdx-model';
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
      const dispatch = store.dispatch();

      dispatch.teacherids.request();
      // @ts-ignore
      const resp = await fetch(endpoint.task("webuntis-external-id"), endpoint.get);
      if (resp.ok) {
        const json = await resp.json();
        // @ts-ignore
        dispatch.teacherids.receivedReport(json);
      }
      else {
        const message = await resp.text();
        // @ts-ignore
        dispatch.teacherids.error(message);
      }
    },

    'routing/change': async function(payload: RoutingState) {
      const dispatch = store.dispatch();

      switch (payload.page) {
        case 'page-main':
          dispatch.teacherids.execute();
          break
      }
    }
  })
})
