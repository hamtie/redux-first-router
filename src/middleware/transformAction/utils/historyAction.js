import { createPrev } from '../../../core'
import { urlToAction, isNotFound } from '../../../utils'
import { nestAction, createNotFoundRoute } from './index'

export default (req, action) => {
  req.route = req.routes[action.type]

  const { nextHistory } = req.action
  const curr = req.getLocation()

  nextHistory.location.state = action.state || nextHistory.location.state

  let prev = nextHistory.kind === 'load' ? curr.prev : curr
  let from

  if (isNotFound(action)) {
    req.action = action
    action.type = createNotFoundRoute(req, prev).type                      // type may have changed to scene-level NOT_FOUND
  }

  // for specialty `history.reset` and `history.jump` methods/actionCreators, we gotta jump through a few
  // hoops to reconcile actions and state to match what would be logical. The below code in combination with
  // History.js re-creates the previous entry based on which direction (back or next) was determined to be going.
  if (/jump|reset/.test(nextHistory.kind)) {
    // find previous location entry based on the desired direction to pretend to be going
    const { entries, index, length, manualKind } = nextHistory

    let prevIndex = manualKind === 'next' ? index - 1 : index + 1

    if (manualKind === 'replace') {
      prevIndex = curr.direction === 'forward' ? index - 1 : index + 1
      if (entries[index].url !== curr.url) {
        from = curr
      }
    }

    const prevLocation = entries[prevIndex]
    const universal = !!curr.universal

    if (prevLocation) {
      // build the action for that entry, and create what the resulting state shape would have looked like
      const { routes, history, options } = req
      const prevAction = urlToAction(prevLocation, routes, options)
      const act = nestAction(req, prevAction, {}, history)

      // do what the location reducer does where it maps `...action.location` flatly on to `action`
      prev = Object.assign({}, act, act.location)

      prev.entries = nextHistory.kind === 'reset' ? entries : history.entries // on reset, use next history's entries for previous state, or the entries may not match
      prev.length = length
      prev.universal = universal
      prev.index = prevIndex
      prev.url = prevLocation.url
      prev.basename = prevLocation.basename
      // prev.search = prevLocation.search
      // prev.pathname = prevLocation.pathname
      prev.state = prevLocation.state || {}
    }
    else prev = createPrev(universal)
  }
  else if (nextHistory.kind === 'replace') {
    prev = curr.prev    // keep previous prev state to reflect how the end user perceives the app
    from = curr         // but provide access to what the state was in the `from` key for user by developers
  }

  req.action = nestAction(req, action, prev, nextHistory, from)          // replace history-triggered action with real action intended for reducers

  return req
}
