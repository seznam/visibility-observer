import insularObserverFactory from 'insular-observer'
import managedMapFactory from 'key-master'

export interface IOptions {
  rootMargin?: number | string
  threshold?: number | number[]
  once?: boolean
}

interface INormalizedOptions extends Required<IOptions> {
  rootMargin: string
}

interface IObservedElementOptions extends INormalizedOptions {
  unobserve: () => void
}

type Listener = (entry: IntersectionObserverEntry) => void
type ObserveCallback = (target: Element, listener: Listener) => UnobserveCallback
type UnobserveCallback = () => void

const observedElements = managedMapFactory(
  () => new Map<Listener, IObservedElementOptions>(),
  new WeakMap<Element, Map<Listener, IObservedElementOptions>>(),
)
const observers = new Map<string, ObserveCallback>()

export function observe<E extends Element>(
  target: E,
  callback: (visibilityEntry: IntersectionObserverEntry) => void,
  options: IOptions = {},
): void {
  const normalizedOptions = normalizeOptions(options)
  const elementCallbacks = observedElements.get(target)
  const existingConfiguration = elementCallbacks.get(callback)
  if (existingConfiguration) {
    if (areOptionsEqual(normalizedOptions, existingConfiguration)) {
      return
    }

    unobserve(target, callback)
  }

  const observeElement = getObserver(normalizedOptions)
  const unobserveCallback = observeElement(target, options.once ? onceObserver.bind(null, callback) : callback)
  elementCallbacks.set(callback, {
    ...normalizedOptions,
    unobserve: unobserveCallback,
  })
}

export function unobserve(
  target: Element,
  callback: (visibilityEntry: IntersectionObserverEntry) => void,
): void {
  const elementCallbacks = observedElements.getUnderlyingDataStructure().get(target)
  if (elementCallbacks) {
    const options = elementCallbacks.get(callback)
    if (options) {
      options.unobserve()
      elementCallbacks.delete(callback)
      if (!elementCallbacks.size) {
        observedElements.delete(target)
      }
    }
  }
}

/**
 * Performs equality checks for the provided options objects.
 *
 * @param options1 The first options object.
 * @param options2 The second options object.
 * @return <code>true</code> iff the options objects are considered strictly equal to each other.
 */
function areOptionsEqual(options1: INormalizedOptions, options2: INormalizedOptions): boolean {
  return (
    options1.rootMargin === options2.rootMargin &&
    options1.threshold === options2.threshold &&
    options1.once === options2.once
  )
}

/**
 * Wrapper for a listener callback used to make the provided callback being executed only once when the observed
 * element becomes visible and then being unregistered.
 *
 * This function is not meant to be used on it's own, it's expected to be bound to the actual callback to invoke and
 * then passed to the underlying observer.
 *
 * @param callback The callback to execute once the observed element is visible and should no longer be executed after
 *        that.
 * @param entry The observer's entry, provided by the observer when a change to the element's visibility is detected.
 */
function onceObserver(callback: Listener, entry: IntersectionObserverEntry): void {
  if (entry.isIntersecting) {
    unobserve(entry.target, callback)
    callback(entry)
  }
}

/**
 * Returns the insular observer to use for the provided options. The options are used as cache keys to re-use the
 * existing observers as much as possible.
 *
 * @param options The observer options, configuring its behavior.
 * @return The observer to use with the provided options.
 */
function getObserver(options: INormalizedOptions): ObserveCallback {
  const serializedOptions = `${options.rootMargin};${options.threshold};${options.once}`
  const observer = observers.get(serializedOptions)
  if (observer) {
    return observer
  }

  const newObserver = insularObserverFactory(IntersectionObserver, options)
  observers.set(serializedOptions, newObserver)
  return newObserver
}

function normalizeOptions(options: IOptions): INormalizedOptions {
  return {
    once: !!options.once,
    rootMargin: normalizeRootMargin(typeof options.rootMargin !== 'undefined' ? options.rootMargin : '0px 0px 0px 0px'),
    threshold: typeof options.threshold !== 'undefined' ? options.threshold : 0,
  }
}

function normalizeRootMargin(rootMargin: number | string) {
  const parts = (typeof rootMargin === 'number' ? `${rootMargin}px` : rootMargin).trim().split(/\s+/)
  if (parts.length > 4) {
    throw new TypeError(
      'Invalid root margin, expected a single number or a string containing 1 to 4 numbers suffixed by "px" or "%" ' +
      `and separated by whitespace: ${rootMargin}`,
    )
  }
  if (parts.length === 1) {
    parts.push(parts[0])
  }
  if (parts.length === 2) {
    parts.push(parts[0])
  }
  if (parts.length === 3) {
    parts.push(parts[1])
  }
  return parts.join(' ')
}
