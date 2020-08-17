import {LitElement, html, css, property, customElement} from 'lit-element';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import './vu-card';
import {TaskReportState} from "../state/state";

@customElement('task-card')
export class TaskCard extends LitElement {
  @property()
  name: string = "<name>";

  @property()
  color: string = "blue";

  @property()
  _error: string = "";

  @property()
  _lines: Object[] = [];

  @property()
  _report: TaskReportState = <TaskReportState>{};
  set report(value: TaskReportState) {
    this._report = value;
    this._error = value.error;
    let date = new Date(value.timestamp).toLocaleDateString() + " " + new Date(value.timestamp).toLocaleTimeString();
    this._lines = [...value.report, { key: "zuletzt ausgeführt", value: date}]
    this._executing = value.executing
  }
  _executing: boolean = false;

  @property()
  execute: Function = function() {};

  static get styles() {
    // language=CSS
    return css`
      :host {
        display: block;
      }
      mwc-icon-button {
        --mdc-icon-button-size: 24px;
      }
      li {
        list-style: none;
      }
      `;
    }

  render() {
    // language=HTML
    return html`
        <vu-card .loading="${this._executing}" .error="${this._error}" .color="${this.color}">
            <span slot="header">${this.name}</span>
            <div slot="content">
                ${this._lines.map((line) => html`
                  <li><b>${line['key']}:</b> ${line['value']}</li>
                `)}
            </div>
            <mwc-icon-button slot="footer" icon="play_arrow" @click="${this.execute}" title="Jetzt ausführen"></mwc-icon-button>
        </vu-card>
    `;
  }
}
