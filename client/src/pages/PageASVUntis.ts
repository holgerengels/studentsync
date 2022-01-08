import {LitElement, html, css, PropertyValues} from 'lit';
import {customElement, query, state} from "lit/decorators.js";
import {map} from 'lit/directives/map.js';
import { connect } from '@captaincodeman/rdx'
import { store, State } from '../state/store'

import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import {colorStyles, fontStyles} from "../sync-styles";
import {Diff} from "../state/state";
import {helperStyles, renderDiff} from "./mergehelper";
import {endpoint} from "../state/endpoint";
import {TopAppBar} from "@material/mwc-top-app-bar";

@customElement('page-asvuntis')
export class PageASVUntis extends connect(store, LitElement) {
  @state()
  // @ts-ignore
  private _loading: boolean = false;

  @state()
  private _diffs: Diff[] = [];

  @state()
  private _error: string = "";

  @query('#download')
  private _download: HTMLAnchorElement;

  @query('#bar')
  private _bar: TopAppBar;

  protected firstUpdated(_changedProperties: PropertyValues) {
    this._bar.scrollTarget = this;
  }

  mapState(state: State) {
    return {
      _loading: state.asvuntis.loading,
      _diffs: state.asvuntis.entities,
      _error: state.asvuntis.error,
    }
  }

  // language=CSS
  static styles = [
    fontStyles,
    colorStyles,
    helperStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
      }
      .board {
        height: 100%;
      }
      .ee {
        text-decoration: line-through;
      }
      [hidden] {
        display: none;
      }
      .message {
        margin: 16px;
      }
  `];

  render() {
    // language=HTML
    return html`
      <mwc-top-app-bar id="bar" dense>
        <mwc-icon-button icon="menu" slot="navigationIcon" @click="${() => this._fire('toggleDrawer')}"></mwc-icon-button>
        <div slot="title">ASV → Untis</div>
        <a id="download" href="${endpoint.diff('asv', 'untis') + '&file=untis-import&referer=' + location.origin}" download="added.csv" hidden></a>
        <mwc-icon-button icon="save_alt" slot="actionItems" title="Untis Import" @click="${() => this._download.click()}"></mwc-icon-button>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.asvuntis.load}"></mwc-icon-button>
      </mwc-top-app-bar>
      <div class="board">
        ${!this._error ? html`${map(this._diffs, renderDiff)}` : html`
        <div class="message">
            <b>Fehlermeldung</b><br/><br/>
            ${this._error}
        </div>
      `}
      </div>
    `;
  }

  _fire(name) {
    this.dispatchEvent(new CustomEvent(name, {bubbles: true, composed: true}));
  }
}
