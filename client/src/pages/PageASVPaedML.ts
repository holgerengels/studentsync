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
import {TopAppBar} from "@material/mwc-top-app-bar";

@customElement('page-asvpaedml')
export class PageASVPaedML extends connect(store, LitElement) {
  @state()
  // @ts-ignore
  private _loading: boolean = false;

  @state()
  private _diffs: Diff[] = [];

  @state()
  private _error: string = "";

  @query('#bar')
  private _bar: TopAppBar;

  protected firstUpdated(_changedProperties: PropertyValues) {
    this._bar.scrollTarget = this;
  }

  mapState(state: State) {
    return {
      _loading: state.asvpaedml.loading,
      _diffs: state.asvpaedml.entities,
      _error: state.asvpaedml.error,
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
        <div slot="title">ASV → PaedML</div>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.asvpaedml.load}"></mwc-icon-button>
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
