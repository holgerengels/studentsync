import {LitElement, html, css} from 'lit';
import {customElement, property, state} from "lit/decorators.js";
import '@material/mwc-icon-button';
import './vu-card';
import {DiffState} from "../state/state";

import '@material/mwc-icon';
import '@material/mwc-ripple';

@customElement('diff-card')
export class DiffCard extends LitElement {
  @property()
  from: string = "<name>";

  @property()
  to: string = "<to>";

  @property()
  color: string = "blue";

  @state()
  private _error: string = "";

  @property()
  list: string = "/";

  @property()
  _diff: DiffState = <DiffState>{};
  set diff(value: DiffState) {
    this._diff = value;
    this._error = value.error;
    this._loading = value.loading || value.syncing;
  }
  _loading: boolean = false;

  static NOOP: Function = function() {};

  @property()
  load: Function = DiffCard.NOOP;

  @property()
  _sync: Function = DiffCard.NOOP;
  set sync(value: Function) {
    this._sync = value;
    this._canSync = value !== DiffCard.NOOP;
  }
  _canSync: boolean = false;

  // language=CSS
  static styles = css`
    :host {
      display: block;
    }
    .box {
      min-width: 60px;
      border: 2px solid var(--color-mediumgray);
      text-align: center;
      padding: 4px;
    }
    .nobox {
      min-width: 60px;
      border: 2px solid var(--color-mediumgray);
      text-align: center;
      padding: 4px;
    }
    [hidden] {
      display: none;
    }
    mwc-icon-button, a[slot=footer] {
      --mdc-icon-button-size: 24px;
      margin-left: 8px;
    }
    a[slot=footer] {
      display: inline-block;
      color: unset;
    }
    a[slot=footer] mwc-icon {
      vertical-align: middle;
    }
  `;

  render() {
    // language=HTML
    return html`
        <vu-card .loading="${this._loading}" .error="${this._error}" .color="${this.color}">
            <span slot="header">${this.from} → ${this.to}</span>
            <table slot="content">
                <tr><th>${this.from}</th><td>&nbsp;→&nbsp;</td><th>${this.to}</th><th></th></tr>
                <tr ?hidden="${!this._diff.added}"><td class="box">${this._diff.added}</td><td></td><td class="nobox"></td><td>&nbsp;hinzufügen</td></tr>
                <tr ?hidden="${!this._diff.changed}"><td class="box">${this._diff.changed}</td><td>&nbsp;≠&nbsp;</td><td class="box">${this._diff.changed}</td><td>&nbsp;ändern</td></tr>
                <tr ?hidden="${!this._diff.kept}"><td class="box">${this._diff.kept}</td><td>&nbsp;=&nbsp;</td><td class="box">${this._diff.kept}</td></tr>
                <tr ?hidden="${!this._diff.removed}"><td class="nobox"></td><td></td><td class="box">${this._diff.removed}</td><td>&nbsp;löschen</td></tr>
            </table>
            <span slot="footer"><slot name="actions"></slot></span>
            <a slot="footer" href="${this.list}"><mwc-ripple></mwc-ripple><mwc-icon slot="footer" title="Abweichungen im Detail">list</mwc-icon></a>
            <mwc-icon-button slot="footer" icon="refresh" @click="${this.load}" title="Neu laden"></mwc-icon-button>
            <mwc-icon-button ?hidden="${!this._canSync}" slot="footer" icon="call_merge" @click="${this._sync}" title="Automatischer Abgleich"></mwc-icon-button>
        </vu-card>
    `;
  }
}
