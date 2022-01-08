import {LitElement, html, css} from 'lit';
import {customElement, query, state} from "lit/decorators.js";
import { connect } from '@captaincodeman/rdx'
import { store, State } from '../state/store'
import {DiffState} from "../state/state";
import {TaskReportState} from "../state/state";

import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import '../cards/diff-card';
import '../cards/task-card';
import {colorStyles, fontStyles} from "../sync-styles";
import {endpoint} from "../state/endpoint";


@customElement('page-main')
export class PageMain extends connect(store, LitElement) {
  @state()
  private _asvuntis: DiffState = <DiffState>{};
  @state()
  private _asvwebuntis: DiffState = <DiffState>{};
  @state()
  private _asvpaedml: DiffState = <DiffState>{};
  @state()
  private _idgenerator: TaskReportState = <TaskReportState>{};
  @state()
  private _groupmapping: TaskReportState = <TaskReportState>{};
  @state()
  private _paedmlfixes: TaskReportState = <TaskReportState>{};
  @state()
  private _teacherids: TaskReportState = <TaskReportState>{};
  @state()
  private _exitdatesync: TaskReportState = <TaskReportState>{};
  @state()
  private _devicereport: TaskReportState = <TaskReportState>{};

  @query('#download')
  private _download: HTMLAnchorElement;

  mapState(state: State) {
    return {
      // @ts-ignore
      route: state.routing,
      _asvuntis: state.asvuntis,
      _asvwebuntis: state.asvwebuntis,
      _asvpaedml: state.asvpaedml,
      _idgenerator: state.idgenerator,
      _groupmapping: state.groupmapping,
      _paedmlfixes: state.paedmlfixes,
      _teacherids: state.teacherids,
      _exitdatesync: state.exitdatesync,
      _devicereport: state.devicereport,
    }
  }

  // language=CSS
  static styles = [
    fontStyles,
    colorStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
      }
      .board {
        display: flex;
        flex-flow: row wrap;
        align-items: stretch;
      }
      .board > * {
        margin: 12px;
        width: 320px;
      }
      diff-card mwc-icon-button {
        --mdc-icon-button-size: 24px;
      }
  `];

  render() {
    // language=HTML
    return html`
      <mwc-top-app-bar id="bar" dense>
        <mwc-icon-button icon="menu" slot="navigationIcon" @click="${() => this._fire('toggleDrawer')}"></mwc-icon-button>
        <div slot="title">Home</div>
      </mwc-top-app-bar>
      <div class="board">
        <diff-card from="ASV" to="Untis" .diff="${this._asvuntis}" .load="${store.dispatch.asvuntis.load}" .sync="${store.dispatch.asvuntis.sync}" list="/sync/asvuntis" color="tertiary">
            <a id="download"  slot="actions" href="${endpoint.diff('asv', 'untis') + '&file=untis-import&referer=' + location.origin}" download="added.csv" referrerpolicy="origin" hidden></a>
            <mwc-icon-button icon="save_alt" slot="actions" title="Untis Import" @click="${() => this._download.click()}"></mwc-icon-button>
        </diff-card>
        <diff-card from="ASV" to="WebUntis" .diff="${this._asvwebuntis}" .load="${store.dispatch.asvwebuntis.load}" list="/sync/asvwebuntis" color="tertiary"></diff-card>
        <diff-card from="ASV" to="PaedML" .diff="${this._asvpaedml}" .load="${store.dispatch.asvpaedml.load}" .sync="${store.dispatch.asvpaedml.sync}" list="/sync/asvpaedml" color="tertiary"></diff-card>
        <task-card name="ASV ID-Generator" .report="${this._idgenerator}" .execute="${store.dispatch.idgenerator.execute}" color="secondary"></task-card>
        <task-card name="PaedML Gruppenzuordnung" .report="${this._groupmapping}" .execute="${store.dispatch.groupmapping.execute}" color="secondary"></task-card>
        <task-card name="PaedML Fixes" .report="${this._paedmlfixes}" .execute="${store.dispatch.paedmlfixes.execute}" color="secondary"></task-card>
        <task-card name="Lehrer Externe ID" .report="${this._teacherids}" .execute="${store.dispatch.teacherids.execute}" color="secondary"></task-card>
        <task-card name="WebUntis Austrittsdatum" .report="${this._exitdatesync}" .execute="${store.dispatch.exitdatesync.execute}" color="secondary"></task-card>
        <task-card name="Tablet Verbleib" .report="${this._devicereport}" .execute="${store.dispatch.devicereport.execute}" color="secondary"></task-card>
      </div>
    `;
  }

  _fire(name) {
    this.dispatchEvent(new CustomEvent(name, {bubbles: true, composed: true}));
  }
}
