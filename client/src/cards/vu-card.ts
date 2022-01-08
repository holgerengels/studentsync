import {LitElement, html, css} from 'lit';
import {customElement, property} from "lit/decorators.js";

import '@material/mwc-linear-progress';
import {colorStyles, fontStyles} from "../sync-styles";

@customElement('vu-card')
export class VuCard extends LitElement {
  @property()
  loading: boolean = false;

  @property()
  error: string = "";

  @property()
  _color: string = "primary";
  set color(value: string) {
    this._color = value;
    switch (this._color) {
      case "primary":
        this.style.setProperty('--color-opaque', "var(--color-primary-dark)");
        this.style.setProperty('--color-light', "var(--color-primary-light)");
        this.style.setProperty('--color-lightest', "var(--color-primary-lighter)");
        break;
      case "secondary":
        this.style.setProperty('--color-opaque', "var(--color-secondary-dark)");
        this.style.setProperty('--color-light', "var(--color-secondary-light)");
        this.style.setProperty('--color-lightest', "var(--color-secondary-lighter)");
        break;
      case "tertiary":
        this.style.setProperty('--color-opaque', "var(--color-tertiary-dark)");
        this.style.setProperty('--color-light', "var(--color-tertiary-light)");
        this.style.setProperty('--color-lightest', "var(--color-tertiary-lighter)");
        break;
    }
  }

  // language=CSS
  static styles = [
    fontStyles,
    colorStyles,
    css`
      :host {
        display: block;
        box-sizing: border-box;
        border-radius: 4px;
        box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.14),
        0 1px 5px 0 rgba(0, 0, 0, 0.12),
        0 3px 1px -2px rgba(0, 0, 0, 0.2);
        color: var(--color-darkgray);
        --color-opaque: var(--color-primary-dark);
        --color-light: var(--color-primary-light);
        --color-lightest: var(--color-primary-lighter);
      }
      .card-header {
        padding: 7px 12px;
        color: white;
        background-color: var(--color-opaque);
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
      }
      .card-content {
        padding: 8px;
        background-color: var(--color-lightest);
        transition: height 1s ease-in-out;
      }
      .card-footer {
        color: var(--color-darkgray);
        background-color: var(--color-light);
        transition: background-color .5s ease-in-out;
        padding: 4px 8px;
        display: flex;
        flex-flow: row wrap;
        justify-content: flex-end;
        border-bottom-left-radius: 4px;
        border-bottom-right-radius: 4px;
      }
      .error {
        display: flex;
        flex-flow: row nowrap;
      }
      .error mwc-icon {
        flex: 0 0 auto;
      }
      .error span {
        margin-left: 8px;
        flex: 1 1 auto;
        word-wrap: break-word;
        overflow-wrap: break-word;
        width: 200px;
      }
      [hidden] {
        display: none;
      }
  `];

  render() {
    return html`
        <div class="card-header">
          <slot name="header"></slot>
        </div>
        <div class="card-content">
          <slot ?hidden="${this.loading || this.error}" name="content"></slot>
          <div class="error" ?hidden="${!this.error}">
              <mwc-icon>error_outline</mwc-icon>
              <span>${this.error}</span>
          </div>
          <mwc-linear-progress ?hidden="${!this.loading}" indeterminate></mwc-linear-progress>
        </div>
        <div class="card-footer">
          <slot name="footer"></slot>
        </div>
    `;
  }
}
