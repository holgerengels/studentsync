import {LitElement, html, css, property, customElement} from 'lit-element';
import { connect } from '@captaincodeman/rdx'
import { store, State } from '../state/store'

import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import 'lit-virtualizer/lit-virtualizer';
import {colorStyles, fontStyles} from "../sync-styles";
import {Student} from "../state/state";
import {renderStudent, helperStyles} from "./helper";

@customElement('page-webuntis')
export class PageWebUntis extends connect(store, LitElement) {
  @property()
  // @ts-ignore
  private _loading: boolean = false;

  @property()
  private _showFilter: boolean = false;

  @property()
  private _students: Student[] = [];

  @property()
  private _error: string = "";

  constructor() {
    super();
    this._filter = this._debounce(this._filter.bind(this), 1000, false);
  }

  mapState(state: State) {
    return {
      _loading: state.webuntis.loading,
      _students: state.webuntis.filter !== "" ? state.webuntis.filtered : state.webuntis.entities,
      _error: state.webuntis.error,
    }
  }

  static get styles() {
    // language=CSS
    return [
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
        input {
          border: none;
          border-bottom: 2px solid white;
          background-color: transparent;
          color: white;
          outline: none;
          width: 100%;
        }
        [hidden] {
          display: none;
        }
        .message {
          margin: 16px;
        }
    `];
  }

  render() {
    // language=HTML
    return html`
      <mwc-top-app-bar id="bar" dense>
        <mwc-icon-button icon="menu" slot="navigationIcon" @click="${this._toggleDrawer}"></mwc-icon-button>
        <div slot="title" ?hidden="${this._showFilter}">WebUntis</div>
        <div slot="title" ?hidden="${!this._showFilter}"><input id="input" type="text" @input="${this._input}" @keydown="${this._keydown}"/></div>
        <mwc-icon-button icon="search" slot="actionItems" @click="${this._toggleFilter}"></mwc-icon-button>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.webuntis.load}"></mwc-icon-button>
      </mwc-top-app-bar>
      <div class="board">
      ${!this._error ? html`
        <lit-virtualizer style="height: 100%" .items=${this._students} .renderItem="${renderStudent}"></lit-virtualizer>
      ` : html`
        <div class="message">
            <b>Fehlermeldung</b><br/><br/>
            ${this._error}
        </div>
      `}
      </div>
    `;
  }

  _toggleFilter() {
    if (!this.shadowRoot) return;

    this._showFilter = !this._showFilter;
    if (this._showFilter) { // @ts-ignore
        this.shadowRoot.getElementById("input").focus();
      }
  }

  _keydown(e) {
    if (e.key === "Escape") {
      store.dispatch.webuntis.filter("");
      this._showFilter = false;
    }
  }
  _input(e) {
    this._filter(e.srcElement.value)
  }
  _filter(filter) {
    store.dispatch.webuntis.filter(filter);
  }
  _debounce(func, wait, immediate) {
    var timeout;
    return function (...args) {
      // @ts-ignore
      var context = this;
      var later = function () {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    }
  }

  _toggleDrawer() {
    this.dispatchEvent(new CustomEvent("toggleDrawer", {bubbles: true, composed: true}));
  }
}
