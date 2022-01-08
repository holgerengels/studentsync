import {LitElement, html, css, PropertyValues} from 'lit';
import {customElement, state, query} from "lit/decorators.js";
import {map} from 'lit/directives/map.js';
import { connect } from '@captaincodeman/rdx'
import { store, State } from '../state/store'

import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import {colorStyles, fontStyles} from "../sync-styles";
import {Student} from "../state/state";
import {renderStudent, helperStyles} from "./helper";
import {endpoint} from "../state/endpoint";
import {TopAppBar} from "@material/mwc-top-app-bar";

@customElement('page-untis')
export class PageUntis extends connect(store, LitElement) {
  @state()
  // @ts-ignore
  private _loading: boolean = false;

  @state()
  private _showFilter: boolean = false;

  @state()
  private _students: Student[] = [];

  @state()
  private _error: string = "";

  @query('#download')
  private _download: HTMLAnchorElement;

  @query('#bar')
  private _bar: TopAppBar;

  protected firstUpdated(_changedProperties: PropertyValues) {
    this._bar.scrollTarget = this;
  }

  constructor() {
    super();
    this._filter = this._debounce(this._filter.bind(this), 1000, false);
  }

  mapState(state: State) {
    return {
      _loading: state.untis.loading,
      _students: state.untis.filter !== "" ? state.untis.filtered : state.untis.entities,
      _error: state.untis.error,
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

  render() {
    // language=HTML
    return html`
      <mwc-top-app-bar id="bar" dense>
        <mwc-icon-button icon="menu" slot="navigationIcon" @click="${this._toggleDrawer}"></mwc-icon-button>
        <div slot="title" ?hidden="${this._showFilter}">Untis</div>
        <div slot="title" ?hidden="${!this._showFilter}"><input id="input" type="text" @input="${this._input}" @keydown="${this._keydown}"/></div>
        <mwc-icon-button icon="search" slot="actionItems" @click="${this._toggleFilter}"></mwc-icon-button>
        <a id="download"  slot="actions" href="${endpoint.list('untis') + '&file=csv&referer=' + location.origin}" download="students.csv" referrerpolicy="origin" hidden></a>
        <mwc-icon-button icon="save_alt" slot="actionItems" title="Untis Download" @click="${() => this._download.click()}"></mwc-icon-button>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.untis.load}"></mwc-icon-button>
      </mwc-top-app-bar>
      <div class="board">
      ${!this._error ? html`${map(this._students, renderStudent)}` : html`
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
    if (this._showFilter) {
      // @ts-ignore
      this.shadowRoot.getElementById("input").focus();
    }
  }

  _keydown(e) {
    if (e.key === "Escape") {
      store.dispatch.untis.filter("");
      this._showFilter = false;
    }
  }
  _input(e) {
    this._filter(e.srcElement.value)
  }
  _filter(filter) {
    store.dispatch.untis.filter(filter);
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
