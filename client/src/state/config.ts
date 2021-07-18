import createMatcher from '@captaincodeman/router'
import { routingPlugin } from '@captaincodeman/rdx'
import * as models from './models'

const routes = {
  '/sync/':                  'page-main',
  '/sync/asv':               'page-asv',
  '/sync/untis':             'page-untis',
  '/sync/paedml':            'page-paedml',
  '/sync/webuntis':          'page-webuntis',
  '/sync/asvuntis':          'page-asvuntis',
  '/sync/asvpaedml':         'page-asvpaedml',
  '/sync/asvwebuntis':       'page-asvwebuntis',
  '/sync/config':            'page-config',
  '/sync/*':                 'not-found',
};

const matcher = createMatcher(routes)
const routing = routingPlugin(matcher)

export const config = { models, plugins: { routing } }
