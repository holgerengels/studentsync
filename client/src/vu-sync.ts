import {LitElement, html, css, property, customElement} from 'lit-element';
import { connect } from '@captaincodeman/rdx'
import { RoutingState } from '@captaincodeman/rdx'
import { store, State } from './state/store'

import './pages/PageMain';
import './pages/PageASV';
import './pages/PageUntis';
import './pages/PagePaedML';
import './pages/PageWebUntis';
import './pages/PageASVUntis';
import './pages/PageASVPaedML';
import './pages/PageASVWebUntis';
import './pages/PageConfig';
import './sync-styles'

import '@material/mwc-drawer';
import {colorStyles, fontStyles} from "./sync-styles";

@customElement('vu-sync')
export class VuSync extends connect(store, LitElement) {
  @property()
  private _page: string = 'main';
  @property()
  private _drawerOpen: boolean = false;

  set route(val: RoutingState) {
    if (val.page !== this._page) {
      this._page = val.page
    }
  }
  mapState(state: State) {
    return {
      // @ts-ignore
      route: state.routing
    }
  }

  static get styles() {
    // language=CSS
    return [
      fontStyles,
      colorStyles,
      css`
        :host {
          display: contents;
          --app-drawer-background-color: var(--app-secondary-color);
          --app-drawer-text-color: var(--app-light-text-color);
          --app-drawer-selected-color: #c67100;
        }
        nav hr {
          border: 1px solid var(--color-mediumgray);
          margin: 8px 16px;
        }
        nav a {
          display: block;
          margin: 12px 16px;
          color: var(--color-primary-dark)
        }
        nav a[selected] {
          color: var(--color-primary-light);
        }
        nav a.secondary {
          display: block;
          color: var(--color-secondary-dark)
        }
        nav a.secondary[selected] {
          color: var(--color-secondary-light)
        }
        nav a.tertiary {
          display: block;
          color: var(--color-tertiary-dark)
        }
        nav a.tertiary[selected] {
          color: var(--color-tertiary-light)
        }
        .main-content {
          display: flex;
          height: 100%;
        }
        .main-content > * {
          flex: 1;
        }
    `];
  }

  render() {
    return html`
  <mwc-drawer id="drawer" hasheader type="dismissible" ?open="${this._drawerOpen}">
    <span slot="title">StudentSync</span>
    <div class="drawer-content">
      <nav class="drawer-list">
        <a ?selected="${this._page === 'page-main'}" href="/sync/" class="secondary">Home</a>
        <hr/>
        <a ?selected="${this._page === 'page-asv'}" href="/sync/asv">ASV</a>
        <a ?selected="${this._page === 'page-untis'}" href="/sync/untis">Untis</a>
        <a ?selected="${this._page === 'page-webuntis'}" href="/sync/webuntis">WebUntis</a>
        <a ?selected="${this._page === 'page-paedml'}" href="/sync/paedml">PaedML</a>
        <hr/>
        <a ?selected="${this._page === 'page-asvuntis'}" href="/sync/asvuntis" class="tertiary">ASV → Untis</a>
        <a ?selected="${this._page === 'page-asvwebuntis'}" href="/sync/asvwebuntis" class="tertiary">ASV → WebUntis</a>
        <a ?selected="${this._page === 'page-asvpaedml'}" href="/sync/asvpaedml" class="tertiary">ASV → PaedML</a>
        <hr/>
        <a ?selected="${this._page === 'page-config'}" href="/sync/config" class="secondary">Konfiguration</a>
      </nav>
    </div>

    <div slot="appContent" class="main-content" role="main" @toggleDrawer="${() => this._drawerOpen = !this._drawerOpen}">
        ${this._renderPage()}
    </div>
    </mwc-drawer>
    `;
  }

  _renderPage() {
    switch (this._page) {
      case 'page-main':
        return html`
          <page-main></page-main>
        `;
      case 'page-asv':
        return html`
          <page-asv></page-asv>
        `;
      case 'page-untis':
        return html`
          <page-untis></page-untis>
        `;
      case 'page-webuntis':
        return html`
          <page-webuntis></page-webuntis>
        `;
      case 'page-paedml':
        return html`
          <page-paedml></page-paedml>
        `;
      case 'page-asvuntis':
        return html`
          <page-asvuntis></page-asvuntis>
        `;
      case 'page-asvwebuntis':
        return html`
          <page-asvwebuntis></page-asvwebuntis>
        `;
      case 'page-asvpaedml':
        return html`
          <page-asvpaedml></page-asvpaedml>
        `;
      case 'page-config':
        return html`
          <page-config></page-config>
        `;
      default:
        return html`
          <p>Seite ${this._page} nicht gefunden. Vielleicht hilft es, <a href="/sync/">hier</a> drauf zu klicken!?</p>
        `;
    }
  }

  __onNavClicked(ev) {
    ev.preventDefault();
    this._page = ev.target.hash.substring(1);
  }
  _showLogin() {
  }
}
